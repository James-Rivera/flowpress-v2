import { NextResponse } from "next/server";
import { getStorageSetupError } from "@/lib/app-runtime";
import { getUploadLimits, getUploadOperationsConfig } from "@/lib/config";
import { ensureBackendApi, getClientAddress, isAllowedRequestOrigin, withPublicCors } from "@/lib/public-api";
import { ensureStorageCapacity, saveUploadedFiles } from "@/lib/storage";
import { consumeUploadRateLimit } from "@/lib/upload-rate-limit";
import { validateUploadContents, validateUploadFiles } from "@/lib/upload-rules";

export const runtime = "nodejs";

const LIMITS = getUploadLimits();
const OPERATIONS = getUploadOperationsConfig();
const MAX_REQUEST_BYTES = LIMITS.maxBatchSizeMb * 1024 * 1024 + 2 * 1024 * 1024;
let activeUploads = 0;

function json(request: Request, body: object, status: number, headers?: HeadersInit) {
  return withPublicCors(request, NextResponse.json(body, { status, headers }));
}

export function OPTIONS(request: Request) {
  const roleError = ensureBackendApi();

  if (roleError) {
    return roleError;
  }

  if (!isAllowedRequestOrigin(request)) {
    return NextResponse.json({ success: false, error: "Origin not allowed." }, { status: 403 });
  }

  return withPublicCors(request, new NextResponse(null, { status: 204 }));
}

export async function POST(request: Request) {
  const requestStartedAt = performance.now();
  const roleError = ensureBackendApi();

  if (roleError) {
    return roleError;
  }

  if (!isAllowedRequestOrigin(request)) {
    return json(request, { success: false, error: "Origin not allowed." }, 403);
  }

  const storageSetupError = getStorageSetupError();

  if (storageSetupError) {
    return json(request, { success: false, error: storageSetupError }, 503);
  }

  const declaredLength = Number.parseInt(request.headers.get("content-length") ?? "", 10);

  if (process.env.NODE_ENV === "production" && !Number.isFinite(declaredLength)) {
    return json(request, { success: false, error: "Upload size is required." }, 411);
  }

  if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
    return json(request, { success: false, error: "Upload request is too large." }, 413);
  }

  const rateLimit = consumeUploadRateLimit(getClientAddress(request), OPERATIONS.rateLimitPerHour);

  if (!rateLimit.allowed) {
    return json(
      request,
      { success: false, error: "Too many uploads. Please wait and try again." },
      429,
      { "Retry-After": String(rateLimit.retryAfterSeconds) }
    );
  }

  if (activeUploads >= OPERATIONS.maxConcurrentUploads) {
    return json(
      request,
      { success: false, error: "The upload server is busy. Please try again shortly." },
      503,
      { "Retry-After": "10" }
    );
  }

  activeUploads += 1;
  try {
    const formData = await request.formData();
    const parsedAt = performance.now();
    const customerName = String(formData.get("name") ?? "").trim();
    const fileEntries = formData.getAll("file").filter((entry): entry is File => entry instanceof File);

    if (!customerName || customerName.length > 80) {
      return json(request, { success: false, error: "Enter a customer name up to 80 characters." }, 400);
    }

    const validationError = validateUploadFiles(fileEntries, LIMITS);

    if (validationError) {
      return json(request, { success: false, error: validationError }, 400);
    }

    const contentError = await validateUploadContents(fileEntries);

    if (contentError) {
      return json(request, { success: false, error: contentError }, 400);
    }
    const validatedAt = performance.now();

    const incomingBytes = fileEntries.reduce((total, file) => total + file.size, 0);
    const capacityError = await ensureStorageCapacity(incomingBytes);

    if (capacityError) {
      return json(request, { success: false, error: capacityError }, 507);
    }
    const capacityCheckedAt = performance.now();

    const savedFiles = await saveUploadedFiles(customerName, fileEntries);
    const savedAt = performance.now();
    const timings = {
      parseMs: Number((parsedAt - requestStartedAt).toFixed(1)),
      validateMs: Number((validatedAt - parsedAt).toFixed(1)),
      capacityMs: Number((capacityCheckedAt - validatedAt).toFixed(1)),
      saveMs: Number((savedAt - capacityCheckedAt).toFixed(1)),
      totalMs: Number((savedAt - requestStartedAt).toFixed(1)),
    };

    console.info(
      "[flowpress-local] upload complete",
      JSON.stringify({ fileCount: fileEntries.length, totalBytes: incomingBytes, ...timings })
    );

    return json(request, {
      success: true,
      uploadedCount: savedFiles.length,
      customerFolder: savedFiles[0]?.customerFolder ?? "",
      files: savedFiles.map((file) => ({
        originalFilename: file.originalFilename,
        savedFilename: file.savedFilename,
        relativePath: file.relativePath,
      })),
    }, 200, {
      "Server-Timing": [
        `parse;dur=${timings.parseMs}`,
        `validate;dur=${timings.validateMs}`,
        `capacity;dur=${timings.capacityMs}`,
        `save;dur=${timings.saveMs}`,
      ].join(", "),
    });
  } catch (error) {
    console.error(
      "[flowpress-local] upload failed",
      JSON.stringify({ totalMs: Number((performance.now() - requestStartedAt).toFixed(1)) }),
      error
    );
    return json(request, { success: false, error: "Upload failed due to a server error." }, 500);
  } finally {
    activeUploads -= 1;
  }
}
