/**
 * Health Check API Endpoint
 * Used by Docker/Kubernetes for container health monitoring
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || "1.0.0",
    },
    { status: 200 }
  );
}
