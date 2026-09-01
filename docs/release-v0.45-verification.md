# v0.45.0 Release Verification

Verified on 2026-09-01 for the local Windows portable build. This report records release evidence; it does not alter the source-available proprietary license or imply that an unsigned binary has an Authenticode signature.

## Release boundary

- Chapters 5 through 15 are implemented as a continuous story and operations arc.
- Chapters 7 through 15 use the production physical CW path for transmitted traffic; QA dispatches real `Z`/`X` key events and never assigns decoded text or gameplay phase directly.
- Chapter 15 completes the planned story and unlocks the initial bounded Open Station dashboard.
- Open Station is intentionally an initial post-story surface, not an unbounded live-service or multiplayer promise.

The seven localized README files use this same boundary and retain the public `cwformer` repository link, the source-available proprietary license wording, and the explicit unsigned Windows-build notice.

## Verification results

| Gate | Result |
| --- | --- |
| Focused packaged-QA contracts | PASS — 89 tests, 0 failures |
| `pnpm test` | PASS — 727 tests, 0 failures |
| `pnpm qso:simulate:poor` | PASS — 15/15, release ready |
| `pnpm qso:calibrate` | PASS — 35 cases, 0 issues, release ready |
| `pnpm mission:economy` | PASS — all economy gates |
| `pnpm build` | PASS — 4,694 modules; 53,706,673 output bytes; owned JavaScript maximum 484,552 bytes against a 512,000-byte budget |
| `pnpm desktop:build` | PASS — portable Windows executable produced |
| Packaged `--semantic-smoke` | PASS — `onnxruntime-node`, model `qso-semanticformer-0.4`, interpretability 100 |
| Full packaged `--qa-capture` | PASS — 197 manifest-bound PNG captures across 16 scopes |
| Packaged font license payload | PASS — both upstream OFL texts and the third-party notice are byte-identical to their tracked sources in `app.asar` |

## Packaged QA evidence

- Evidence root basename: `cwgame-qa-v045-final-review-25f6881909024b789e6a1c1071af8ba0` (under the verifier's temporary directory; the absolute local path is intentionally omitted).
- QA run ID: `2f959c08-3918-4433-bbeb-b158ea6e8573`.
- Scope capture counts: `bootstrap` 22, `inventory` 12, `equipment` 14, `practice` 13, `qso` 24, `expedition` 11, `qsl-story` 8, `service-net` 10, `coordinate-relay` 10, `contest` 12, `listening` 11, `storm-relay` 12, `night-operations` 12, `final-promise` 11, `first-page` 9, and `lights` 6.
- Every capture is present exactly once in the manifest and independently passes the PNG signature, chunk ordering, chunk type, critical-chunk allowlist, CRC, decompression, dimension, colour, and non-empty pixel-data checks. All 197 images are 1439×912.
- Pixel-level duplicate validation admitted only three exact pre-declared warm-up pairs: warehouse radio, station listening, and the unsaved QSO result. No Chapter 7–15 mission-availability image relies on a duplicate allowlist; each intended mission card is scrolled into view before capture.
- Sixteen segment sentinels, fifteen state hand-offs, all chapter result files, and the root manifest carry the same QA run ID. Root and per-scope console error counts are zero; no failure or timeout marker exists.
- Chapter evidence validates settlement, mission claim, reload persistence, linked QSO/relationship facts, bounded archives, and duplicate-settlement no-ops. Expedition and Lights retain their dedicated failure/recovery and replay/idempotency evidence.
- The automatic-key helper reads the live configured WPM from each physical-CW screen. Deterministic 22 WPM regressions prove that a word such as `CHECK` remains intact after the Contest changes the saved keyer speed and that 150 ms renderer timer drift cannot split `SIMF3CC` into multiple words.

### Recovery evidence retained

- `cwgame-qa-v045-final-e6f6e2f678804bf58374e9ff9a3d9738` contains all 197 captures but no root success manifest; the pixel gate correctly rejected identical `contest-reloaded` and `listening-mission-available` views.
- `cwgame-qa-v045-final-pass-7b5fe1597327431ca0ae3c4fdd62844a` stopped in Storm Relay when a stale 18 WPM QA gap split the live 22 WPM word `CHECK` into `CH ECK`.
- `cwgame-qa-v045-release-dba0434a659146e29a702009bd2a6b32` contains all 197 captures but no root success manifest; the pixel gate exposed the same mission-card framing issue between Listening reload and the Chapter 12 availability checkpoint.
- `cwgame-qa-v045-review-fix-9d7b619df32a4dddb403120b54b36116` stopped in Contest when renderer timer drift extended an internal character gap and decoded `SIMF3CC` as `S IMF3CC`; it has no root success manifest.
- The final code fixes the evidence semantics rather than expanding duplicate policy: all Chapter 7–15 availability captures reveal their exact mission card. An isolated final-candidate Storm Relay run also passed 12/12 before the complete fresh chain.

## Runtime model integrity

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `qso-semanticformer-v0.4.int8.onnx` | 1,164,897 | `7cf7333e31c317db4c9636d4f74f83941865ae48d67ada4287884af65d203855` |
| `qso-semanticformer-v0.4.runtime-contract.json` | 5,344 | `73c7c96de8715602390c6b54a7847b6c06221ad98ba9374a0003b842b15f6de0` |

The packaged semantic smoke uses the bundled model through `onnxruntime-node`; missing or corrupt pinned bytes fail closed.

## Windows artifact

- File: `CWGame-latest.exe`
- Size: 149,289,426 bytes
- PE header: `MZ`
- Authenticode status: `NotSigned`
- SHA-256: `8e954b6e7e8a3200a4a5c2a0b804575ff088dbe41e42fe658ef7af3325b5d730`
- Unpacked `app.asar`: 80,527,041 bytes; SHA-256 `0f9695d498f66bf3b3db58c10aab4987feba97e3cf1fcef50ea9d8baa1f771a4`
- Fusion Pixel OFL SHA-256: `bc518cf64b8032c07690f33cc270c35c179255a6ac8efa7c165ebae7e8f76a63`
- Press Start 2P OFL SHA-256: `42f069b690469d0a2e534649f435e92371f5ff179e733f0812dec87c737a0e8f`

The portable executable is intentionally unsigned. Users should verify its SHA-256 and obtain builds only from the project's release channel.
