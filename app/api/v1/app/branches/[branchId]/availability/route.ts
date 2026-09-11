import { jsonError, jsonOk } from "@/lib/api";
import { resolvePublicAvailability } from "@/lib/public-availability";
import { setBypassContext } from "@/lib/tenant-context";

// GET /api/v1/app/branches/[branchId]/availability?date=YYYY-MM-DD[&categoryIds=a,b,c]
// Нийтэд нээлттэй. Сонгосон ангилалуудын нийлбэр хугацаанд багтах сул цагуудыг
// (slot) буцаана — booking v2 D. categoryIds хоосон бол салбарын default slot урт.
//
// S15-S16 (WEB_SCHEDULING_ASSESSMENT_2026-09-10.md): all boundary/eligibility
// validation now lives in the shared lib/public-availability.ts service —
// see that file's doc comment for what it fixes and why.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ branchId: string }> },
) {
  setBypassContext();
  const { branchId } = await ctx.params;
  const sp = new URL(req.url).searchParams;

  const dateStr = sp.get("date") ?? "";
  const categoryIds = (sp.get("categoryIds") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const result = await resolvePublicAvailability({ branchId, dateStr, categoryIds });
  if (!result.ok) {
    switch (result.reason) {
      case "invalid_date":
      case "invalid_category":
        return jsonError(400, result.message);
      case "not_found":
        return jsonError(404, result.message);
      case "not_available":
        return jsonError(403, result.message);
    }
  }

  return jsonOk({ date: dateStr, ...result.availability });
}
