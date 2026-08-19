import path from "node:path";

export type AppRole = "frontend" | "backend";

function getPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getUploadsRootDir() {
  const configuredPath = (process.env.UPLOADS_DIR ?? "").trim();
  return path.resolve(configuredPath || path.join(/* turbopackIgnore: true */ process.cwd(), "uploads"));
}

export function getAppRole(): AppRole {
  return process.env.APP_ROLE?.trim().toLowerCase() === "frontend" ? "frontend" : "backend";
}

export function getBackendBaseUrl() {
  return (process.env.NEXT_PUBLIC_BACKEND_BASE_URL ?? "").trim().replace(/\/+$/, "");
}

export function getAllowedOrigins() {
  return (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

export function getMetadataDir() {
  return path.join(getUploadsRootDir(), "_meta");
}

export function getUploadLimits() {
  return {
    maxFileCount: getPositiveInt(process.env.UPLOAD_MAX_FILE_COUNT, 20),
    maxFileSizeMb: getPositiveInt(process.env.UPLOAD_MAX_FILE_SIZE_MB, 100),
    maxBatchSizeMb: getPositiveInt(process.env.UPLOAD_MAX_BATCH_SIZE_MB, 500),
  };
}

export function getUploadOperationsConfig() {
  return {
    rateLimitPerHour: getPositiveInt(process.env.UPLOAD_RATE_LIMIT_PER_HOUR, 60),
    maxConcurrentUploads: getPositiveInt(process.env.UPLOAD_MAX_CONCURRENT, 2),
    minimumFreeSpaceMb: getPositiveInt(process.env.UPLOAD_MIN_FREE_SPACE_MB, 5120),
    retentionHours: getPositiveInt(process.env.UPLOAD_RETENTION_HOURS, 720),
    maxDiskUsagePercent: getPositiveInt(process.env.UPLOAD_MAX_DISK_USAGE_PERCENT, 85),
  };
}

export function getMessengerLinks() {
  return {
    web: (process.env.NEXT_PUBLIC_MESSENGER_WEB_URL ?? "https://m.me/cjnetvalley").trim(),
    app: (process.env.NEXT_PUBLIC_MESSENGER_APP_URL ?? "fb-messenger://user-thread/cjnetvalley").trim(),
  };
}

export function getGmailConfig() {
  return {
    to: (process.env.NEXT_PUBLIC_GMAIL_TO ?? "cjnetvalley@gmail.com").trim(),
    subject: (process.env.NEXT_PUBLIC_GMAIL_SUBJECT ?? "CJ NET Print Request").trim(),
  };
}

export { getPositiveInt };
