import { NextResponse } from "next/server";

import { auth } from "@/auth";

const ADMIN_BASE_PATH = "/admin";
const ADMIN_LOGIN_PATH = `${ADMIN_BASE_PATH}/login`;

export default auth((request) => {
  const { nextUrl } = request;
  const session = request.auth;
  const { pathname, search } = nextUrl;

  if (!pathname.startsWith(ADMIN_BASE_PATH)) {
    return NextResponse.next();
  }

  if (pathname === ADMIN_LOGIN_PATH) {
    if (session?.user) {
      return NextResponse.redirect(new URL(ADMIN_BASE_PATH, nextUrl.origin));
    }

    return NextResponse.next();
  }

  if (!session?.user) {
    const loginUrl = new URL(ADMIN_LOGIN_PATH, nextUrl.origin);

    if (pathname !== ADMIN_BASE_PATH) {
      loginUrl.searchParams.set("callbackUrl", pathname + (search || ""));
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
