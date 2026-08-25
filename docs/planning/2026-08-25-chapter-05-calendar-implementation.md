# Chapter 5 “Lights” Calendar Slice — Implementation Plan

**Goal:** Establish the save-safe dual-calendar contract needed by the first story run, annual May replay, year-round practice, and clock-rollback protection.

**Scope:** This slice contains only deterministic calendar, annual-record, and save-migration logic. It does not add Chapter 5 to the mission list, define its radio exchange, or implement its map and pile-up UI.

**Design:** World time is derived from the real clock in the selected station’s IANA time zone. The first story run remains available on every date. After story completion, the annual run is available from May 1 through May 7, with May 5 marked as the special day; practice remains available throughout the year. A monotonic trusted-time guard pauses annual rewards after a rollback of more than five minutes and automatically clears once the clock catches up. Annual records keep one reward flag and the best score/grade per station-local calendar year.

## Tasks

1. Add failing unit tests for station-local date boundaries, availability modes, May 5, rollback/recovery, annual reward idempotency, best-record updates, and hostile legacy state.
2. Implement `src/game/worldCalendar.js` as a pure, bounded state module.
3. Add `worldCalendarVersion` and `worldCalendarState` to new saves and legacy normalization.
4. Extend save-store tests to lock the migration contract.
5. Run focused tests, the full game suite, production build, and server-side validation before committing.

