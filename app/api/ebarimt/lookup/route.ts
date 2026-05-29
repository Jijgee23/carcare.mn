import { NextResponse } from "next/server";
import { lookupOrgByRegno } from "@/lib/ebarimt";

/**
 * Нийтийн endpoint — бүртгүүлэх хуудсанд регистрийн нэрийг автоматаар татахад
 * ашиглана. Auth шаардахгүй (зөвхөн нийтийн мэдээлэл).
 *
 * GET /api/ebarimt/lookup?regno=1234567
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const regno = url.searchParams.get("regno")?.trim() ?? "";
  if (!/^\d{7}$/.test(regno)) {
    return NextResponse.json(
      { error: "Регистр 7 оронтой тоо байх ёстой." },
      { status: 400 },
    );
  }

  try {
    const org = await lookupOrgByRegno(regno);
    return NextResponse.json({ org });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ebarimt алдаа гарлаа.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
