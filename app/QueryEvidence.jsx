export default function QueryEvidence({scope,calls,details}) {
  if(!calls?.some(c=>c.name.startsWith('query_')))return null;
  return <details style={{marginTop:12,whiteSpace:'normal',fontSize:11,color:'#94a3b8'}}>
    <summary style={{cursor:'pointer',color:'#a5b4fc'}}>Applied filters and calculation</summary>
    <div style={{paddingTop:8}}>
      <div>Executed server tool: {calls.map(c=>c.name).join(', ')}.</div>
      <ul style={{paddingLeft:18,margin:'6px 0'}}>{(scope||[]).map((line,i)=><li key={i}>{line}</li>)}</ul>
      {(details||[]).map((detail,i)=><div key={i} style={{margin:'10px 0'}}>
        {details.length>1&&<strong>{detail.title}</strong>}
        <ul style={{paddingLeft:18,margin:'6px 0'}}>{detail.notes.map((note,n)=><li key={n}>{note}</li>)}</ul>
        <details>
          <summary style={{cursor:'pointer'}}>Supporting values ({detail.rows.length})</summary>
          <ul style={{paddingLeft:18,maxHeight:260,overflowY:'auto',margin:'6px 0'}}>{detail.rows.map((row,n)=><li key={n}>{row}</li>)}</ul>
        </details>
      </div>)}
      <div>All displayed figures are calculated by server code from the synthetic records. Model-written numerical prose is not used.</div>
    </div>
  </details>;
}
