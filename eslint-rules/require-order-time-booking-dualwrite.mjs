/**
 * D-068 (COWORK.md): ServiceOrder.scheduledAt/startedAt/expectedFinishAt/
 * occupiesCapacity are now a denormalized cache — the real scheduling truth
 * lives in OrderTimeBooking. Twice in this codebase's history, a direct
 * serviceOrder.update()/updateMany() touching one of these fields shipped
 * without the matching OrderTimeBooking dual-write, silently desyncing the
 * booking table from real orders (see COWORK.md, 2026-09-10). This rule
 * flags any such write in app/_actions/orders.ts and app/api/v1/orders/**
 * unless a known dual-write helper call is visible in the same function —
 * a spread `data` object (whose keys aren't statically known) is flagged
 * conservatively too, since that's exactly the shape of one of the two past
 * bugs (updateOrderAction spreads parseOrderInput's result, which includes
 * scheduledAt).
 */
const DUAL_WRITE_HELPERS = [
  "closeOpenOrderTimeBooking",
  "openOrderTimeBooking",
  "updateOpenOrderTimeBookingForecast",
  "updateOpenOrderTimeBookingSchedule",
];
const SCHEDULING_FIELDS = ["scheduledAt", "startedAt", "expectedFinishAt", "occupiesCapacity"];

function isServiceOrderWriteCall(node) {
  if (node.type !== "CallExpression") return null;
  const callee = node.callee;
  if (callee.type !== "MemberExpression" || callee.computed) return null;
  const method = callee.property.type === "Identifier" ? callee.property.name : null;
  if (method !== "update" && method !== "updateMany") return null;
  const obj = callee.object;
  if (obj.type !== "MemberExpression" || obj.computed) return null;
  const prop = obj.property.type === "Identifier" ? obj.property.name : null;
  return prop === "serviceOrder" ? method : null;
}

function inspectDataArg(node) {
  const arg = node.arguments[0];
  if (!arg || arg.type !== "ObjectExpression") return { fields: [], hasSpread: false };
  const dataProp = arg.properties.find(
    (p) => p.type === "Property" && !p.computed && p.key.type === "Identifier" && p.key.name === "data",
  );
  if (!dataProp || dataProp.value.type !== "ObjectExpression") return { fields: [], hasSpread: false };
  const fields = [];
  let hasSpread = false;
  for (const p of dataProp.value.properties) {
    if (p.type === "SpreadElement") {
      hasSpread = true;
    } else if (p.type === "Property" && !p.computed && p.key.type === "Identifier") {
      fields.push(p.key.name);
    }
  }
  return { fields, hasSpread };
}

function enclosingFunction(node) {
  let cur = node.parent;
  while (cur) {
    if (
      cur.type === "FunctionDeclaration" ||
      cur.type === "FunctionExpression" ||
      cur.type === "ArrowFunctionExpression"
    ) {
      return cur;
    }
    cur = cur.parent;
  }
  return null;
}

const rule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "A ServiceOrder write touching D-068 scheduling fields must dual-write to OrderTimeBooking in the same function.",
    },
    schema: [],
    messages: {
      missingDualWriteFields:
        "serviceOrder.{{method}}() sets {{fields}} — a D-068 scheduling field cached from OrderTimeBooking — but no dual-write helper call ({{helpers}}) is visible in the enclosing function. Either call one, or add an eslint-disable-next-line with a reason if this write is intentionally cache-only (e.g. it never touches a live/uncompleted order).",
      missingDualWriteSpread:
        "serviceOrder.{{method}}()'s data object is spread from a variable whose fields aren't statically known here, so it might include a D-068 scheduling field — no dual-write helper call ({{helpers}}) is visible in the enclosing function. Verify it doesn't touch scheduledAt/startedAt/expectedFinishAt/occupiesCapacity, or add a dual-write call, or add an eslint-disable-next-line with a reason.",
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    return {
      CallExpression(node) {
        const method = isServiceOrderWriteCall(node);
        if (!method) return;
        const { fields, hasSpread } = inspectDataArg(node);
        const hitFields = fields.filter((f) => SCHEDULING_FIELDS.includes(f));
        if (hitFields.length === 0 && !hasSpread) return;
        const fn = enclosingFunction(node);
        const scopeText = fn ? sourceCode.getText(fn) : sourceCode.getText();
        const hasDualWrite = DUAL_WRITE_HELPERS.some((h) => scopeText.includes(h));
        if (hasDualWrite) return;
        context.report({
          node,
          messageId: hitFields.length > 0 ? "missingDualWriteFields" : "missingDualWriteSpread",
          data: { method, fields: hitFields.join(", "), helpers: DUAL_WRITE_HELPERS.join(", ") },
        });
      },
    };
  },
};

export default rule;
