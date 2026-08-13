import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

export type PlatformSettings = {
  facebookUrl: string | null;
  youtubeUrl: string | null;
};

const SETTING_ID = "default";

/**
 * Global тохиргоог уншина (нэг мөр). Байхгүй бол бүгд null.
 * Дуудагдах хоёр контекст (public Footer, эсвэл system superadmin) аль аль нь
 * bypass-той тохирдог тул энд bypass тавихад аюулгүй (superadmin талд аль
 * хэдийн bypass идэвхтэй тул давхар дуудалт зүгээр).
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  setBypassContext();
  const row = await prisma.platformSetting.findUnique({
    where: { id: SETTING_ID },
    select: { facebookUrl: true, youtubeUrl: true },
  });
  return {
    facebookUrl: row?.facebookUrl ?? null,
    youtubeUrl: row?.youtubeUrl ?? null,
  };
}
