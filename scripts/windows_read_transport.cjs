// Optional native Windows HTTPS bridge for public READ-ONLY StudioNet RPC.
// Never intercept/retry signing or broadcasts, and never read wallet files.
const {requestOnce} = require('./native_http.cjs');
const reads = new Set(['eth_chainId', 'eth_getTransactionCount', 'eth_getTransactionByHash',
  'eth_getTransactionReceipt', 'gen_call', 'gen_getContractCode', 'gen_getContractSchema',
  'eth_getBalance', 'eth_gasPrice', 'eth_estimateGas', 'sim_getTransactionsForAddress']);
const original = globalThis.fetch;
globalThis.fetch = async (url, options) => {
  let rpc;
  try { rpc = JSON.parse(options?.body ?? '{}'); } catch {}
  const target = new URL(String(url));
  if (process.platform !== 'win32' || target.origin !== 'https://studio.genlayer.com'
      || target.pathname !== '/api' || !reads.has(rpc?.method)) return original(url, options);
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const body = await requestOnce(rpc);
      return new Response(body, {status: 200, headers: {'content-type': 'application/json'}});
    } catch (error) { if (attempt === 2) throw error; }
  }
};
