# Court Watch v3 Tennis Europe sharded recovery plan

Status: implementation plan, non-publishing and safe by default.

## Goals

- Keep the public v3 app on the last known good backup until live data is verified.
- Split Tennis Europe work into shards so one slow/failing country cannot block or erase the whole calendar.
- Fix the known Tennis Europe quality problems before republishing live data:
  - preserve specific tournament names instead of generic `Tennis Europe`;
  - use official detail pages only for location/date enrichment, without pairing neighboring search-result text;
  - decode HTML entities in names and locations;
  - include Camilla Lingeri in Tennis Europe scanning;
  - parse row-leading acceptance positions correctly, including `(OA)` rows, so labels are `MD-15`, `MD-39`, etc., not `MD-1`;
  - never publish if `players` is empty, FITP drops to zero, or TE collapses unexpectedly.

## Architecture

1. Tournament discovery shards by country group.
2. Merge tournament shards by `competitionId`.
3. Acceptance shards by balanced tournament batches.
4. Merge acceptance shards with guardrails.
5. Draw verification in a separate non-destructive step.
6. Publish only after validation.

## Guardrails

Publishing is blocked if any condition is true:

- `players.length === 0`
- FITP visible entries drop from a healthy baseline to zero
- Tennis Europe entries drop by more than 50% versus the last good baseline unless explicitly approved
- required shard outputs are missing
- merged tournament names are mostly generic `Tennis Europe`
- known label regression appears on `(OA)` rows

## Current public safety state

The app is intentionally reading the last good v3 backup commit while this new pipeline is built and validated.
