import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { scanCredentials } from "@/lib/credentials";

export const runtime = "nodejs";

export async function POST() {
  try {
    return NextResponse.json(await scanCredentials());
  } catch (error) {
    return jsonError(error, 500);
  }
}
