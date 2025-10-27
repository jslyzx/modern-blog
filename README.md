# Modern Blog Admin

Modern Blog Admin is a secure operations console for the Modern Blog platform. It is built on the Next.js App Router and ships with credential based authentication, rich content tooling, MySQL integrations, and production-ready deployment assets so editors can manage posts, tags, media, and SEO primitives confidently.

## Table of contents

- [Overview](#overview)
  - [Tech stack](#tech-stack)
- [Quick start](#quick-start)
- [Environment configuration](#environment-configuration)
- [Database schema and migrations](#database-schema-and-migrations)
- [Feature checklist](#feature-checklist)
- [Development workflow](#development-workflow)
- [Testing & quality checks](#testing--quality-checks)
- [Deployment](#deployment)
  - [Build a production image](#build-a-production-image)
  - [Deploy with Docker Compose](#deploy-with-docker-compose)
  - [Nginx reverse proxy](#nginx-reverse-proxy)
  - [Alibaba Cloud HTTP quick start](#alibaba-cloud-http-quick-start)
  - [Optional systemd service](#optional-systemd-service)
- [Troubleshooting](#troubleshooting)

## Overview

The admin panel exposes CRUD tooling for posts and tags, media uploads with strict sanitisation, live post search, and operational dashboards. Editors authenticate with credentials managed through NextAuth.js and the interface persists content to a MySQL database. All routing is implemented in the Next.js App Router, so SSR, streaming, metadata, and route handlers are first-class citizens.

### Tech stack

- **Runtime**: Next.js 14 (App Router) on Node.js 20
- **Language**: TypeScript with Vitest for testing
- **Package manager**: pnpm (Corepack-enabled)
- **UI**: Tailwind CSS, Radix UI primitives, Shadcn-inspired components, Lucide icons
- **Content tooling**: Tiptap rich text editor, Markdown + KaTeX rendering, Shiki syntax highlighting
- **Authentication**: NextAuth.js Credentials provider with bcrypt hashing
- **Database**: MySQL 8 via `mysql2`, pooled connections, Zod-validated environment configuration
- **Media**: Local disk storage under `public/uploads` with server-side validation via `formidable` and `sharp`
- **Ops**: Dockerfile, `docker-compose.yml`, deployable Nginx config, and optional systemd unit

## Quick start

> **Prerequisites**
>
> - Node.js 20.x (use `nvm install 20` or download from nodejs.org)
> - pnpm 9 (enable via `corepack enable` and `corepack prepare pnpm@9.12.2 --activate`)
> - MySQL 8 (local install or Docker)
> - OpenSSL (to generate secrets)

1. **Clone and install dependencies**
   ```bash
   git clone <your-fork-url> modern-blog-admin
   cd modern-blog-admin
   pnpm install
   ```

2. **Create your environment file**
   ```bash
   cp .env.local.example .env.local
   ```
   Update the values to match your local MySQL instance. `SITE_BASE_URL`, `NEXTAUTH_URL`, and database credentials are required even in development.

3. **Start MySQL and apply the schema**
   - **Existing MySQL**: ensure the database named in `BLOG_DB_NAME` exists.
   - **Docker (recommended for local development)**:
     ```bash
     docker compose up db -d
     ```
   - Import the reference schema:
     ```bash
     mysql -h 127.0.0.1 -u <user> -p<password> <database> < docs/blog_schema.sql
     ```

4. **Seed an administrator account**
   ```bash
   pnpm seed:admin
   ```
   By default this ensures an `admin / 123456` user exists with `role = 'admin'` and `status = 'active'`. Override the credentials by exporting `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL`.

5. **Run the development server**
   ```bash
   pnpm dev
   ```
   Visit [http://localhost:3000/admin/login](http://localhost:3000/admin/login) and sign in with the seeded credentials.

6. **(Optional) Run maintenance scripts**
   - `pnpm migrate:slugs` converts legacy slugs to Pinyin-friendly variants, ensuring uniqueness across posts.

## Environment configuration

All configuration keys live in `.env.local.example`. Copy it to `.env.local` for development and to `.env.production` (or `.env`) for production builds.

| Variable | Required | Default/example | Purpose |
| --- | --- | --- | --- |
| `NEXTAUTH_SECRET` | ✅ | Generated via `openssl rand -base64 32` | Secret used by NextAuth to sign/encrypt session tokens. |
| `NEXTAUTH_URL` | ✅ | `http://localhost:3000` | Public URL of the admin app. Should match the domain served by Nginx/Ingress. |
| `SITE_BASE_URL` | ✅ | `http://localhost:3000` | Canonical origin for sitemap, RSS feed, and metadata. Must include protocol. |
| `BLOG_DB_HOST` | ✅ | `127.0.0.1` | MySQL host or service name (`db` when using Docker Compose). |
| `BLOG_DB_PORT` | ✅ | `3306` | MySQL port. |
| `BLOG_DB_USER` | ✅ | `root` | Database user with read/write privileges. |
| `BLOG_DB_PASSWORD` | ✅ | `your-db-password` | Password for `BLOG_DB_USER`. |
| `BLOG_DB_NAME` | ✅ | `modern_blog` | Database/schema name containing blog tables. |
| `BLOG_DB_SSL` | ➖ | `false` | Set to `true` or a DSN string for SSL-enabled connections. |
| `DB_CONNECTION_LIMIT` | ➖ | `10` | Max pooled MySQL connections. |
| `BCRYPT_SALT_ROUNDS` | ➖ | `12` | Cost factor for bcrypt password hashing. |
| `ADMIN_USERNAME` | ➖ | `admin` | Override username when running `pnpm seed:admin`. |
| `ADMIN_PASSWORD` | ➖ | `123456` | Override password when running `pnpm seed:admin`. |
| `ADMIN_EMAIL` | ➖ | _(empty)_ | Optional email used by the seed script. |
| `NEXT_PUBLIC_SITE_NAME` | ➖ | `Modern Blog` | Overrides the site name used in metadata and feeds. |
| `NEXT_PUBLIC_SITE_DESCRIPTION` | ➖ | `Insights and stories from Modern Blog.` | Overrides the site description used in metadata and feeds. |
| `MYSQL_ROOT_PASSWORD` | ➖ | `root` | Convenience value consumed by `docker-compose.yml` when provisioning the bundled MySQL service. |

For production deploys, place these variables in an `.env.production` file and reference it from Docker Compose or your hosting provider’s secret manager.

## Database schema and migrations

The repository includes a reference schema at [`docs/blog_schema.sql`](docs/blog_schema.sql). Import it into the database named in `BLOG_DB_NAME` before running the app:

```bash
mysql -h <host> -u <user> -p<password> <database> < docs/blog_schema.sql
```

Key tables:

- `users` – stores credentials, role, and status for administrators.
- `posts` – article content, summary, HTML/Markdown payloads, status, and author relationships.
- `tags` and `post_tags` – tag catalogue and the many-to-many join table.
- `media` – optional metadata when persisting uploads locally.

Maintenance tooling lives in `scripts/`:

- `pnpm seed:admin` upserts an admin user according to the environment configuration.
- `pnpm migrate:slugs` normalises existing post slugs to Pinyin-based, unique identifiers (safe to rerun).

Back up your production database before applying schema changes or running maintenance scripts.

## Feature checklist

- [x] Credentials-based authentication via NextAuth.js with bcrypt hashing and session JWTs.
- [x] Rich text editor powered by Tiptap with live preview, Markdown shortcuts, KaTeX/LaTeX rendering, and Shiki syntax highlighting.
- [x] Post management (create, edit, publish, archive, delete) with automatic slug generation and status filters.
- [x] Tag management with uniqueness safeguards, Pinyin slug migration, and post/tag association counts.
- [x] Image uploads (JPEG, PNG, WebP, GIF, SVG) with 5&nbsp;MB size limits, SVG sanitisation, metadata extraction, and persistent storage under `public/uploads`.
- [x] RESTful admin APIs for posts, tags, media uploads, and database health checks guarded by authenticated sessions.
- [x] Search endpoints for published posts with tag hydration and pagination-friendly responses.
- [x] SEO outputs including dynamic metadata, Open Graph/Twitter cards, sitemap.xml, robots.txt, and RSS feeds.
- [x] Dashboard statistics summarising post status counts, active users, tags, and recent content.
- [x] Production-ready Dockerfile, docker-compose stack (with health checks and volumes), and Nginx reverse proxy tuned for Next.js assets.

## Development workflow

### Project structure

```
app/                    # Next.js routes, layouts, metadata, and API handlers
app/api/**/*            # Session-protected REST endpoints for admin operations
components/             # Shared UI primitives and admin widgets
lib/                    # Database utilities, authentication, markdown rendering, search helpers
scripts/                # Maintenance scripts (seed admin, migrate slugs)
public/uploads/         # Persistent media uploads (bind-mounted in Docker)
deploy/                 # Ops assets: nginx.conf and modern-blog-admin.service
tests/unit/             # Vitest unit suites (environment validation, auth helpers)
tests/integration/      # Database & API smoke tests
```

### Conventions

- Use TypeScript for all new code. Prefer explicit return types for exported functions.
- Keep data access centralised in `lib/` modules (e.g., `lib/admin/posts.ts`, `lib/tags.ts`). Avoid raw SQL in components.
- Follow Tailwind utility ordering conventions already present in the project. Reuse components from `components/ui` where possible.
- Protect new admin endpoints with `auth()` checks and return structured JSON error payloads.
- Store user-uploaded assets via `LocalMediaStorage` to maintain consistent directory layout.

### Adding new features

1. Extend the database schema (via a migration or manual SQL) and document the change in `docs/`.
2. Add or update repository scripts if data backfills are required.
3. Implement server logic in `lib/` or `app/api/` before wiring UI components.
4. Cover new behaviour with Vitest unit tests and, when appropriate, integration tests under `tests/integration`.
5. Update this README (and `.env.local.example`) when new configuration is required.
6. Run the commands in [Testing & quality checks](#testing--quality-checks) before opening a pull request.

## Testing & quality checks

```bash
pnpm lint   # ESLint with Next.js configuration
pnpm check  # TypeScript type checking (tsc --noEmit)
pnpm test   # Vitest unit & integration suites
```

Continuous integration runs these commands automatically via the GitHub Actions workflow in `.github/workflows/ci.yml`.

## Deployment

All deployment assets live at the repository root or under `deploy/`. The stack is designed to run the Next.js server behind Nginx with persistent uploads and a managed or co-located MySQL database.

### Build a production image

The provided multi-stage [`Dockerfile`](Dockerfile) builds and prunes dependencies before producing a lean Node.js 20 Alpine image. To build locally:

```bash
docker build -t modern-blog-admin:latest .
```

The image exposes port `3000`, declares a writable volume at `/app/public/uploads`, and defines a health check against `/api/health/db`.

### Deploy with Docker Compose

[`docker-compose.yml`](docker-compose.yml) provisions two services: `app` (the Next.js server) and `db` (MySQL 8). It mounts `./public/uploads` into the container to keep media between deploys and injects environment variables from `.env.production`.

1. Create `.env.production` with production secrets and database credentials:
   ```bash
   cat <<'EOF' > .env.production
   NEXTAUTH_SECRET=$(openssl rand -base64 32)
   NEXTAUTH_URL=https://admin.example.com
   SITE_BASE_URL=https://blog.example.com
   BLOG_DB_HOST=db
   BLOG_DB_PORT=3306
   BLOG_DB_USER=modern_blog
   BLOG_DB_PASSWORD=super-secret-password
   BLOG_DB_NAME=modern_blog
   BLOG_DB_SSL=false
   EOF
   ```
2. Launch the stack:
   ```bash
   docker compose --env-file .env.production up -d --build
   ```
3. Verify the container logs and wait for the health check to pass (`docker compose ps`). The application listens on container port `3000`; place Nginx or a load balancer in front for public traffic.

> **Tip:** If you rely on a managed MySQL service (e.g., RDS), remove or disable the bundled `db` service and point `BLOG_DB_HOST`/`BLOG_DB_PORT` at the managed instance.

### Nginx reverse proxy

Use [`deploy/nginx.conf`](deploy/nginx.conf) to terminate HTTP traffic and serve static assets efficiently.

1. Copy the file to your server (e.g., `/etc/nginx/conf.d/modern-blog-admin.conf`).
2. Update `server_name` and the `/uploads/` alias to match your domain and the host path where uploads are stored (default: `/var/www/modern-blog-admin/public/uploads/`).
3. Ensure the upstream (`127.0.0.1:3000`) resolves to the running container or service.
4. Reload Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

The configuration caches `_next/static` assets aggressively, forwards standard `X-Forwarded-*` headers, and increases `client_max_body_size` to 25&nbsp;MB to accommodate image uploads. Add a TLS-enabled server block (or use a cloud load balancer) before exposing the admin interface over the public internet.

### Alibaba Cloud HTTP quick start

For deployments on Alibaba Cloud ECS or ACK:

1. **Provision infrastructure**
   - ECS instance (or ACK node) running a recent 64-bit Linux distribution.
   - MySQL (ApsaraDB RDS or self-managed) reachable from the application subnet only.
   - Persistent storage for uploads (ECS disk, NAS, or OSS mount).

2. **Harden networking**
   - Allow inbound TCP traffic on port **80** (and **443** when HTTPS is enabled) in your security group.
   - Restrict port **3000** to the VPC/private subnets—only Nginx or your load balancer should reach it.
   - Permit outbound traffic on your MySQL port (default 3306) so the app can reach RDS.

3. **Install runtime dependencies**
   ```bash
   sudo apt-get update && sudo apt-get install -y curl git
   nvm install 20
   corepack enable
   corepack prepare pnpm@9.12.2 --activate
   ```

4. **Deploy with Docker (recommended)**
   - Clone this repository onto the ECS instance.
   - Create `.env.production` with the variables listed above.
   - Run `docker compose --env-file .env.production up -d --build`.
   - Bind-mount `/var/www/modern-blog-admin/public/uploads` (or a mounted OSS/NAS path) to persist media.

5. **Attach Nginx**
   - Copy `deploy/nginx.conf`, update `server_name`, and point the `/uploads/` alias to your mounted path.
   - Reload Nginx and validate access over HTTP before enabling HTTPS with an Alibaba Cloud SSL certificate or a managed load balancer.

6. **Verify connectivity**
   - Test database access from the ECS host: `mysql -h <host> -u <user> -p`.
   - Hit `http://your-domain/api/health/db` to confirm the application can reach MySQL.

### Optional systemd service

For bare-metal or VM deployments without Docker:

1. Install production dependencies:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   ```
2. Copy [`deploy/modern-blog-admin.service`](deploy/modern-blog-admin.service) into `/etc/systemd/system/` and adjust `WorkingDirectory`, `User`, and `Group` as needed.
3. Create `/etc/modern-blog-admin/env` containing the environment variables from [Environment configuration](#environment-configuration).
4. Ensure the service user can write to `public/uploads` (e.g., `sudo chown -R www-data:www-data /var/www/modern-blog-admin/public/uploads`).
5. Start and enable the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now modern-blog-admin
   ```

## Troubleshooting

- **"Invalid environment variables" on startup** – Ensure every `BLOG_DB_*`, `NEXTAUTH_*`, and `SITE_BASE_URL` value is set. The Zod validator in `lib/env.ts` terminates early when required keys are missing.
- **`/api/health/db` returns 503** – MySQL is unreachable. Confirm the database is running, credentials are correct, and network security groups/firewalls allow traffic.
- **Seed script errors (`ER_NO_SUCH_TABLE`)** – Import `docs/blog_schema.sql` before running `pnpm seed:admin` or any migration scripts.
- **Uploads fail with 413/415 responses** – Check `client_max_body_size` in Nginx, ensure files are within the 5&nbsp;MB limit, and verify the image MIME type is one of the allowed formats.
- **Uploaded media missing after restart** – Make sure `public/uploads` is mounted to persistent storage (`./public/uploads:/app/public/uploads` in Docker) and writable by the runtime user.
- **Docker health check keeps failing** – The container polls `/api/health/db`; wait for MySQL to finish initialising or adjust environment credentials.
- **`Error: JWT Secret not configured` from NextAuth** – Regenerate and set `NEXTAUTH_SECRET` in both local and production environments.
- **`pnpm: command not found`** – Enable Corepack (`corepack enable`) or install pnpm globally (`npm install -g pnpm`).

With these resources in place, new contributors can spin up a fully functional environment, understand the project architecture, and deploy Modern Blog Admin with confidence.
