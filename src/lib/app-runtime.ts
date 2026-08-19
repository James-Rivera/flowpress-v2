import path from "node:path";
import { getAppRole, getUploadsRootDir } from "@/lib/config";

function isSubPath(parentPath: string, childPath: string) {
  const relative = path.relative(parentPath, childPath);
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative);
}

export function getStorageSetupError() {
  if (getAppRole() === "frontend") {
    return null;
  }

  const configuredPath = (process.env.UPLOADS_DIR ?? "").trim();

  if (process.env.NODE_ENV === "production" && !configuredPath) {
    return "UPLOADS_DIR is required for the backend production deployment.";
  }

  if (!configuredPath) {
    return null;
  }

  if (process.env.NODE_ENV === "production" && !path.isAbsolute(configuredPath)) {
    return "UPLOADS_DIR must be an absolute path in backend production.";
  }

  const uploadsRoot = getUploadsRootDir();
  const projectRoot = path.resolve(/* turbopackIgnore: true */ process.cwd());

  if (uploadsRoot === projectRoot || isSubPath(projectRoot, uploadsRoot)) {
    return "UPLOADS_DIR must be outside the application directory.";
  }

  return null;
}
