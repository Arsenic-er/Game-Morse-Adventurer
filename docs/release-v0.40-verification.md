# v0.40.0 Release Verification

## Release boundary

- Chapters 5–10 are implemented. This release completes the Chapter 7 QSL investigation, Chapter 8 fictional service net, Chapter 9 Pixel Grid coordinate relay, and Chapter 10 RUN / S&P contest.
- Chapters 11–15 remain planned and are not playable.
- The target remains an unsigned, offline Windows x64 portable prototype. The repository is source-available for public review under a proprietary license.
- Real emergency traffic, real organizations, real emergency frequencies, multiplayer communication, online rankings, arbitrary chat, and on-air portraits are out of scope.

## Verification checklist

The final values below are intentionally left pending until the Task 14 commands run against the v0.40.0 candidate.

| Gate | Final evidence |
|---|---|
| `pnpm test` | Pending |
| `pnpm qso:simulate:poor` | Pending |
| `pnpm qso:calibrate` | Pending |
| `pnpm mission:economy` | Pending |
| `pnpm semantic:model:sync` | Pending |
| `pnpm build` and largest owned JS | Pending |
| `pnpm desktop:build` | Pending |
| Packaged semantic smoke | Pending |
| Portable executable size / SHA-256 / signature | Pending |
| Packaged font licenses and model hashes | Pending |
| Fresh 142-capture, 11-scope packaged QA | Pending |
| Repository integrity and final review | Pending |

## Packaged QA contract

The final run must use one new exclusive evidence root and one `qaRunId`. It must contain exactly 142 manifest paths across `bootstrap`, `inventory`, `equipment`, `practice`, `qso`, `expedition`, `qsl-story`, `service-net`, `coordinate-relay`, `contest`, and `lights`; every segment must report zero console errors and no failure or timeout marker. The Chapter 7–10 evidence files must each prove settlement, mission claim, reload persistence, and duplicate-settlement no-op behavior.
