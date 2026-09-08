import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const apiKey = process.env.AI_CFO_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "AI_CFO_API_KEY 未配置",
        },
        {
          status: 500,
        }
      );
    }

    let baseUrl =
      process.env.NEXT_PUBLIC_SITE_URL;

    if (!baseUrl) {
      if (process.env.VERCEL_URL) {
        baseUrl = `https://${process.env.VERCEL_URL}`;
      } else {
        baseUrl = "http://localhost:3000";
      }
    }

    const response = await fetch(
      `${baseUrl}/api/ai-cfo`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error:
            data?.error ||
            `AI CFO API 请求失败 (${response.status})`,
        },
        {
          status: response.status,
        }
      );
    }

    return NextResponse.json(data, {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error: any) {
    console.error(
      "AI CFO page proxy error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error?.message ||
          "AI CFO 数据读取失败",
      },
      {
        status: 500,
      }
    );
  }
}