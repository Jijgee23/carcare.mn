import {
  itemPositions,
  positionedKey,
  type ReportEntry,
  type TemplateItem,
  type TemplateSchema,
} from "@/lib/diagnostics";
import { saveUpload } from "@/lib/storage";

/**
 * FormData (multipart) дотроос тайлангийн утга/файлуудыг гаргаж, зургийг
 * /public/uploads/diagnostics дотор хадгалан, URL-уудыг буцаана.
 *
 * Field-ийн форматууд:
 *   data[<itemId>][value]      — текст/тоо/check (radio утга)
 *   data[<itemId>][note]       — тайлбар
 *   photos[<itemId>][]         — File (давхар)
 *   signatures[<itemId>]       — File (1ш)
 *   signature                  — тайлангийн ерөнхий гарын үсэг (File)
 */
export async function collectReportData(
  fd: FormData,
  schema: TemplateSchema,
): Promise<{
  data: Record<string, ReportEntry>;
  signatureUrl: string | null;
}> {
  const data: Record<string, ReportEntry> = {};

  for (const section of schema.sections) {
    for (const item of section.items) {
      const positions = itemPositions(item);
      if (positions) {
        // Байрлал тус бүрд нийлмэл түлхүүрээр (`<itemId>@<code>`) уншина.
        for (const pos of positions) {
          const key = positionedKey(item.id, pos.code);
          data[key] = await collectEntry(fd, item, key);
        }
      } else {
        data[item.id] = await collectEntry(fd, item, item.id);
      }
    }
  }

  let signatureUrl: string | null = null;
  const sig = fd.get("signature");
  if (sig instanceof File && sig.size > 0) {
    const saved = await saveUpload(sig, "diagnostics/signatures");
    signatureUrl = saved.path;
  }

  return { data, signatureUrl };
}

// Нэг талбарын (item эсвэл байрлал-түлхүүрийн) утга/файл/тэмдэглэлийг уншина.
// `fieldId` нь энгийн item-д `item.id`, байрлалтай item-д `<itemId>@<code>`.
async function collectEntry(
  fd: FormData,
  item: TemplateItem,
  fieldId: string,
): Promise<ReportEntry> {
  const entry: ReportEntry = {};
  const valueKey = `data[${fieldId}][value]`;
  const noteKey = `data[${fieldId}][note]`;
  const photoKey = `photos[${fieldId}]`;
  const sigKey = `signatures[${fieldId}]`;

  if (item.type === "text" || item.type === "check") {
    const v = fd.get(valueKey);
    if (typeof v === "string" && v.trim()) entry.value = v.trim();
  } else if (item.type === "number") {
    const v = fd.get(valueKey);
    if (typeof v === "string" && v.trim()) {
      const n = Number(v);
      if (!Number.isNaN(n)) entry.value = n;
    }
  } else if (item.type === "photo") {
    const files = fd.getAll(photoKey);
    const urls: string[] = [];
    for (const f of files) {
      if (f instanceof File && f.size > 0) {
        const saved = await saveUpload(f, "diagnostics");
        urls.push(saved.path);
      }
    }
    if (urls.length > 0) entry.photos = urls;
  } else if (item.type === "signature") {
    const f = fd.get(sigKey);
    if (f instanceof File && f.size > 0) {
      const saved = await saveUpload(f, "diagnostics/signatures");
      entry.value = saved.path;
    }
  }

  const note = fd.get(noteKey);
  if (typeof note === "string" && note.trim()) entry.note = note.trim();

  return entry;
}
