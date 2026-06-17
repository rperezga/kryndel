# AUDIT-PA-2026-06-16 §B1 — explicit semver patch (no silent minor bumps).
# §B3 TODO: pin to immutable digest, e.g.
#   FROM node:22.13.1-slim@sha256:<digest>
# Roger to fetch the current linux/amd64 digest with:
#   docker pull node:22.13.1-slim
#   docker inspect --format='{{index .RepoDigests 0}}' node:22.13.1-slim
FROM node:22.13.1-slim
WORKDIR /app

# Install pnpm v11 (matches local dev, reads the lockfile format correctly)
RUN npm install -g pnpm@11.5.2

# Copy workspace manifests first (layer cache)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/core/package.json    ./packages/core/
COPY packages/worker/package.json  ./packages/worker/
COPY packages/web/package.json     ./packages/web/
COPY packages/cli/package.json     ./packages/cli/
COPY packages/viewer/package.json  ./packages/viewer/

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy source
COPY . .

# Build core then worker
RUN pnpm --filter @kryndel/core build
RUN pnpm --filter @kryndel/worker build

# AUDIT-PA-2026-06-16 §B1 — drop root for runtime.
RUN groupadd --system --gid 1001 kryndel \
 && useradd  --system --uid 1001 --gid kryndel --home-dir /app kryndel \
 && chown -R kryndel:kryndel /app
USER kryndel

EXPOSE 3000
CMD ["node", "packages/worker/dist/main.js"]
