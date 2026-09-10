import { NextResponse } from "next/server";

import { getHoldings } from "@/lib/asset";

export async function GET() {
  try {
    const holdings = await getHoldings();

    return NextResponse.json({
      holdings,
    });
  } catch (error) {
    console.error(
      "GET /api/record/holdings error:",
      error
    );

    return NextResponse.json(
      {
        error: "读取 Holding 失败",
      },
      {
        status: 500,
      }
    );
  }
}

