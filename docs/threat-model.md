# Threat model

The artifact is a deterministic merge of three public, hash-bound snapshots under a fixed semantic comparison policy. It is NOT factual certification, graph mutation, service settlement or authorization.

Trusted boundaries: chain transaction sender/clock, GenVM runner and GenLayer consensus, SHA-256 integrity, pinned GitHub content availability. The publisher may lie; the primitive only reconciles that text. No independent factual-witness claim is made. Stable IDs' meaning is an input precondition. A malicious publisher can intentionally reuse IDs or encode misleading context.

Prompt injections and ambiguous references map to UNKNOWN in the prompt; an LLM can still be fooled. Exact independent agreement is not a mathematical proof of natural-language equivalence. All three source bodies, parsed records and labels are included in consensus, preventing a leader from swapping evidence or merely comparing its own summary.

Base/branch substitution: ordered paths/hashes, full commit, creator namespace and spec root. Retry replay: expected attempt number and terminal states. Cross-contract replay: address in job key/spec. Unauthorized consumer: no write-capable consumer API; anyone may read immutable public artifacts. No funds to steal or unilateral owner veto.

Malformed JSON, duplicate keys, oversized bodies and hash mismatch -> INVALID. HTTP failure -> UNAVAILABLE, at most three stored attempts, then INCONCLUSIVE; deadline allows anyone to expire. Model schema failure -> transaction error with no stored attempt. Validator disagreement -> no finalized state mutation; callers can retry same attempt before deadline. Contradictory semantic vectors -> CONFLICTED. Any unknown blocks entire artifact. Rejected reports preserve alternatives; no partially merged content is available as a complete artifact.

Deletion versus semantic no-op is not conflict. Genuine edit/delete is conflict. Two distinct concurrent edits within one row are not automatically composed, even if intuitively compatible. Smaller stable record units allow independent changes; caller must choose their schema responsibly.

Resource bounds: 16 jobs per creator, 3 attempts/job, 3 sources/attempt, 8 KiB/source, 6 rows/document, 8 union IDs, 600 characters/row, at most 24 semantic pairs. Creator limits are not Sybil protection. Sources are downloaded in full before body-size rejection, so transport-level bandwidth is not bounded by this check.

No independent audit, formal proof, mainnet deployment or production guarantee. Model tests cover supplied labels, not real-world model accuracy. Receipt majority agreement is not unanimity. Source/fixture roots and every actual proof must be checked before submitting.
