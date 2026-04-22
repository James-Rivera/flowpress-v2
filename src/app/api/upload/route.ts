import { NextResponse } from "next/server";
import { getUploadLimits } from "@/lib/config";
import { saveUploadedFiles } from "@/lib/storage";
import { validateUploadFiles } from "@/lib/upload-rules";

export const runtime = "nodejs";

const LIMITS = getUploadLimits();

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const customerName = String(formData.get("name") ?? "").trim();
    const fileEntries = formData.getAll("file").filter((entry): entry is File => entry instanceof File);

    if (!customerName) {
      return NextResponse.json({ success: false, error: "Customer name is required." }, { status: 400 });
    }

    const validationError = validateUploadFiles(fileEntries, LIMITS);

    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const savedFiles = await saveUploadedFiles(customerName, fileEntries);

    return NextResponse.json({
      success: true,
      uploadedCount: savedFiles.length,
      customerFolder: savedFiles[0]?.customerFolder ?? "",
      files: savedFiles.map((file) => ({
        originalFilename: file.originalFilename,
        savedFilename: file.savedFilename,
        relativePath: file.relativePath,
      })),
    });
  } catch (error) {
    console.error("[flowpress-local] upload failed", error);
    return NextResponse.json({ success: false, error: "Upload failed due to a server error." }, { status: 500 });
  }
}
