import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";

// =====================================================
// Supabase
// =====================================================

function getSupabaseAdmin() {

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL"
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "缺少 SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}


// =====================================================
// 工具
// =====================================================

function cleanString(
  value: unknown
): string | null {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text
    ? text
    : null;
}


// =====================================================
// GET
//
// GET /api/expense/mappings
//
// ?confirmed=true
// ?confirmed=false
// =====================================================

export async function GET(
  request: NextRequest
) {

  try {

    const supabase =
      getSupabaseAdmin();

    const confirmedParam =
      request.nextUrl.searchParams.get(
        "confirmed"
      );

    let query =
      supabase
        .from(
          "expense_account_mappings"
        )
        .select(
          `
            id,
            source_name,
            standard_name,
            account_type,
            confirmed,
            created_at,
            updated_at
          `
        )
        .order(
          "confirmed",
          {
            ascending: true,
          }
        )
        .order(
          "source_name",
          {
            ascending: true,
          }
        );


    if (
      confirmedParam === "true"
    ) {

      query =
        query.eq(
          "confirmed",
          true
        );

    }


    if (
      confirmedParam === "false"
    ) {

      query =
        query.eq(
          "confirmed",
          false
        );

    }


    const {
      data,
      error,
    } =
      await query;


    if (error) {

      console.error(
        "GET /api/expense/mappings error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error: error.message,
        },
        {
          status: 500,
        }
      );

    }


    return NextResponse.json(
      {
        success: true,

        // ★ 页面使用这个字段
        mappings:
          data ?? [],

        // 同时保留 data，兼容其他代码
        data:
          data ?? [],

        total:
          data?.length ?? 0,

        pending:
          data?.filter(
            item =>
              item.confirmed !== true
          ).length ?? 0,

        confirmed:
          data?.filter(
            item =>
              item.confirmed === true
          ).length ?? 0,
      }
    );

  } catch (error) {

    console.error(
      "GET /api/expense/mappings error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );

  }

}


// =====================================================
// POST
//
// 新增账户映射
//
// 如果 source_name 已存在
// → 更新
//
// 如果不存在
// → INSERT
// =====================================================

export async function POST(
  request: NextRequest
) {

  try {

    const supabase =
      getSupabaseAdmin();

    const body =
      await request.json();


    const sourceName =
      cleanString(
        body?.source_name
      );

    const standardName =
      cleanString(
        body?.standard_name
      );

    const accountType =
      cleanString(
        body?.account_type
      );

    const confirmed =
      body?.confirmed === true;


    if (!sourceName) {

      return NextResponse.json(
        {
          success: false,
          error:
            "source_name 不能为空",
        },
        {
          status: 400,
        }
      );

    }


    if (
      confirmed &&
      !standardName
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "确认映射时 standard_name 不能为空",
        },
        {
          status: 400,
        }
      );

    }


    // =================================================
    // 查找现有记录
    // =================================================

    const {
      data: existing,
      error: findError,
    } =
      await supabase
        .from(
          "expense_account_mappings"
        )
        .select(
          "id"
        )
        .eq(
          "source_name",
          sourceName
        )
        .maybeSingle();


    if (findError) {

      return NextResponse.json(
        {
          success: false,
          error:
            findError.message,
        },
        {
          status: 500,
        }
      );

    }


    let data;


    // =================================================
    // UPDATE
    // =================================================

    if (existing?.id) {

      const {
        data: updated,
        error,
      } =
        await supabase
          .from(
            "expense_account_mappings"
          )
          .update(
            {
              standard_name:
                standardName,

              account_type:
                accountType,

              confirmed,

              updated_at:
                new Date().toISOString(),
            }
          )
          .eq(
            "id",
            existing.id
          )
          .select(
            `
              id,
              source_name,
              standard_name,
              account_type,
              confirmed,
              created_at,
              updated_at
            `
          )
          .single();


      if (error) {

        return NextResponse.json(
          {
            success: false,
            error:
              error.message,
          },
          {
            status: 500,
          }
        );

      }


      data =
        updated;

    }

    // =================================================
    // INSERT
    // =================================================

    else {

      const {
        data: inserted,
        error,
      } =
        await supabase
          .from(
            "expense_account_mappings"
          )
          .insert(
            {
              source_name:
                sourceName,

              standard_name:
                standardName,

              account_type:
                accountType,

              confirmed,

              updated_at:
                new Date().toISOString(),
            }
          )
          .select(
            `
              id,
              source_name,
              standard_name,
              account_type,
              confirmed,
              created_at,
              updated_at
            `
          )
          .single();


      if (error) {

        return NextResponse.json(
          {
            success: false,
            error:
              error.message,
          },
          {
            status: 500,
          }
        );

      }


      data =
        inserted;

    }


    return NextResponse.json(
      {
        success: true,
        mapping: data,
        data,
      }
    );

  } catch (error) {

    console.error(
      "POST /api/expense/mappings error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );

  }

}


// =====================================================
// PUT
//
// 修改映射
// =====================================================

export async function PUT(
  request: NextRequest
) {

  try {

    const supabase =
      getSupabaseAdmin();

    const body =
      await request.json();


    const id =
      cleanString(
        body?.id
      );


    const standardName =
      cleanString(
        body?.standard_name
      );


    const accountType =
      cleanString(
        body?.account_type
      );


    const confirmed =
      body?.confirmed === true;


    if (!id) {

      return NextResponse.json(
        {
          success: false,
          error:
            "id 不能为空",
        },
        {
          status: 400,
        }
      );

    }


    if (
      confirmed &&
      !standardName
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "确认映射时必须填写标准名称",
        },
        {
          status: 400,
        }
      );

    }


    const updateData: Record<
      string,
      unknown
    > = {

      standard_name:
        standardName,

      confirmed,

      updated_at:
        new Date().toISOString(),

    };


    if (
      accountType !== null
    ) {

      updateData.account_type =
        accountType;

    }


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "expense_account_mappings"
        )
        .update(
          updateData
        )
        .eq(
          "id",
          id
        )
        .select(
          `
            id,
            source_name,
            standard_name,
            account_type,
            confirmed,
            created_at,
            updated_at
          `
        )
        .single();


    if (error) {

      console.error(
        "PUT /api/expense/mappings error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
        },
        {
          status: 500,
        }
      );

    }


    return NextResponse.json(
      {
        success: true,

        mapping:
          data,

        data,
      }
    );

  } catch (error) {

    console.error(
      "PUT /api/expense/mappings error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );

  }

}


// =====================================================
// DELETE
//
// DELETE /api/expense/mappings?id=xxx
//
// 同时兼容 JSON body
// =====================================================

export async function DELETE(
  request: NextRequest
) {

  try {

    const supabase =
      getSupabaseAdmin();

    let id =
      request.nextUrl.searchParams.get(
        "id"
      );


    // =================================================
    // 如果 URL 没有 id
    // 尝试读取 body
    // =================================================

    if (!id) {

      try {

        const body =
          await request.json();

        id =
          cleanString(
            body?.id
          );

      } catch {

        // 没有 body，继续
      }

    }


    if (!id) {

      return NextResponse.json(
        {
          success: false,
          error:
            "缺少 id",
        },
        {
          status: 400,
        }
      );

    }


    const {
      error,
    } =
      await supabase
        .from(
          "expense_account_mappings"
        )
        .delete()
        .eq(
          "id",
          id
        );


    if (error) {

      console.error(
        "DELETE /api/expense/mappings error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
        },
        {
          status: 500,
        }
      );

    }


    return NextResponse.json(
      {
        success: true,
        id,
      }
    );

  } catch (error) {

    console.error(
      "DELETE /api/expense/mappings error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );

  }

}