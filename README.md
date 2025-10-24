# Modern Blog Admin

This project provides a secure admin interface for the Modern Blog platform, built with Next.js App Router and credentials-based authentication powered by NextAuth.js.

## Getting started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure environment variables** by creating an `.env.local` file in the project root:

   ```bash
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-generated-secret
   DATABASE_URL=mysql://user:password@localhost:3306/modern_blog
   DB_CONNECTION_LIMIT=10 # optional
   BCRYPT_SALT_ROUNDS=12  # optional override (defaults to 12)
   ```

   - `NEXTAUTH_SECRET` can be generated with `openssl rand -base64 32`.
   - `NEXTAUTH_URL` should match the URL where the application is hosted.
   - `DATABASE_URL` must point to a MySQL instance that contains the `admin_users` table with at least one seeded administrator.

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
   npm run dev
   ```

   Visit [http://localhost:3000/admin/login](http://localhost:3000/admin/login) to sign in with the seeded credentials.

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

When deploying, ensure the environment variables listed above are available and that the MySQL database is reachable from the deployed environment.

Session cookies are managed automatically by NextAuth and scoped to HTTPS in production.
