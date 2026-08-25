# A container this repo has needed since the first line of its own README's Security
# section: "There is no sandbox... the isolation that needs is a container around the whole
# run, which does not exist yet." This is that container. It does not change the trust
# model documented there — the agents still run with whatever permissions this process has,
# still reach the network through `pi-web-access`, still have no sandbox of their own inside
# it — it moves the boundary from "the operator's whole machine" to "this one process and
# what it can see", which is the version of that promise a real deployment can actually keep.
#
# It also closes a gap found by running a real, very long research conversation against the
# Vultr deployment of this app: pi's own `find` and `grep` tools shell out to `fd` and `rg`
# and, on a bare box that has neither, try to auto-download them and can fail doing so — one
# step in that conversation died exactly this way. Both are installed explicitly below so
# that failure mode cannot happen inside this image, on any host.

FROM node:22-slim

# `fd-find` is Debian's package name for `fd`, and it installs the binary as `fdfind`, not
# `fd` — pi's own tool looks for literally `fd` on PATH. The symlink is what makes the
# rename invisible to pi; without it this image would carry the exact binary and still hit
# the exact bug it exists to close.
RUN apt-get update \
	&& apt-get install -y --no-install-recommends fd-find ripgrep ca-certificates \
	&& ln -s "$(command -v fdfind)" /usr/local/bin/fd \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Dependencies before source, so an ordinary code change does not re-run `npm install` —
# only a change to what is installed does.
COPY package.json package-lock.json ./
COPY packages/kernel/package.json packages/kernel/package.json
COPY packages/server/package.json packages/server/package.json
COPY packages/web/package.json packages/web/package.json
RUN npm install

COPY . .

# The server runs its TypeScript directly (`--experimental-strip-types`, no build step); the
# web package is the one thing here that has to be built before it can be served.
RUN cd packages/web && npx vite build

EXPOSE 4173

# Loopback-only, the app's own default, is meaningless inside a container: Docker's port
# mapping cannot reach a process bound to 127.0.0.1 in its own network namespace, only one
# bound to 0.0.0.0. So this image sets LUMEN_HOST=0.0.0.0 itself, which means it is *always*
# in the "reachable beyond this one machine" case the app's own code already refuses to
# start in without a password (packages/server/src/index.ts checks LOOPBACK_HOSTS and exits
# if LUMEN_BASIC_AUTH is unset) — the container will not silently come up unauthenticated;
# it will not come up at all. Pass LUMEN_BASIC_AUTH at `docker run` time.
ENV LUMEN_HOST=0.0.0.0
ENV LUMEN_PORT=4173

# Model credentials and Modal credentials are never baked into the image — mount them:
#   -v ~/.pi/agent/auth.json:/root/.pi/agent/auth.json:ro
#   -v ~/.modal.toml:/root/.modal.toml:ro
# Conversations are in-memory by this app's own design (see README's "Where a conversation
# lives") and their on-disk directory is not meant to be precious, but mount it too if a
# restart should not lose what agents have `save`d:
#   -v lumen-sessions:/root/.lumen/sessions

CMD ["node", "--experimental-strip-types", "packages/server/src/index.ts"]
