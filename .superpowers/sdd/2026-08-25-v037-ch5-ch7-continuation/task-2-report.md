# Task 2 report — independent packaged Lights QA repair

## Outcome

Task 2 now has a real independent `--qa-lights-capture` entry point. It seeds only a fictional story-05-ready save, drives the rendered game through real Z/X automatic-key input, follows the live pile-up roster, proves one failed run and a Base retry, and writes six screenshots plus literal JSON facts. The same path completed from the generated portable EXE.

The capture never writes decoded text, run state, settlement state, or `document.hasFocus`. QA-only DOM fields are read-only projections of the live keyer/result state.

## TDD and diagnosis

- Initial audit: `node --test test/packaged-lights-qa-contract.test.cjs` passed 13/13 for the inherited repair draft.
- RED: a one-renderer-execution regression for `RRR RST` failed because `sendAutomaticLightsText` was not exported/implemented as that boundary.
- GREEN: the whole real keydown/up, pulse observation, and gap loop moved into one renderer-side async IIFE; the contract passed.
- A direct run exposed `RST` decoding as `ENST`; the per-symbol main/renderer round trips were the source of timing jitter.
- RED: evidence with a missing `validQsoCount` was incorrectly accepted because `undefined < 3` is false.
- GREEN: the validator now requires integer `validQsoCount`, `distinctRegionCount`, and `resolvedPileupCount`; the renderer exposes those live result values as read-only DOM data.
- The first portable run then produced a hard failure at `pulseCount=18` while using quick-tap queueing. A renderer-idle-after-every-element hypothesis was disproved by the short direct probe (`RRR RST` split into individual E/T symbols).
- Final RED/GREEN: each real paddle keydown is held until the corresponding DOM pulse count increments, with keyup guaranteed in `finally`; idle is awaited only at character boundaries and the remaining 2/6 dot character/word gap is applied in the renderer. The final short direct probe passed before the portable rebuild.

Final contract result:

```text
node --test test/packaged-lights-qa-contract.test.cjs
tests 15 / pass 15 / fail 0
```

## Direct Electron evidence

The complete direct Electron run with the single-renderer protocol wrote evidence to:

```text
C:\Users\jiang\AppData\Local\Temp\cwgame-lights-direct-20260826-010239249
```

Its independently re-read JSON passed `validateLightsQaEvidence` and contained Base grade, 3 valid QSOs, 3 distinct regions, 3 resolved pile-ups, duplicate-settlement no-op facts, and reload equality. It produced six `lights-*.png` files.

After the final held-paddle refinement, a new direct timing probe wrote to:

```text
C:\Users\jiang\AppData\Local\Temp\cwgame-lights-probe-20260826-011601047
```

`RRR RST` decoded exactly, the flow advanced through the full chase, and both story-launch and chase screenshots were generated. This probe-only process was then deliberately terminated with SIGINT before rebuilding the portable artifact; it is not represented as a complete result run.

## Portable EXE evidence

Build command:

```text
pnpm exec electron-builder --win portable
exit 0
```

Artifact:

```text
release\CWGame-latest.exe
147,812,327 bytes
2026-08-26 01:21:42 local time
```

The generated EXE was run as:

```text
release\CWGame-latest.exe --qa-lights-capture
```

Complete evidence directory:

```text
C:\Users\jiang\AppData\Local\Temp\cwgame-lights-portable-final-20260826-012150945
```

Independent post-run validation returned true and found exactly six screenshots. Literal result facts were:

```text
grade=base
validQsoCount=3
distinctRegionCount=3
resolvedPileupCount=3
selected regions=JP, US, CN
qsoLogDelta=3
duplicate settlement: settledRunIds/money/qsoLogCount unchanged at money=420, qsoLogCount=3
after story-05 claim: money=1020, qsoLogCount=3
after reload: money=1020, qsoLogCount=3, identical settledRunIds
live QA processes after completion=0
```

The `420 -> 1020` transition is intentional: the Base run settlement first records three event QSOs and their ordinary QSO rewards (balance 420); claiming the ready story-05 mission then adds its 600 mission reward (balance 1020). Duplicate settlement is checked before the mission claim and changes neither balance nor logs. The reported positive `moneyDelta=1020` spans the isolated seed balance of zero through both the real settlement and the real mission claim.

## Final verification

```text
node --test test/packaged-lights-qa-contract.test.cjs test/lights-event-acceptance.test.js
tests 18 / pass 18 / fail 0

pnpm test
tests 374 / pass 374 / fail 0

pnpm build
exit 0; 4628 modules transformed; built in 13.60s
```

Vite emitted its existing chunk-size warning for the roughly 982 kB main JavaScript chunk. No test or build failure was present.

## Delivered repair surface

- `.github/workflows/windows-portable.yml`: runs the literal JSON validator before accepting packaged evidence.
- `electron/main.cjs` and `electron/preload.cjs`: independent Lights CLI mode, QA focus/show behavior, and disabled background throttling for QA.
- `electron/qa-capture.cjs`: real held-paddle Z/X transmission, live pile-up selection, phase diagnostics, Base/overlap/idempotency/reload evidence, and schema validation.
- `src/App.jsx`: restores the missing `QSO_EXIT_RISKS` import that blocked station entry.
- `src/screens/LightsEventScreen.jsx`: read-only pulse/decoded/result fact projections consumed by QA.
- `test/packaged-lights-qa-contract.test.cjs`: executable contracts for the independent runner, timing boundary, evidence schema, focus, dynamic callers, and reload diagnostics.

No push was performed.
