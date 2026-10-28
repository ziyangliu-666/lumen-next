# Report: the hosting, persistence, sequence and source animations (subagent, 2026-10-21)

Verbatim report from the subagent that wrote `scenes_physical.py`.

---

The four scenes are drawn in `scenes_physical.py`, and `SCENES` holds hosting, persistence, sequence and source. I looked at every step still in `out/steps/` and fixed each overlap I found: the well label hit the Traefik box, the check marks hit the pod labels, the "SHA-256" block was clipped, a label crossed the branch line, and the last sequence arrow went past the bottom margin. Every label is 13 pt or more, and nothing is inside the 0.3 in margin or the title band.

I changed no other source file and committed nothing. `make.py` wrote new GIFs and PNGs into `out/`. This replaces the old tracked `out/hosting.gif` with the new scene.

**hosting**, 26.9 s
1. One t3.medium server in AWS Singapore, about USD 1.3 a day
2. Only ports 22, 80 and 443 are open; 6443 stays closed
3. A request enters on 443; Traefik serves HTTPS
4. Traefik routes the request by its path to a service
5. Services call each other on /internal with a secret header
6. From outside, /internal has no route: it stops at Traefik
7. A push deploys over SSH; the pods are replaced one by one

Facts I was not sure of:
- I drew port 80 as a plain line into Traefik. I did not check what it does (an HTTPS redirect, and the Let's Encrypt HTTP-01 challenge).
- The AWS README opens port 22 to one address only (`<your-ip>/32`). The slide shows 22 as simply open.
- The rolling update gives all five pods a check, one after another. Each pod replaces itself on its own, so the order is only for the picture.

**persistence**, 28.7 s
1. One PostgreSQL database; each context keeps its own tables
2. An API key is stored only as its SHA-256 hash
3. RabbitMQ keeps three durable queues; files go on a volume
4. A question writes its session and task rows
5. Its turn waits in lumen.turns.0 until a worker is done
6. The work writes step rows, a ledger row and a finding
7. The worker acknowledges, and the turn leaves the queue
8. Today one database for all; next, one per service. The grey line under the wells says "one database, tables split by context · next: one database per service".

Facts I was not sure of:
- The rows use the real table names from the migrations. I followed your grouping: `platform_api_keys` under identity, and `platform_agents` and `findings` under projects. The `platform_` prefix does not show an owner. `public-api.md` says the key routes run in identity, but the contract lists `/api/keys/*` under billing.
- Step 7 marks the acknowledgement with a check in the queue cell where the turn sat.

**sequence**, 26.0 s
1. The literature watch app asks a question with its API key
2. Project creates a project and asks session to start
3. Session puts the first turn on the lumen.turns.0 queue
4. A worker takes the turn and applies the agent's instructions
5. The worker calls gpt-4.1-nano and reports each step
6. The worker says done; the app reads the answer

Facts I was not sure of:
- The gateway lifeline stands for the Traefik Ingress, because there is no gateway service.
- "GET answer" goes from the app straight to session, across the gateway lifeline. There is no separate return arrow.
- In the code, "done" goes to session and the acknowledgement then goes to RabbitMQ. The diagram shows only the "done" message.

**source**, 20.7 s
1. One monorepo holds the server, both apps and the chart
2. main is the monolith; ass/platform is this platform
3. Each member works on a branch and merges it into ass/platform
4. The push builds one image, tagged with the commit SHA
5. No registry: the image goes over SSH, straight into k3s
6. helm upgrade replaces the pods with the new image

Facts I was not sure of:
- The workflow runs the checks (verify, npm audit, CodeQL, Trivy) before the deploy. The slide leaves them out, because the pipeline slide shows them.
- I drew three member branches with no names, where the team has five.
- The image tag shows as `lumen-next:<commit sha>`, so the slide does not invent a SHA.

All four loops run 21 to 29 s, a little more than the 15 to 25 s that the visual review suggests. If you want them shorter, cut the holds.
