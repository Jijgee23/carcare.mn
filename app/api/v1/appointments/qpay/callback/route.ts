import { NextResponse } from "next/server";
import { confirmAppointmentPayment } from "@/lib/appointment-payments";
import { setBypassContext } from "@/lib/tenant-context";

/**
 * QPay callback. Invoice үүсгэхдээ callback_url-д `?appointment_id=<id>` нэмж
 * өгсөн — төлбөр хийгдсэний дараа QPay энэ рүү (GET эсвэл POST) дуудна. Бид
 * callback-ийн агуулгад найдахгүй, харин `confirmAppointmentPayment` дотор
 * QPay.checkPayment-ээр бие даан баталгаажуулдаг тул хуурамч дуудлага
 * төлбөр идэвхжүүлэх боломжгүй. Зөвхөн энд (эсвэл account-ийн polling-ээс)
 * л AppointmentPayment (Invoice) анх удаа үүснэ.
 */
async function handle(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const appointmentId =
    url.searchParams.get("appointment_id") ?? url.searchParams.get("appointmentId");
  if (!appointmentId) {
    return NextResponse.json({ ok: false, error: "appointment_id required" }, {
      status: 400,
    });
  }
  // tenantId нь appointmentId-аар өөрөө DB-ээс уншигдах хүртэл тодорхойгүй.
  setBypassContext();

  const result = await confirmAppointmentPayment(appointmentId);
  // QPay-д 200 буцаах нь чухал (эс бөгөөс дахин дуудсаар байна). Үр дүнг
  // JSON-оор мэдээлнэ; алдаа гарсан ч 200-аар хүлээн авсныг илтгэнэ.
  return NextResponse.json({ ok: result.ok, paid: result.paid });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
