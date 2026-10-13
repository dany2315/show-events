import "server-only";
import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AccessError } from "./dal";
import { DonationError } from "./donations";

export function json<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: { "cache-control": "no-store", ...(init?.headers ?? {}) },
  });
}

export function errorResponse(error: unknown) {
  if (error instanceof AccessError) {
    return json({ error: error.message, code: "ACCESS" }, { status: error.status });
  }
  if (error instanceof DonationError) {
    const status =
      error.code === "RATE_LIMITED" ? 429 : error.code === "EVENT_NOT_FOUND" || error.code === "NOT_FOUND" ? 404 : error.code === "INVALID" ? 400 : 409;
    return json({ error: error.message, code: error.code }, { status });
  }
  if (error instanceof ZodError) {
    return json({ error: "Données invalides", code: "INVALID", issues: error.issues }, { status: 400 });
  }
  console.error("[api]", error);
  return json({ error: "Erreur serveur", code: "SERVER" }, { status: 500 });
}

export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "0.0.0.0";
}
