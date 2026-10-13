# Proof matrix

| Property | Local check | Onchain evidence |
|---|---|---|
| Source/deployment match | pinned runner, lint/interface | verified deployment receipt + source hash |
| Immutable input registration | direct bindings/namespaces | OPEN readback; final receipt check pending |
| Paraphrase vs real edit affects branch selection | mocked semantic Diff3, exact-text provenance | pending; no reconcile transaction sent |
| Conflicting edits cannot publish artifact | EDIT_EDIT, DELETE_EDIT, ADD_ADD cases | pending |
| Contradictory label vectors fail closed | two SAME + DIFFERENT; all-or-nothing output | local only |
| Unknown meaning blocks artifact | direct UNKNOWN result | local only |
| Validator independently recomputes full report | actual callback AST test; evidence/choice mutation rejected | semantic consensus pending |
| Wrong hash rejected before reasoning | direct INVALID result | pending |
| Replay cannot overwrite output | direct terminal-state revert | pending |
| Acquisition deadline / safe expiry | direct stale-attempt rejection + expiry | local only |
| HTTP failure cannot remain retryable forever | three mocked 503 attempts -> INCONCLUSIVE | local only |
| Permissionless processing cannot replace spec | direct other-party processing/binding | local only |
| Case algebra and source provenance | exhaustive 400 bounded combinations | local only |

No confidence tolerance, caller score, owner override, graph head, certificate or consumption API. No test is advertised as formal verification or proof of LLM accuracy.

## Architectural distinction

Compared with owner-controlled versioned graphs: no head/edge/proposal approval or manual conflict resolution. Compared with SemanticQuotientIndex: no single-dataset deduplication partition, representative lookup or multiplicity. Compared with source-delta queues: no work scheduling, worker leases or operational severity. The consequential output here is a base-relative edit decision and an exact-source document artifact with all-or-nothing conflict withholding. This is a concrete mechanism difference, not a guarantee that reviewers will award novelty or points.
