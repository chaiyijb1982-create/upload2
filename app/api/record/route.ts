import { NextResponse } from "next/server";

import {
  createRecord,
  getActiveRecords,
} from "@/lib/records";

// =====================================================
// GET
// 获取所有未完成记录
// 按 updated_at desc 排序
// =====================================================

export async function GET() {
  try {
    const records = await getActiveRecords();

    return NextResponse.json({
      records,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取记录失败";

    console.error("GET /api/records error:", error);

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// POST
// 创建新记录
// =====================================================

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const title =
      typeof body?.title === "string"
        ? body.title.trim()
        : "";

    if (!title) {
      return NextResponse.json(
        {
          error: "记录标题不能为空",
        },
        {
          status: 400,
        }
      );
    }

    let content = undefined;

    if (
      body?.content &&
      typeof body.content === "object" &&
      !Array.isArray(body.content)
    ) {
      content = body.content;
    }

    const record = await createRecord(title, content);

    return NextResponse.json(
      {
        record,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "创建记录失败";

    console.error("POST /api/records error:", error);

    return NextResponse.json(
      {
        error: message,
      },
      {
        status: 500,
      }
    );
  }
}