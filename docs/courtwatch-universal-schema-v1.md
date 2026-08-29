# Court Watch universal data schema v1

Status: shadow. This model does not replace the public v3 files or alter the three acquisition engines.

## Principles

- FITP, Tennis Europe and ITF remain distinct through the mandatory circuit field.
- Every entity retains its original source identifier, URL and observation time.
- Court Watch IDs are deterministic and use official source IDs when available.
- Heavy source archives stay on R2. D1 will contain application indexes, users, preferences and manual data.
- Missing historical coverage is explicit; a shadow generation cannot claim completeness.

## Entities

| Entity | Relationship | Purpose |
| --- | --- | --- |
| player | Court Watch identity and official IDs | One person across circuits |
| tournament | circuit and source ID | Canonical tournament |
| entry | tournament and player | Acceptance, withdrawn or draw-confirmed relation |
| match | tournament and players | Draw/result unit |
| schedule | tournament/match and players | OOP and revisions |
| result | tournament/match and players | Score and outcome |

## Readiness gate for OOP and results

Point 2 may start when the shadow builder runs, IDs are unique, references are valid, circuit/provenance are preserved, false completeness is blocked and the workflow completes green without publishing to the current app.

Historical completeness is a separate engine certification requiring missing=0, retry=0 and unreadable=0 for expected inventories.
