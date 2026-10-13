# Submission draft — lifecycle proofs pending

Contribution type: Builder → Intelligent Contracts

Title:
```text
SemanticThreeWayMerge — Base-Aware Concurrent Document Reconciliation
```

Notes / Description (993/1000 characters):
```text
SemanticThreeWayMerge is a GenLayer primitive for reconciling concurrent edits to structured public documents. It independently fetches commit-pinned base, left and right snapshots, verifies complete-body SHA-256 commitments and evaluates changed propositions—not caller summaries. Validators independently repeat acquisition and semantic comparison; exact report equality covers evidence, labels and row decisions. Base-aware edit algebra distinguishes paraphrases from real changes, selects exact source text with provenance, honors deletion against an unchanged branch and preserves edit/edit or deletion/edit conflicts. Contradictory equivalence labels or uncertain meaning block the entire merged artifact. Jobs, reports and artifacts are immutable and creator/contract-bound; attempt fencing, bounded retries and expiry prevent replay and stuck processing. The source is pushed and StudioNet deployment/source verified. 41 local tests pass; live semantic lifecycle proofs remain pending.
```

Evidence:

- https://github.com/Al1ranger/semantic-three-way-merge
- https://github.com/Al1ranger/semantic-three-way-merge/blob/main/contracts/SemanticThreeWayMerge.py
- https://github.com/Al1ranger/semantic-three-way-merge/blob/main/README.md
- https://explorer-studio.genlayer.com/address/0x62883BfE483fB1565CBF3fe82C958fbBc848a022
- https://explorer-studio.genlayer.com/tx/0xd6e8fbfbd84aa45d4e65c0e7acf9e17cfde6c820dc784ab420a94350ae38cbc1

Do not claim completed semantic usage until the proof runner produces verified finalized receipts and readback. Publish updated LIVE_PROOFS.md/proofs/verified.json before linking them as evidence; these latest documentation edits are not yet pushed because network/sandbox access changed.
