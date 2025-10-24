import { NextResponse } from "next/server";

import { pingDatabase } from "@/lib/db";

export async function GET() {
  try {
    await pingDatabase();

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Database health check failed", error);

    return NextResponse.json(
      { status: "error", message: "Database unreachable" },
      { status: 503 },
    );
  }
}
