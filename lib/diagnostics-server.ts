import {
  isItemVisible,
  itemPositions,
  positionedKey,
  type ReportEntry,
  type TemplateItem,
  type TemplateSchema,
  validateReportData,
} from "@/lib/diagnostics";
import {
  deleteUpload,
  saveUpload,
  validateUpload,
  type SavedFile,
} from "@/lib/storage";

export type UploadStore = {
  validateUpload: (file: File) => void;
  saveUpload: (file: File, subdir: string) => Promise<SavedFile>;
  deleteUpload: (urlPath: string) => Promise<void>;
};

export class ReportDataValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportDataValidationError";
  }
}

const defaultStore: UploadStore = { validateUpload, saveUpload, deleteUpload };

type PendingFile = {
  file: File;
  fieldId: string;
  kind: "photo" | "signature";
};

/** Collect and validate the whole request before the first upload write. */
export async function collectValidatedReportData(
  fd: FormData,
  schema: TemplateSchema,
  store: UploadStore = defaultStore,
): Promise<{
  data: Record<string, ReportEntry>;
  signatureUrl: string | null;
  uploadedPaths: string[];
}> {
  const data: Record<string, ReportEntry> = {};
  const pending: PendingFile[] = [];

  for (const section of schema.sections) {
    for (const item of section.items) {
      const positions = itemPositions(item);
      if (positions) {
        for (const position of positions) {
          collectDraftEntry(
            fd,
            item,
            positionedKey(item.id, position.code),
            data,
            pending,
          );
        }
      } else {
        collectDraftEntry(fd, item, item.id, data, pending);
      }
    }
  }

  const signatureValue = fd.get("signature");
  const overallSignature =
    signatureValue instanceof File && signatureValue.size > 0
      ? signatureValue
      : null;
  if (overallSignature) {
    pending.push({ file: overallSignature, fieldId: "signature", kind: "signature" });
  }

  // Required/scalar/visibility validation must finish before any file work.
  try {
    validateReportData(schema, data);
  } catch (error) {
    throw new ReportDataValidationError(
      error instanceof Error ? error.message : "Бөглөлт буруу.",
    );
  }

  // Validate every relevant file before the first save.
  for (const upload of pending) store.validateUpload(upload.file);

  // Pending markers exist only to let required-file validation pass. Remove
  // them before materialising the real paths below.
  for (const upload of pending) {
    if (upload.fieldId === "signature") continue;
    const entry = data[upload.fieldId];
    if (!entry) continue;
    if (upload.kind === "photo") entry.photos = [];
    else delete entry.value;
  }

  const uploadedPaths: string[] = [];
  try {
    for (const upload of pending) {
      const saved = await store.saveUpload(
        upload.file,
        upload.kind === "signature" ? "diagnostics/signatures" : "diagnostics",
      );
      uploadedPaths.push(saved.path);
      if (upload.kind === "photo") {
        const entry = data[upload.fieldId] ?? {};
        entry.photos = [...(entry.photos ?? []), saved.path];
        data[upload.fieldId] = entry;
      } else if (upload.fieldId !== "signature") {
        const entry = data[upload.fieldId] ?? {};
        entry.value = saved.path;
        data[upload.fieldId] = entry;
      }
    }
  } catch (error) {
    await bestEffortDelete(uploadedPaths, store.deleteUpload);
    throw error;
  }

  const signatureIndex = pending.findIndex(
    (upload) => upload.fieldId === "signature",
  );
  return {
    data,
    signatureUrl:
      signatureIndex >= 0 ? uploadedPaths[signatureIndex] ?? null : null,
    uploadedPaths,
  };
}

/** Compensate request-owned uploads for commit exceptions and non-successes. */
export async function commitWithReportUploadCleanup<Result>(
  uploadedPaths: string[],
  commit: () => Promise<Result>,
  isSuccess: (result: Result) => boolean = defaultCommitSuccess,
  remove: (urlPath: string) => Promise<void> = deleteUpload,
): Promise<Result> {
  try {
    const result = await commit();
    if (isSuccess(result)) return result;
    await bestEffortDelete(uploadedPaths, remove);
    return result;
  } catch (error) {
    await bestEffortDelete(uploadedPaths, remove);
    throw error;
  }
}

function defaultCommitSuccess(result: unknown): boolean {
  return result instanceof Response ? result.ok : true;
}

async function bestEffortDelete(
  paths: string[],
  remove: (urlPath: string) => Promise<void>,
): Promise<void> {
  for (const uploadPath of paths) {
    try {
      await remove(uploadPath);
    } catch {
      // Cleanup must never mask the primary result or exception.
    }
  }
}

function collectDraftEntry(
  fd: FormData,
  item: TemplateItem,
  fieldId: string,
  data: Record<string, ReportEntry>,
  pending: PendingFile[],
): void {
  if (!isItemVisible(item, data)) return;
  const entry: ReportEntry = {};
  const value = fd.get(`data[${fieldId}][value]`);

  if (item.type === "text" || item.type === "check") {
    if (typeof value === "string" && value.trim()) entry.value = value.trim();
  } else if (item.type === "number") {
    if (typeof value === "string" && value.trim()) {
      const number = Number(value);
      if (!Number.isNaN(number)) entry.value = number;
    }
  } else if (item.type === "photo") {
    const files = nonEmptyFiles(fd.getAll(`photos[${fieldId}]`));
    if (files.length) {
      entry.photos = files.map(() => "__pending_upload__");
      for (const file of files) pending.push({ file, fieldId, kind: "photo" });
    }
  } else if (item.type === "signature") {
    const file = fd.get(`signatures[${fieldId}]`);
    if (file instanceof File && file.size > 0) {
      entry.value = "__pending_upload__";
      pending.push({ file, fieldId, kind: "signature" });
    }
  }

  const note = fd.get(`data[${fieldId}][note]`);
  if (typeof note === "string" && note.trim()) entry.note = note.trim();
  data[fieldId] = entry;
}

function nonEmptyFiles(values: FormDataEntryValue[]): File[] {
  return values.filter(
    (value): value is File => value instanceof File && value.size > 0,
  );
}
