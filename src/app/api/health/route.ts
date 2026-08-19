import { NextResponse } from "next/server";
import { getStorageSetupError } from "@/lib/app-runtime";
import { getAppRole } from "@/lib/config";
import { getStorageCapacity } from "@/lib/storage";

export const runtime = "nodejs";

export async function GET() {
  if (getAppRole() === "frontend") {
    return NextResponse.json({ status: "ok", role: "frontend" }, { headers: { "Cache-Control": "no-store" } });
  }

  if (getStorageSetupError()) {
    return NextResponse.json(
      { status: "error", role: "backend", storage: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const capacity = await getStorageCapacity();
    return NextResponse.json(
      {
        status: "ok",
        role: "backend",
        storage: "available",
        freeSpaceMb: Math.floor(capacity.freeBytes / 1024 / 1024),
        usedPercent: Number(capacity.usedPercent.toFixed(1)),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "error", role: "backend", storage: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
