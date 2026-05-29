import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { saveUpload } from "@/lib/storage";

const ALLOWED_KINDS = new Set(["diagnostics", "signatures"]);

export async function POST(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return jsonError(400, "Multipart form-data илгээнэ үү.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return jsonError(400, "`file` талбарт зураг хавсаргана уу.");
  }

  const kindRaw = (formData.get("kind") ?? "diagnostics").toString();
  const kind = ALLOWED_KINDS.has(kindRaw) ? kindRaw : "diagnostics";
  const subdir = kind === "signatures" ? "diagnostics/signatures" : "diagnostics";

  try {
    const saved = await saveUpload(file, subdir);
    return jsonOk(
      {
        url: saved.path,
        size: saved.size,
        mime: saved.mime,
      },
      { status: 201 },
    );
  } catch (e) {
    return jsonError(400, e instanceof Error ? e.message : "Файл хадгалахад алдаа.");
  }
}
