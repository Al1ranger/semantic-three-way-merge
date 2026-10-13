# Live proofs

## Verified deployment

- Network: gasless StudioNet (not Bradbury or mainnet).
- Contract: [0x62883BfE483fB1565CBF3fe82C958fbBc848a022](https://explorer-studio.genlayer.com/address/0x62883BfE483fB1565CBF3fe82C958fbBc848a022).
- [Deployment transaction](https://explorer-studio.genlayer.com/tx/0xd6e8fbfbd84aa45d4e65c0e7acf9e17cfde6c820dc784ab420a94350ae38cbc1).
- Receipt independently checked: FINALIZED, leader execution SUCCESS, MAJORITY_AGREE. This is not a claim of unanimous validator execution.
- Deployed source matched the local/published contract after line-ending and final-newline normalization.
- Normalized source SHA-256: `79e7f89682c79f27f4e2b867202f5cb587e3de176d6b5545b6df3b11bf1ac1c6`.
- Published fixture/source commit: `fff8bd3b422423cadb510cc79d8e3e1781d6cb9f`.
- Dedicated public test signer: `0x7a413BB4AB62E31d62d4cD9efC8C8a8Dae37FB42`. No funding or transfers.

## Registration observed; final receipt verification pending

[Registration transaction](https://explorer-studio.genlayer.com/tx/0x24a32e1ab520233602f40df59a633b7a081243b19364127f6991eb43c5860d2e) was broadcast and the CLI completed. An independent SDK read returned the registered job in OPEN with no artifact and verified spec binding. Its separate finalized-receipt check was interrupted by network/sandbox changes, so it is NOT listed as a fully verified finalized usage proof.

- Job: `semantic-edit-v1`.
- Key: `f45768c5c178d21077800141933c09e3af02af1d6e9d22a9cb72dcc3ad63b2e6`.
- Spec root: `4e6af1f6635d05f67f7f6b19c8e2aec2526fd0060036afb11cf6e2db853c7df5`.
- No reconcile transaction has been sent. Do NOT claim MERGED, CONFLICTED, hash rejection or replay prevention has been demonstrated onchain yet.

## Local validation (not onchain proofs)

- GenVM lint: 3 checks pass; contract validation succeeds; 7 methods (4 views, 3 writes).
- 41 pytest cases pass, including direct-mode mocked evidence/model execution and an extracted actual validator callback with independent observation stubs.
- 400 bounded presence/semantic-label combinations checked for merge safety and branch-swap state symmetry.
- 3 SDK calldata encode/decode roundtrips pass; these are not VM execution or distributed consensus tests.

## Completion workflow

`scripts/complete-proofs.ps1` is prepared and syntax-checked, NOT executed. It uses the same encrypted test signer and deployed contract, creates fresh job IDs, sends one write at a time and stops on an unknown outcome, failed receipt or unexpected readback. It writes only sanitized public proof metadata. It checks source, performs merge/conflict/hash-rejection/deletion cases and an expected reverted replay. It does not push results automatically.

Run from authenticated Windows PowerShell 5.1 or PowerShell 7 with the dedicated encrypted test account unlocked. The HTTP helper uses Windows curl, not pwsh. Local DNS name failures may use authenticated Google DNS-over-HTTPS before any RPC request; TLS verification stays enabled. Never paste a password or private key into chat. Network and OS-keyring access must be available. Each finalized receipt AND readback must pass before adding its link as verified evidence. The synthetic fixture snapshots prove text-reconciliation behavior, not factual service delivery or independent external authorities.

The DNS fallback and transport have 15 offline tests. Live connectivity after this transport change is NOT yet verified; it does not add any onchain usage proof.
