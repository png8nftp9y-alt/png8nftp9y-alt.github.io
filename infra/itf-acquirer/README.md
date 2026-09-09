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

CourtWatch uses the dedicated factsheet variables when present; otherwise the acceptance workflows derive `/v1/factsheet` from the existing `ITF_ACQUISITION_URL` and reuse `ITF_ACQUIRER_TOKEN`. The fallback is called only by factsheet metadata reads. The existing `/v1/fetch` API path and the ITF T−1 acquisition workflow remain unchanged.
