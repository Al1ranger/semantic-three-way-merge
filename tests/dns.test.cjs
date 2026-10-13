const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {EventEmitter}=require('node:events');
function load(lookup,answer){
  const exports={},calls=[];
  vm.runInNewContext(fs.readFileSync('scripts/studio_dns.cjs','utf8'),{
    exports,Date,setTimeout,clearTimeout,
    require(name){
      if(name==='node:net')return require(name);
      if(name==='node:dns')return {promises:{lookup}};
      if(name==='node:https')return {get(url,options,callback){
        calls.push({url,options});
        const req=new EventEmitter();req.destroy=()=>{};
        queueMicrotask(()=>{
          const response=new EventEmitter();
          response.statusCode=200;response.resume=()=>{};response.destroy=()=>{};
          callback(response);
          response.emit('data',Buffer.from(JSON.stringify(answer)));
          response.emit('end');
        });
        return req;
      }};
      throw Error('Unexpected dependency');
    }
  });
  return {exports,calls};
}
const payload={Status:0,Question:[{name:'studio.genlayer.com.',type:1}],
  Answer:[{name:'studio.genlayer.com.',type:1,TTL:60,data:'93.184.216.34'}]};
const absent=async()=>{throw Object.assign(Error('not found'),{code:'ENOTFOUND'});};

test('normal system DNS needs no external resolver',async()=>{
  const s=load(async()=>({address:'93.184.216.34'}),payload);
  assert.equal(await s.exports.resolveStudioAddress(),'93.184.216.34');
  assert.equal(s.calls.length,0);
});
test('missing local name uses authenticated DoH before RPC',async()=>{
  const s=load(absent,payload);
  assert.equal(await s.exports.resolveStudioAddress(),'93.184.216.34');
  assert.equal(await s.exports.resolveStudioAddress(),'93.184.216.34');
  assert.equal(s.calls.length,1);
  const {url,options}=s.calls[0];
  assert.equal(new URL(url).hostname,'dns.google');
  assert.equal(options.servername,'dns.google');
  assert.equal(options.rejectUnauthorized,true);
  options.lookup('dns.google',{all:true},(err,records)=>{
    assert.equal(err,null);assert.equal(records[0].address,'8.8.8.8');
  });
});
for(const code of ['EACCES','EPERM']){
  test('permission denial never triggers DoH: '+code,async()=>{
    const s=load(async()=>{throw Object.assign(Error('denied'),{code});},payload);
    await assert.rejects(s.exports.resolveStudioAddress(),/permission/);
    assert.equal(s.calls.length,0);
  });
}
test('NXDOMAIN fails closed; no stale or hardcoded target IP',async()=>{
  const s=load(absent,{...payload,Status:3});
  await assert.rejects(s.exports.resolveStudioAddress(),/DNS evidence unavailable/);
});
test('only matching query answers are accepted',()=>{
  const s=load(absent,payload);
  assert.throws(()=>s.exports.parseAnswer({...payload,Question:[{name:'other.test',type:1}]}));
  assert.throws(()=>s.exports.parseAnswer({...payload,Answer:[{name:'other.test',type:1,TTL:60,data:'93.184.216.34'}]}));
});
test('CNAME chain may lead to a public address',()=>{
  const s=load(absent,payload);
  const value={...payload,Answer:[
    {name:'studio.genlayer.com.',type:5,data:'edge.example.net.'},
    {name:'edge.example.net.',type:1,TTL:90,data:'93.184.216.34'}]};
  assert.equal(s.exports.parseAnswer(value).address,'93.184.216.34');
  assert.equal(s.exports.parseAnswer(value).ttl,60);
});
test('private, local, reserved and malformed IPs rejected',()=>{
  const s=load(absent,payload);
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.1.2','169.254.169.254',
    '100.64.0.1','0.0.0.0','192.0.2.1','198.18.1.2','198.51.100.1','203.0.113.1','224.0.0.1',
    '255.255.255.255','::1','garbage',null,42]){
    assert.equal(s.exports.publicIPv4(ip),false);
  }
});
