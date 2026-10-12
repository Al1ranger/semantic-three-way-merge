# SemanticThreeWayMerge

Three-way reconciliation of bounded public record documents, not factual verification.

Base, left and right are three ordered, immutable, commit-pinned HTTPS JSON documents. A stable record ID denotes the same logical field across documents. Missing rows mean deletion; renamed IDs mean delete/add. No agent registration, graph edges, mutable head, approval certificate, token balance or consumption API.

The contract fetches all three complete bodies, checks SHA-256 and schema, and independently asks every validator to compare changed textual pairs. Exact normalized reports must agree. Base-aware edit algebra chooses unchanged, left edit, right edit, convergent edit, deletion or conflict. Byte-different paraphrases may be semantic no-ops: the AI decision therefore materially changes which branch survives. Outputs copy exact fetched text with slot provenance; no generated replacement prose.

Conflicting or unknown rows prevent publication of the ENTIRE merged artifact. Both alternatives remain in the immutable report. An agreed logical inconsistency (two SAME edges and one DIFFERENT) also fails closed. Network/model validator disagreement aborts the transaction and does not manufacture a stored conflict.

One immutable job has up to three evidence-acquisition attempts. Only unavailable HTTP evidence is retryable; semantic outcomes are terminal. Anyone may reconcile or expire; caller cannot substitute any bound payload. Creator/contract/ID namespaces prevent job replay. Deadlines bound acquisition time, not document creation age. Commit pinning establishes content integrity, not source honesty or independent authorities.

Distinct mechanism: a base-relative edit algebra and source-provenance merged artifact, not single-dataset equivalence classes, a versioned graph proposal, or evidence approval/consumption.
