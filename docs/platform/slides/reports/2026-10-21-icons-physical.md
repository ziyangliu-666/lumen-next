# Report: icons and business motion in the physical scenes (subagent, 2026-10-21)

Verbatim report from the subagent that redrew hosting, sequence and source in `scenes_physical.py`.

---

I rewrote `hosting()`, `sequence()` and `source()`. I did not change `persistence()`. Every part is now an icon with a short label under it. The moving thing is the business object. I rendered each scene alone, checked the stills in `out/steps/`, and fixed each overlap that I found. Every label is 13 pt or more.

## hosting, 27.3 s

The AWS server is one thin frame. A cloud icon and "AWS ap-southeast-1 · t3.medium · k3s" sit in its corner. The left edge of the frame is the security group wall.

1. One t3.medium server in AWS Singapore, about USD 1.3 a day. The browser icon and GitHub (a branch icon) are outside the frame.
2. Only ports 22, 80 and 443 are open; 6443 stays closed. The wall lights up. It has a gap at 443, 80 and 22. At 6443 it has a cross, and the number is grey.
3. A request enters on 443; Traefik serves HTTPS. A question bubble travels from the browser through port 443 to the gateway icon ("Traefik · HTTPS").
4. Traefik routes the request by its path to a service. The bubble travels along the route line to the project folder. The five services are icons in one row: identity (key), project (folder), session (stream), worker (gear), billing (wallet).
5. Services call each other on /internal with a secret header. The bubble goes from project to session on the cluster network line under the services. The words "/internal" and "x-lumen-internal" show under that line. PostgreSQL (database icon) and RabbitMQ (queue cells) hang from the same line.
6. From outside, /internal has no route: it stops at Traefik. The bubble goes from the browser to the gateway again. A lock icon closes the route line after the gateway, and "/internal" shows over the browser.
7. A push deploys over SSH; the pods are replaced one by one. An image box travels from GitHub through port 22 to the helm icon. Then each service greys out, lights up again, and gets a check, one after another.

## sequence, 27.5 s

The lifeline heads are icons: watch app (app), gateway, project (folder), session (stream), RabbitMQ (queue cells), worker (gear), model (spark). Each message has a small icon of the object that it carries, in front of its words. While the message is sent, the same object rides along the arrow.

1. The literature watch app asks a question; the gateway checks its key. Messages: "question + API key" (question bubble), then a call to itself, "check the key" (key icon).
2. Project creates a project and asks session to start. Messages: "create project" and "start session" (question bubble).
3. Session puts the first turn on the lumen.turns.0 queue. The turn (white square) travels to RabbitMQ and stays in its first cell.
4. A worker takes the turn and applies the agent's instructions. The turn leaves the queue for the worker. Then "apply the agent" is a call to itself, and the worker's gear turns.
5. The worker calls gpt-4.1-nano and reports each step. A question bubble goes to the model. A recorded step (short bar) goes back to session.
6. The worker is done; the app gets the answer as a paper. A paper travels from session back to the watch app.

I changed the messages so that each one carries one object. The old "done" and "GET answer" messages became one "answer" message that goes from session to the app. I changed the titles of steps 1 and 6 to match.

## source, 26.2 s

1. One monorepo holds the server, both apps and the chart. The monorepo is a thin frame with four folder icons: server, web, watch, k8s.
2. main is Lumen; ass/platform splits it into services. The main and ass/platform branch lines light up.
3. Each member works on a branch and merges it into ass/platform. A commit dot travels along a member branch and becomes a merge dot on ass/platform.
4. The push builds one image, tagged with the commit SHA. The commit travels to the GitHub Actions gear. The gear turns, and then an image box comes out with the tag "lumen-next:<sha>" over it.
5. No registry: the image goes over SSH, straight into k3s. The image box travels over the "SSH" arrow to the k3s server icon, which gets a check.
6. helm upgrade replaces the pods with the new image. For each of the five pods (small server icons: identity, project, session, worker, billing), an image box travels from helm to the pod. The pod greys out, lights up and gets a check.

## Icons I added

- `ask` in `icons.py`: the question bubble with the "?" drawn as strokes. The `question` icon draws its "?" in a fixed 22 pt font. Below about 0.35 in, that "?" covers the bubble. The scenes use `ask` for every question that travels or sits on a sequence arrow. `python3 icons.py` still works and draws 26 icons.

## Things I could not do, or that you should check

- The `cloud` icon has two small dark specks inside it at 0.42 in. This comes from the existing icon. I did not change it.
- The sequence prefix icons are 0.26 in. That is the largest size that fits in a 0.28 in row. They are small, but you can read them.
- In hosting, the GitHub actor is a branch icon labelled "GitHub", because there is no GitHub icon.
- Each loop restarts from a calm step-1 frame. The checks from the last step disappear at the restart, as before.
