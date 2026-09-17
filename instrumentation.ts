/**
 * Next.js-ийн server instance бүр асахад НЭГ УДАА дуудагдана (Node.js БОЛОН
 * Edge runtime хоёуланд). Орчны хувьсагчийн баталгаажуулалтыг (`lib/env.ts`)
 * энд импортлож, тохиргоо буруу бол сервер бодит хүсэлт хүлээж авахаас өмнө
 * (эхний ашиглалт дээр биш, boot дээр) throw хийж зогсооно.
 *
 * Мөн Prisma-ийн pg pool-ыг энд `await`-тэйгээр (блоклож) урьдчилан
 * дүүргэнэ (`lib/prisma.ts`-ийн `warmPool()`) — сервер бодит хүсэлт хүлээж
 * авахаас өмнө pool аль хэдийн бүрэн дүүрсэн байхын тулд.
 *
 * Харах: https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation
 */
export async function register() {
  await import("@/lib/env");

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warmPool } = await import("@/lib/prisma");
    await warmPool();
  }
}
