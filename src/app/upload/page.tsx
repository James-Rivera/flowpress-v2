"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type DragEvent, type FormEvent } from "react";
import { getClientUploadLimits } from "@/lib/public-config";
import { validateUploadFiles } from "@/lib/upload-rules";

type SubmitState = {
  tone: "error" | "success";
  message: string;
} | null;

const LIMITS = getClientUploadLimits();

function prettyMb(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function mergeFiles(existing: File[], incoming: File[]) {
  const map = new Map<string, File>();

  for (const file of [...existing, ...incoming]) {
    const key = `${file.name}-${file.size}-${file.lastModified}`;
    map.set(key, file);
  }

  return Array.from(map.values());
}

export default function UploadPage() {
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function setChosenFiles(nextFiles: File[], mode: "replace" | "append" = "replace") {
    setFiles((current) => (mode === "append" ? mergeFiles(current, nextFiles) : nextFiles));
    setSubmitState(null);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);
    setChosenFiles(nextFiles, files.length > 0 ? "append" : "replace");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function onDragOver(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(true);
  }

  function onDragLeave(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    setChosenFiles(Array.from(event.dataTransfer.files ?? []), files.length > 0 ? "append" : "replace");
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
    setSubmitState(null);
  }

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!customerName.trim()) {
      setSubmitState({ tone: "error", message: "Enter the customer name first." });
      return;
    }

    const validationError = validateUploadFiles(files, LIMITS);

    if (validationError) {
      setSubmitState({ tone: "error", message: validationError });
      return;
    }

    setIsSubmitting(true);
    setSubmitState(null);

    const formData = new FormData();
    formData.set("name", customerName.trim());

    for (const file of files) {
      formData.append("file", file);
    }

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as {
        success?: boolean;
        error?: string;
        uploadedCount?: number;
      };

      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Upload failed.");
      }

      const params = new URLSearchParams();
      params.set("name", customerName.trim());
      params.set("count", String(payload.uploadedCount ?? files.length));
      router.push(`/success?${params.toString()}`);
    } catch (error) {
      setSubmitState({
        tone: "error",
        message: error instanceof Error ? error.message : "Upload failed.",
      });
      setIsSubmitting(false);
    }
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);

  return (
    <main className="app-shell flex items-center justify-center">
      <section className="page-wrap customer-wrap">
        <article className="mx-auto w-full max-w-[460px] rounded-[1.75rem] border border-surface-border bg-surface-card px-6 py-7 shadow-[0_10px_28px_rgba(20,23,31,0.10)] sm:px-8 sm:py-8">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="secondary-btn !px-4 !py-2 !text-sm !font-medium">
              Back
            </Link>
            <div className="w-full max-w-[150px]">
              <Image src="/logo.svg" alt="CJ NET" width={260} height={88} className="h-auto w-full" priority />
            </div>
          </div>

          <h1 className="display-title mt-6 text-3xl font-semibold tracking-tight text-foreground">Upload file</h1>
          <p className="mt-3 text-sm leading-6 text-text-secondary">
            Enter the customer name, choose the file, then send it to the shop PC.
          </p>

          <form className="mt-6 space-y-4" onSubmit={onSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Customer name</span>
              <input
                className="input-field"
                value={customerName}
                onChange={(event) => setCustomerName(event.target.value)}
                placeholder="Enter customer name"
                autoComplete="name"
                disabled={isSubmitting}
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold">Files</span>
              <p className="mb-3 text-sm text-text-secondary">Tap to choose files, or drag them here.</p>
              <label
                className={`upload-dropzone ${isDragging ? "upload-dropzone-active" : ""} ${isSubmitting ? "opacity-70" : ""}`}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <input
                  ref={fileInputRef}
                  className="sr-only"
                  type="file"
                  multiple
                  onChange={onFileChange}
                  disabled={isSubmitting}
                />
                {files.length === 0 ? (
                  <>
                    <span className="text-xl font-semibold text-foreground">Tap to choose files</span>
                    <span className="mt-2 text-sm text-text-secondary">PDF, DOCX, JPG, JPEG, PNG</span>
                  </>
                ) : (
                  <div className="w-full">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-left text-base font-semibold text-foreground">Selected files</p>
                        <p className="mt-1 text-left text-sm text-text-secondary">
                          {files.length} file{files.length === 1 ? "" : "s"} ready
                        </p>
                      </div>
                      <button
                        type="button"
                        className="secondary-btn !px-4 !py-2 !text-sm"
                        onClick={(event) => {
                          event.preventDefault();
                          openFilePicker();
                        }}
                        disabled={isSubmitting}
                      >
                        Add more files
                      </button>
                    </div>

                    <ul className="mt-4 space-y-2">
                      {files.map((file, index) => (
                        <li
                          key={`${file.name}-${file.size}-${file.lastModified}`}
                          className="upload-file-row"
                        >
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                            <p className="mt-1 text-xs text-text-secondary">{prettyMb(file.size)}</p>
                          </div>
                          <button
                            type="button"
                            className="upload-file-remove"
                            onClick={(event) => {
                              event.preventDefault();
                              removeFile(index);
                            }}
                            disabled={isSubmitting}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </label>
            </label>

            <div className="subtle-panel rounded-2xl px-4 py-4">
              <p className="m-0 font-semibold">Upload limits</p>
              <p className="mt-2 mb-0 text-sm leading-6 text-text-secondary">
                Up to {LIMITS.maxFileCount} files, {LIMITS.maxFileSizeMb}MB each, {LIMITS.maxBatchSizeMb}MB total.
              </p>
            </div>

            {files.length > 0 ? <p className="text-sm text-text-secondary">Total selected: {prettyMb(totalBytes)}</p> : null}

            {submitState ? (
              <div className={`status-box ${submitState.tone === "error" ? "status-box-error" : "status-box-success"}`}>
                {submitState.message}
              </div>
            ) : null}

            <button type="submit" className="primary-btn w-full text-base font-extrabold" disabled={isSubmitting}>
              {isSubmitting ? "Uploading..." : "Send files"}
            </button>
          </form>
        </article>
      </section>
    </main>
  );
}
