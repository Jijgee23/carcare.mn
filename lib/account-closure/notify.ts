import { sendSilentPushToTokens } from "@/lib/push";

export type AccountClosedReason = "deleted" | "deactivated";

/**
 * Account/user хаагдсаны дараа (deactivate эсвэл delete) тухайн эзний бүх
 * төхөөрөмж рүү чимээгүй (data-only) push илгээж, нээлттэй апп-ыг шууд
 * гаргана (sign out). Гэрээ (contract): `{ type: "account_closed", reason }`,
 * `notification` блокгүй.
 *
 * Энэ функц хэзээ ч throw хийхгүй — push алдаа нь closure-ийн үр дүнд нөлөөлөх
 * ёсгүй тул алдааг зөвхөн лог хийж залгинa.
 */
export async function notifyAccountClosed(
  tokens: string[],
  reason: AccountClosedReason,
): Promise<void> {
  if (tokens.length === 0) return;
  try {
    await sendSilentPushToTokens(tokens, { type: "account_closed", reason });
  } catch (err) {
    console.error("[account-closure] silent push failed", { reason, err });
  }
}
