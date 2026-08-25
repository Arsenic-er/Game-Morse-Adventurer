# World Calendar Heartbeat — Implementation Plan

**Goal:** Persist the trusted world clock while an active save is being played so Chapter 5 annual-reward rollback protection works across restarts.

**Design:** A pure save helper advances the versioned world-calendar state using the active station’s IANA time zone. The application touches the active save immediately on entering Home, Station, or save-backed Practice, then once per minute. A no-op tick preserves object identity and skips storage writes. The heartbeat changes only world-calendar fields; it does not rewrite the save’s player-activity timestamp.

## Tasks

1. Add failing tests for trusted-time advancement, no-op identity, rollback persistence, recovery, and renderer wiring.
2. Export a one-minute heartbeat contract and pure calendar advancement function.
3. Add a save-level touch helper with migration-safe normalization.
4. Wire the helper into the active-save lifecycle without per-second persistence.
5. Run focused tests, full tests, production build, review, and new-server verification.

