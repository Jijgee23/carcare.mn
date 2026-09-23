// P3-B5 — GET /api/v1/customers/[id]/history
// Thin adapter over `lib/customers/customer-history.ts` (DM-05 — the same
// query the extraction is built around; there is no web page equivalent to
// keep in sync since customer order history did not exist on the web
// before this slice). Mirrors the auth/permission/404 conventions of the
// sibling `app/api/v1/customers/[id]/route.ts` exactly.

import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";
import { getCustomerOrderHistory } from "@/lib/customers/customer-history";

// Another tenant's customer id must be indistinguishable from an id that
// does not exist at all — same rule as the sibling detail route. Confirmed
// by the tenant-scoped `findFirst` lookup below, not by a status check
// after the fact.
function customerNotFound() {
  return jsonError(404, "Үйлчлүүлэгч олдсонгүй.");
}

// GET /api/v1/customers/[id]/history
// Permission: customers.view
// Paginated (`page`, `pageSize`/`limit`) — a long-standing customer's order
// list is unbounded.
export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "customers.view");
  if (denied) return denied;

  const { id } = await ctx.params;

  const customer = await prisma.customer.findFirst({
    where: { id, tenantId: auth.user.tenantId },
    select: { id: true },
  });
  if (!customer) return customerNotFound();

  const url = new URL(req.url);
  const page = getApiPageInfo(url.searchParams);

  const { orders, meta } = await getCustomerOrderHistory(auth.user.tenantId, id, page);

  return jsonOk({ orders, meta });
}
