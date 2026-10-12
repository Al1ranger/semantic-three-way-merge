import {createClient} from 'genlayer-js';
import {studionet} from 'genlayer-js/chains';
import crypto from 'node:crypto';
const [address, creator, id, expected] = process.argv.slice(2);
const ascii = x => JSON.stringify(x).replace(/[\u007f-\uffff]/g, c => '\\u' + c.charCodeAt(0).toString(16).padStart(4,'0'));
const canonical = x => x === null || typeof x !== 'object' ? ascii(x) :
  Array.isArray(x) ? '[' + x.map(canonical).join(',') + ']' :
  '{' + Object.keys(x).sort().map(k => ascii(k) + ':' + canonical(x[k])).join(',') + '}';
const hash = x => crypto.createHash('sha256').update(canonical(x)).digest('hex');
function checkRoot(x) {const {root, ...body} = x; if (hash(body) !== root) throw Error('Root mismatch');}
const client = createClient({chain: studionet});
async function read(functionName, args) {
  try {return await client.readContract({address, functionName, args});}
  catch (error) {
    // Do not print SDK errors: RPC error receipts may contain private validator configuration.
    for (let e=error, depth=0; e && depth<8; e=e.cause,depth++) {
      const result=e.data?.receipt?.result;
      if (typeof result === 'string') {
        const expected=Buffer.from(result,'base64').toString('utf8').match(/\[EXPECTED\][^\x00\r\n]{0,180}/)?.[0];
        if(expected) throw Error(expected);
      }
    }
    throw Error('Contract read failed: '+functionName+'; inspect sanitized receipt metadata');
  }
}
const key=await read('job_key',[creator,id]);
const job=await read('get_job',[key]);
if(job.spec.key!==key || job.spec.id!==id || hash(job.spec)!==job.spec_root) throw Error('Spec binding');
if(expected && job.state!==expected) throw Error('Unexpected state: '+job.state);
for(const [i,r] of job.attempts.entries()){
  checkRoot(r);
  if(r.binding.job!==key || r.binding.spec_root!==job.spec_root || r.binding.attempt!==i) throw Error('Report binding');
  if(r.documents.length) {
    if(r.documents.length!==3 || r.sources.length!==3) throw Error('Source count');
    r.sources.forEach((s,slot)=>{
      if(s.slot!==slot || s.hash!==job.spec.hashes[slot] || s.http!==200) throw Error('Source hash');
    });
    r.rows.forEach(row=>{
      if(row.values.some((text,slot)=>text!==(r.documents[slot][row.id]??null))) throw Error('Row provenance');
    });
  }
}
let artifact=null;
if(job.state==='MERGED'){
  artifact=await read('get_artifact',[key]);checkRoot(artifact);
  const r=job.attempts.at(-1);
  if(artifact.job!==key || artifact.root!==job.artifact_root || artifact.report_root!==r.root
    || artifact.spec_root!==job.spec_root || canonical(artifact.documents)!==canonical(r.merged)
    || canonical(artifact.source_hashes)!==canonical(job.spec.hashes)) throw Error('Artifact binding');
  for(const row of artifact.documents){
    if(row.text!==r.documents[row.slot][row.id]) throw Error('Invented output text');
    const lookup=await read('get_record',[key,row.id]);
    if(canonical(lookup.record)!==canonical(row) || lookup.artifact_root!==artifact.root) throw Error('Consumer lookup');
  }
}else{
  if(job.artifact_root || job.attempts.some(r=>r.merged.length)) throw Error('Failed job published artifact');
  try{await read('get_artifact',[key]);throw Error('Unexpected artifact');}
  catch(e){if(!String(e).includes('no merge artifact'))throw e;}
}
console.log(JSON.stringify({key,state:job.state,spec_root:job.spec_root,artifact,
  reports:job.attempts.map(r=>({state:r.state,reason:r.reason,labels:r.labels,rows:r.rows,root:r.root,
    sources:r.sources})),roots_verified:true,provenance_verified:true}));
