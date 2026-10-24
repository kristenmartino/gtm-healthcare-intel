import Ajv from 'ajv';
import { PRACTICE_DATA } from './practice-scenario.mjs';
import { PRACTICE_PROCEDURES } from './practice-aggregates.mjs';
import { GTM_DATA } from './gtm-scenario.mjs';

const choice = values => ({type:'string',enum:values});
const list = (items,maxItems=20) => ({type:'array',items,maxItems,uniqueItems:true});
const object = properties => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
export const PRACTICE_METRICS=['revenue','collections','patients','denials','noShows','collectionRatio','avgReimb','procedures','payerRevenue'];
export const GTM_METRICS=['bookings','pipeline','wins','losses','closed','winRate','avgACV','avgCycle','target','gap','quota','attainment','coverage','shortfall','nrr','customerChurn','customersStart','churned','mqls','sqls','demosBooked','pipelineGenerated','spend'];
const predicate = metric => object({metric,operator:choice(['none','lt','lte','eq','gte','gt']),value:{type:['number','null']}});
const ranking = metric => object({metric,direction:choice(['none','highest','lowest','both']),limit:{type:'integer',minimum:1,maximum:20},within:list(choice(['provider','month','quarter','payer','procedure','rep','specialty','source']),2)});
const practiceQuery=object({
  metric:choice(PRACTICE_METRICS),
  months:{...list({type:'integer',minimum:0,maximum:11},12),minItems:1},
  providers:list(choice(PRACTICE_DATA.providers),5),
  payers:list(choice(PRACTICE_DATA.payers),6),
  procedures:list(choice(PRACTICE_PROCEDURES),5),
  groupBy:list(choice(['provider','month','quarter','payer','procedure']),3),
  predicate:predicate(choice(PRACTICE_METRICS)),
  ranking:ranking(choice(PRACTICE_METRICS)),
});
const gtmQuery=object({
  report:choice(['performance','quota','retention','marketing','qbr']),
  quarters:{...list(choice(GTM_DATA.quarters),3),minItems:1},
  reps:list(choice(GTM_DATA.reps),6),specialties:list(choice(GTM_DATA.specialties),4),sources:list(choice(GTM_DATA.sources),5),
  groupBy:list(choice(['quarter','rep','specialty','source']),2),
  predicate:predicate(choice(GTM_METRICS)),ranking:ranking(choice(GTM_METRICS)),
});
export const TOOL_SCHEMAS={
  query_practice:object({queries:{type:'array',items:practiceQuery,minItems:1,maxItems:9},explain:{type:'boolean'}}),
  query_gtm:object({queries:{type:'array',items:gtmQuery,minItems:1,maxItems:4},explain:{type:'boolean'}}),
  request_clarification:object({reason:choice(['ambiguous_scope','unsupported_measure','unsupported_breakdown','unavailable_period','unknown_entity','missing_denominator','missing_evidence','patient_data','unsupported_operation'])}),
};
const ajv=new Ajv({allErrors:true,strict:true,allowUnionTypes:true});
const validators=Object.fromEntries(Object.entries(TOOL_SCHEMAS).map(([name,schema])=>[name,ajv.compile(schema)]));
export class QueryError extends Error {}
export function validateToolInput(name,input){
  const validate=validators[name];
  if(!validate||!validate(input))throw new QueryError('The requested calculation did not pass query validation. Please specify the measure, period, grouping and filters.');
}
// Strict generation uses the supported schema subset. Local validation above
// still enforces uniqueness, bounds and lengths before any calculation runs.
function generationSchema(value){
  if(Array.isArray(value))return value.map(generationSchema);
  if(!value||typeof value!=='object')return value;
  return Object.fromEntries(Object.entries(value).filter(([k])=>!['uniqueItems','minimum','maximum','minItems','maxItems'].includes(k)).map(([k,v])=>[k,generationSchema(v)]));
}
export function queryTools(domain){
  const name=domain==='practice'?'query_practice':'query_gtm';
  return [name,'request_clarification'].map(tool=>({name:tool,strict:true,input_schema:generationSchema(TOOL_SCHEMAS[tool]),description:tool==='request_clarification'?'Ask for clarification when an entity, period, operation or linkage is unavailable or ambiguous. Never silently drop a requested constraint.':`Calculate validated ${domain} queries from synthetic records. Each queries item is an independent measure scope. Empty entity filters mean all supplied entities. groupBy is the requested result grain. predicate filters aggregated groups BEFORE ranking; operator none requires value null. ranking direction none means no rank; limit 1 preserves all true ties. Rates use percent units, not fractions. Server executes and formats the answer; do not write a numerical answer yourself.`}));
}
