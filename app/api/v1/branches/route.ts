import { jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const branches = await prisma.branch.findMany({
    where: { tenantId: auth.user.tenantId },
    orderBy: { name: "asc" },
    select: { id: true, name: true, address: true, phone: true },
  });

  return jsonOk({ branches });
}
