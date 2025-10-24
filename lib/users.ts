import { RowDataPacket } from "mysql2";

import { getPool } from "@/lib/db";

export interface AdminUser {
  id: number;
  email: string;
  passwordHash: string;
  name: string | null;
}

interface AdminUserRow extends RowDataPacket {
  id: number;
  email: string;
  password_hash: string;
  name: string | null;
}

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const pool = getPool();
  const [rows] = await pool.query<AdminUserRow[]>(
    "SELECT id, email, password_hash, name FROM admin_users WHERE email = ? LIMIT 1",
    [email]
  );

  if (!rows.length) {
    return null;
  }

  const user = rows[0];

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.password_hash,
    name: user.name,
  };
}
