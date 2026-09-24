import { createJwtSession } from "@/lib/auth/jwt-session";

export const SESSION_COOKIE_NAME = "carcare_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 хоног

// Хэрэглэгч тухайн нэвтрэлтдээ "Бүх салбар" сонгосон гэдгийг илэрхийлэх sentinel
// (жинхэнэ Branch.id биш). Зөвхөн isOwner эсвэл branchId=null хэрэглэгчид л
// сонгох боломжтой (харах: lib/auth/roles.ts canChooseAllBranches).
export const ALL_BRANCHES = "ALL" as const;

export type SessionPayload = {
  userId: string;
  tenantId: string;
  isOwner: boolean;
  sid?: string; // UserSession id — төхөөрөмж/revoke хөтлөлтөд (хуучин token-д байхгүй)
  // Тухайн нэвтрэлтэд сонгосон ажиллах салбар — жинхэнэ Branch.id, ALL_BRANCHES,
  // эсвэл undefined ("хараахан сонгоогүй", хуучин token-д ч байхгүй). Зөвхөн
  // логин бүрт шинээр тогтоогдоно — өөр салбар сонгохын тулд дахин нэвтрэх ёстой.
  workingBranchId?: string;
};

const client = createJwtSession<SessionPayload>({
  secretEnvVars: ["SESSION_SECRET"],
  maxAgeSeconds: SESSION_MAX_AGE_SECONDS,
  parse(payload) {
    // sid-гүй token-ийг DB-ээр revoke шалгах боломжгүй тул хүлээж авахгүй.
    if (!payload.userId || !payload.tenantId || typeof payload.sid !== "string") return null;
    return {
      userId: payload.userId as string,
      tenantId: payload.tenantId as string,
      isOwner: Boolean(payload.isOwner),
      sid: typeof payload.sid === "string" ? payload.sid : undefined,
      workingBranchId:
        typeof payload.workingBranchId === "string"
          ? payload.workingBranchId
          : undefined,
    };
  },
});

export const signSession = client.sign;
export const verifySession = client.verify;
