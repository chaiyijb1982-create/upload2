import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest
) {
  try {
    const body = await request.json();

    const username =
      String(body?.username || "").trim();

    const password =
      String(body?.password || "");

    const correctUsername =
      process.env.AUTH_USERNAME;

    const correctPassword =
      process.env.AUTH_PASSWORD;

    if (
      !correctUsername ||
      !correctPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "服务器登录配置缺失",
        },
        {
          status: 500,
        }
      );
    }

    if (
      username !== correctUsername ||
      password !== correctPassword
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "账号或密码错误",
        },
        {
          status: 401,
        }
      );
    }

    const response =
      NextResponse.json({
        success: true,
      });

    response.cookies.set(
      "ai_wealth_auth",
      "1",
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      }
    );

    return response;
  } catch {
    return NextResponse.json(
      {
        success: false,
        message: "登录请求无效",
      },
      {
        status: 400,
      }
    );
  }
}