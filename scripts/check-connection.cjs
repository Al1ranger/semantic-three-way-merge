// Read-only connectivity check. Never signs, broadcasts or dumps raw RPC results.
const {requestOnce} = require('./native_http.cjs');
requestOnce({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]}).then(raw => {
  const value=JSON.parse(raw);
  if(value.error || typeof value.result !== 'string') throw Error('RPC read failed');
  console.log('StudioNet HTTPS/RPC read succeeded');
}).catch(error => {console.error(error.message);process.exitCode=1;});
