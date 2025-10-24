import { NextResponse } from "next/server";

import { auth } from "@/auth";

const ADMIN_LOGIN_PATH = "/admin/login";

export default auth((req) => {
  const { nextUrl } = req;
  const isAdminRoute = nextUrl.pathname.startsWith("/admin");
  const isLoginRoute = nextUrl.pathname === ADMIN_LOGIN_PATH;

  if (!isAdminRoute) {
    return NextResponse.next();
  }

  if (req.auth?.user && isLoginRoute) {
    return NextResponse.redirect(new URL("/admin", nextUrl.origin));
  }

  if (!req.auth?.user && !isLoginRoute) {
    const loginUrl = new URL(ADMIN_LOGIN_PATH, nextUrl.origin);
    if (nextUrl.pathname !== "/admin") {
      loginUrl.searchParams.set("callbackUrl", nextUrl.pathname + nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
