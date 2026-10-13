# Deployment and verification

Use gasless StudioNet only. No funding or paid-mainnet authority is implied.

1. Install pinned Python/Node tooling as in README; lint before direct tests.
2. Publish contract and fixture source commit. Compute SHA-256 over the exact bytes, including final newline. No text-mode normalization of source fixtures.
3. Use GenLayer CLI encrypted signer; never print/export a key or write passwords into scripts. Select studionet and a dedicated test signer with `genlayer network set studionet` and account selection.
4. `genlayer deploy --contract contracts/SemanticThreeWayMerge.py`.
5. Record transaction hash. Confirm FINALIZED plus leader execution SUCCESS plus consensus outcome. CLI checkmark alone is insufficient.
6. `node --require ./scripts/windows_read_transport.cjs scripts/check.mjs --source ADDRESS` compares Explorer RPC source with the local contract (normalizes only line endings/trailing newline).
7. `genlayer write ADDRESS open_merge --args demo Al1ranger semantic-three-way-merge COMMIT examples/fixtures/base.json,examples/fixtures/left.json,examples/fixtures/right.json HASH_BASE,HASH_LEFT,HASH_RIGHT DEADLINE`.
8. Read `job_key(CREATOR,demo)`, then `genlayer write ADDRESS reconcile --args KEY 0`.
9. Check each receipt with `scripts/check.mjs --success HASH`. Read back with `scripts/inspect.mjs ADDRESS CREATOR demo MERGED`; verify roots and exact output text/slot provenance.
10. Independently exercise the conflict case, wrong-hash case, and a replay attempt. Expected execution ERROR is negative evidence, never a successful lifecycle step.

Optional Windows native read transport uses the public StudioNet RPC only. Broadcast transport requires STUDIO_NATIVE_BROADCAST=1 and only forwards an already signed StudioNet payload once per process. Native transport errors may leave acceptance uncertain; check wallet history/nonce and receipts BEFORE any retry. Do not dump full RPC/SDK errors; validator configuration may contain sensitive data. Helpers sanitize logs.

Live evidence will be recorded only after actual receipts and readback verification; planned steps are not proofs.

## Windows DNS failure

Run `node scripts/check-connection.cjs` first. This only reads the chain ID; it does not sign or broadcast.

The native transport resolves `studio.genlayer.com` before starting an RPC send. System DNS is preferred. Only ENOTFOUND/EAI_AGAIN name failures may consult Google's authenticated DNS-over-HTTPS JSON service. The resolver's bootstrap address is 8.8.8.8, while HTTPS Host/SNI and certificate verification remain bound to dns.google. Only the public RPC hostname is queried; no wallet data or RPC payload is sent to the resolver. Valid responses must match the requested name or its CNAME chain, and private/reserved destinations are rejected. Cached answers last no more than 60 seconds. Authoritative missing records fail closed: there is no hardcoded GenLayer IP.

Windows curl receives the resolved address using `--resolve`, retaining the original studio.genlayer.com HTTPS hostname and certificate checks. No insecure TLS flag, global DNS setting or hosts-file change is used. Permission errors do not trigger DNS fallback. Proxy, firewall, unavailable DoH, certificate or upstream failures still stop processing. Resolution finishes before the first RPC POST; no uncertain write is retried.

This fallback has offline tests, not a confirmed live end-to-end success yet. Run `node --test tests/transport.test.cjs tests/dns.test.cjs` for those tests. The proof runner supports Windows PowerShell 5.1 and does not require pwsh:

```powershell
powershell.exe -NoProfile -File scripts/complete-proofs.ps1
```
