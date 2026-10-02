"use server";

import { requireUser } from "@/lib/auth";
import { canCreate } from "@/lib/auth/roles";
import { intakeStagingSubdir } from "@/lib/orders/order-intake";
import { saveUpload } from "@/lib/storage";
import { assertActiveSubscription } from "@/lib/subscription-server";

export type StageIntakeFileResult = { ok: true; path: string } | { ok: false; message: string };

/**
 * QA #14: захиалга үүсгэхээс өмнө хүлээн авах зураг / гарын үсгийг нэг нэгээр
 * staging хийнэ. Захиалгатай холбох нь createOrderAction-д (lib/orders/order-intake.ts).
 */
export async function stageIntakeFileAction(formData: FormData): Promise<StageIntakeFileResult> {
  try {
    const user = await requireUser();
    if (!canCreate(user, "orders")) return { ok: false, message: "Танд засварын хуудас үүсгэх эрх байхгүй." };
    try {
      await assertActiveSubscription(user.tenantId);
    } catch (e) {
      return { ok: false, message: e instanceof Error ? e.message : "Алдаа" };
    }
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Зураг сонгоно уу." };
    const saved = await saveUpload(file, intakeStagingSubdir(user.tenantId, user.id));
    return { ok: true, path: saved.path };
  } catch (e) {
    // saveUpload-ийн validation алдаа (төрөл, хэмжээ) хэрэглэгчид харагдана.
    if (e instanceof Error && /зураг|файл|MB/i.test(e.message)) return { ok: false, message: e.message };
    console.error("[order-intake] stage:", e);
    return { ok: false, message: "Серверийн алдаа гарлаа. Дахин оролдоно уу." };
  }
}
