import { NextResponse } from "next/server";
import { confirmSubscriptionPayment } from "@/lib/subscription-payments";

/**
 * QPay callback. Invoice үүсгэхдээ callback_url-д `?payment_id=<id>` нэмж өгсөн —
 * төлбөр хийгдсэний дараа QPay энэ рүү (GET эсвэл POST) дуудна. Бид callback-ийн
 * агуулгад найдахгүй, харин `confirmSubscriptionPayment` дотор QPay.checkPayment-ээр
 * бие даан баталгаажуулдаг тул хуурамч дуудлага төлбөр идэвхжүүлэхгүй.
 */
async function handle(req: Request): Promise<NextResponse> {
  const url = new URL(req.url);
  const paymentId =
    url.searchParams.get("payment_id") ?? url.searchParams.get("paymentId");
  if (!paymentId) {
    return NextResponse.json({ ok: false, error: "payment_id required" }, {
      status: 400,
    });
  }

  const result = await confirmSubscriptionPayment(paymentId);
  // QPay-д 200 буцаах нь чухал (эс бөгөөс дахин дуудсаар байна). Үр дүнг JSON-оор
  // мэдээлнэ; алдаа гарсан ч 200-аар хүлээн авсныг илтгэнэ.
  return NextResponse.json({ ok: result.ok, paid: result.paid });
}

export async function GET(req: Request) {
  return handle(req);
}

export async function POST(req: Request) {
  return handle(req);
}
