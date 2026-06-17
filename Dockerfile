FROM node:22.13-slim
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

EXPOSE 3000
CMD ["node", "packages/worker/dist/main.js"]
