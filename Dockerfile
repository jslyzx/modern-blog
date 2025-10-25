# syntax=docker/dockerfile:1

ARG PNPM_VERSION=9.12.2

FROM node:20-alpine AS base
ARG PNPM_VERSION
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

FROM base AS deps
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 make g++
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY . .
RUN pnpm build

FROM builder AS production-deps
RUN pnpm prune --prod

FROM node:20-alpine AS runner
ENV PNPM_HOME="/pnpm"
ENV PATH="${PNPM_HOME}:${PATH}"
ARG PNPM_VERSION=9.12.2
ENV NODE_ENV=production
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate \
    && apk add --no-cache libc6-compat
COPY --from=production-deps /pnpm /pnpm
COPY --from=production-deps /app/package.json ./package.json
COPY --from=production-deps /app/node_modules ./node_modules
COPY --from=builder /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.mjs ./next.config.mjs
COPY --from=builder /app/next.config.ts ./next.config.ts
EXPOSE 3000
CMD ["pnpm", "start", "--", "--hostname", "0.0.0.0", "--port", "3000"]
