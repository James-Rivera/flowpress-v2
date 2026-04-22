export type UploadableFile = {
  name: string;
  size: number;
  type?: string;
};

export type UploadLimits = {
  maxFileCount: number;
  maxFileSizeMb: number;
  maxBatchSizeMb: number;
};

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".ppt",
  ".pptx",
  ".jpg",
  ".jpeg",
  ".png",
]);

function getExtension(filename: string) {
  const lastDot = filename.lastIndexOf(".");
  return lastDot === -1 ? "" : filename.slice(lastDot).toLowerCase();
}

export function validateUploadFiles(files: UploadableFile[], limits: UploadLimits) {
  if (files.length === 0) {
    return "Choose at least one file.";
  }

  if (files.length > limits.maxFileCount) {
    return `Maximum ${limits.maxFileCount} files per upload.`;
  }

  const maxFileBytes = limits.maxFileSizeMb * 1024 * 1024;
  const maxBatchBytes = limits.maxBatchSizeMb * 1024 * 1024;
  let totalBytes = 0;

  for (const file of files) {
    totalBytes += file.size;

    if (!ALLOWED_EXTENSIONS.has(getExtension(file.name))) {
      return `Unsupported file type: ${file.name}. Upload PDF, Office, JPG, or PNG files only.`;
    }

    if (file.size > maxFileBytes) {
      return `${file.name} is too large. Maximum is ${limits.maxFileSizeMb}MB per file.`;
    }
  }

  if (totalBytes > maxBatchBytes) {
    return `Total upload too large. Maximum is ${limits.maxBatchSizeMb}MB per upload.`;
  }

  return null;
}
