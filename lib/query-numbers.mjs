import { QueryError } from './query-contract.mjs';

const units=['zero','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
const tens=['twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
const powers={thousand:3,k:3,million:6,m:6,billion:9,b:9};
const mantissaPowers={...powers,hundred:2};
const words=[...units,...tens,'hundred',...Object.keys(powers),'point','decimal','half','halves','quarter','quarters','and','a','of','minus','negative'];
const atom=`(?:\\d+(?:[,.]\\d+)*|\\.\\d+|(?:${words.sort((a,b)=>b.length-a.length).join('|')})\\b)`;
const quantities=new RegExp(`(\\b(?:at most|at least|no more than|no fewer than|less than|more than|under|over|above|below|exactly|top)\\b|[<>]=?|=)\\s*\\$?\\s*([+-]?\\s*${atom}(?:(?:\\s+|-)${atom})*(?:(?:thousand|million|billion|hundred|[kmb])\\b)?)(?=$|\\s|[;,!?%)]|\\b)`,'g');
const invalid=()=>{throw new QueryError('Please clarify the complete numeric quantity, including its decimal and scale. No calculation was run.');};

function underHundred(tokens){
  if(tokens.length===1){
    if(units.includes(tokens[0]))return units.indexOf(tokens[0]);
    if(tens.includes(tokens[0]))return (tens.indexOf(tokens[0])+2)*10;
    if(/^\d+$/.test(tokens[0])&&Number(tokens[0])<100)return Number(tokens[0]);
    if(tokens[0]==='a')return 1;
  }
  if(tokens.length===2&&tens.includes(tokens[0])&&units.indexOf(tokens[1])>0&&units.indexOf(tokens[1])<10)return (tens.indexOf(tokens[0])+2)*10+units.indexOf(tokens[1]);
  return invalid();
}
function underThousand(tokens){
  const hundred=tokens.indexOf('hundred');
  if(hundred===-1)return underHundred(tokens);
  if(hundred!==1||tokens.lastIndexOf('hundred')!==hundred)return invalid();
  const multiplier=underHundred(tokens.slice(0,1));
  if(multiplier<1||multiplier>9)return invalid();
  let rest=tokens.slice(2);if(rest[0]==='and')rest=rest.slice(1);
  return multiplier*100+(rest.length?underHundred(rest):0);
}
function integerWords(tokens){
  if(tokens.length===1&&/^\d+$/.test(tokens[0]))return Number(tokens[0]);
  let total=0,start=0,previousPower=Infinity;
  for(let i=0;i<tokens.length;i++)if(tokens[i] in powers){
    const power=powers[tokens[i]];if(power>=previousPower)return invalid();
    let group=tokens.slice(start,i);if(group[0]==='and')group=group.slice(1);
    if(!group.length)return invalid();
    total+=underThousand(group)*10**power;previousPower=power;start=i+1;
  }
  let tail=tokens.slice(start);if(tail[0]==='and')tail=tail.slice(1);
  return total+(tail.length?underThousand(tail):0);
}
function fraction(tokens){
  if(tokens[0]==='a')tokens=['one',...tokens.slice(1)];
  if(tokens.length===1&&tokens[0]==='half')return '5';
  if(tokens.length===1&&tokens[0]==='quarter')return '25';
  if(tokens.length===2&&tokens[1]==='half'&&tokens[0]==='one')return '5';
  if(tokens.length===2&&/^quarters?$/.test(tokens[1]))return ({one:'25',two:'5',three:'75'})[tokens[0]];
  return undefined;
}
// Shift the decimal string before converting to Number. Multiplying a binary
// float such as 1.005 by a million can otherwise invent a threshold mismatch.
function shiftDecimal(text,power){
  const [whole,decimal='']=text.split('.'),digits=whole+decimal,point=whole.length+power;
  return point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point);
}
function plainNumber(value){
  const text=String(value);if(!/[eE]/.test(text))return text;
  const negative=value<0,parts=text.replace(/^-/,'').split('e'),exponent=Number(parts[1]);
  const [whole,decimal='']=parts[0].split('.'),digits=whole+decimal,point=whole.length+exponent;
  const expanded=point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point);
  return (negative?'-':'')+expanded;
}

export function parseWrittenQuantity(phrase){
  let text=phrase.trim().toLowerCase(),negative=false;
  if(/^[+-]/.test(text)){negative=text[0]==='-';text=text.slice(1).trim();}
  let tokens=text.split(/[\s-]+/).filter(Boolean);
  if(['minus','negative'].includes(tokens[0])){if(negative)return invalid();negative=true;tokens=tokens.slice(1);}
  if(!tokens.length)return invalid();
  // An attached numeric suffix is a scale, not a partial numeric token.
  const attached=tokens[0]?.match(/^([\d,.]+)(thousand|million|billion|hundred|[kmb])$/);
  if(attached)tokens=[attached[1],attached[2],...tokens.slice(1)];
  let power=0;
  const mantissa=tokens.some(t=>/^(?:point|decimal|half|halves|quarters?)$/.test(t))||/^[\d,.]+$/.test(tokens[0]);
  if(mantissa&&tokens.at(-1) in mantissaPowers){power=mantissaPowers[tokens.at(-1)];tokens=tokens.slice(0,-1);}
  let magnitude;
  if(tokens.length===1&&/^[\d,.]+$/.test(tokens[0])){
    if(!/^(?:\d+(?:\.\d+)?|\.\d+|\d{1,3}(?:,\d{3})+(?:\.\d+)?)$/.test(tokens[0]))return invalid();
    magnitude=tokens[0].replaceAll(',','');if(magnitude.startsWith('.'))magnitude='0'+magnitude;
  }else if(tokens.includes('point')||tokens.includes('decimal')){
    const points=tokens.map((t,i)=>['point','decimal'].includes(t)?i:-1).filter(i=>i>=0);if(points.length!==1)return invalid();
    const index=points[0],whole=index?integerWords(tokens.slice(0,index)):0,decimal=tokens.slice(index+1);
    if(!decimal.length)return invalid();
    let digits;
    if(decimal.every(t=>units.indexOf(t)>=0&&units.indexOf(t)<10||/^\d+$/.test(t)))digits=decimal.map(t=>/^\d+$/.test(t)?t:units.indexOf(t)).join('');
    else digits=String(underHundred(decimal));
    magnitude=whole+'.'+digits;
  }else if(tokens.some(t=>/^(?:half|halves|quarters?)$/.test(t))){
    while(['a','of'].includes(tokens.at(-1)))tokens=tokens.slice(0,-1);
    const and=tokens.lastIndexOf('and');
    const digits=fraction(and<0?tokens:tokens.slice(and+1));if(digits===undefined)return invalid();
    magnitude=(and<0?0:integerWords(tokens.slice(0,and)))+'.'+digits;
  }else magnitude=String(integerWords(tokens));
  // If the integer phrase already contained a scale, append the final scale
  // only for a single mantissa, never "one thousand million".
  if(power&&tokens.some(t=>t in powers))return invalid();
  const value=Number(shiftDecimal(magnitude,power))*(negative?-1:1);
  if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)return invalid();
  return value;
}

export function normalizeThresholdNumbers(text){
  return text.replace(quantities,(_,operator,candidate)=>{
    const tokens=candidate.trim().split(/\s+/),tail=[];
    // Conjunctions belong to the next measure, not the preceding quantity.
    while(['and','a','of'].includes(tokens.at(-1)))tail.unshift(tokens.pop());
    const value=parseWrittenQuantity(tokens.join(' '));
    return `${operator} ${plainNumber(value)}${tail.length?' '+tail.join(' '):''}`;
  });
}
