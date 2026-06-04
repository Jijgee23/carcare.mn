import { jsonError, jsonOk, requireApiUser } from "@/lib/api";
import { branchScopeId, canDelete } from "@/lib/auth/roles";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const report = await prisma.diagnosticReport.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    include: {
      template: {
        select: {
          id: true,
          name: true,
          type: true,
          schema: true,
        },
      },
      customer: { select: { id: true, fullName: true, phone: true } },
      vehicle: {
        select: { id: true, plate: true, make: true, model: true, year: true },
      },
      branch: { select: { id: true, name: true } },
      filledBy: { select: { id: true, firstName: true, lastName: true } },
      order: { select: { id: true, number: true } },
    },
  });
  if (!report) return jsonError(404, "Тайлан олдсонгүй.");

  return jsonOk({ report });
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const { id } = await ctx.params;
  const scope = branchScopeId(auth.user);

  const report = await prisma.diagnosticReport.findFirst({
    where: {
      id,
      tenantId: auth.user.tenantId,
      ...(scope ? { branchId: scope } : {}),
    },
    select: { id: true, filledById: true },
  });
  if (!report) return jsonError(404, "Тайлан олдсонгүй.");

  const allowed =
    canDelete(auth.user, "diagnostics") || report.filledById === auth.user.id;
  if (!allowed) return jsonError(403, "Танд устгах эрх байхгүй.");

  await prisma.diagnosticReport.delete({ where: { id: report.id } });
  return jsonOk({ ok: true });
}
