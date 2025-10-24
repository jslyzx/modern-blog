import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const loadAuthModule = async () => {
  vi.resetModules();
  process.env = { ...originalEnv, BCRYPT_SALT_ROUNDS: "4" } as NodeJS.ProcessEnv;

  return import("@/lib/auth");
};

afterEach(() => {
  process.env = { ...originalEnv } as NodeJS.ProcessEnv;
  vi.resetModules();
});

describe("auth password helpers", () => {
  it("hashes passwords and verifies the resulting hash", async () => {
    const { hashPassword, verifyPassword } = await loadAuthModule();

    const hashed = await hashPassword("Sup3rSecret!");

    expect(hashed).not.toBe("Sup3rSecret!");
    expect(await verifyPassword("Sup3rSecret!", hashed)).toBe(true);
  });

  it("rejects when asked to hash an empty password", async () => {
    const { hashPassword } = await loadAuthModule();

    await expect(hashPassword("")).rejects.toThrow("Password must not be empty");
  });

  it("returns false for missing or mismatched hashes", async () => {
    const { hashPassword, verifyPassword } = await loadAuthModule();

    const hashed = await hashPassword("AnotherSecret123");

    await expect(verifyPassword("AnotherSecret123", null)).resolves.toBe(false);
    await expect(verifyPassword("WrongPassword", hashed)).resolves.toBe(false);
  });
});
