// Public StudioNet RPC transport only. No wallet files or signing operations.
const {spawn} = require('node:child_process');
const path = require('node:path');
const {resolveStudioAddress} = require('./studio_dns.cjs');
const shell = path.join(process.env.SystemRoot || 'C:\\Windows',
  'System32', 'curl.exe');
exports.requestOnce = async rpc => {
  // Resolve BEFORE any RPC send. No uncertain broadcast is retried.
  const address = await resolveStudioAddress();
  return new Promise((resolve, reject) => {
  const child = spawn(shell, ['--disable', '--silent', '--show-error', '--fail',
    '--connect-timeout', '10', '--max-time', '25', '--proto', '=https',
    '--resolve', 'studio.genlayer.com:443:' + address,
    '--request', 'POST', '--header', 'Content-Type: application/json', '--data-binary', '@-',
    'https://studio.genlayer.com/api'],
    {windowsHide: true, stdio: ['pipe', 'pipe', 'pipe']});
  const chunks = [];
  let size = 0, settled = false;
  const finish = (error, value) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    error ? reject(error) : resolve(value);
  };
  const timer = setTimeout(() => { child.kill(); finish(Error('Native transport timeout; broadcast outcome may be unknown')); }, 30000);
  child.stdout.on('data', chunk => {
    size += chunk.length;
    if (size > 10485760) { child.kill(); finish(Error('Native RPC response too large')); }
    else chunks.push(chunk);
  });
  child.stderr.resume(); // Never expose raw stderr, payloads or server configuration.
  child.on('error', () => finish(Error('Native transport process failed')));
  child.on('close', code => {
    if (code !== 0) {
      const category = ({5:'PROXY_DNS',6:'DNS',7:'CONNECT',22:'HTTP_STATUS',28:'TIMEOUT',35:'TLS_HANDSHAKE',60:'TLS_CERTIFICATE'})[code] ?? 'PROCESS';
      return finish(Error('Native HTTP failed (' + category + '); check receipt before any rebroadcast'));
    }
    const body = Buffer.concat(chunks).toString('utf8');
    try { JSON.parse(body); finish(null, body); } catch { finish(Error('Invalid native RPC response')); }
  });
  child.stdin.on('error', () => finish(Error('Native transport input failed')));
  child.stdin.end(JSON.stringify(rpc));
});
};
