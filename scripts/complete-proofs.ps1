param(
    [string]$Prefix = ("live-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()),
    [string]$Account = "studio-proof-deployer"
)
$ErrorActionPreference = "Stop"
Set-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
if ($Prefix -notmatch '^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$') { throw "Invalid prefix" }
$Address = "0x62883BfE483fB1565CBF3fe82C958fbBc848a022"
$Creator = "0x7a413BB4AB62E31d62d4cD9efC8C8a8Dae37FB42"
$Commit = "fff8bd3b422423cadb510cc79d8e3e1781d6cb9f"
if ($Account -ne "studio-proof-deployer") { throw "This runner is bound to the documented dedicated test signer" }
$env:ADVISORY_FUSE_ACCOUNT = $Account
$env:STUDIO_NATIVE_BROADCAST = "1"
$Cli = (Resolve-Path -LiteralPath "../intent-firewall/node_modules/genlayer/dist/index.js").Path
$Pin = (Resolve-Path -LiteralPath "../advisory-fuse/scripts/pin_cli_context.cjs").Path
$Read = (Resolve-Path -LiteralPath "scripts/windows_read_transport.cjs").Path
$Send = (Resolve-Path -LiteralPath "scripts/windows_broadcast_once.cjs").Path
$Ledger = [System.Collections.Generic.List[object]]::new()
$States = [System.Collections.Generic.List[object]]::new()
$Output = Join-Path (Get-Location) ("proofs/" + $Prefix + ".json")
New-Item -ItemType Directory -Path "proofs" -Force | Out-Null

function Save-Ledger {
    $value = @{contract=$Address;creator=$Creator;fixture_commit=$Commit;transactions=@($Ledger.ToArray());states=@($States.ToArray())}
    [IO.File]::WriteAllText($Output, ($value | ConvertTo-Json -Depth 40), [Text.UTF8Encoding]::new($false))
}
function Check-Receipt([string]$Hash, [string]$Mode = "--success", [string]$ExpectedError = "") {
    $receiptArgs = @("--require", $Read, "scripts/check.mjs", $Mode, $Hash)
    if ($ExpectedError) { $receiptArgs += $ExpectedError }
    $safe = & node @receiptArgs
    if ($LASTEXITCODE -ne 0) { throw "Receipt check failed for $Hash. Do not rebroadcast; inspect its status first." }
    return ($safe | ConvertFrom-Json)
}
function Read-State([string]$Id, [string]$Expected) {
    $safe = & node --require $Read scripts/inspect.mjs $Address $Creator $Id $Expected
    if ($LASTEXITCODE -ne 0) { throw "Readback failed for $Id. No subsequent write will be sent." }
    return ($safe | ConvertFrom-Json)
}
function Send-Step([string]$Step, [string]$Method, [object[]]$Values, [string]$ExpectedError = "") {
    # Capture raw CLI receipt privately in memory; NEVER print or persist it.
    # The CLI may include validator configuration in an error object.
    # Windows PowerShell 5.1 wraps native stderr as ErrorRecord objects.
    # Capture it without aborting before the hash/receipt checks.
    $previousErrorPreference = $ErrorActionPreference
    try {
        $ErrorActionPreference = "Continue"
        $raw = (& node --require $Pin --require $Read --require $Send $Cli write $Address $Method --args @Values 2>&1 | Out-String)
    } finally {
        $ErrorActionPreference = $previousErrorPreference
    }
    $found = [regex]::Matches($raw, "tx_id:\s*'?(0x[0-9a-fA-F]{64})") |
        ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
    if (-not $found) {
        $found = [regex]::Matches($raw, "BROADCAST_HASH (0x[0-9a-fA-F]{64})") |
            ForEach-Object { $_.Groups[1].Value } | Select-Object -Unique
    }
    $raw = $null
    if (@($found).Count -ne 1) { throw "Broadcast outcome unknown. Stop and inspect public wallet history/nonce; never blindly retry." }
    $hash = [string]@($found)[0]
    [void]$Ledger.Add(@{step=$Step;hash=$hash;verification="PENDING"})
    Save-Ledger
    $mode = if ($ExpectedError) { "--error" } else { "--success" }
    $receipt = Check-Receipt $hash $mode $ExpectedError
    $Ledger[$Ledger.Count-1] = @{step=$Step;hash=$hash;verification="VERIFIED";receipt=$receipt;expected_error=$ExpectedError}
    Save-Ledger
    Write-Host "$Step $hash $($receipt.execution)"
}
# No passwords, key exports, token transfers or paid-network transactions.
# Run in the user's authenticated PowerShell after unlocking this encrypted test account.
# Stops on any unknown broadcast, failed receipt or unexpected state.
$deploy = Check-Receipt "0xd6e8fbfbd84aa45d4e65c0e7acf9e17cfde6c820dc784ab420a94350ae38cbc1"
[void]$Ledger.Add(@{step="Existing deployment";verification="VERIFIED";receipt=$deploy})
& node --require $Read scripts/check.mjs --source $Address
if ($LASTEXITCODE -ne 0) { throw "Deployed source mismatch" }
$hashes = @{
    base="19e5cb1775e300f76df3836e9af8fb9ea4f549c1b090cfdeb9d1ebfcb49cd098"
    left="a6a6d1e921b0982a32b14a006ac2412a1380fd438bcd5ebf23217c703512fd5e"
    right="8513d859a5df48930048de83462ed1621491d37c02c8ed0bccafcf1772c2a382"
    conflict="0739957576f6da58b76e08c7feb30f7f9933234715a84bac8e3597e869486b05"
    deleted="7b4e544a6b5a65c6168d7aee1fecacb469908579657650b60c85371b802c4221"
}
foreach ($name in $hashes.Keys) {
    $actual = (Get-FileHash -LiteralPath "examples/fixtures/$name.json" -Algorithm SHA256).Hash.ToLowerInvariant()
    if ($actual -ne $hashes[$name]) { throw "Local pinned fixture mismatch: $name" }
}
$cases = @(
    @{suffix="merge";files=@("base","left","right");expected="MERGED"},
    @{suffix="conflict";files=@("base","conflict","right");expected="CONFLICTED"},
    @{suffix="bad-hash";files=@("base","left","right");expected="INVALID"},
    @{suffix="deletion";files=@("base","left","deleted");expected="MERGED"}
)
foreach ($case in $cases) {
    $id = "$Prefix-$($case.suffix)"
    $paths = ($case.files | ForEach-Object { "examples/fixtures/$_.json" }) -join ","
    $commitments = @($case.files | ForEach-Object { $hashes[$_] })
    if ($case.suffix -eq "bad-hash") { $commitments[1] = "0" * 64 }
    $deadline = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds() + 3600
    Send-Step "Register $id" "open_merge" @($id,"Al1ranger","semantic-three-way-merge",$Commit,$paths,($commitments -join ","),$deadline)
    $open = Read-State $id "OPEN"
    Send-Step "Reconcile $id" "reconcile" @($open.key,0)
    $state = Read-State $id $case.expected
    [void]$States.Add($state)
    Save-Ledger
    if ($case.suffix -eq "merge") {
        $delivery = @($state.artifact.documents | Where-Object id -eq "delivery")
        if ($delivery.Count -ne 1 -or $delivery[0].slot -ne 2) { throw "Semantic edit did not choose right branch" }
        Send-Step "Reject replay $id" "reconcile" @($open.key,0) "closed or stale attempt"
        $same = Read-State $id "MERGED"
        if ($same.artifact.root -ne $state.artifact.root) { throw "Replay changed artifact" }
    }
}
Write-Host "Verified public-only proof ledger: $Output"
Write-Host "Review and publish the ledger. These fixtures are synthetic semantic tests, not factual service evidence."
