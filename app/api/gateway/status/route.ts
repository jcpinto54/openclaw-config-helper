import { NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { getGatewayStatus } from "@/lib/openclaw";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json(await getGatewayStatus());
  } catch (error) {
    return jsonError(error, 500);
  }
}
