import { formatBusinessDateTime } from "@/lib/account-closure/appointment-cancellation";

/**
 * D-191: `appointment_booked_by_staff` мэдэгдлийн текст — салбарын нэр +
 * Asia/Ulaanbaatar цагаар (`formatBusinessDateTime`, ЗААВАЛ explicit
 * timeZone-той, `lib/appointments.ts`-ийн `formatWhen`-г ХЭРЭГЛЭХГҮЙ, учир нь
 * тэр хостын локал цагаас хамаардаг). Тусдаа файлд байгаа шалтгаан: энэ модуль
 * `"server-only"` импортгүй (`appointment-create-command.ts` нь
 * `subscription-server`-ээр дамжуулан татдаг тул node:test-д шууд импортлож
 * болдоггүй) — behavioral тест энэ жижиг файлыг ганцааранг нь импортолно.
 */
export function buildAppointmentBookedByStaffBody(branchName: string, requestedAt: Date): string {
  return `${branchName} таны нэр дээр ${formatBusinessDateTime(requestedAt)}-д цаг бүртгэлээ.`;
}
