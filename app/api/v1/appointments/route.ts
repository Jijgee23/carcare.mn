import { Prisma } from "@/app/generated/prisma/client";
import { jsonError, jsonOk, requireApiUser, requirePermission } from "@/lib/api";
import { resolveWorkingBranch } from "@/lib/auth/api-branch";
import { APPOINTMENT_STATUSES, type AppointmentStatus } from "@/lib/appointments";
import { buildMeta, getApiPageInfo } from "@/lib/pagination";
import { prisma } from "@/lib/prisma";

const APPT_SELECT = {
  id: true,
  status: true,
  requestedAt: true,
  note: true,
  createdAt: true,
  branch: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  account: { select: { name: true, phone: true } },
  customer: { select: { id: true, fullName: true, phone: true } },
  accountVehicle: {
    select: { vehicle: { select: { plate: true, make: true, model: true } } },
  },
  vehicle: { select: { id: true, plate: true, make: true, model: true } },
  serviceOrder: { select: { id: true, number: true } },
} satisfies Prisma.AppointmentSelect;

// AccountVehicle нь global Vehicle руу заадаг болсон тул хариунд хуучин хэлбэрээр
// (accountVehicle: { plate, make, model } | null) тэгшлэн буцаана.
export function shapeAppointment<
  T extends {
    accountVehicle: {
      vehicle: { plate: string; make: string; model: string };
    } | null;
  },
>(a: T): Omit<T, "accountVehicle"> & {
  accountVehicle: { plate: string; make: string; model: string } | null;
} {
  return { ...a, accountVehicle: a.accountVehicle?.vehicle ?? null };
}

/**
 * PURE — `X-Working-Branch` (resolved, validated `scope`) болон `?branchId=`
 * query param хоёул заасан атал өөр өөр салбар заавал "зөрчилдсөн" гэж үзнэ.
 * `scope` null (owner эсвэл "ALL") үед хэзээ ч зөрчилдөхгүй — тэр үед л
 * query param ганцаараа хүчинтэй шүүлт болно. Unit test-д зориулж тусад нь
 * гаргасан (харах: tests/api-branch-routes.test.ts) — DB хамааралгүй.
 */
export function branchFilterConflicts(
  scope: string | null,
  branchIdParam: string | undefined,
): boolean {
  return Boolean(scope && branchIdParam && branchIdParam !== scope);
}

// GET /api/v1/appointments
// Query: status?, date? (YYYY-MM-DD), month? (YYYY-MM), branchId?, page?, pageSize?
// month= → returns { dates: string[] } (per-appointment YYYY-MM-DD for dot counts)
// Permission: appointments.view
export async function GET(req: Request) {
  const auth = await requireApiUser(req);
  if (auth.response) return auth.response;
  const denied = requirePermission(auth.user, "appointments.view");
  if (denied) return denied;

  const url = new URL(req.url);
  const scopeResult = await resolveWorkingBranch(req, auth.user);
  if (scopeResult.response) return scopeResult.response;
  const scope = scopeResult.branchId;
  const branchIdParam = url.searchParams.get("branchId")?.trim() || undefined;

  // `X-Working-Branch` (→ `scope`) болон `?branchId=` query param хоёулаа
  // салбар шүүлт зааж болно, зөрчилдвөл HEADER ялна — учир нь энэ л
  // баталгаажсан (tenant/isActive/eligibility/roster-lock шалгасан) утга;
  // query param ямар ч серверийн шалгалтгүйгээр клиентээс ирдэг түүхий
  // утга. `scope` null (жишээ нь owner, эсвэл "ALL" илгээсэн) үед л
  // query param-ыг ашиглана — энэ өөрчлөгдөөгүй.
  //
  // Хоёул заасан БОЛОН ЗӨРЧИЛДВӨЛ (өөр өөр салбар) query param-ыг
  // чимээгүй үл тоомсорлохгүй, 422-оор татгалзана. Учир шалтгаан: клиент
  // тодорхой зорилготойгоор branchId дамжуулсан бол (жишээ нь өөр таб дээр
  // сонгосон салбарын өгөгдлийг хүсэх гэж), серверийн бодитоор буцаах өгөгдөл
  // түүнээс өөр (header-ийн) салбарынх байх нь чимээгүй буруу үр дүн олгож,
  // клиент кодыг тодорхой алдаа мэдэгдэлгүйгээр буруу зан төлөвт хүргэнэ.
  // Тодорхой татгалзал нь клиентэд асуудлыг шууд илрүүлэх боломж олгоно.
  if (branchFilterConflicts(scope, branchIdParam)) {
    return jsonError(422, "Query параметрийн branchId нь баталгаажсан ажлын салбартай зөрчилдөж байна.", {
      fieldErrors: { branchId: "Идэвхтэй ажлын салбараас өөр салбарын мэдээлэл хүсэх боломжгүй." },
    });
  }

  // ── Month counts mode ─────────────────────────────────────────────────────
  const monthParam = url.searchParams.get("month")?.trim();
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    const monthStart = new Date(y, m - 1, 1);
    const monthEnd = new Date(y, m, 1);

    const rows = await prisma.appointment.findMany({
      where: {
        tenantId: auth.user.tenantId,
        requestedAt: { gte: monthStart, lt: monthEnd },
        ...(scope ? { branchId: scope } : branchIdParam ? { branchId: branchIdParam } : {}),
      },
      select: { requestedAt: true },
    });

    const pad = (n: number) => String(n).padStart(2, "0");
    const dates = rows.map(
      (r) => `${r.requestedAt.getFullYear()}-${pad(r.requestedAt.getMonth() + 1)}-${pad(r.requestedAt.getDate())}`,
    );
    return jsonOk({ dates });
  }

  // ── Day list mode ─────────────────────────────────────────────────────────
  const statusParam = url.searchParams.get("status")?.trim();
  const status =
    statusParam &&
    (APPOINTMENT_STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as AppointmentStatus)
      : null;
  const dateParam = url.searchParams.get("date")?.trim();
  const { page, pageSize, skip, take } = getApiPageInfo(url.searchParams, {
    maxSize: 100,
  });

  const where: Prisma.AppointmentWhereInput = {
    tenantId: auth.user.tenantId,
    ...(status ? { status } : {}),
    ...(scope
      ? { branchId: scope }
      : branchIdParam
        ? { branchId: branchIdParam }
        : {}),
  };

  if (dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    const dayStart = new Date(`${dateParam}T00:00:00`);
    if (Number.isFinite(dayStart.getTime())) {
      where.requestedAt = {
        gte: dayStart,
        lt: new Date(dayStart.getTime() + 86_400_000),
      };
    }
  }

  const [total, items] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: { requestedAt: "asc" },
      skip,
      take,
      select: APPT_SELECT,
    }),
  ]);

  return jsonOk({
    appointments: items.map(shapeAppointment),
    pagination: buildMeta(total, page, pageSize),
  });
}
