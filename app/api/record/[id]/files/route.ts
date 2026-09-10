import { NextResponse } from "next/server";

import {
  getRecordFiles,
  uploadRecordFile,
  deleteRecordFile,
} from "@/lib/records";

// =====================================================
// UUID 校验
// =====================================================

function isValidUuid(value: unknown): value is string {
  if (typeof value !== "string") {
    return false;
  }

  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}

// =====================================================
// GET
// 获取当前记录的附件
// =====================================================

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordId } = await params;

    if (!isValidUuid(recordId)) {
      console.error(
        "GET /api/record/[id]/files invalid recordId:",
        recordId
      );

      return NextResponse.json(
        {
          error: "记录 ID 无效",
          recordId: recordId ?? null,
        },
        {
          status: 400,
        }
      );
    }

    const files = await getRecordFiles(recordId);

    return NextResponse.json({
      files,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "获取附件失败";

    console.error(
      "GET /api/record/[id]/files error:",
      error
    );

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
// 上传附件
//
// 前端使用 FormData：
// file = File
// =====================================================

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordId } = await params;

    if (!isValidUuid(recordId)) {
      console.error(
        "POST /api/record/[id]/files invalid recordId:",
        recordId
      );

      return NextResponse.json(
        {
          error: "记录 ID 无效",
          recordId: recordId ?? null,
        },
        {
          status: 400,
        }
      );
    }

    const formData = await request.formData();

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "没有找到上传文件",
        },
        {
          status: 400,
        }
      );
    }

    if (file.size <= 0) {
      return NextResponse.json(
        {
          error: "上传文件不能为空",
        },
        {
          status: 400,
        }
      );
    }

    const recordFile = await uploadRecordFile(
      recordId,
      file
    );

    return NextResponse.json(
      {
        file: recordFile,
      },
      {
        status: 201,
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "上传附件失败";

    console.error(
      "POST /api/record/[id]/files error:",
      error
    );

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
// 删除附件
//
// {
//   "fileId": "..."
// }
// =====================================================

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: recordId } = await params;

    if (!isValidUuid(recordId)) {
      console.error(
        "DELETE /api/record/[id]/files invalid recordId:",
        recordId
      );

      return NextResponse.json(
        {
          error: "记录 ID 无效",
          recordId: recordId ?? null,
        },
        {
          status: 400,
        }
      );
    }

    const body = await request.json();

    const fileId =
      typeof body?.fileId === "string"
        ? body.fileId.trim()
        : "";

    if (!fileId) {
      return NextResponse.json(
        {
          error: "附件 ID 不能为空",
        },
        {
          status: 400,
        }
      );
    }

    await deleteRecordFile(fileId);

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "删除附件失败";

    console.error(
      "DELETE /api/record/[id]/files error:",
      error
    );

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