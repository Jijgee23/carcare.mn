import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { prisma } from "@/lib/prisma";
import {
  branchFilterConflicts,
  buildAssignableUserWhere,
  toAssignableUserDto,
} from "@/lib/orders/order-assignable-users";

function requestForBranch(req: Request, branchId: string): Request {
  const headers = new Headers(req.headers);
  headers.set("X-Working-Branch", branchId);
  return new Request(req.url, { method: "GET", headers });
}

export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;

  const denied = requirePermission(auth.user, "orders.assign");
  if (denied) return denied;

  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;

  const url = new URL(req.url);
  const branchIdParam = url.searchParams.get("branchId")?.trim() || undefined;
  if (branchFilterConflicts(scopeResult.branchId, branchIdParam)) {
    return jsonError(422, "Query branchId нь баталгаажсан ажлын салбартай зөрчилдөж байна.", {
      fieldErrors: {
        branchId: "Идэвхтэй ажлын салбараас өөр салбарын ажилтныг авах боломжгүй.",
      },
    });
  }

  // A query branch is an explicit scope request, so run it through the same
  // server-authoritative tenant, active-branch, eligibility and roster-lock
  // checks as X-Working-Branch before it reaches Prisma.
  let branchId = scopeResult.branchId;
  const branchToValidate = branchIdParam ?? scopeResult.branchId;
  if (branchToValidate) {
    const branchResult = await resolveWorkingBranch(
      requestForBranch(req, branchToValidate),
      auth.user,
    );
    if (branchResult.response) return branchResult.response;
    branchId = branchResult.branchId;
  }

  const users = await prisma.user.findMany({
    where: buildAssignableUserWhere({
      tenantId: auth.user.tenantId,
      branchId,
    }),
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
    select: { id: true, firstName: true, lastName: true },
  });

  return jsonOk({ users: users.map(toAssignableUserDto) });
}
