import { prisma } from "@/lib/prisma";

export type PlatformSettings = {
  facebookUrl: string | null;
  youtubeUrl: string | null;
};

const SETTING_ID = "default";

/** Global тохиргоог уншина (нэг мөр). Байхгүй бол бүгд null. */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  const row = await prisma.platformSetting.findUnique({
    where: { id: SETTING_ID },
    select: { facebookUrl: true, youtubeUrl: true },
  });
  return {
    facebookUrl: row?.facebookUrl ?? null,
    youtubeUrl: row?.youtubeUrl ?? null,
  };
}
