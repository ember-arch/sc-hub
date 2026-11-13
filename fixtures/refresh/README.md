# fixtures/refresh

The early start of the refresh (ADR-059).

- `early.json` — the last build the News workflow's check (`scripts/refresh/early.ts`) started the refresh for, and when. A build is asked for once; written by the step, never by hand. Absent until the check first starts a refresh.
