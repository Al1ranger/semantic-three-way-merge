# SemanticThreeWayMerge

A reusable, source-bound **three-way merge** for short structured documents on GenLayer. It reconciles the base, left and right meanings of stable record IDs, producing an immutable merged document with exact source-text provenance—or preserving conflicts without publishing a merged artifact.

Experimental, unaudited. No claim of factual truth, production security, reviewer acceptance or point value.

## Problem

Byte-oriented merge tools flag rewording as edits. If left merely paraphrases the base while right changes a requirement, a byte merge sees competing edits; a semantic three-way merge can preserve the actual right-side change. Conversely, two materially different edits must remain unresolved, not be overwritten by a fluent summary.

Ordinary deterministic contracts can compare bytes but cannot interpret paraphrases. Here GenLayer's independently verified semantic labels materially select the retained branch. No agent-written summary or caller-supplied score controls that choice.

## Architecture

```text
Pinned HTTPS base / left / right JSON
                 |
Full-response acquisition + SHA-256 + strict schema
                 |
Independent pairwise semantic reasoning by leader and validators
                 |
Exact normalized report equality
                 |
Base-aware edit algebra + consistency guard
           /                    \\
    MERGED artifact         conflict / unknown
    source provenance       no merged artifact
```

This is not an owner-controlled graph, version head, approval certificate or one-time consumer gate. The stored objects are immutable three-input jobs, row-wise edit decisions and materialized document artifacts. There is no mechanism for arbitrary owner approval or resolving a conflict by overwriting alternatives.

## Input and merge rules

Each source is `{"records":[{"id":"delivery","text":"Orders arrive within 24 hours."}]}`. Stable IDs denote the same field across versions. Up to six rows per document and eight IDs in the union; 8 KiB per full body; 8–600 characters per text. Duplicate keys/IDs, additional fields and malformed UTF-8 fail closed. Empty documents represent deletion.

The three slots are base=0, left=1, right=2. Equal bytes and absence comparisons are deterministic. Every other comparison receives SAME, DIFFERENT or UNKNOWN from independent semantic evaluation. SAME requires bidirectional entailment of all consequential details—not similarity. Numbers, timing, scope, modality and negation matter.

| Relationship | Result |
|---|---|
| Both branches unchanged in meaning | retain base |
| Only left changed | select left, including deletion |
| Only right changed | select right, including deletion |
| Both branches converge in meaning | select exact left text |
| Both change differently, or edit vs deletion | CONFLICTED |
| Any necessary comparison UNKNOWN | INCONCLUSIVE |
| Two SAME and one DIFFERENT | CONFLICTED: inconsistent equivalence |

A conflict or unknown anywhere blocks the entire artifact. Reports retain all three alternatives and per-row reasons. Outputs only copy fetched text; they do not synthesize new prose. This does not compose two concurrent edits within a single record.

## State machine and consensus

```text
OPEN -> reconcile -> MERGED | CONFLICTED | INCONCLUSIVE | INVALID
                 -> UNAVAILABLE -> retry (maximum 3 attempts)
OPEN / UNAVAILABLE -> deadline -> permissionless EXPIRED
```

A validator refetches every body and independently repeats semantic interpretation. Exact equality covers binding, URLs, HTTP statuses, hashes, byte counts, normalized documents, labels, row choices and whole result. The deterministic transition recomputes the merge before publication. Validator disagreement aborts consensus without storing an invented CONFLICTED record. CONFLICTED denotes an agreed conflicting edit or internally inconsistent label vector.

## Security model

- Creator/contract/job-ID namespaces; immutable source specs and terminal outcomes.
- Ordered base/left/right paths and exact full-response hash commitments.
- Commit-pinned raw GitHub HTTPS only: no arbitrary URL, local service or redirect selection by callers.
- Permissionless processing uses the bound spec, never replacement payloads.
- Attempt-number fencing, deadline checks and permissionless expiry.
- Every report, spec and artifact has a canonical, domain-bound SHA-256 root.
- Failed, stale, unavailable or ambiguous inputs cannot publish merged content.
- No tokens, custody, funds, external execution or privileged administrator.

A Git commit is an integrity anchor, NOT independent factual evidence or proof of publisher honesty. Same-repository branches are expected, not independent authorities. Deadlines constrain acquisition time; they do not prove content was recently authored. Semantic reasoning is fallible, prompt injection is not cryptographically eliminated, and public storage is unsuitable for private documents. See [threat model](docs/threat-model.md).

## API

`job_key`, `open_merge`, `reconcile`, `expire`, `get_job`, `get_artifact`, `get_record`.

`open_merge(id, owner, repo, commit, paths, hashes, deadline)` takes exactly three comma-separated paths and three comma-separated lowercase SHA-256 hashes. Slots cannot be reordered later. Commit is a full 40-character lowercase commit ID. Deadline is a Unix timestamp 60 seconds–24 hours ahead. `reconcile(key, expected_attempt)` is permissionless.

## Example workflows

Fixtures are synthetic, public semantic test data—not real service delivery evidence.

- base=24-hour delivery, left=24-hour paraphrase, right=48-hour delivery: select right's exact 48-hour text. An independent left-side contact-field edit is also retained.
- base=24 hours, left=12 hours, right=48 hours: record EDIT_EDIT conflict; no artifact.
- One branch deletes a field while the other only paraphrases base: honor deletion.
- Wrong expected hash: INVALID before semantic evaluation.
- Duplicate processing: revert; existing artifact cannot be reset.

## Installation, test and deployment

```powershell
python -m venv .venv
.venv\\Scripts\\python.exe -m pip install -r requirements-dev.txt
npm ci
$env:PYTHONIOENCODING='utf-8'
.venv\\Scripts\\genvm-lint.exe check contracts/SemanticThreeWayMerge.py
.venv\\Scripts\\python.exe -m pytest -q
npm run check:sdk
npm install -g genlayer@0.39.2
genlayer network set studionet
genlayer account # choose/create an encrypted dedicated TEST signer
genlayer deploy --contract contracts/SemanticThreeWayMerge.py
```

Never export keys or put wallet passwords in source. Pin/publish fixture commit before deriving raw-byte hashes. Windows CLI compatibility helpers are optional and opt-in; signing remains in the CLI keystore. Exact commands and receipt checks: [deployment](docs/deployment.md).

The pinned runner is intentional; newer runner availability is not a security update claim. Local direct tests use mocked model/web responses and do not demonstrate distributed consensus. SDK tests check calldata encoding only. [LIVE_PROOFS.md](LIVE_PROOFS.md) separates actual finalized receipts, expected failures, local tests and unexecuted scenarios.
