function getPositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function getClientUploadLimits() {
  return {
    maxFileCount: getPositiveInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_COUNT, 20),
    maxFileSizeMb: getPositiveInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_FILE_SIZE_MB, 100),
    maxBatchSizeMb: getPositiveInt(process.env.NEXT_PUBLIC_UPLOAD_MAX_BATCH_SIZE_MB, 500),
  };
}
