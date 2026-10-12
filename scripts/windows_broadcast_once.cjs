// Explicit opt-in transport for an ALREADY SIGNED gasless StudioNet transaction.
// Signing remains in the CLI encrypted keystore. Never inspect/export keys.
// Cache both success and failure: SDK retries cannot rebroadcast this payload.
const {requestOnce} = require('./native_http.cjs');
const {createHash} = require('node:crypto');
const original = globalThis.fetch;
const sent = new Map();
globalThis.fetch = async (url, options) => {
  let rpc;
  try { rpc = JSON.parse(options?.body ?? '{}'); } catch {}
  const target = new URL(String(url));
  if (process.platform !== 'win32' || process.env.STUDIO_NATIVE_BROADCAST !== '1'
      || target.origin !== 'https://studio.genlayer.com' || target.pathname !== '/api'
      || rpc?.method !== 'eth_sendRawTransaction') return original(url, options);
  if (rpc.params?.length !== 1 || !/^0x[0-9a-fA-F]+$/.test(rpc.params[0])) throw Error('Invalid signed broadcast shape');
  const key = createHash('sha256').update(rpc.params[0]).digest('hex');
  if (!sent.has(key)) sent.set(key, requestOnce(rpc));
  const body = await sent.get(key);
  const result = JSON.parse(body);
  if (typeof result.result === 'string' && /^0x[0-9a-fA-F]{64}$/.test(result.result))
    console.error(`BROADCAST_HASH ${result.result}`);
  return new Response(body, {status: 200, headers: {'content-type': 'application/json'}});
};
