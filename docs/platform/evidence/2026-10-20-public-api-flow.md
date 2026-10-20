# Producers, consumers and the public API on the public host, 20 October 2026

Target: the public HTTPS address, after pipeline run 39441445313 (SCA, SAST,
verify, image scan, deploy, DAST and smoke load all passed). The workers run in
demo mode: no model key is set on the host, so answers are placeholders that
show the input the worker received.

## A producer and a consumer with one API key

| Step | Request | Result |
|---|---|---|
| Sign up (cookie) | `POST /api/auth/signup` | 201 |
| Create a key with five scopes | `POST /api/v1/keys` | 201, key shown once, prefix kept |
| Use the key on a web route | `GET /api/projects` with `Bearer` | 403 |
| Publish an agent (producer) | `POST /api/v1/agents` | 201 |
| List agents | `GET /api/v1/agents` | the new slug is listed |
| Ask with the agent (consumer) | `POST /api/v1/questions` | 201 with `sessionId` |
| Read the answer | `GET /api/v1/questions/:id` | `ended` after 4.9 s, cost USD 0.01, agent `literature-scout-demo`, 1 finding |
| Read usage | `GET /api/v1/usage` | as consumer and as producer: 1 session, USD 0.01, median 4.89 s to rest |
| OpenAPI | `GET /api/v1/openapi.json` | 200 |
| Rate limit | 25 quick `GET /api/v1/agents` | 21 × 200, then 429 |

The worker's input began with `Instructions from the agent "Literature Scout"`,
so the chosen agent reached the worker through the intent row.

## The second app: the literature watch

`node apps/watch/publish-agent.mjs` published `literature-scout`. Then
`node apps/watch/watch.mjs` with one topic asked through the API, polled, and
printed a digest: status `ended`, cost USD 0.01, 5 s, exit code 0. The app used
only `LUMEN_URL` and `LUMEN_API_KEY`.
