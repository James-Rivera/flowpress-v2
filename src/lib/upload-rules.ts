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

    if (file.size <= 0) {
      return `${file.name} is empty.`;
    }

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

function beginsWith(bytes: Uint8Array, signature: number[]) {
  return signature.every((value, index) => bytes[index] === value);
}

export async function validateUploadContents(files: File[]) {
  for (const file of files) {
    const extension = getExtension(file.name);
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    const isPdf = beginsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]);
    const isJpeg = beginsWith(bytes, [0xff, 0xd8, 0xff]);
    const isPng = beginsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const isZip = beginsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || beginsWith(bytes, [0x50, 0x4b, 0x05, 0x06]);
    const isLegacyOffice = beginsWith(bytes, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);

    const valid =
      (extension === ".pdf" && isPdf) ||
      ((extension === ".jpg" || extension === ".jpeg") && isJpeg) ||
      (extension === ".png" && isPng) ||
      ([".docx", ".xlsx", ".pptx"].includes(extension) && isZip) ||
      ([".doc", ".xls", ".ppt"].includes(extension) && isLegacyOffice);

    if (!valid) {
      return `${file.name} does not match its file extension.`;
    }
  }

  return null;
}
