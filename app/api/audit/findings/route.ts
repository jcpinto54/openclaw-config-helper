import { NextResponse } from "next/server";

import { getLatestFindings } from "@/lib/audit";
import { jsonError } from "@/lib/api-responses";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getLatestFindings());
  } catch (error) {
    return jsonError(error, 500);
  }
}
