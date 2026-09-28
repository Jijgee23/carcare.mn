import type { Prisma } from "@/app/generated/prisma/client";

/**
 * Account устгахын өмнө автоматаар цуцлах ёстой захиалгын шалгуур:
 * ирээдүйн (requestedAt > now), хариу хүлээгдэж буй эсвэл баталгаажсан
 * (PENDING/CONFIRMED), ирээгүй (arrivedAt null), захиалга (ServiceOrder)
 * үүсээгүй. Эдгээрийг л капасити тооцоход "PENDING/CONFIRMED" гэдгээрээ
 * ороодог (lib/branch-schedule-loader.ts) тул Account устгагдсаны дараа ч
 * слот эзэлсэн хэвээр үлдэхээс сэргийлнэ.
 *
 * `now` нь ЗААВАЛ дуудагчаас ирнэ (жиш. transaction эхлэх үеийн `new Date()`)
 * — локал цагийн тооцоо хийхгүй, шууд instant харьцуулна.
 */
export function isFutureCancellableAppointment(
  appt: {
    status: string;
    requestedAt: Date;
    arrivedAt: Date | null;
    serviceOrderId: string | null;
  },
  now: Date,
): boolean {
  return (
    (appt.status === "PENDING" || appt.status === "CONFIRMED") &&
    appt.requestedAt.getTime() > now.getTime() &&
    appt.arrivedAt === null &&
    appt.serviceOrderId === null
  );
}

/** Дээрх шалгуурын Prisma `where` хувилбар — query түвшинд ашиглана. */
export function futureCancellableWhere(
  accountId: string,
  now: Date,
): Prisma.AppointmentWhereInput {
  return {
    accountId,
    status: { in: ["PENDING", "CONFIRMED"] },
    requestedAt: { gt: now },
    arrivedAt: null,
    serviceOrderId: null,
  };
}

export const ACCOUNT_DELETION_CANCEL_REASON = "Хэрэглэгч бүртгэлээ устгасан";

export const BUSINESS_TIME_ZONE = "Asia/Ulaanbaatar";

/** Ажилтны мэдэгдэлд харуулах огноо/цаг — Asia/Ulaanbaatar (UTC+8), хостын
 * цагийн бүсээс үл хамааран. `lib/appointments.ts`-ийн `formatWhen`-ээс
 * ялгаатай нь энд `timeZone` тодорхой заасан (тэр функц хостын локал цагаас
 * хамаардаг тул энд ашиглах нь аюулгүй биш). */
export function formatBusinessDateTime(d: Date): string {
  return d.toLocaleString("mn-MN", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export type CancelledAppointmentSummary = {
  requestedAt: Date;
  paidUnrefunded: boolean;
};

const MAX_LISTED_APPOINTMENTS = 5;

/**
 * Ажилтны мэдэгдлийн текст: цуцлагдсан захиалга бүрийн business-цагийг
 * (requestedAt-аар өсөх дарааллаар) жагсаана, төлбөр буцаах шаардлагатай
 * мөрийг "(төлбөр буцаах)" гэж тэмдэглэнэ. 5-аас дээш бол эхний 5-ыг
 * жагсааж "… +N" гэж үлдсэнийг товчилно. Устгалтын огноо (`now`) энд
 * ОРУУЛАХГҮЙ — ажилтанд хэрэгтэй нь аль ЦАГ ЗАХИАЛГА чөлөөлөгдсөн гэдэг мэдээлэл,
 * устгалт хэзээ болсон нь биш.
 */
export function buildAccountDeletionCancelNotificationBody(
  appointments: CancelledAppointmentSummary[],
): string {
  const sorted = [...appointments].sort(
    (a, b) => a.requestedAt.getTime() - b.requestedAt.getTime(),
  );
  const shown = sorted.slice(0, MAX_LISTED_APPOINTMENTS);
  const extra = sorted.length - shown.length;
  const items = shown
    .map(
      (a) =>
        formatBusinessDateTime(a.requestedAt) + (a.paidUnrefunded ? " (төлбөр буцаах)" : ""),
    )
    .join(", ");
  const list = extra > 0 ? `${items}, … +${extra}` : items;
  return (
    `Хэрэглэгч бүртгэлээ устгасны улмаас ${sorted.length} цаг захиалга автоматаар ` +
    `цуцлагдлаа (${ACCOUNT_DELETION_CANCEL_REASON}): ${list}`
  );
}
