import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap gate: anyone without an admin session cookie is sent to the login page.
 * Real verification (signature, active staff, role) happens in requireStaff()/requireOwner().
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/admin/login") || pathname.startsWith("/admin/setup")) return NextResponse.next();
  if (!req.cookies.get("ec_admin")?.value) {
    const url = req.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = { matcher: ["/admin/:path*"] };
