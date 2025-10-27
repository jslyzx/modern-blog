# Modern Blog Admin

This project provides a secure admin interface for the Modern Blog platform, built with Next.js App Router and credentials-based authentication powered by NextAuth.js.

## Getting started

1. **Install dependencies**

   ```bash
   pnpm install
   ```

2. **Configure environment variables** by creating an `.env.local` file in the project root:

   ```bash
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-generated-secret
   SITE_BASE_URL=http://localhost:3000
   BLOG_DB_HOST=127.0.0.1
   BLOG_DB_PORT=3306
   BLOG_DB_USER=root
   BLOG_DB_PASSWORD=your-db-password
   BLOG_DB_NAME=modern_blog
   BLOG_DB_SSL=false
   DB_CONNECTION_LIMIT=10 # optional
   BCRYPT_SALT_ROUNDS=12  # optional override (defaults to 12)
   ```

   - `NEXTAUTH_SECRET` can be generated with `openssl rand -base64 32`.
   - `NEXTAUTH_URL` should match the URL where the application is hosted.
   - `SITE_BASE_URL` must include the protocol (`http://` or `https://`) and is used for canonical URLs, the sitemap, and the RSS feed.
   - `BLOG_DB_*` variables must point to a MySQL instance that contains the `users` table used by the admin interface.

3. **Seed an administrator account**

   The project includes a convenience script that upserts an administrator using the configured database connection:

   ```bash
   pnpm seed:admin
   ```

   The script reads the optional `ADMIN_USERNAME`, `ADMIN_PASSWORD`, and `ADMIN_EMAIL` environment variables (falling back to `admin`, `123456`, and no email) and ensures a record exists in the `users` table with `role = 'admin'` and `status = 'active'`.

   Ensure your database exposes a compatible `users` table. A minimal schema looks like:

   ```sql
   CREATE TABLE IF NOT EXISTS users (
     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     username VARCHAR(255) NOT NULL UNIQUE,
     email VARCHAR(255) NOT NULL UNIQUE,
     password_hash VARCHAR(255) NOT NULL,
     role VARCHAR(50) NOT NULL,
     status VARCHAR(50) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

4. **Run in development**

   ```bash
   pnpm dev
   ```

   Visit [http://localhost:3000/admin/login](http://localhost:3000/admin/login) to sign in with the seeded credentials.

## Testing & quality checks

Run the project quality checks with pnpm:

```bash
pnpm lint   # ESLint (Next.js configuration)
pnpm check  # TypeScript type checking
pnpm test   # Vitest unit and integration tests
```

Unit tests live under `tests/unit` and cover environment validation and password hashing helpers. Integration smoke tests for the database health endpoint can be found in `tests/integration`.

## Media uploads

- The admin editor uploads images via `POST /api/media/upload`, which requires an authenticated admin session.
- Supported MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, and `image/svg+xml`. Requests with other types return `415`.
- SVG uploads are rejected if they contain scripts, inline event handlers, or embedded HTML via `<foreignObject>`.
- Files larger than 5&nbsp;MB are rejected with HTTP `413`.
- Filenames are sanitised and stored as unique objects under `public/uploads/<year>/<month>/` so assets remain organised by upload date.
- The API response includes the public URL along with width, height, MIME type, and file size metadata for editor integrations.
- When running with Docker Compose, uploads persist thanks to the `./public/uploads:/app/public/uploads` volume declared in `docker-compose.yml`.

## Continuous integration

A GitHub Actions workflow is defined at `.github/workflows/ci.yml`. It installs dependencies with pnpm and runs `pnpm lint`, `pnpm check`, and `pnpm test` on pushes and pull requests targeting the `main` branch.

## Authentication flow

- The `/admin/login` page uses a secure server action to authenticate credentials with NextAuth's Credentials provider.
- Passwords are verified with bcrypt against the stored hash in the MySQL database.
- Successful login establishes a secure session via NextAuth. Unauthenticated requests to `/admin` routes are redirected to the login page by middleware.
- Invalid credentials return a clear inline error message without redirecting away from the form.

## Project structure

- `auth.ts` – central NextAuth configuration and exports for handlers, session, and server actions.
- `app/admin` – protected admin routes and layout shell.
- `app/api/auth/[...nextauth]` – NextAuth route handler for the App Router.
- `lib` – shared utilities for database access and authentication helpers.
- `components/ui` – shadcn-inspired UI primitives used by the login form and admin pages.

## Deployment notes

Session cookies are managed automatically by NextAuth and scoped to HTTPS in production. The sample Nginx configuration included in this repository listens on port 80 so you can verify the deployment over HTTP first, but you should still plan to terminate TLS (for example, with Nginx on Alibaba Cloud or a cloud load balancer) before exposing the admin interface publicly.

## Required environment variables

| Name | Required | Description |
| --- | --- | --- |
| `NEXTAUTH_SECRET` | ✅ | Secret used by NextAuth to sign and encrypt session tokens. Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | ✅ | Public URL of the admin interface (e.g. `https://admin.example.com`). |
| `SITE_BASE_URL` | ✅ | Base URL used for canonical links, the sitemap, and RSS feed (include protocol, e.g. `http://blog.example.com`). |
| `BLOG_DB_HOST` | ✅ | Hostname or IP of the MySQL instance. |
| `BLOG_DB_PORT` | ✅ | MySQL port (default `3306`). |
| `BLOG_DB_USER` | ✅ | Database user with read/write access to the admin schema. |
| `BLOG_DB_PASSWORD` | ✅ | Password for `BLOG_DB_USER`. |
| `BLOG_DB_NAME` | ✅ | Database/schema name that contains the `users` table. |
| `BLOG_DB_SSL` | ➖ | Optional flag or DSN string for SSL-enabled database connections (`true`, `false`, or a custom DSN). |
| `DB_CONNECTION_LIMIT` | ➖ | Max connections for the MySQL pool (defaults to `10`). |
| `BCRYPT_SALT_ROUNDS` | ➖ | Override bcrypt salt rounds for password hashing (defaults to `12`). |

## Alibaba Cloud deployment guide

### Prerequisites

- **Compute**: Elastic Compute Service (ECS) or Container Service (ACK/ECI) instance running a recent 64-bit Linux distribution.
- **Node.js**: Install Node.js 20 LTS (`nvm install 20` or via Alibaba Cloud image). Run `corepack enable` so pnpm is available, or install pnpm globally (`npm install -g pnpm`).
- **Database**: Provision an ApsaraDB RDS for MySQL instance (or self-managed MySQL). Allow inbound connections from the application subnet only.
- **Object storage / disk**: Attach an OSS bucket or a mounted disk for persistent uploads (the app writes to `public/uploads`).

### Firewall and networking

1. In the Alibaba Cloud security group for your ECS instance, allow inbound TCP traffic on port **80** for web traffic (add **443** when you enable HTTPS) and restrict port **3000** to internal traffic only (if the reverse proxy terminates TLS).
2. Allow outbound connections on port **3306** (or your MySQL port) so the app can reach the RDS instance.
3. If using Docker Compose, ensure the bridge network does not conflict with existing VPC CIDR ranges.

### Container deployment (recommended)

1. Create a `.env.production` file in the project root with the variables from the table above. For example:
   ```bash
   cat <<'EOF' > .env.production
   NEXTAUTH_SECRET="$(openssl rand -base64 32)"
   NEXTAUTH_URL=https://admin.example.com
   SITE_BASE_URL=http://your-domain-or-ip
   BLOG_DB_HOST=db.internal
   BLOG_DB_PORT=3306
   BLOG_DB_USER=modern_blog
   BLOG_DB_PASSWORD=secure-password
   BLOG_DB_NAME=modern_blog
   BLOG_DB_SSL=false
   EOF
   ```

2. Build and tag the image locally or in a CI pipeline:
   ```bash
   docker build -t modern-blog-admin:latest .
   ```

3. Test the image on the ECS host (or your workstation) before wiring up Nginx:
   ```bash
   docker run --rm -it \
     --env-file .env.production \
     -p 3000:3000 \
     -v "$(pwd)/public/uploads:/app/public/uploads" \
     modern-blog-admin:latest
   ```
   Visit [http://localhost:3000/admin/login](http://localhost:3000/admin/login) to confirm the application is healthy, then press <kbd>Ctrl</kbd>+<kbd>C</kbd> to stop the container.

4. Deploy with Docker Compose in detached mode (adjust `docker-compose.yml` if you need to change image tags, port bindings, or database hostnames):
   ```bash
   docker compose --env-file .env.production up -d --build
   ```
   The compose file mounts `./public/uploads` so uploads persist across releases, and the `env_file` directive injects `SITE_BASE_URL` and database credentials without hard-coding them. The application will be available on port `3000` inside the container—use the Nginx configuration below to expose it on port 80 (add a TLS-enabled server block when you are ready for HTTPS).

### Nginx reverse proxy

1. Copy `deploy/nginx.conf` to `/etc/nginx/conf.d/modern-blog-admin.conf` on your ECS instance (or symlink it if you keep the repository checked out on the server). The upstream targets `127.0.0.1:3000`; adjust it if the container runs on another host or network.
2. Ensure the `/uploads/` alias matches the host path that Docker mounts (`/var/www/modern-blog-admin/public/uploads/` in the sample). Update the path if you store uploads elsewhere and grant Nginx read access.
3. Set `server_name` and the `SITE_BASE_URL` environment variable to the domain you intend to serve (include the `http://` prefix while running over HTTP).
4. Validate and reload Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```
   The configuration listens on port 80, forwards `X-Forwarded-*` headers, enables gzip compression, caches Next.js `_next` assets, and raises `client_max_body_size` for uploads. When you are ready to enable HTTPS, add a TLS-enabled server block or terminate TLS in an upstream load balancer.

### Persisting media uploads

- The application writes uploaded assets to `public/uploads`. When running in Docker, keep the existing bind mount (`./public/uploads:/app/public/uploads`) so files are stored on the ECS disk or a mounted NAS/OSS path.
- For bare-metal deployments, point `public/uploads` to a persistent disk or mount (e.g. `/var/www/modern-blog-admin/public/uploads`). Ensure the service user has write permissions.

### Non-container deployment with systemd

1. Install dependencies on the ECS instance:
   ```bash
   pnpm install --frozen-lockfile
   pnpm build
   ```
2. Copy `deploy/modern-blog-admin.service` to `/etc/systemd/system/modern-blog-admin.service` and adjust `WorkingDirectory`, `User`, and `Group` as needed.
3. Create `/etc/modern-blog-admin/env` containing the environment variables listed above (one `KEY=value` per line).
4. Allow the service user to write to `public/uploads`:
   ```bash
   sudo chown -R www-data:www-data /var/www/modern-blog-admin/public/uploads
   ```
5. Enable and start the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable --now modern-blog-admin
   ```

Regardless of deployment method, verify database connectivity from the ECS instance (`mysql -h <host> -u <user> -p`) and confirm that the initial admin user has been seeded before exposing the interface to the internet.
