import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 登录页面允许直接访问
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // 登录 API 允许直接访问
  if (pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  // 登出 API 允许直接访问
  if (pathname === "/api/auth/logout") {
    return NextResponse.next();
  }

  // AI CFO API 使用独立 API Key 鉴权
if (pathname === "/api/ai-cfo") {
  return NextResponse.next();
}

  // Cron 自动更新接口必须放行
  if (pathname === "/api/cron/update-market") {
    return NextResponse.next();
  }

  // 贷款自动还款 Cron 必须放行
  if (pathname === "/api/cron/loan-auto-payment") {
    return NextResponse.next();
  }

  // Next.js 静态资源放行
  if (
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // 检查登录 Cookie
  const auth = request.cookies.get("ai_wealth_auth");

  if (auth?.value === "1") {
    return NextResponse.next();
  }

  // 未登录 → 登录页面
  const loginUrl = new URL("/login", request.url);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * 匹配所有页面和 API，
     * 再由上面的逻辑决定哪些路径放行。
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};