import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, verifySession } from "@/lib/auth/session";
import {
  SYSTEM_COOKIE_NAME,
  verifySystemSession,
} from "@/lib/auth/system-session";

const TENANT_PROTECTED_PREFIXES = ["/dashboard"];
const SYSTEM_PROTECTED_PREFIX = "/system";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- /system хамгаалалт ---
  if (pathname.startsWith(SYSTEM_PROTECTED_PREFIX)) {
    if (pathname === "/system/login") return NextResponse.next();
    const token = req.cookies.get(SYSTEM_COOKIE_NAME)?.value;
    const session = token ? await verifySystemSession(token) : null;
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/system/login";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // --- /dashboard хамгаалалт ---
  if (TENANT_PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = token ? await verifySession(token) : null;
    if (!session) {
      const url = req.nextUrl.clone();
      url.pathname = "/page/login";
      url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/system/:path*"],
};
