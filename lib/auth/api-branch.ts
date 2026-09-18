import { NextResponse } from "next/server";
import { jsonForbidden } from "@/lib/api";
import type { ApiUser } from "@/lib/auth/api-token";
import { resolveTodayLockedBranch } from "@/lib/employee-branch-lock";
import { prisma } from "@/lib/prisma";
import { branchScopeId, canChooseAllBranches, eligibleBranchIds } from "./roles";
import { ALL_BRANCHES } from "./session";

// Мобайл/API-ийн "ажиллах салбар" — dashboard-ийн session-based
// `workingBranchScopeId` (lib/auth/roles.ts)-тэй адил зорилготой ч энд
// session cookie байхгүй тул хүсэлт бүрт `X-Working-Branch` header-аар
// дамжуулна. Header буруу/зөвшөөрөгдөөгүй бол ЯМАР Ч тохиолдолд өгөгдмөл
// (branchScopeId) руу чимээгүй буцахгүй — 403-оор татгалзана. Учир нь
// чимээгүй fallback хийвэл клиентийн алдаа (жишээ нь буруу branchId илгээх)
// өгөгдлийн хамрах хүрээг чимээгүйгээр өргөсгөх эрсдэлтэй.

export type WorkingBranchDenyReason =
  | "all_branches_not_allowed"
  | "branch_not_found"
  | "cross_tenant"
  | "inactive_branch"
  | "not_eligible"
  // Header-ийн заасан scope (ALL эсвэл өөр branch) өнөөдрийн ажлын
  // хувиараар түгжигдсэн салбартай зөрчилдөж байна.
  | "locked_branch_conflict";

export type WorkingBranchDecision =
  | { ok: true; branchId: string | null }
  | { ok: false; reason: WorkingBranchDenyReason };

export const WORKING_BRANCH_INVALID_HEADER = "X-Working-Branch-Invalid";
export const WORKING_BRANCH_INVALID_VALUE = "1";

export type DecideWorkingBranchUser = {
  isOwner: boolean;
  branchId: string | null;
};

export type DecideWorkingBranchInput = {
  /** Raw `X-Working-Branch` header утга (trim хийгээгүй ч болно), эсвэл байхгүй бол null/undefined. */
  header: string | null | undefined;
  user: DecideWorkingBranchUser;
  tenantId: string;
  /**
   * Header-д заасан branch id-тай тохирох Branch мөр (аль хэдийн Prisma-аар
   * уншсан). Олдоогүй бол null. Header нь "ALL" эсвэл хоосон үед
   * ашиглагдахгүй тул ямар ч утга дамжуулж болно.
   */
  candidateBranch: { tenantId: string; isActive: boolean } | null;
  /** `eligibleBranchIds(user)`-ийн үр дүн (аль хэдийн тооцоолсон). */
  eligibleBranchIds: string[];
  /** Өнөөдрийн ажлын хувиараар "түгжигдсэн" салбарын id, эсвэл байхгүй бол null. */
  lockedBranchId: string | null;
};

/**
 * PURE функц — Prisma, Request хамааралгүй. `resolveWorkingBranch`-ийн цөм.
 * Аль хэдийн татаж авсан өгөгдөл дээр л шийдвэр гаргана — unit test-д DB
 * шаардлагагүй (харах: tests/api-branch.test.ts).
 */
export function decideWorkingBranch(
  input: DecideWorkingBranchInput,
): WorkingBranchDecision {
  const { header, user, tenantId, candidateBranch, eligibleBranchIds: eligible, lockedBranchId } = input;

  const trimmed = header?.trim() ?? "";

  // Өнөөдрийн ажлын хувиараар түгжигдсэн салбар байвал ЭНЭ Л цорын ганц
  // зөвшөөрөгдөх scope — header юу заасан, хэрэглэгч owner эсэх хамаагүй
  // (харах: app/dashboard/layout.tsx-ийн `locked={Boolean(lockedBranch)}` —
  // web дээр switcher бүхэлдээ идэвхгүй болдогтой адил). Owner бодит байдал
  // дээр roster-д түгждэггүй ч pure функц энд ялгаа гаргахгүй — зан төлөв
  // тодорхой, туршилтаар баталгаажсан байх ёстой (харах:
  // tests/api-branch.test.ts-ийн "owner ... locked ..." кэйс).
  if (lockedBranchId) {
    if (trimmed === "") {
      return { ok: true, branchId: lockedBranchId };
    }
    if (trimmed === ALL_BRANCHES) {
      return { ok: false, reason: "locked_branch_conflict" };
    }
    if (trimmed !== lockedBranchId) {
      return { ok: false, reason: "locked_branch_conflict" };
    }
    // trimmed === lockedBranchId — доош candidateBranch/eligibility
    // шалгалтууд руу унана (олдоогүй/идэвхгүй/өөр тенант бол тэдгээр
    // шалтгаанаар татгалзана, зөв branch id мэт боловч ижил утгатай бол зөв).
  }

  // Header байхгүй/хоосон, түгжээгүй үед — өнөөгийн (dashboard бус)
  // API-ийн хэвийн зан төлөв, back-compatible.
  if (trimmed === "") {
    return { ok: true, branchId: branchScopeId(user) };
  }

  if (trimmed === ALL_BRANCHES) {
    if (!canChooseAllBranches(user)) {
      return { ok: false, reason: "all_branches_not_allowed" };
    }
    return { ok: true, branchId: null };
  }

  // Үлдсэн бүх тохиолдолд header-ийг branch id гэж үзнэ — олдохгүй бол
  // "anything else" мөрийн адил татгалзана.
  if (!candidateBranch) {
    return { ok: false, reason: "branch_not_found" };
  }
  if (candidateBranch.tenantId !== tenantId) {
    return { ok: false, reason: "cross_tenant" };
  }
  if (!candidateBranch.isActive) {
    return { ok: false, reason: "inactive_branch" };
  }
  if (!user.isOwner && !eligible.includes(trimmed)) {
    return { ok: false, reason: "not_eligible" };
  }
  // lockedBranchId-той зөрчилдвөл дээрх блок аль хэдийн буцсан байх ёстой
  // (trimmed !== lockedBranchId бол дээр аль хэдийн 403); энд дахин
  // шалгах нь зөвхөн батламж — давхар хамгаалалт хор хөнөөлгүй.
  if (lockedBranchId && lockedBranchId !== trimmed) {
    return { ok: false, reason: "locked_branch_conflict" };
  }

  return { ok: true, branchId: trimmed };
}

const DENY_MESSAGES: Record<WorkingBranchDenyReason, string> = {
  all_branches_not_allowed: "Танд бүх салбарыг сонгох эрх байхгүй.",
  branch_not_found: "Заасан салбар олдсонгүй.",
  cross_tenant: "Заасан салбар олдсонгүй.",
  inactive_branch: "Заасан салбар идэвхгүй байна.",
  not_eligible: "Танд энэ салбарт ажиллах эрх байхгүй.",
  locked_branch_conflict:
    "Өнөөдрийн ажлын хувиараар өөр салбарт томилогдсон тул сонгож болохгүй.",
};

/**
 * Preserve the normal 403 response body while giving API clients a stable way
 * to distinguish an invalid working-branch scope from other forbidden errors.
 */
export function workingBranchForbidden(reason: WorkingBranchDenyReason): NextResponse {
  const response = jsonForbidden(DENY_MESSAGES[reason]);
  response.headers.set(WORKING_BRANCH_INVALID_HEADER, WORKING_BRANCH_INVALID_VALUE);
  return response;
}

/**
 * `resolveWorkingBranch`-ийн буцаах утга — `requireApiUser`-ийн early-return
 * хэлбэртэй адил: `if (x.response) return x.response;`.
 */
export type ResolveWorkingBranchResult =
  | { branchId: string | null; response?: undefined }
  | { branchId?: undefined; response: NextResponse };

/**
 * `req`-ийн `X-Working-Branch` header-ийг уншиж, шаардлагатай Prisma
 * уншилтуудыг хийгээд `decideWorkingBranch`-д даатгана. Хэзээ ч throw
 * хийхгүй — буруу/зөвшөөрөгдөөгүй header 403 `NextResponse`-ээр буцна.
 */
export async function resolveWorkingBranch(
  req: Request,
  user: ApiUser,
): Promise<ResolveWorkingBranchResult> {
  const header = req.headers.get("X-Working-Branch");
  const trimmed = header?.trim() ?? "";

  // ХҮСЭЛТ БҮРД (header байхгүй/хоосон болон "ALL"-г оруулаад) өнөөдрийн
  // ажлын хувиараар түгжигдсэн салбарыг уншина. Өмнө нь зөвхөн тодорхой
  // branch id заасан үед л уншдаг байсан тул floating (тогтмол branchId-гүй)
  // ажилтан header-ээ орхиж эсвэл "ALL" илгээж роструудын түгжээнээс
  // мултарч чадаж байсан (P0-B1a-д засварласан алдаа — decideWorkingBranch
  // үзнэ үү). Энэ нь хүсэлт бүрт нэмэлт нэг DB унших (`resolveTodayLockedBranch`)
  // авчирна; зөв байдлын төлөө хүлээн зөвшөөрсөн ч ирээдүйн оновчлолын
  // зорилтот цэг (жишээ нь: request-scoped кэш, эсвэл `getApiUserFromRequest`-
  // тэй нэг дор нэг query-д нэгтгэх) хэвээр байна.
  //
  // `resolveTodayLockedBranch` энд аюулгүй дуудагдана: энэ функцийг
  // дуудахаас өмнө `requireApiUser` → `getApiUserFromRequest`
  // (lib/auth/api-token.ts) аль хэдийн `setTenantContext`-ийг тохируулсан
  // байдаг — тэр функцийн doc comment-д шаардсан tenant context яг энэ.
  const candidateBranchPromise =
    trimmed !== "" && trimmed !== ALL_BRANCHES
      ? prisma.branch.findUnique({
          where: { id: trimmed },
          select: { tenantId: true, isActive: true },
        })
      : Promise.resolve(null);

  const [candidateBranch, locked] = await Promise.all([
    candidateBranchPromise,
    resolveTodayLockedBranch(user),
  ]);

  const decision = decideWorkingBranch({
    header: trimmed,
    user,
    tenantId: user.tenantId,
    candidateBranch,
    // `ApiUser`-ийн select-д `assignableBranchIds`-г нэмсэн тул (харах:
    // lib/auth/api-token.ts) энд DB-ээс тусад нь татах шаардлагагүй болсон.
    eligibleBranchIds: user.isOwner
      ? []
      : eligibleBranchIds({ branchId: user.branchId, assignableBranchIds: user.assignableBranchIds }),
    lockedBranchId: locked?.branchId ?? null,
  });

  if (!decision.ok) {
    return { response: workingBranchForbidden(decision.reason) };
  }
  return { branchId: decision.branchId };
}
