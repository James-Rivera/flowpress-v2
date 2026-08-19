import { promises as fs } from "node:fs";
import path from "node:path";

async function loadDotEnv(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");

    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;

      const separator = line.indexOf("=");
      if (separator < 1) continue;

      const name = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();

      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }

      if (process.env[name] === undefined) process.env[name] = value;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
}

function positiveInt(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function collectFiles(directory, ignoredRoots = new Set()) {
  const files = [];

  async function walk(currentDirectory, isRoot = false) {
    let entries;

    try {
      entries = await fs.readdir(currentDirectory, { withFileTypes: true });
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }

    for (const entry of entries) {
      if (isRoot && ignoredRoots.has(entry.name)) continue;
      const fullPath = path.join(currentDirectory, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile()) {
        const stats = await fs.stat(fullPath);
        files.push({ fullPath, modifiedAt: stats.mtimeMs, size: stats.size });
      }
    }
  }

  await walk(directory, true);
  return files;
}

async function removeEmptyDirectories(directory, protectedDirectories = new Set()) {
  let entries;

  try {
    entries = await fs.readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const fullPath = path.join(directory, entry.name);
    await removeEmptyDirectories(fullPath, protectedDirectories);

    if (!protectedDirectories.has(fullPath)) {
      const remaining = await fs.readdir(fullPath);
      if (remaining.length === 0) await fs.rmdir(fullPath);
    }
  }
}

await loadDotEnv(path.join(process.cwd(), ".env.local"));

const configuredRoot = (process.env.UPLOADS_DIR ?? "").trim();
if (!configuredRoot || !path.isAbsolute(configuredRoot)) {
  throw new Error("UPLOADS_DIR must be configured as an absolute path before cleanup can run.");
}

const uploadsRoot = path.resolve(configuredRoot);
const projectRoot = path.resolve(process.cwd());
const relativeToProject = path.relative(projectRoot, uploadsRoot);

if (uploadsRoot === projectRoot || (!relativeToProject.startsWith("..") && !path.isAbsolute(relativeToProject))) {
  throw new Error("Refusing to clean an upload path inside the application directory.");
}

const retentionHours = positiveInt(process.env.UPLOAD_RETENTION_HOURS, 720);
const cutoff = Date.now() - retentionHours * 60 * 60 * 1000;
const incomingCutoff = Date.now() - 24 * 60 * 60 * 1000;
const dryRun = process.argv.includes("--dry-run");
const metadataDir = path.join(uploadsRoot, "_meta");
const incomingDir = path.join(uploadsRoot, ".incoming");
const files = await collectFiles(uploadsRoot, new Set(["_meta", ".incoming"]));
const metadata = await collectFiles(metadataDir);
const incoming = await collectFiles(incomingDir);
const expired = [
  ...files.filter((file) => file.modifiedAt <= cutoff),
  ...metadata.filter((file) => file.modifiedAt <= cutoff),
  ...incoming.filter((file) => file.modifiedAt <= incomingCutoff),
];

if (!dryRun) {
  for (const file of expired) await fs.rm(file.fullPath, { force: true });
  await removeEmptyDirectories(uploadsRoot, new Set([uploadsRoot, metadataDir, incomingDir]));
}

console.info(JSON.stringify({
  uploadsRoot,
  dryRun,
  retentionHours,
  expiredFiles: expired.length,
  reclaimableBytes: expired.reduce((total, file) => total + file.size, 0),
}, null, 2));
