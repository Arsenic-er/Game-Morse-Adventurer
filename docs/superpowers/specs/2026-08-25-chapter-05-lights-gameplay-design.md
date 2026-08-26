# Chapter 5 “Lights Across the Air” Gameplay Design

## Status

Implemented in v0.37.0 as the complete Chapter 5 presentation. This specification builds on the dual-calendar and active-save clock contracts in `worldCalendar.js` and `worldCalendarHeartbeat.js`; chase, pile-up, exchange, scoring, settlement, mission, economy, save, narrative, archive-backed lights map/history, annual records, stamps, achievements, failure coaching, and seven-language UI contracts are executable. NPC portraits remain excluded from on-air scenes.

## 1. Purpose and boundaries

Chapter 5 is the first event-style CW chapter. It teaches the player to hear a crowded frequency, recover a partial callsign, complete a short event exchange, and then operate the event station for a timed slot.

The implemented chapter includes:

- the event identity and radio contract;
- story, annual, and practice entry modes;
- Chapter 5 mission-tree integration;
- the chase-station stage;
- deterministic 2–4-station pile-ups;
- full, partial, and repeat-request callsign handling;
- the player-operated event-station stage;
- exchange validation, scoring, grades, and rewards;
- annual and daily reward idempotency.
- fixed NOVA→SORA→MORSE narrative beats and cause-specific failure coaching;
- stable person/station identities and bounded event-run archives;
- an archive-backed lights map, annual/practice history, stamps, and achievements.

Chapter 5 does not include portraits, new equipment, the full Chapter 7 story, or Chapters 8–15. Chapter 6 is implemented separately as a playable expedition vertical slice; Chapter 7 has only the QSL/person-choice foundation in v0.37.0.

## 2. Frozen event identity

The event is entirely fictional and must not use a real club, organization, contest, callsign, or award name.

| Locale | Display name |
|---|---|
| English | Lights Across the Air |
| 简体中文 | 空中灯火纪念通联 |
| 繁體中文 | 空中燈火紀念通聯 |
| 日本語 | 空をつなぐ灯火記念QSO |
| Español | Luces en el aire |
| Deutsch | Lichter über Funk |
| Русский | Огни в эфире |

- Stable event ID: `lights-across-air`
- Chapter mission ID: `story-05`
- Fictional special-event callsign: `SIM5LT`
- On-air event token: `LGT`
- Main operator: SORA
- Story prerequisite: `story-04`

`SIM5LT` uses the game’s reserved fictional `SIM` namespace, contains only uppercase ASCII letters and digits, stays within the seven-character callsign limit, and does not collide with any current fixed or procedural station.

## 3. Event-region codes

Event-region codes are exchange data, not real callsign prefixes. The six-code catalogue maps directly onto the existing procedural population and playable locations.

| Code | Event region | Source region/location mapping |
|---|---|---|
| `JP` | Japan | `JP`; all Japan locations |
| `US` | United States | `US`; all United States locations |
| `CN` | China | `CN`; all China locations |
| `GE` | Rhine region | procedural `DE`; `europe-rhine-valley` |
| `CH` | Alpine region | procedural `CH`; `europe-swiss-lake` |
| `FI` | Nordic lakes | procedural `FI`; `europe-finland-lake` |

`GE` deliberately replaces `DE` in the event exchange because `DE` already means “from” in CW procedure. Unknown codes never count toward an exchange or distinct-region score. A player’s transmitted code comes from the selected save location; it is never inferred from the player-entered callsign.

The event roster must make at least five distinct codes reachable in every run. The generation algorithm therefore chooses region codes before choosing operators and must not rely on chance to satisfy the gold-grade requirement.

## 4. Three run modes

### Story

- Available on every real date until `story-05` is claimed.
- Uses a forced May 5 evening ambience without changing the trusted world clock.
- Starts with the chase stage and continues into the control stage.
- The first base-grade completion advances the story and unlocks SORA.
- Failure in the control stage allows an immediate control-stage retry; the chase stage does not need to be repeated during that mission attempt.

### Annual

- Available after story completion from May 1 through May 7 in the save location’s IANA time zone.
- Uses the same `SIM5LT` station and the control-stage rules.
- May 5 adds a gold-edged dated log stamp; the other six days use the standard dated stamp. A later May 5 completion may upgrade that year’s standard stamp without granting money again.
- The fixed annual money reward is available once per station-local calendar year. Better later results may update the best score and grade but do not pay again.
- A detected clock rollback pauses money and the dated stamp while still allowing play and best-record improvement.

### Practice

- Available year-round after story completion.
- Uses the control stage only.
- The first completed practice run on a station-local date establishes the paid grade. A later higher grade pays only the difference up to that date’s 80-money maximum; an equal or lower grade pays zero.
- Practice never grants technology points or annual stamps.

## 5. Chapter 5 mission contract

`story-05` is locked until `story-04` is claimed. Accepting the mission freezes a Chapter 5 session contract rather than scanning old QSO logs.

The mission is ready to claim only when the session result contains:

- mode `story`;
- chase stage completed;
- at least base grade in the control stage;
- at least three valid event QSOs;
- at least two distinct event-region codes;
- at least one resolved pile-up containing two or more callers.

Claiming `story-05` is atomic: mission history, money, technology points, SORA’s revealed name, Chapter 5 story-completed state, and the best story result must be persisted together. Repeating or reloading cannot claim any component twice.

## 6. Chase-stage radio flow

SORA operates `SIM5LT`. The player uses the save’s own callsign and region code.

Canonical flow:

```text
CQ LGT CQ LGT DE SIM5LT K
SIM5LT DE <PLAYER> K
<PLAYER> DE SIM5LT RST 599 JP K
SIM5LT DE <PLAYER> RST <RST> <PLAYER_REGION> K
<PLAYER> DE SIM5LT TU 73 SK
```

The player’s report is accepted when the semantic structure contains:

- `SIM5LT` as the peer callsign;
- the save callsign as the self callsign;
- one legal RST value matching `[1-5][1-9][1-9]`;
- the exact region code assigned from the save location;
- a turn handoff or close token: `K`, `KN`, `TU`, `73`, or `SK`.

`RST` and leading `R` are optional. `PSE`, `TU`, and `73` are harmless additions. Whitespace loss and small inter-character timing breaks are evaluated by the existing semantic/quality pipeline and are not hard format failures. A wrong callsign, illegal RST, or wrong/unknown region code remains a hard field error.

The chase stage may use `AGN K` or `QRS K` without changing SORA, the event exchange, the channel seed, or the eventual reward.

## 7. Deterministic pile-up engine

Each control-stage round freezes a responder set and an audio schedule. Repeats reuse the same set and facts; they never reroll an easier answer.

The story roster is derived from the save’s world seed plus `story-05`. Annual rosters add the station-local year, and practice rosters add the station-local date plus run sequence. All three draw from the existing procedural population while selecting event regions first, so identities retain their generated skill, speed, personality, and error tendencies without compromising region reachability.

| Guidance | Callers | WPM | Pitch range | Start offset |
|---|---:|---:|---:|---:|
| Full | 2 | 12–16 | 540–720 Hz | 180–480 ms |
| Hints | 2–3 | 15–20 | 520–760 Hz | 120–520 ms |
| Off | 3–4 | 18–24 | 500–780 Hz | 80–560 ms |

Additional rules:

- adjacent callers differ by at least 35 Hz;
- relative amplitude ranges from 0.55 to 1.00;
- every callsign is transmitted twice;
- at least one prefix or suffix fragment of every caller is unobscured by another caller;
- QSB and propagation strength come from the existing map and equipment snapshot;
- a run seed, round number, mode, and guidance level reproduce the same roster and schedule;
- a round contains at least two distinct region codes whenever the remaining grade target requires them.

The state engine owns caller identity, timing, pitch, strength, and repeat facts. Audio rendering consumes this schedule and does not decide gameplay outcomes.

## 8. Partial-callsign and repeat handling

The player has three valid selection actions after a pile-up:

1. Full call: `<CALLSIGN> K` or `<CALLSIGN> DE SIM5LT KN`.
2. Partial call: a known prefix or suffix of at least two characters plus one wildcard, such as `SIMU? K` or `?4K2 K`.
3. General repeat: `AGN K` or `QRZ K`.

Resolution rules:

- one full match selects that station;
- one partial match selects that station and counts as a successful partial recovery;
- multiple partial matches cause only the matching subset to repeat;
- no partial match returns a short question response and keeps the original responder set;
- `AGN`/`QRZ` repeats the complete responder set with the same callsigns and exchange facts;
- naming a complete callsign that is not in the frozen responder set records one misidentification;
- partial calls and repeat requests never count as misidentifications;
- six consecutive dots or six consecutive dashes still clear only the current transmit buffer and do not alter the round.

Full guidance may reveal the caller count and up to two correctly copied character positions. Hints reveals only caller count. Off reveals no visual identity information.

## 9. Player-operated event-station flow

During the control stage, the on-air self callsign is `SIM5LT`; the save callsign remains operator metadata for logs and ownership.

Canonical round:

```text
CQ LGT CQ LGT DE SIM5LT K
SIM5LT DE <CALLER> <CALLER> K
<CALLER> DE SIM5LT KN
SIM5LT DE <CALLER> RST <RST> <CALLER_REGION> K
<CALLER> DE SIM5LT RST <RST> <PLAYER_REGION> K
SIM5LT DE <CALLER> TU 73 SK
```

The event parser accepts the same harmless variants as the chase parser. It also accepts the region before or after the RST token, provided the semantic result contains one unambiguous legal RST and one known event-region code.

A valid event QSO:

- is written to the normal QSO log with `eventId`, `eventMode`, `eventRegionCode`, `onAirCallsign`, and `operatorCallsign` metadata;
- updates operator relationships and career QSO counts;
- does not receive the ordinary base/weak/new-region/new-distance QSO money breakdown;
- receives money only through the run-level reward ledger below.

This separate reward policy prevents a seven-contact event run from becoming a repeatable money exploit while preserving the contacts as real career history.

## 10. Session, scoring, grades, and rewards

The control slot ends after eight minutes or immediately after the seventh valid QSO. The timer pauses while the game menu is open or the application is not in an active gameplay state.

Session facts:

- `validQsoCount`
- `distinctRegionCount`
- `resolvedPileupCount`
- `successfulPartialCount`
- `misidentificationCount`
- `agnRequestCount`

Score, clamped to `0..999`:

```text
validQsoCount * 100
+ distinctRegionCount * 25
+ successfulPartialCount * 15
- misidentificationCount * 25
- agnRequestCount * 5
```

Grades are based on facts, not score thresholds:

| Grade | Requirements |
|---|---|
| Base | 3 valid QSOs, 2 regions, 1 resolved pile-up |
| Silver | 5 valid QSOs, 4 regions, 1 resolved pile-up |
| Gold | 7 valid QSOs, 5 regions, 1 resolved pile-up, 0 misidentifications |

Rewards:

| Mode/result | Money | Technology points | Other |
|---|---:|---:|---|
| Story base completion | 500 | 2 | SORA unlocked; story completion |
| Story silver improvement | +100 total grade bonus | 0 | Silver record |
| Story gold improvement | +200 total grade bonus | 0 | Gold record; medal progress |
| Annual completion | 300 | 0 | Dated annual stamp |
| Practice base/silver/gold | 40 / 60 / 80 | 0 | First rewarded run per station-local date only |

Story grade bonuses are lifetime totals shared by later annual and practice runs, not per-run payments. A story base result followed by a later gold event result pays only the additional 200; silver followed by gold pays only the remaining 100. Annual money is fixed regardless of grade and can be paid once per year. Practice rewards use the best rewarded grade on that date and may pay only the difference if improved later that day.

All settlements use an immutable run ID plus mode-specific ledger keys:

- story: `lights:story:<saveId>`;
- annual: `lights:annual:<saveId>:<stationYear>`;
- practice: `lights:practice:<saveId>:<stationDateKey>`.

The story-grade bonus uses the separate monotonic key `lights:grade:<saveId>` so annual or practice settlement can safely pay only a previously unclaimed grade difference.

Persist the result, mission progress, relationship changes, QSO logs, money, technology points, annual/practice ledger, and best record in one save replacement. A repeated run ID or already-paid ledger amount returns a no-op result.

## 11. Error and recovery behavior

- Invalid or incomplete radio input keeps the same stage, round, roster, and timer state and returns a field-specific correction.
- ONNX unavailability falls back to the deterministic event grammar; it must not make the chapter impossible.
- Corrupt or unknown persisted event records are normalized to bounded values and never grant money.
- Save migrations never infer a past annual/practice reward and never retroactively pay one.
- If the process closes before settlement, the run remains unclaimed; replaying it generates a new run ID and can settle exactly once.
- Abandoning an active run does not pay, grade, or record its unfinished contacts as completed event QSOs.

## 12. Acceptance criteria

- Story, annual, and practice availability follows the frozen calendar contract.
- Chapter 5 unlocks only after Chapter 4 and advances on base grade.
- The chase flow accepts standard and harmlessly varied exchanges but rejects wrong hard fields.
- All guidance levels generate reproducible, solvable 2–4-caller pile-ups.
- Full, partial, ambiguous partial, wrong full call, and `AGN`/`QRZ` paths are independently tested.
- At least five event regions are reachable in every seven-contact run.
- Base, silver, and gold boundaries are exact and tested.
- Story, annual, and practice rewards are idempotent under retry, reload, clock rollback, and grade improvement.
- Event contacts update logs and relationships without ordinary per-QSO money.
- Existing QSO, mission, economy, save migration, semantic, and world-calendar suites remain green.
