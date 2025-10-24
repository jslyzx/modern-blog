import bcrypt from "bcryptjs";

const SALT_ROUNDS = Number(process.env.BCRYPT_SALT_ROUNDS ?? 12);

export async function hashPassword(plainText: string) {
  if (!plainText) {
    throw new Error("Password must not be empty");
  }

  return bcrypt.hash(plainText, SALT_ROUNDS);
}

export async function verifyPassword(plainText: string, hashed: string | null | undefined) {
  if (!plainText || !hashed) {
    return false;
  }

  try {
    return await bcrypt.compare(plainText, hashed);
  } catch (error) {
    console.error("Failed to verify password", error);
    return false;
  }
}
