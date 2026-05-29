/**
 * Хэрэглэгчийн идэвхтэй эсэхийг шалгах helper. login + middleware-аас дуудна.
 */

export type ActiveCheck =
  | { ok: true }
  | { ok: false; reason: "INACTIVE" | "EXPIRED"; message: string };

/**
 * Хэрэглэгч идэвхтэй эсэх, түүний хугацаа дуусаагүй эсэхийг шалгана.
 */
export function checkUserActive(user: {
  isActive: boolean;
  activeUntil: Date | null;
}): ActiveCheck {
  if (!user.isActive) {
    return {
      ok: false,
      reason: "INACTIVE",
      message:
        "Энэ хэрэглэгч идэвхгүй болсон. Менежертэйгээ холбоо барина уу.",
    };
  }
  if (user.activeUntil && user.activeUntil.getTime() <= Date.now()) {
    return {
      ok: false,
      reason: "EXPIRED",
      message: `Энэ хэрэглэгчийн хугацаа ${user.activeUntil.toLocaleDateString("mn-MN")}-нд дууссан.`,
    };
  }
  return { ok: true };
}
