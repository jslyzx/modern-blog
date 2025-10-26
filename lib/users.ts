import type { RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";

export interface AdminUser {
  id: number;
  email: string;
  passwordHash: string;
  name: string | null;
}

interface AdminUserRow extends RowDataPacket {
  id: number;
  username: string | null;
  email: string;
  password_hash: string;
  role: string;
  status: string;
}

export async function findAdminByEmail(email: string): Promise<AdminUser | null> {
  const rows = await query<AdminUserRow[]>(
    `SELECT id, username, email, password_hash, role, status
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  );

  const user = rows[0];

  if (!user || user.role !== "admin" || user.status !== "active") {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    passwordHash: user.password_hash,
    name: user.username,
  };
}
