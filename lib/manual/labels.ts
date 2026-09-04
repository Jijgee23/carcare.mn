import { RESOURCES } from "@/lib/auth/permissions";
import type { ManualRoleTag } from "@/lib/manual/types";

// Role tag-ийн Монгол шошго — resource-ийнх нь бодит нэрийг ашиглана
// (lib/auth/permissions.ts-тэй ганц эх сурвалж, давхар бичихгүй).
export function manualRoleTagLabel(tag: ManualRoleTag): string {
  if (tag === "owner") return "Эзэмшигч";
  return RESOURCES.find((r) => r.key === tag)?.label ?? tag;
}
