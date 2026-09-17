import { createJwtSession } from "@/lib/auth/jwt-session";

export const SYSTEM_COOKIE_NAME = "carcare_system_session";
export const SYSTEM_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 цаг — system admin богино

export type SystemSessionPayload = {
  adminId: string;
  email: string;
};

const client = createJwtSession<SystemSessionPayload>({
  tag: "system",
  secretEnvVars: ["SESSION_SECRET"],
  maxAgeSeconds: SYSTEM_SESSION_MAX_AGE_SECONDS,
  parse(payload) {
    if (!payload.adminId || !payload.email) return null;
    return {
      adminId: payload.adminId as string,
      email: payload.email as string,
    };
  },
});

export const signSystemSession = client.sign;
export const verifySystemSession = client.verify;
