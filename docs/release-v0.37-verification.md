# v0.37.0 Release Verification

Verified on 2026-08-27 for the local Windows portable build. This report records release evidence; it does not alter the source-available proprietary license or imply that an unsigned binary has an Authenticode signature.

## Release boundary

- Chapter 5, **Lights Across the Air**, is fully implemented.
- Chapter 6, **Hill Expedition**, is a playable vertical slice.
- Chapter 7 implements only the QSL and persistent people-choice foundation.
- The rest of Chapter 7 and Chapters 8–15 remain planned work.

The seven localized README files use this same boundary and retain the public `cwformer` repository link, the source-available proprietary license wording, and the explicit unsigned Windows-build notice.

## Verification results

| Gate | Result |
| --- | --- |
| Focused packaged-QA contract | PASS — 38 tests, 0 failures |
| `pnpm test` | PASS — 546 tests, 0 failures |
| `pnpm qso:simulate:poor` | PASS — 15/15, release ready |
| `pnpm qso:calibrate` | PASS — 35 cases, 0 issues, release ready |
| `pnpm mission:economy` | PASS — all economy gates |
| `pnpm build` | PASS — 4,644 modules; owned JavaScript maximum 425,174 bytes against a 512,000-byte budget |
| `pnpm desktop:build` | PASS — portable Windows executable produced |
| Packaged `--semantic-smoke` | PASS — `onnxruntime-node`, model `qso-semanticformer-0.4`, interpretability 100 |
| Isolated packaged QSO stability | PASS — 3/3 fresh runs, 24/24 captures each, console 0, no failure or timeout |
| Full packaged `--qa-capture` | PASS — 102 manifest-bound PNG captures across 7 scopes |
| Packaged font license payload | PASS — both upstream OFL texts are byte-identical to their tracked sources in `app.asar` |
| Repository privacy and secret scan | PASS — no credential, server IP, private-key, co-author trailer, or absolute local-user path findings |

## Packaged QA evidence

- Evidence root basename: `cwgame-qa-v037-final11-8ad35d85da184899b6eae4b6bda1d55c` (under the verifier's temporary directory; the absolute local path is intentionally omitted).
- QA run ID: `d95f1118-8766-4873-9805-01a8e390aad4`.
- Scopes and capture counts: `bootstrap` 22, `inventory` 12, `equipment` 14, `practice` 13, `qso` 24, `expedition` 11, and `lights` 6.
- Every capture is present exactly once in the manifest and passes the PNG signature, chunk ordering, chunk type, critical-chunk allowlist, CRC, decompression, dimension, colour, and non-empty pixel-data checks.
- Pixel-level duplicate validation admitted only the three exact warm-up pairs present in this run. The empty-log warm-up was visually distinct in the final run; its exact two-member fallback allowlist remains bounded and rejects a third member. The first blind-copy and `AGN`-repeat captures are visibly and cryptographically distinct.
- Root and per-scope console error counts are zero; no failure or timeout marker exists.
- Expedition evidence proves the failure penalty, `AGN` recovery, successful settlement, SORA person/QSL linkage, QSL choice persistence after reload, exact duplicate-choice no-op, pause without catch-up, reachable timeout and battery depletion, a durable replay entry, and replay with no duplicate reward.
- Lights evidence proves story readiness, keying input, story launch, chase completion, control entry, Escape pause/resume, a failed run, retry, settlement, reload history, and exact duplicate-settlement no-op.
- Automatic-key evidence dispatches real `Z`/`X` events and observes the live keyer. Main-process character boundaries restore real focus, while every character's complete physical element sequence remains atomic inside one renderer task; no helper writes decoded text, pulse state, keyer state, phase, or focus state.

### Recovery evidence retained

- `cwgame-qa-v037-release-f5be7a5998d14ed1bbfa121721629132` remains the original interrupted/failing evidence: QSO stopped after a dropped physical automatic-key pulse.
- `cwgame-qa-v037-release-final-fc0a173c675f4bc9881c31ac90cfb7d6` remains the first complete-capture failure: the root validator correctly withheld its manifest when blind-copy and `AGN`-repeat pixels were identical.
- `cwgame-qa-v037-final10-f311ac7fc9ed4afd894fb5efb0c4eee0` retains all 102 valid scope captures from the run whose root manifest was correctly withheld for one omitted exact warm-up pair. Offline revalidation after the bounded policy fix is recorded separately and is not presented as the final supervisor pass.
- The polling-induced `cwgame-qso-final11-1-87e1d48a15a04cc98b652b50248907e7` and hidden-window `cwgame-qso-final11-diagnostic-0cd3c7d25f1a42cf871bf2fc8e168aa1` roots remain evidence that real focus loss fails closed. A visible single-exec diagnostic then passed 24/24 without external polling.
- The fixed executable passed three fresh isolated QSO roots: `cwgame-qso-final11-pass1-cf3a8a716355471584e00b9613c2144a`, `cwgame-qso-final11-pass2-6ebba607dba744c6b9fc893488eb6b93`, and `cwgame-qso-final11-pass3-944ad9de02144b1fbbe9f01f26a9b016`.

## Runtime model integrity

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `qso-semanticformer-v0.4.int8.onnx` | 1,164,897 | `7cf7333e31c317db4c9636d4f74f83941865ae48d67ada4287884af65d203855` |
| `qso-semanticformer-v0.4.runtime-contract.json` | 5,344 | `73c7c96de8715602390c6b54a7847b6c06221ad98ba9374a0003b842b15f6de0` |

The tracked runtime succeeds with network access denied. A missing or corrupt local model fails closed instead of downloading a replacement or reporting a false provider success.

## Windows artifact

- File: `CWGame-latest.exe`
- Size: 149,747,588 bytes
- PE header: `MZ`
- Authenticode status: `NotSigned`
- SHA-256: `fd9846382d7d5c122b09867c22c7b392847e174b3d14476b4ede74e99731a168`
- Unpacked `app.asar` SHA-256: `61b4e270f7624d205017b8ead9c80a5420d2919b055ad20bec32d7357b7cb005`
- Local checksum sidecar: `release/CWGame-latest.exe.sha256` (ignored build artifact, intentionally not forced into Git)

The portable executable is intentionally unsigned. Users should verify its SHA-256 and obtain builds only from the project's release channel.
