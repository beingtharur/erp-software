import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { decrypt, COOKIE_NAME } from "@/lib/session";
import { roleHome } from "@/lib/nav";

const publicRoutes = ["/login"];

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isPublicRoute = publicRoutes.includes(path);

  const cookie = req.cookies.get(COOKIE_NAME)?.value;
  const session = await decrypt(cookie);

  if (!isPublicRoute && !session?.userId) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  if (path === "/login" && req.nextUrl.searchParams.has("session")) {
    const res = NextResponse.redirect(new URL("/login", req.nextUrl));
    res.cookies.delete(COOKIE_NAME);
    return res;
  }

  if (isPublicRoute && session?.userId) {
    return NextResponse.redirect(new URL(roleHome[session.accessRole] ?? "/", req.nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)"],
};
