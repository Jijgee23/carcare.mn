import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { intakeStagingSubdir } from "@/lib/orders/order-intake";
import { saveUpload } from "@/lib/storage";
import { requireActiveSubscriptionApi } from "@/lib/subscription-server";

const ALLOWED_KINDS = new Set(["diagnostics", "signatures", "intake"]);

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
  let subdir = kind === "signatures" ? "diagnostics/signatures" : "diagnostics";
  if (kind === "intake") {
    // Хүлээн авах зураг: захиалга үүсгэх эрхтэй, багц идэвхтэй ажилтны өөрийн staging хавтас.
    const denied = requirePermission(auth.user, "orders.create");
    if (denied) return denied;
    const locked = await requireActiveSubscriptionApi(auth.user);
    if (locked) return locked;
    subdir = intakeStagingSubdir(auth.user.tenantId, auth.user.id);
  }

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
