import { loadEnvConfig } from "@next/env";
import type { Pool } from "mysql2/promise";

async function seedAdmin() {
  loadEnvConfig(process.cwd());

  const [{ env }, { getPool }, { hashPassword }] = await Promise.all([
    import("../lib/env"),
    import("../lib/db"),
    import("../lib/auth"),
  ]);

  const username = env.ADMIN_USERNAME;
  const password = env.ADMIN_PASSWORD;
  const email = env.ADMIN_EMAIL ?? null;

  let pool: Pool | undefined;

  try {
    const passwordHash = await hashPassword(password);

    pool = getPool();

    await pool.query(
      `INSERT INTO users (username, email, password_hash, role, status)
       VALUES (?, ?, ?, 'admin', 'active')
       ON DUPLICATE KEY UPDATE password_hash = ?, email = ?`,
      [username, email, passwordHash, passwordHash, email],
    );

    console.log("Admin user created/updated:", username);
  } catch (error) {
    console.error("Error seeding admin:", error);
    process.exitCode = 1;
  } finally {
    if (pool) {
      await pool.end();
    }
  }
}

seedAdmin().catch((error) => {
  console.error("Error seeding admin:", error);
  process.exit(1);
});
