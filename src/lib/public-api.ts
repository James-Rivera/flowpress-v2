import { NextResponse } from "next/server";
import { getAllowedOrigins, getAppRole, getBackendBaseUrl } from "@/lib/config";

function normalizeOrigin(value: string) {
  return value.trim().replace(/\/+$/, "");
}

function getRequestOrigin(request: Request) {
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`;
  }

  return new URL(request.url).origin;
}

export function getPublicApiUrl(pathname: string) {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  const baseUrl = getBackendBaseUrl();
  return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}

export function ensureBackendApi() {
  if (getAppRole() === "frontend") {
    return NextResponse.json({ success: false, error: "Not found." }, { status: 404 });
  }

  return null;
}

export function isAllowedRequestOrigin(request: Request) {
  const originHeader = request.headers.get("origin");

  if (!originHeader) {
    return true;
  }

  const origin = normalizeOrigin(originHeader);
  const sameOrigin = normalizeOrigin(getRequestOrigin(request));
  return origin === sameOrigin || getAllowedOrigins().includes(origin);
}

export function withPublicCors(request: Request, response: NextResponse) {
  const origin = request.headers.get("origin");

  if (origin && isAllowedRequestOrigin(request)) {
    response.headers.set("Access-Control-Allow-Origin", normalizeOrigin(origin));
    response.headers.set("Vary", "Origin");
  }

  response.headers.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type");
  response.headers.set("Access-Control-Max-Age", "86400");
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export function getClientAddress(request: Request) {
  return (
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "unknown"
  );
}
