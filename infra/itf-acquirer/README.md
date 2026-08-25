# CourtWatch ITF persistent acquirer

Runs official ITF Tournament API reads inside one persistent Chromium profile.
It serializes requests, caches only valid JSON, and never treats an Imperva page
as an empty draw.

Required environment variable: `ITF_ACQUIRER_TOKEN`.

Expose the service through HTTPS on the VPS reverse proxy. CourtWatch uses
`ITF_ACQUISITION_URL=https://host.example/v1/fetch` and the same token.

Only URLs on `www.itftennis.com/tennis/api/TournamentApi/` are accepted.
