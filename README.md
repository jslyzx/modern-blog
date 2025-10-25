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
   - `BLOG_DB_*` variables must point to a MySQL instance that contains the `admin_users` table with at least one seeded administrator.

3. **Seed an administrator account**

   Ensure the following table (or equivalent) exists:

   ```sql
   CREATE TABLE IF NOT EXISTS admin_users (
     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
     email VARCHAR(255) NOT NULL UNIQUE,
     password_hash VARCHAR(255) NOT NULL,
     name VARCHAR(255) NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

   Hash passwords using the same bcrypt settings as the app (12 salt rounds by default). Example in Node.js:

   ```bash
   node -e "console.log(require('bcryptjs').hashSync('AdminPassword123!', 12))"
   ```

   Then insert the admin user:

   ```sql
   INSERT INTO admin_users (email, password_hash, name)
   VALUES ('admin@example.com', '$2a$12$...', 'Admin User');
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

Session cookies are managed automatically by NextAuth and scoped to HTTPS in production. Ensure TLS termination (for example, with Nginx on Alibaba Cloud) so cookies remain secure.

## Required environment variables

| Name | Required | Description |
| --- | --- | --- |
| `NEXTAUTH_SECRET` | ✅ | Secret used by NextAuth to sign and encrypt session tokens. Generate with `openssl rand -base64 32`. |
| `NEXTAUTH_URL` | ✅ | Public URL of the admin interface (e.g. `https://admin.example.com`). |
| `BLOG_DB_HOST` | ✅ | Hostname or IP of the MySQL instance. |
| `BLOG_DB_PORT` | ✅ | MySQL port (default `3306`). |
| `BLOG_DB_USER` | ✅ | Database user with read/write access to the admin schema. |
| `BLOG_DB_PASSWORD` | ✅ | Password for `BLOG_DB_USER`. |
| `BLOG_DB_NAME` | ✅ | Database/schema name that contains the `admin_users` table. |
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

1. In the Alibaba Cloud security group for your ECS instance, allow inbound TCP traffic on ports **80/443** for web traffic and restrict port **3000** to internal traffic only (if the reverse proxy terminates TLS).
2. Allow outbound connections on port **3306** (or your MySQL port) so the app can reach the RDS instance.
3. If using Docker Compose, ensure the bridge network does not conflict with existing VPC CIDR ranges.

### Container deployment (recommended)

1. Create a `.env.production` file in the project root with the variables from the table above. For example:
   ```bash
   cat <<'EOF' > .env.production
   NEXTAUTH_SECRET="$(openssl rand -base64 32)"
   NEXTAUTH_URL=https://admin.example.com
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
3. Review and update `docker-compose.yml` with your domain, database credentials, and SSL/TLS preferences. The compose file mounts `./public/uploads` into the container so media remains on the host disk or attached OSS bucket.
4. Launch the stack:
   ```bash
   docker compose --env-file .env.production up -d --build
   ```
   The application will be available on port `3000` inside the container. Use the Nginx configuration below to expose it on ports 80/443.

### Nginx reverse proxy

- Place the sample configuration from `deploy/nginx.conf` under `/etc/nginx/conf.d/modern-blog-admin.conf` (or similar).
- Update `server_name`, certificate paths, and upstream IPs to match your ECS instance or internal load balancer.
- Reload Nginx:
  ```bash
  sudo nginx -t
  sudo systemctl reload nginx
  ```
- The configuration enables gzip compression, sets long-lived cache headers for Next.js static assets, and forwards the appropriate proxy headers required by Next.js and NextAuth.

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
