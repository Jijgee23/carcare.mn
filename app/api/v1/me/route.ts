import { jsonOk, requireApiUser } from "@/lib/api";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const tenant = await prisma.tenant.findUnique({
    where: { id: auth.user.tenantId },
    select: { id: true, name: true, slug: true, logoUrl: true },
  });
  const branch = auth.user.branchId
    ? await prisma.branch.findUnique({
        where: { id: auth.user.branchId },
        select: { id: true, name: true },
      })
    : null;

  return jsonOk({
    id: auth.user.id,
    email: auth.user.email,
    firstName: auth.user.firstName,
    lastName: auth.user.lastName,
    phone: auth.user.phone,
    isOwner: auth.user.isOwner,
    role: auth.user.role
      ? {
          id: auth.user.role.id,
          name: auth.user.role.name,
          permissions: auth.user.role.permissions,
        }
      : null,
    tenant,
    branch,
  });
}
