import { NextResponse } from "next/server";

export type HealthResponse = {
  status: "ok";
  time: string;
};

/** Lightweight liveness check used by the home page and CI smoke tests. */
export async function GET() {
  const body: HealthResponse = {
    status: "ok",
    time: new Date().toISOString(),
  };

  return NextResponse.json(body);
}
