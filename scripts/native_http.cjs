// Public StudioNet RPC transport only. No wallet files or signing operations.
const {spawn} = require('node:child_process');
const script = `$ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); `
  + `$encoded=[Console]::In.ReadToEnd(); $body=[System.Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($encoded)); `
  + `$r=Invoke-WebRequest -UseBasicParsing -Uri 'https://studio.genlayer.com/api' -Method Post `
  + `-ContentType 'application/json' -Body $body -TimeoutSec 25 -MaximumRetryCount 0; [Console]::Write($r.Content)`;
const encodedScript = Buffer.from(script, 'utf16le').toString('base64');
exports.requestOnce = rpc => new Promise((resolve, reject) => {
  const child = spawn('pwsh.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand', encodedScript],
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
  child.stderr.resume(); // Never expose raw request/error context in logs.
  child.on('error', () => finish(Error('Native transport process failed')));
  child.on('close', code => {
    if (code !== 0) return finish(Error('Native HTTP failed; check receipt before any rebroadcast'));
    const body = Buffer.concat(chunks).toString('utf8');
    try { JSON.parse(body); finish(null, body); } catch { finish(Error('Invalid native RPC response')); }
  });
  child.stdin.on('error', () => finish(Error('Native transport input failed')));
  child.stdin.end(Buffer.from(JSON.stringify(rpc), 'utf8').toString('base64'));
});
