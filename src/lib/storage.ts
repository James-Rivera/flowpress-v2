import { createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeReadableStream } from "node:stream/web";
import { getMetadataDir, getUploadsRootDir } from "@/lib/config";

export type StoredUpload = {
  customerName: string;
  customerFolder: string;
  originalFilename: string;
  savedFilename: string;
  absolutePath: string;
  relativePath: string;
};

function sanitizePathSegment(value: string, fallback: string) {
  const cleaned = value
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[. ]+$/g, "");

  return cleaned || fallback;
}

function sanitizeCustomerFolder(name: string) {
  return sanitizePathSegment(name, "Customer");
}

function sanitizeFilename(filename: string) {
  const parsed = path.parse(filename);
  const safeBase = sanitizePathSegment(parsed.name, "upload");
  const safeExt = parsed.ext.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "");
  return `${safeBase}${safeExt}`;
}

async function fileExists(targetPath: string) {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function writeWebFileToDisk(file: File, targetPath: string) {
  await pipeline(
    Readable.fromWeb(file.stream() as unknown as NodeReadableStream<Uint8Array>),
    createWriteStream(targetPath, { flags: "wx" })
  );
}

async function createUniqueFilePath(directory: string, originalFilename: string) {
  const parsed = path.parse(sanitizeFilename(originalFilename));
  const extension = parsed.ext;
  const baseName = parsed.name;

  let attempt = 0;

  while (true) {
    const candidate = attempt === 0 ? `${baseName}${extension}` : `${baseName} (${attempt + 1})${extension}`;
    const targetPath = path.join(directory, candidate);

    if (!(await fileExists(targetPath))) {
      return {
        filename: candidate,
        targetPath,
      };
    }

    attempt += 1;
  }
}

async function writeManifest(entries: StoredUpload[]) {
  await mkdir(getMetadataDir(), { recursive: true });

  const manifest = {
    uploadedAt: new Date().toISOString(),
    customerName: entries[0]?.customerName ?? "",
    files: entries.map((entry) => ({
      originalFilename: entry.originalFilename,
      savedFilename: entry.savedFilename,
      relativePath: entry.relativePath,
    })),
  };

  const stamp = Date.now();
  await writeFile(path.join(getMetadataDir(), `${stamp}.json`), JSON.stringify(manifest, null, 2), "utf8");
}

export async function saveUploadedFiles(customerName: string, files: File[]) {
  const uploadsRoot = getUploadsRootDir();
  const customerFolder = sanitizeCustomerFolder(customerName);
  const customerDir = path.join(uploadsRoot, customerFolder);

  await mkdir(customerDir, { recursive: true });

  const savedEntries: StoredUpload[] = [];

  for (const file of files) {
    const originalFilename = sanitizeFilename(file.name);
    const { filename, targetPath } = await createUniqueFilePath(customerDir, originalFilename);
    await writeWebFileToDisk(file, targetPath);

    savedEntries.push({
      customerName,
      customerFolder,
      originalFilename,
      savedFilename: filename,
      absolutePath: targetPath,
      relativePath: path.join(customerFolder, filename),
    });
  }

  await writeManifest(savedEntries);

  return savedEntries;
}

export async function listRecentUploads(limit = 10) {
  try {
    const metadataDir = getMetadataDir();
    const stats = await stat(metadataDir);

    if (!stats.isDirectory()) {
      return [];
    }
  } catch {
    return [];
  }

  const metadataDir = getMetadataDir();
  const fileNames = await readdir(metadataDir);
  const manifests = await Promise.all(
    fileNames
      .filter((fileName) => fileName.endsWith(".json"))
      .map(async (fileName) => {
        const filePath = path.join(metadataDir, fileName);
        const payload = await readFile(filePath, "utf8");
        return JSON.parse(payload) as {
          uploadedAt: string;
          customerName: string;
          files: Array<{ originalFilename: string; savedFilename: string; relativePath: string }>;
        };
      })
  );

  return manifests
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime())
    .slice(0, limit);
}
