# v0.40.0 Release Verification

Verified on 2026-08-28 for the local Windows x64 portable build. This report records release evidence; it does not alter the source-available proprietary license or imply that the unsigned binary has an Authenticode signature.

## Release boundary

- Chapters 5–10 are implemented. This release completes the Chapter 7 QSL investigation, Chapter 8 fictional service net, Chapter 9 Pixel Grid coordinate relay, and Chapter 10 RUN / S&P contest.
- Chapters 11–15 remain planned and are not playable.
- The target remains an unsigned, offline Windows x64 portable prototype. The repository is source-available for public review under a proprietary license.
- Real emergency traffic, real organizations, real emergency frequencies, multiplayer communication, online rankings, arbitrary chat, and on-air portraits are out of scope.

The seven localized README files use this same boundary and retain the public `cwformer` repository link, source-available proprietary license wording, and explicit unsigned Windows-build notice.

## Verification results

| Gate | Result |
| --- | --- |
| `pnpm test` | PASS — 638 tests, 0 failures |
| Chapter 7–10 CW / evidence regression suites | PASS — real CW input, strict semantic evidence, bounded mission normalization, relationship stability, duplicate settlement, and visible settlement-state checks |
| `pnpm qso:simulate:poor` | PASS — 15/15, release ready |
| `pnpm qso:calibrate` | PASS — 35 cases, 0 issues, release ready |
| `pnpm mission:economy` | PASS — QSO income 3,495, mission income 3,290, research points earned 62 / spent 24 / balance 38 |
| `pnpm semantic:model:sync` | PASS — both pinned runtime files verified locally without download |
| `pnpm build` | PASS — 4,666 modules; 53,458,435 bytes total; largest owned JavaScript 506,812 bytes against a 512,000-byte budget |
| `pnpm desktop:build` | PASS — portable Windows executable produced |
| Packaged `--semantic-smoke` | PASS — `onnxruntime-node`, model `qso-semanticformer-0.4`, interpretability 100 |
| Full packaged `--qa-capture` | PASS — 142 manifest-bound PNG captures across 11 scopes |
| Packaged font license payload | PASS — both upstream OFL texts are byte-identical to their tracked sources in `app.asar` |
| Repository integrity | PASS — diff checks, lockfile check, authorship audit, and high-confidence secret / absolute-user-path scans are clean |

## Packaged QA evidence

- Evidence root basename: `cwgame-qa-v040-final-15474f24c59447279ddf1bada5d422a5` (under the verifier's temporary directory; the absolute local path is intentionally omitted).
- QA run ID: `ea50c560-95d9-4646-a60b-5014d117e355`.
- Scopes and capture counts: `bootstrap` 22, `inventory` 12, `equipment` 14, `practice` 13, `qso` 24, `expedition` 11, `qsl-story` 8, `service-net` 10, `coordinate-relay` 10, `contest` 12, and `lights` 6.
- Independent revalidation found exactly 142 physical PNG files, 142 manifest paths, and 142 unique paths. Every PNG passed the signature, chunk, CRC, decompression, dimensions, colour, and visible-pixel checks.
- All 11 segment sentinels carry the same run ID. Root and segment console error counts are zero, and no failure or timeout marker exists.
- Expedition evidence proves a real failure penalty, `AGN` recovery, successful settlement, SORA identity/QSL linkage, persisted QSL choice, exact duplicate-choice no-op, pause without catch-up, reachable timeout and battery depletion, a durable replay entry, and replay with no duplicate reward.
- Chapter 7 evidence proves one bounded QSL event QSO, final `request-review` choice, settlement, mission claim, reload persistence, and duplicate-settlement no-op.
- Chapter 8 evidence proves three deterministic service messages and receipts, one event QSO, settlement, mission claim, reload persistence, and duplicate-settlement no-op.
- Chapter 9 evidence proves packet `472`, fictional grid `PX-6075-7831`, two event QSOs, settlement, mission claim, reload persistence, and duplicate-settlement no-op.
- Chapter 10 evidence proves an explicit 22 WPM QA configuration, six valid contacts split 3 RUN / 3 S&P across six regions, silver grade, six event QSOs, settlement, mission claim, reload persistence, and duplicate-settlement no-op inside the unchanged five-minute contest window.
- Chapter 7–10 result and settled captures are all pixel-distinct because each screen exposes a visible persisted-settlement acknowledgement; the aggregate duplicate-image gate did not need a new exception for these pairs.
- Lights evidence proves story launch, chase and control, Escape pause/resume, failed-run retry, three contacts across three regions, Base settlement, exact duplicate no-op, mission/achievement money flow to 1,140, and reload persistence.

## Runtime model integrity

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `qso-semanticformer-v0.4.int8.onnx` | 1,164,897 | `7cf7333e31c317db4c9636d4f74f83941865ae48d67ada4287884af65d203855` |
| `qso-semanticformer-v0.4.runtime-contract.json` | 5,344 | `73c7c96de8715602390c6b54a7847b6c06221ad98ba9374a0003b842b15f6de0` |

The tracked runtime succeeds with network access denied. A missing or corrupt local model fails closed instead of downloading a replacement or reporting a false provider success.

## Windows artifact

- File: `CWGame-latest.exe`
- Size: 149,796,433 bytes
- PE header: `MZ`
- Authenticode status: `NotSigned`; signer absent
- SHA-256: `58f90f2f5b2e23152e06b4efe581fb11aca818cb6921cf3a5eff635920e14708`
- Local checksum sidecar matches the executable exactly and remains an ignored build artifact.
- Unpacked `app.asar`: 80,232,625 bytes; SHA-256 `df1baeca5f40741e8cfd5201dc9b71f997067ccd1d87023a8a90b2af80102e9a`.
- Fusion Pixel OFL: 4,514 bytes; SHA-256 `9291281eaa1275afe06285d010362c175efcf8766a37c9bac274a770550fe4fc`; byte-identical to the tracked source.
- Press Start 2P OFL: 4,504 bytes; SHA-256 `91b5d31c7f6635b071ca77123fdf788800c752dac10988d607a10b08ba7dd762`; byte-identical to the tracked source.

The portable executable is intentionally unsigned. Users should verify its SHA-256 and obtain builds only from the project's release channel.

## Review and repository integrity

- Release review reproduced and closed the inherited/sparse mission-ledger flaw plus descriptor/coercion traps, mixed-invalid and duplicate mission proof ledgers, noncanonical mission history/event ordering, the Chapter 7–9 text-input bypasses, Chapter 10 missing-CQ and direct AGN/QRS submission paths, semantic-null acceptance, relationship drift, wrong Chapter 7 event frequency, non-executed duplicate-settlement checks, and contradictory completed-state error banners. Each was first captured by a failing regression and then repaired without weakening the packaged gates.
- The complete suite passed 638/638 before the final package and QA run. The final package then passed all 142 captures, including real CW entry and recovery for Chapters 7–10 and actual second settlement calls returning exact no-op outcomes.
- One preceding full-chain attempt ended after the practice scope had already written 13/13 captures, its sentinel and a zero-error console report, because the Windows portable child returned transient `0x80000003`. The same executable and predecessor state immediately passed an isolated 13/13 practice run; the recorded final full-chain evidence above was nevertheless generated from a new exclusive root and completed with supervisor exit 0.
- The branch range from v0.37 contains no `pnpm-lock.yaml` change. Every Chapter 7–10 commit has author and committer `Arsenic-er <302726993@qq.com>` with no co-author trailer.
- `git diff --check` passes for the worktree and the complete v0.37-to-v0.40 range. High-confidence credential, private-key, bearer-token, and absolute local-user-path scans report zero tracked findings.
