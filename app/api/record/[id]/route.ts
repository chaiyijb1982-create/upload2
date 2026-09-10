import { NextResponse } from "next/server";

import {
  getRecord,
  updateRecord,
  completeRecord,
  reopenRecord,
  deleteRecord,
} from "@/lib/records";

// =====================================================
// GET
// 获取单条记录
// =====================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "记录 ID 不能为空",
        },
        {
          status: 400,
        }
      );
    }

    const record = await getRecord(id);

    if (!record) {
      return NextResponse.json(
        {
          error: "记录不存在",
        },
        {
          status: 404,
        }
      );
    }

    return NextResponse.json({
      record,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取记录失败";

    console.error("GET /api/records/[id] error:", error);

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
// PUT
// 修改记录
//
// 支持：
// {
//   title: "...",
//   content: {...}
// }
//
// 或者：
// {
//   action: "complete"
// }
//
// 或者：
// {
//   action: "reopen"
// }
// =====================================================

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "记录 ID 不能为空",
        },
        {
          status: 400,
        }
      );
    }

    const body = await request.json();

    // -------------------------------------------------
    // 完成事件
    // -------------------------------------------------

    if (body?.action === "complete") {
      const record = await completeRecord(id);

      return NextResponse.json({
        record,
      });
    }

    // -------------------------------------------------
    // 恢复事件
    // -------------------------------------------------

    if (body?.action === "reopen") {
      const record = await reopenRecord(id);

      return NextResponse.json({
        record,
      });
    }

    // -------------------------------------------------
    // 普通修改
    // -------------------------------------------------

    const updates: {
      title?: string;
      content?: Record<string, unknown>;
    } = {};

    if (typeof body?.title === "string") {
      const title = body.title.trim();

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

      updates.title = title;
    }

    if (
      body?.content &&
      typeof body.content === "object" &&
      !Array.isArray(body.content)
    ) {
      updates.content = body.content;
    }

    if (
      updates.title === undefined &&
      updates.content === undefined
    ) {
      return NextResponse.json(
        {
          error: "没有需要修改的内容",
        },
        {
          status: 400,
        }
      );
    }

    const record = await updateRecord(id, updates);

    return NextResponse.json({
      record,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "修改记录失败";

    console.error("PUT /api/records/[id] error:", error);

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
// DELETE
// 删除记录
//
// 注意：
// 正常业务流程使用“完成事件”
// DELETE 只是彻底删除记录
// =====================================================

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        {
          error: "记录 ID 不能为空",
        },
        {
          status: 400,
        }
      );
    }

    await deleteRecord(id);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "删除记录失败";

    console.error("DELETE /api/records/[id] error:", error);

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