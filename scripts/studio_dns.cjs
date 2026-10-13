// Project-local resolution for ONE public RPC host. Never edits OS DNS/hosts.
// System DNS first; authenticated Google DoH only for ENOTFOUND/EAI_AGAIN.
// Permission errors never trigger a fallback.
const dns = require('node:dns').promises;
const https = require('node:https');
const net = require('node:net');
const HOST = 'studio.genlayer.com';
let cached = null;

function publicIPv4(value) {
  if (typeof value !== 'string' || net.isIP(value) !== 4) return false;
  const [a,b,c] = value.split('.').map(Number);
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113));
}

function parseAnswer(value) {
  if (!value || value.Status !== 0 || value.TC === true ||
      !Array.isArray(value.Question) || value.Question.length !== 1 ||
      value.Question[0].type !== 1 ||
      value.Question[0].name.toLowerCase().replace(/\.$/,'') !== HOST ||
      !Array.isArray(value.Answer)) throw Error('DNS evidence unavailable; no RPC broadcast attempted');
  // Follow only CNAMEs belonging to the requested name; reject unrelated address answers.
  const names = new Set([HOST]);
  for (let round=0; round<8; round++) {
    for (const row of value.Answer) {
      if(row.type === 5 && typeof row.name === 'string' && typeof row.data === 'string' &&
        names.has(row.name.toLowerCase().replace(/\.$/,'')))
        names.add(row.data.toLowerCase().replace(/\.$/,''));
    }
  }
  const answers=value.Answer.filter(row=>row.type===1 && typeof row.name==='string' &&
    names.has(row.name.toLowerCase().replace(/\.$/,'')) && publicIPv4(row.data));
  if (!answers.length) throw Error('DNS evidence has no public address; no RPC broadcast attempted');
  return {address:answers[0].data,ttl:Math.min(60,...answers.map(row=>
    Number.isFinite(row.TTL) && row.TTL >= 0 ? row.TTL : 0))};
}

function doh() {
  return new Promise((resolve,reject)=>{
    let settled=false;
    const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);error?reject(error):resolve(value);};
    // DNS bootstrap IP is Google's public resolver, NOT a pinned GenLayer address.
    // Host/SNI remain dns.google; certificate verification is mandatory.
    const req=https.get('https://dns.google/resolve?name='+HOST+'&type=A',{
      servername:'dns.google',rejectUnauthorized:true,
      lookup(host,options,callback){
        if(host!=='dns.google')return callback(Error('Unexpected DNS bootstrap host'));
        callback(null, options.all ? [{address:'8.8.8.8',family:4}] : '8.8.8.8',4);
      }
    },response=>{
      if(response.statusCode!==200){response.resume();done(Error('Authenticated DNS request failed; no RPC broadcast attempted'));return;}
      let body='',bytes=0;
      response.on('data',chunk=>{
        bytes+=chunk.length;
        if(bytes>16384){response.destroy();done(Error('DNS response too large; no RPC broadcast attempted'));}
        else body+=chunk.toString('utf8');
      });
      response.on('error',()=>done(Error('DNS response failed; no RPC broadcast attempted')));
      response.on('end',()=>{
        if(settled)return;
        try{done(null,parseAnswer(JSON.parse(body)));}
        catch{done(Error('DNS evidence unavailable; no RPC broadcast attempted'));}
      });
    });
    const timer=setTimeout(()=>{req.destroy();done(Error('DNS HTTPS timeout; no RPC broadcast attempted'));},8000);
    req.on('error',()=>done(Error('DNS HTTPS failed; no RPC broadcast attempted')));
  });
}

exports.resolveStudioAddress = async () => {
  if(cached && cached.until>Date.now())return cached.address;
  let resolved;
  try {
    let timer;
    try {
      resolved=await Promise.race([
        dns.lookup(HOST,{family:4}),
        new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Local DNS timeout; no RPC broadcast attempted')),6000);})
      ]);
    } finally {clearTimeout(timer);}
    if(!publicIPv4(resolved.address))throw Error('Non-public RPC address rejected; no RPC broadcast attempted');
    cached={address:resolved.address,until:Date.now()+30000};
  } catch(error) {
    if(!['ENOTFOUND','EAI_AGAIN'].includes(error.code))
      throw Error('Local DNS unavailable ('+(['EACCES','EPERM'].includes(error.code)?'permission':'lookup')+'); no RPC broadcast attempted');
    const answer=await doh();
    cached={address:answer.address,until:Date.now()+answer.ttl*1000};
  }
  return cached.address;
};
exports.publicIPv4=publicIPv4;
exports.parseAnswer=parseAnswer;
