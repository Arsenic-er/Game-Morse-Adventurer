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
tests 18 / pass 18 / fail 0
```

The review hardening was also TDD-driven. Negative fixtures first demonstrated that
missing or false protocol facts and malformed ledgers could pass the old validator.
The validator now requires a complete plain-object schema, all protocol checkpoints,
three well-formed selected contacts across at least two regions, non-empty string run
IDs, finite nonnegative integer counters, duplicate/reload equality, and the complete
staged money flow. Helper behavior tests replaced two source-regex assertions; the
remaining source checks cover only the packaged main-process wiring and read-only DOM
surface that cannot be exercised by the CommonJS helper tests.

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
147,811,304 bytes
2026-08-26 01:52:51.956 +09:00
```

The generated EXE was run as:

```text
release\CWGame-latest.exe --qa-lights-capture
```

The first review-round run was retained as a hard failure rather than discarded:

```text
C:\Users\jiang\AppData\Local\Temp\cwgame-lights-portable-round2-20260826-015303265
```

It failed during real keying because `SIM5LT` decoded as `SIM5EDT` while the document
was focused and visible. No new timing assumption was added. An unchanged, clean-TEMP
rerun of the same rebuilt EXE completed at:

```text
C:\Users\jiang\AppData\Local\Temp\cwgame-lights-portable-round2-final-20260826-015443749
```

Independent post-run validation returned true and found exactly six screenshots. Literal result facts were:

```text
grade=base
validQsoCount=3
distinctRegionCount=3
resolvedPileupCount=3
selected regions=JP, US, CN
seed: money=0, qsoLogCount=0, eventQsoCredits=0, settledRunIds=[]
before Base click: money=0, qsoLogCount=0, eventQsoCredits=0, one failed settledRunId
Base grade award=0; event QSO credits=0; qsoLogDelta=3; settledRunIdDelta=1
after achievement settlement: money=420 from first-qso=120 + regions-3=300
duplicate settlement: all durable facts unchanged at money=420, qsoLogCount=3
mission claim stage: story-05 mission=500 + first-name achievement=100; total=600
final: money=1020, qsoLogCount=3, eventQsoCredits=0
after reload: money=1020 with identical QSO count, run IDs, and claimed-achievement IDs; storyBestGrade=base
live QA processes after completion=0
```

The `420 -> 1020` transition is intentional but is not a Lights settlement reward.
Story Base has a grade award of zero and event QSO records carry zero credits. The
balance first reaches 420 only because settling three event QSOs unlocks the
`first-qso` (120) and `regions-3` (300) achievements. Claiming story-05 then pays its
500 mission reward and unlocks `first-name` for another 100, so that claim stage adds
600 and produces the final 1020 balance. Duplicate settlement is checked at the 420
stage and is a full durable-state no-op.

## Final verification

```text
node --test test/packaged-lights-qa-contract.test.cjs test/lights-event-acceptance.test.js
tests 21 / pass 21 / fail 0

pnpm test
tests 377 / pass 377 / fail 0

pnpm build
exit 0; 4628 modules transformed; built in 11.61s
```

Vite emitted its existing chunk-size warning for the roughly 982 kB main JavaScript chunk. No test or build failure was present.

## Delivered repair surface

- `.github/workflows/windows-portable.yml`: runs the literal JSON validator before accepting packaged evidence.
- `electron/main.cjs` and `electron/preload.cjs`: independent Lights CLI mode, QA focus/show behavior, and disabled background throttling for QA.
- `electron/qa-capture.cjs`: real held-paddle Z/X transmission, live pile-up selection, phase diagnostics, fail-closed evidence schema, staged reward accounting, Base/overlap/idempotency/reload evidence.
- `src/App.jsx`: restores the missing `QSO_EXIT_RISKS` import that blocked station entry.
- `src/screens/LightsEventScreen.jsx`: read-only pulse/decoded/result/settlement fact projections consumed by QA.
- `test/packaged-lights-qa-contract.test.cjs`: executable contracts and negative fixtures for the independent runner, timing boundary, complete evidence schema, staged money semantics, focus, dynamic callers, and reload diagnostics.

No push was performed.
