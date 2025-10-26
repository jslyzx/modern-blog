import type { RowDataPacket } from "mysql2/promise";

import { query } from "@/lib/db";

export interface AdminUser {
  id: number;
  username: string;
  email: string | null;
  passwordHash: string;
}

interface AdminUserRow extends RowDataPacket {
  id: number;
  username: string | null;
  email: string | null;
  password_hash: string;
  role: string;
  status: string;
}

export async function findAdminByUsername(username: string): Promise<AdminUser | null> {
  const rows = await query<AdminUserRow[]>(
    `SELECT id, username, email, password_hash, role, status
     FROM users
     WHERE username = ?
       AND role = 'admin'
       AND status = 'active'
     LIMIT 1`,
    [username],
  );

  const user = rows[0];

  if (!user || !user.username) {
    return null;
  }

  return {
    id: user.id,
    username: user.username,
    email: user.email,
    passwordHash: user.password_hash,
  };
}
