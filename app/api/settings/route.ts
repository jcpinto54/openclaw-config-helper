import { NextRequest, NextResponse } from "next/server";

import { jsonError } from "@/lib/api-responses";
import { accessMode, env } from "@/lib/env";
import { getAppSettings, updateAppSettings } from "@/lib/settings";
import type { AppSettings } from "@/lib/types";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({
      settings: getAppSettings(),
      connection: {
        accessMode,
        sshHost: env.sshHost || null,
        sshUser: env.sshUser || null,
        hasGatewayToken: Boolean(env.gatewayToken),
      },
    });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Partial<AppSettings>;
    return NextResponse.json({
      settings: updateAppSettings(body),
    });
  } catch (error) {
    return jsonError(error);
  }
}
