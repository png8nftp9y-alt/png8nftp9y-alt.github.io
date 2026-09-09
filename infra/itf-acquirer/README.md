# CourtWatch ITF persistent acquirer

Runs official ITF Tournament API reads inside one persistent Chromium profile.
It serializes requests, caches only valid JSON, and never treats an Imperva page
as an empty draw.

Required environment variable: `ITF_ACQUIRER_TOKEN`.

Expose the service through HTTPS on the VPS reverse proxy. CourtWatch uses
`ITF_ACQUISITION_URL=https://host.example/v1/fetch` and the same token.

Only URLs on `www.itftennis.com/tennis/api/TournamentApi/` are accepted.

## Optional factsheet route

`POST /v1/factsheet` accepts only official ITF tournament-page URLs and returns rendered page text after the existing serialized browser queue has run. It is isolated from `POST /v1/fetch`, which remains restricted to `TournamentApi` URLs.

The CourtWatch engines use this route only when both `ITF_FACTSHEET_ACQUISITION_URL` and `ITF_FACTSHEET_ACQUIRER_TOKEN` are explicitly configured. With those variables absent, the existing ITF and ITF T−1 acquisition paths are unchanged.
