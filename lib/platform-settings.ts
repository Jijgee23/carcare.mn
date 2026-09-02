import { prisma } from "@/lib/prisma";
import { setBypassContext } from "@/lib/tenant-context";

export type PlatformSettings = {
  facebookUrl: string | null;
  youtubeUrl: string | null;
  // Цаг захиалгын хураамж — false бол үнэгүй (invoice үүсэхгүй).
  appointmentFeeEnabled: boolean;
  appointmentFeeAmount: number;
};

const SETTING_ID = "default";
const DEFAULT_APPOINTMENT_FEE_AMOUNT = 1000;

/**
 * Global тохиргоог уншина (нэг мөр). Мөр байхгүй бол текст талбарууд null,
 * хураамж анхны утгуудаараа (идэвхтэй, 1000₮).
 * Дуудагдах хоёр контекст (public Footer, эсвэл system superadmin) аль аль нь
 * bypass-той тохирдог тул энд bypass тавихад аюулгүй (superadmin талд аль
 * хэдийн bypass идэвхтэй тул давхар дуудалт зүгээр).
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  setBypassContext();
  const row = await prisma.platformSetting.findUnique({
    where: { id: SETTING_ID },
    select: {
      facebookUrl: true,
      youtubeUrl: true,
      appointmentFeeEnabled: true,
      appointmentFeeAmount: true,
    },
  });
  return {
    facebookUrl: row?.facebookUrl ?? null,
    youtubeUrl: row?.youtubeUrl ?? null,
    appointmentFeeEnabled: row?.appointmentFeeEnabled ?? true,
    appointmentFeeAmount: row
      ? Number.parseFloat(row.appointmentFeeAmount.toString())
      : DEFAULT_APPOINTMENT_FEE_AMOUNT,
  };
}
