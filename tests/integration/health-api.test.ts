import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/health/db/route";
import { pingDatabase } from "@/lib/db";

vi.mock("@/lib/db", () => ({
  pingDatabase: vi.fn(),
}));

const mockedPingDatabase = vi.mocked(pingDatabase);

describe("GET /api/health/db", () => {
  beforeEach(() => {
    mockedPingDatabase.mockReset();
  });

  it("returns an ok status when the database responds", async () => {
    mockedPingDatabase.mockResolvedValueOnce(undefined);

    const response = await GET();

    expect(mockedPingDatabase).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ status: "ok" });
  });

  it("returns a 503 when the database check fails", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockedPingDatabase.mockRejectedValueOnce(new Error("connection failed"));

    const response = await GET();

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      status: "error",
      message: "Database unreachable",
    });

    consoleErrorSpy.mockRestore();
  });
});
