const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {EventEmitter} = require('node:events');

function setup(dnsError) {
  let launch, input, sends=0;
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.stderr.resume = () => {};
  child.stdin = new EventEmitter();
  child.stdin.end = value => {input = value;};
  child.kill = () => {};
  const exports = {};
  const code = fs.readFileSync('scripts/native_http.cjs', 'utf8');
  vm.runInNewContext(code, {exports, Buffer, setTimeout, clearTimeout,
    process: {env:{SystemRoot:'C:\\Windows'}},
    require(name) {
      if(name === 'node:path') return path.win32;
      if(name === './studio_dns.cjs') return {async resolveStudioAddress() {
        if(dnsError)throw dnsError;
        return '93.184.216.34';
      }};
      if(name === 'node:child_process') return {spawn(...args) {sends++;launch=args;return child;}};
      throw Error('Unexpected dependency');
    }});
  return {exports,child,launch:()=>launch,input:()=>input,sends:()=>sends};
}

test('native curl uses resolved address while retaining original HTTPS hostname', async () => {
  const s=setup(), rpc={jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]};
  const pending=s.exports.requestOnce(rpc);
  await new Promise(setImmediate);
  const [exe,args,options]=s.launch();
  assert.equal(exe,'C:\\Windows\\System32\\curl.exe');
  assert.equal(args[args.indexOf('--resolve')+1],'studio.genlayer.com:443:93.184.216.34');
  assert.equal(args.at(-1),'https://studio.genlayer.com/api');
  assert.ok(!args.includes('--insecure') && !args.includes('-k'));
  assert.equal(args[args.indexOf('--proto')+1],'=https');
  assert.equal(options.windowsHide,true);
  assert.deepEqual(JSON.parse(s.input()),rpc);
  s.child.stdout.emit('data',Buffer.from('{"result":"0x1"}'));
  s.child.emit('close',0);
  assert.equal(await pending,'{"result":"0x1"}');
});

test('native stderr never becomes a raw error/credential log', async () => {
  const s=setup(), pending=s.exports.requestOnce({method:'eth_chainId'});
  const rejected=assert.rejects(pending,/Native HTTP failed/);
  await new Promise(setImmediate);
  s.child.emit('close',1);
  await rejected;
});

test('only allowlisted HTTP diagnostic is exposed', async () => {
  const s=setup(), pending=s.exports.requestOnce({method:'eth_chainId'});
  const rejected=assert.rejects(pending, e => e.message.includes('HTTP_STATUS') && !e.message.includes('secret'));
  await new Promise(setImmediate);
  s.child.stderr.emit('data',Buffer.from('secret raw context NATIVE_HTTP_403'));
  s.child.emit('close',22);
  await rejected;
});

test('DNS category remains distinguishable from generic failure', async () => {
  const s=setup(), pending=s.exports.requestOnce({method:'eth_chainId'});
  const rejected=assert.rejects(pending,/failed \(DNS\)/);
  await new Promise(setImmediate);
  s.child.stderr.emit('data',Buffer.from('NATIVE_NETWORK_NameResolutionFailure'));
  s.child.emit('close',6);
  await rejected;
});

test('failed resolution never starts an RPC or broadcast', async () => {
  const s=setup(Error('DNS evidence unavailable; no RPC broadcast attempted'));
  await assert.rejects(s.exports.requestOnce({method:'eth_sendRawTransaction',params:['0x00']}),/no RPC broadcast attempted/);
  assert.equal(s.sends(),0);
});

test('uncertain send is never retried by transport', async () => {
  const s=setup(), pending=s.exports.requestOnce({method:'eth_sendRawTransaction',params:['0x00']});
  const rejected=assert.rejects(pending,/TIMEOUT/);
  await new Promise(setImmediate);
  s.child.emit('close',28);
  await rejected;
  assert.equal(s.sends(),1);
});

test('runner parses in actual Windows PowerShell 5.1', {skip:process.platform !== 'win32'}, () => {
  const script = "$tokens=$null;$errors=$null;"
    + "[System.Management.Automation.Language.Parser]::ParseFile("
    + "(Join-Path (Get-Location) 'scripts/complete-proofs.ps1'),[ref]$tokens,[ref]$errors)|Out-Null;"
    + "if($errors.Count){exit 1};$PSVersionTable.PSVersion.ToString()";
  const result = require('node:child_process').spawnSync(
    path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe'),
    ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(script,'utf16le').toString('base64')],
    {encoding:'utf8',windowsHide:true,timeout:15000});
  assert.equal(result.status,0);
  assert.match(result.stdout.trim(),/^5\.1\./);
});
