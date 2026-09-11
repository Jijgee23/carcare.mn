import type { PermissionCode } from "./permissions";

export type OrderAccessUser = {
  id: string;
  isOwner: boolean;
  role?: { permissions: string[] } | null;
};

export type OrderAccessScope = "none" | "own" | "branch";

function has(
  user: Pick<OrderAccessUser, "isOwner" | "role">,
  code: PermissionCode,
): boolean {
  return user.isOwner || Boolean(user.role?.permissions.includes(code));
}

export function orderViewScope(
  user: Pick<OrderAccessUser, "isOwner" | "role">,
): OrderAccessScope {
  if (user.isOwner || has(user, "orders.view")) return "branch";
  if (has(user, "orders.viewOwn")) return "own";
  return "none";
}

/** Edit is clamped to the effective view scope so a stale/misconfigured role
 * can never grant mutation access to an order it cannot read. */
export function orderEditScope(
  user: Pick<OrderAccessUser, "isOwner" | "role">,
): OrderAccessScope {
  const view = orderViewScope(user);
  if (view === "none") return "none";
  if (user.isOwner || has(user, "orders.edit")) return view;
  if (has(user, "orders.editOwn")) return "own";
  return "none";
}

export function canViewOrder(
  user: OrderAccessUser,
  order: { assignedToId: string | null },
): boolean {
  const scope = orderViewScope(user);
  return scope === "branch" || (scope === "own" && order.assignedToId === user.id);
}

export function canEditOrder(
  user: OrderAccessUser,
  order: { assignedToId: string | null },
): boolean {
  const scope = orderEditScope(user);
  return scope === "branch" || (scope === "own" && order.assignedToId === user.id);
}

export function canAssignOrders(user: OrderAccessUser): boolean {
  return has(user, "orders.assign");
}

export function orderReadWhere(user: OrderAccessUser):
  | Record<string, never>
  | { assignedToId: string }
  | { id: { in: string[] } } {
  const scope = orderViewScope(user);
  if (scope === "branch") return {};
  if (scope === "own") return { assignedToId: user.id };
  return { id: { in: [] } };
}

/** Item status is a mutation, so it requires the standalone permission plus
 * the same assignment/broad edit boundary as any other order edit. */
export function canChangeOrderItemStatus(
  user: OrderAccessUser,
  order: { assignedToId: string | null },
): boolean {
  return has(user, "orders.itemStatus") && canEditOrder(user, order);
}
