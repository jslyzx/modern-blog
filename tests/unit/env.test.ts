import { afterEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

const baseEnv: NodeJS.ProcessEnv = {
  BLOG_DB_HOST: "localhost",
  BLOG_DB_PORT: "3306",
  BLOG_DB_USER: "admin",
  BLOG_DB_PASSWORD: "secret",
  BLOG_DB_NAME: "blog",
  BLOG_DB_SSL: "true",
};

const loadEnvModule = async (overrides: Partial<NodeJS.ProcessEnv> = {}) => {
  vi.resetModules();
  process.env = { ...originalEnv, ...baseEnv, ...overrides } as NodeJS.ProcessEnv;

  return import("@/lib/env");
};

afterEach(() => {
  process.env = { ...originalEnv } as NodeJS.ProcessEnv;
  vi.resetModules();
});

describe("databaseEnv", () => {
  it("parses and normalizes the database configuration", async () => {
    const { databaseEnv } = await loadEnvModule();

    expect(databaseEnv).toEqual({
      host: "localhost",
      port: 3306,
      user: "admin",
      password: "secret",
      database: "blog",
      ssl: true,
    });
  });

  it("maps falsy SSL values to booleans or undefined", async () => {
    const sslDisabled = await loadEnvModule({ BLOG_DB_SSL: "false" });
    expect(sslDisabled.databaseEnv.ssl).toBe(false);

    const sslUnset = await loadEnvModule({ BLOG_DB_SSL: "  " });
    expect(sslUnset.databaseEnv.ssl).toBeUndefined();
  });

  it("throws a descriptive error when validation fails", async () => {
    await expect(loadEnvModule({ BLOG_DB_HOST: "" })).rejects.toThrow(
      /BLOG_DB_HOST is required/,
    );
  });
});

describe("env", () => {
  it("provides default admin values when not specified", async () => {
    const { env } = await loadEnvModule();

    expect(env).toEqual({
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "123456",
      ADMIN_EMAIL: null,
    });
  });

  it("respects provided admin environment overrides", async () => {
    const { env } = await loadEnvModule({
      ADMIN_USERNAME: "superuser",
      ADMIN_PASSWORD: "pa$w0rd",
      ADMIN_EMAIL: "admin@example.com",
    });

    expect(env).toEqual({
      ADMIN_USERNAME: "superuser",
      ADMIN_PASSWORD: "pa$w0rd",
      ADMIN_EMAIL: "admin@example.com",
    });
  });

  it("normalizes blank admin values to defaults", async () => {
    const { env } = await loadEnvModule({
      ADMIN_USERNAME: "   ",
      ADMIN_PASSWORD: "",
      ADMIN_EMAIL: " ",
    });

    expect(env).toEqual({
      ADMIN_USERNAME: "admin",
      ADMIN_PASSWORD: "123456",
      ADMIN_EMAIL: null,
    });
  });
});
