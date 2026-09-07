import { NextResponse } from "next/server";

const AUTH_COOKIE = "ai_cfo_auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const password =
      typeof body?.password === "string"
        ? body.password
        : "";

    const correctPassword =
      process.env.AI_CFO_PASSWORD || "";

    if (!correctPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "AI_CFO_PASSWORD 未配置",
        },
        { status: 500 }
      );
    }

    if (!password || password !== correctPassword) {
      return NextResponse.json(
        {
          success: false,
          error: "密码错误",
        },
        { status: 401 }
      );
    }

    const response = NextResponse.json({
      success: true,
    });

    response.cookies.set({
      name: AUTH_COOKIE,
      value: "authenticated",
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        error: "请求格式错误",
      },
      { status: 400 }
    );
  }
}