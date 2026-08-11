// =====================================================
// app/api/test-finnhub/route.ts
//
// 专门测试 Vercel -> Finnhub
// =====================================================

import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {

  const symbol = "VOO";

  const apiKey =
    process.env.FINNHUB_KEY;

  if (!apiKey) {

    return NextResponse.json({

      success: false,

      step: "config",

      error:
        "FINNHUB_KEY 未配置",

    });

  }

  const url =
    "https://finnhub.io/api/v1/quote" +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&token=${encodeURIComponent(apiKey)}`;

  try {

    const response =
      await fetch(
        url,
        {
          cache: "no-store",
        }
      );

    const text =
      await response.text();

    return NextResponse.json({

      success:
        response.ok,

      status:
        response.status,

      statusText:
        response.statusText,

      symbol,

      response:
        text,

      hasApiKey:
        true,

      apiKeyLength:
        apiKey.length,

    });

  } catch (error: any) {

    return NextResponse.json({

      success: false,

      step: "fetch",

      error:
        error?.message ||
        String(error),

    });

  }

}