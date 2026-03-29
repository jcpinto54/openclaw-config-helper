import { NextResponse } from "next/server";

export const jsonError = (error: unknown, status = 400) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  return NextResponse.json({ error: message }, { status });
};
