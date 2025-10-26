import { NextRequest, NextResponse } from "next/server";

import { auth } from "@/auth";

const ADMIN_BASE_PATH = "/admin";
const ADMIN_LOGIN_PATH = `${ADMIN_BASE_PATH}/login`;

export async function middleware(request: NextRequest) {
  const { nextUrl } = request;
  const { pathname } = nextUrl;

  if (!pathname.startsWith(ADMIN_BASE_PATH)) {
    return NextResponse.next();
  }

  if (pathname === ADMIN_LOGIN_PATH) {
    return NextResponse.next();
  }

  const session = await auth(request);

  if (!session?.user) {
    const loginUrl = new URL(ADMIN_LOGIN_PATH, nextUrl.origin);

    if (pathname !== ADMIN_BASE_PATH) {
      loginUrl.searchParams.set("callbackUrl", pathname + nextUrl.search);
    }

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
