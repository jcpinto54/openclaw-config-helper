import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { runSecurityAudit } from "@/lib/audit";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(await runSecurityAudit());
  } catch (error) {
    return jsonError(error, 500);
  }
}
