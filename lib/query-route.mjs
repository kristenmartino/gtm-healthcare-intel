import Anthropic from '@anthropic-ai/sdk';
import { NextResponse } from 'next/server.js';
import { checkRateLimit } from './rate-limit.mjs';
import { answerWithQueryTools } from './query-service.mjs';

export function createQueryRoute(domain,{makeClient=()=>new Anthropic({timeout:45_000,maxRetries:0})}={}){return async request=>{
  const rate=checkRateLimit(request,{limit:10,windowMs:60_000});
  if(!rate.ok)return NextResponse.json({error:'Too many requests. Please slow down.'},{status:429,headers:{'Retry-After':String(rate.retryAfter)}});
  let body;try{body=await request.json();}catch{return NextResponse.json({error:'Invalid JSON body'},{status:400});}
  if(typeof body?.question!=='string'||!body.question.trim())return NextResponse.json({error:"Missing or invalid 'question' field"},{status:400});
  if(body.question.length>2000)return NextResponse.json({error:'Question exceeds 2000-character limit'},{status:400});
  try{
    const client=makeClient();
    return NextResponse.json(await answerWithQueryTools({domain,question:body.question,client}));
  }catch(error){
    console.error('Validated query service failed:',error?.constructor?.name,error?.status||'');
    return NextResponse.json({error:'The question interpretation service is unavailable. Please try again. Scenario summaries remain available.'},{status:503});
  }
};}
