import { NextRequest, NextResponse } from "next/server";

import { createClient } from "@supabase/supabase-js";


// =====================================================
// Supabase
// =====================================================

function getSupabase() {
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
// 类型
// =====================================================

type TableType =
  | "estimate"
  | "actual";

type ItemType =
  | "income"
  | "expense";


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


function parseYear(
  value: unknown
): number | null {

  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 2000 ||
    number > 2100
  ) {
    return null;
  }

  return number;
}


function parseMonth(
  value: unknown
): number | null {

  const number =
    Number(value);

  if (
    !Number.isInteger(number) ||
    number < 1 ||
    number > 12
  ) {
    return null;
  }

  return number;
}


function parseAmount(
  value: unknown
): number {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value === "number"
  ) {

    return Number.isFinite(value)
      ? value
      : 0;

  }

  const text =
    String(value)
      .replace(/,/g, "")
      .replace(/¥/g, "")
      .replace(/￥/g, "")
      .trim();

  const number =
    Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
}


function getTableName(
  table: TableType
) {

  return table === "actual"
    ? "monthly_savings_actual"
    : "monthly_savings_estimates";

}


// =====================================================
// 默认名称
// =====================================================

function getDefaultItemName(
  itemType: ItemType,
  number: number
) {

  const baseName =
    itemType === "income"
      ? "新增收入"
      : "新增支出";


  if (
    number <= 1
  ) {

    return baseName;

  }


  return `${baseName} ${number}`;

}


// =====================================================
// SELECT 字段
// =====================================================

const ITEM_SELECT = `
  id,
  year,
  month,
  item_type,
  item_name,
  amount,
  sort_order,
  copy_group_id,
  created_at,
  updated_at
`;


// =====================================================
// GET
// =====================================================

export async function GET(
  request: NextRequest
) {

  try {

    const searchParams =
      request.nextUrl.searchParams;


    const year =
      parseYear(
        searchParams.get(
          "year"
        )
      ) ??
      new Date().getFullYear();


    const monthParam =
      searchParams.get(
        "month"
      );


    const month =
      monthParam !== null
        ? parseMonth(
            monthParam
          )
        : null;


    if (
      monthParam !== null &&
      month === null
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "month 必须是 1-12",
        },
        {
          status: 400,
        }
      );

    }


    const tableParam =
      searchParams.get(
        "table"
      );


    const table: TableType =
      tableParam === "actual"
        ? "actual"
        : "estimate";


    const tableName =
      getTableName(
        table
      );


    const supabase =
      getSupabase();


    let query =
      supabase
        .from(tableName)
        .select(
          ITEM_SELECT
        )
        .eq(
          "year",
          year
        )
        .order(
          "month",
          {
            ascending: true,
          }
        )
        .order(
          "item_type",
          {
            ascending: true,
          }
        )
        .order(
          "sort_order",
          {
            ascending: true,
          }
        )
        .order(
          "created_at",
          {
            ascending: true,
          }
        );


    if (
      month !== null
    ) {

      query =
        query.eq(
          "month",
          month
        );

    }


    const {
      data,
      error,
    } =
      await query;


    if (error) {

      console.error(
        "GET monthly savings error:",
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

        table,

        year,

        month,

        items:
          data ?? [],
      }
    );

  } catch (error) {

    console.error(
      "GET /api/monthly-savings error:",
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
// 新增项目
// =====================================================

export async function POST(
  request: NextRequest
) {

  try {

    const body =
      await request.json();


    const table: TableType =
      body?.table === "actual"
        ? "actual"
        : "estimate";


    const year =
      parseYear(
        body?.year
      );


    const month =
      parseMonth(
        body?.month
      );


    const itemType =
      body?.item_type;


    const requestedItemName =
      cleanString(
        body?.item_name
      );


    const amount =
      parseAmount(
        body?.amount
      );


    const sortOrder =
      Number.isFinite(
        Number(
          body?.sort_order
        )
      )
        ? Number(
            body.sort_order
          )
        : 0;


    if (!year) {

      return NextResponse.json(
        {
          success: false,
          error:
            "year 无效",
        },
        {
          status: 400,
        }
      );

    }


    if (!month) {

      return NextResponse.json(
        {
          success: false,
          error:
            "month 必须是 1-12",
        },
        {
          status: 400,
        }
      );

    }


    if (
      itemType !== "income" &&
      itemType !== "expense"
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "item_type 必须是 income 或 expense",
        },
        {
          status: 400,
        }
      );

    }


    const tableName =
      getTableName(
        table
      );


    const supabase =
      getSupabase();


    // =================================================
    // 如果是复制产生的项目
    //
    // 可以直接指定 copy_group_id
    // =================================================

    const requestedCopyGroupId =
      cleanString(
        body?.copy_group_id
      );


    // =================================================
    // 判断自动名称
    // =================================================

    const useAutoName =
      !requestedItemName ||
      requestedItemName ===
        "新增收入" ||
      requestedItemName ===
        "新增支出";


    // =================================================
    // 手动名称
    // =================================================

    if (
      !useAutoName
    ) {

      const {
        data,
        error,
      } =
        await supabase
          .from(tableName)
          .insert(
            {
              year,

              month,

              item_type:
                itemType,

              item_name:
                requestedItemName,

              amount,

              sort_order:
                sortOrder,

              copy_group_id:
                requestedCopyGroupId ||
                null,
            }
          )
          .select(
            ITEM_SELECT
          )
          .single();


      if (error) {

        console.error(
          "POST monthly savings error:",
          error
        );


        if (
          error.code ===
          "23505"
        ) {

          return NextResponse.json(
            {
              success: false,

              error:
                `「${requestedItemName}」已经存在，请直接修改原项目。`,
            },
            {
              status: 409,
            }
          );

        }


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

          item:
            data,

          data,
        }
      );

    }


    // =================================================
    // 自动名称
    // =================================================

    const MAX_RETRIES = 100;


    for (
      let number = 1;
      number <= MAX_RETRIES;
      number += 1
    ) {

      const itemName =
        getDefaultItemName(
          itemType,
          number
        );


      const {
        data,
        error,
      } =
        await supabase
          .from(tableName)
          .insert(
            {
              year,

              month,

              item_type:
                itemType,

              item_name:
                itemName,

              amount,

              sort_order:
                sortOrder,

              copy_group_id:
                requestedCopyGroupId ||
                null,
            }
          )
          .select(
            ITEM_SELECT
          )
          .single();


      if (!error) {

        return NextResponse.json(
          {
            success: true,

            item:
              data,

            data,
          }
        );

      }


      if (
        error.code ===
        "23505"
      ) {

        continue;

      }


      console.error(
        "POST monthly savings error:",
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
        success: false,

        error:
          "无法生成新的项目名称，请稍后重试。",
      },
      {
        status: 500,
      }
    );

  } catch (error) {

    console.error(
      "POST /api/monthly-savings error:",
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
// 自动保存修改
// =====================================================

export async function PUT(
  request: NextRequest
) {

  try {

    const body =
      await request.json();


    const id =
      cleanString(
        body?.id
      );


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


    const table: TableType =
      body?.table === "actual"
        ? "actual"
        : "estimate";


    const tableName =
      getTableName(
        table
      );


    const updateData:
      Record<
        string,
        unknown
      > = {};


    // =================================================
    // item_name
    // =================================================

    if (
      body?.item_name !==
      undefined
    ) {

      const itemName =
        cleanString(
          body.item_name
        );


      if (!itemName) {

        return NextResponse.json(
          {
            success: false,
            error:
              "item_name 不能为空",
          },
          {
            status: 400,
          }
        );

      }


      updateData.item_name =
        itemName;

    }


    // =================================================
    // amount
    // =================================================

    if (
      body?.amount !==
      undefined
    ) {

      updateData.amount =
        parseAmount(
          body.amount
        );

    }


    // =================================================
    // sort_order
    // =================================================

    if (
      body?.sort_order !==
      undefined
    ) {

      const sortOrder =
        Number(
          body.sort_order
        );


      if (
        !Number.isFinite(
          sortOrder
        )
      ) {

        return NextResponse.json(
          {
            success: false,
            error:
              "sort_order 无效",
          },
          {
            status: 400,
          }
        );

      }


      updateData.sort_order =
        sortOrder;

    }


    // =================================================
    // item_type
    // =================================================

    if (
      body?.item_type !==
      undefined
    ) {

      if (
        body.item_type !==
          "income" &&
        body.item_type !==
          "expense"
      ) {

        return NextResponse.json(
          {
            success: false,
            error:
              "item_type 必须是 income 或 expense",
          },
          {
            status: 400,
          }
        );

      }


      updateData.item_type =
        body.item_type;

    }


    // =================================================
    // year
    // =================================================

    if (
      body?.year !==
      undefined
    ) {

      const year =
        parseYear(
          body.year
        );


      if (!year) {

        return NextResponse.json(
          {
            success: false,
            error:
              "year 无效",
          },
          {
            status: 400,
          }
        );

      }


      updateData.year =
        year;

    }


    // =================================================
    // month
    // =================================================

    if (
      body?.month !==
      undefined
    ) {

      const month =
        parseMonth(
          body.month
        );


      if (!month) {

        return NextResponse.json(
          {
            success: false,
            error:
              "month 必须是 1-12",
          },
          {
            status: 400,
          }
        );

      }


      updateData.month =
        month;

    }


    // =================================================
    // copy_group_id
    //
    // 一般不需要页面手工修改。
    // 这里只允许显式传入。
    // =================================================

    if (
      body?.copy_group_id !==
      undefined
    ) {

      updateData.copy_group_id =
        cleanString(
          body.copy_group_id
        );

    }


    // =================================================
    // 没有需要修改
    // =================================================

    if (
      Object.keys(
        updateData
      ).length === 0
    ) {

      return NextResponse.json(
        {
          success: true,

          message:
            "没有需要修改的数据",
        }
      );

    }


    const supabase =
      getSupabase();


    const {
      data,
      error,
    } =
      await supabase
        .from(tableName)
        .update(
          updateData
        )
        .eq(
          "id",
          id
        )
        .select(
          ITEM_SELECT
        )
        .single();


    if (error) {

      console.error(
        "PUT monthly savings error:",
        error
      );


      if (
        error.code ===
        "23505"
      ) {

        return NextResponse.json(
          {
            success: false,

            error:
              "修改后与同月同类型的其他项目名称重复。",
          },
          {
            status: 409,
          }
        );

      }


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

        item:
          data,

        data,
      }
    );

  } catch (error) {

    console.error(
      "PUT /api/monthly-savings error:",
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
// APPLY
//
// 将一个项目复制到其他月份
//
// POST /api/monthly-savings
//
// {
//   action: "apply",
//   source_id: "...",
//   table: "estimate"
// }
//
// 规则：
//
// 1. 当前项目作为源项目
// 2. 创建 copy_group_id
// 3. 复制到其他 11 个月
// 4. 名称、金额、类型、排序完全复制
// 5. 如果目标月份已经有同名项目
//    则跳过，不覆盖用户已有数据
// 6. 返回复制结果
// =====================================================

async function applyToOtherMonths(
  body: Record<string, unknown>
) {

  const sourceId =
    cleanString(
      body?.source_id
    );


  const table: TableType =
    body?.table === "actual"
      ? "actual"
      : "estimate";


  if (!sourceId) {

    return NextResponse.json(
      {
        success: false,
        error:
          "缺少 source_id",
      },
      {
        status: 400,
      }
    );

  }


  const tableName =
    getTableName(
      table
    );


  const supabase =
    getSupabase();


  // =================================================
  // 获取源项目
  // =================================================

  const {
    data: source,
    error: sourceError,
  } =
    await supabase
      .from(tableName)
      .select(
        ITEM_SELECT
      )
      .eq(
        "id",
        sourceId
      )
      .single();


  if (sourceError) {

    console.error(
      "Apply source query error:",
      sourceError
    );


    return NextResponse.json(
      {
        success: false,
        error:
          sourceError.message,
      },
      {
        status: 500,
      }
    );

  }


  if (!source) {

    return NextResponse.json(
      {
        success: false,
        error:
          "找不到要应用的项目",
      },
      {
        status: 404,
      }
    );

  }


  // =================================================
  // 如果已经应用过
  //
  // 不重复创建
  // =================================================

  if (
    source.copy_group_id
  ) {

    return NextResponse.json(
      {
        success: true,

        alreadyApplied:
          true,

        copy_group_id:
          source.copy_group_id,

        message:
          "这个项目已经应用到其他月份。",
      }
    );

  }


  // =================================================
  // 生成复制组 ID
  // =================================================

  const copyGroupId =
    crypto.randomUUID();


  // =================================================
  // 先把源项目标记为这个复制组
  // =================================================

  const {
    data: updatedSource,
    error: updateSourceError,
  } =
    await supabase
      .from(tableName)
      .update(
        {
          copy_group_id:
            copyGroupId,
        }
      )
      .eq(
        "id",
        sourceId
      )
      .select(
        ITEM_SELECT
      )
      .single();


  if (updateSourceError) {

    console.error(
      "Apply source update error:",
      updateSourceError
    );


    return NextResponse.json(
      {
        success: false,
        error:
          updateSourceError.message,
      },
      {
        status: 500,
      }
    );

  }


  // =================================================
  // 复制到其他月份
  // =================================================

  const insertedItems: unknown[] = [];

  const skippedMonths: number[] = [];


  for (
    let month = 1;
    month <= 12;
    month += 1
  ) {

    // 当前月份不复制
    if (
      month ===
      source.month
    ) {

      continue;

    }


    // =================================================
    // 检查目标月份是否已经有同名项目
    // =================================================

    const {
      data: existing,
      error: existingError,
    } =
      await supabase
        .from(tableName)
        .select(
          "id"
        )
        .eq(
          "year",
          source.year
        )
        .eq(
          "month",
          month
        )
        .eq(
          "item_type",
          source.item_type
        )
        .eq(
          "item_name",
          source.item_name
        )
        .limit(
          1
        );


    if (existingError) {

      console.error(
        "Apply duplicate check error:",
        existingError
      );


      // 出现检查错误时，不继续覆盖
      skippedMonths.push(
        month
      );

      continue;

    }


    if (
      existing &&
      existing.length > 0
    ) {

      skippedMonths.push(
        month
      );

      continue;

    }


    // =================================================
    // 插入复制项目
    // =================================================

    const {
      data: inserted,
      error: insertError,
    } =
      await supabase
        .from(tableName)
        .insert(
          {
            year:
              source.year,

            month,

            item_type:
              source.item_type,

            item_name:
              source.item_name,

            amount:
              source.amount,

            sort_order:
              source.sort_order,

            copy_group_id:
              copyGroupId,
          }
        )
        .select(
          ITEM_SELECT
        )
        .single();


    if (insertError) {

      // 如果数据库唯一约束冲突
      // 当作跳过
      if (
        insertError.code ===
        "23505"
      ) {

        skippedMonths.push(
          month
        );

        continue;

      }


      console.error(
        "Apply insert error:",
        insertError
      );


      // 发生真正错误：
      // 清理刚刚创建的复制项目
      await supabase
        .from(tableName)
        .delete()
        .eq(
          "copy_group_id",
          copyGroupId
        );


      // 恢复源项目
      await supabase
        .from(tableName)
        .update(
          {
            copy_group_id:
              null,
          }
        )
        .eq(
          "id",
          sourceId
        );


      return NextResponse.json(
        {
          success: false,
          error:
            insertError.message,
        },
        {
          status: 500,
        }
      );

    }


    if (
      inserted
    ) {

      insertedItems.push(
        inserted
      );

    }

  }


  return NextResponse.json(
    {
      success: true,

      applied:
        true,

      copy_group_id:
        copyGroupId,

      source:
        updatedSource,

      inserted:
        insertedItems,

      insertedCount:
        insertedItems.length,

      skippedMonths,

      message:
        `已应用到 ${insertedItems.length} 个其他月份。`,
    }
  );

}


// =====================================================
// UNDO APPLY
//
// 撤销“应用到其他月份”
//
// 只删除：
//
// copy_group_id = 当前复制组
// 且 id != source_id
//
// 不删除源项目。
//
// 这样用户在原月份的项目仍然保留。
// =====================================================

async function undoApply(
  body: Record<string, unknown>
) {

  const sourceId =
    cleanString(
      body?.source_id
    );


  const copyGroupId =
    cleanString(
      body?.copy_group_id
    );


  const table: TableType =
    body?.table === "actual"
      ? "actual"
      : "estimate";


  if (!sourceId) {

    return NextResponse.json(
      {
        success: false,
        error:
          "缺少 source_id",
      },
      {
        status: 400,
      }
    );

  }


  const tableName =
    getTableName(
      table
    );


  const supabase =
    getSupabase();


  // =================================================
  // 如果没有传 copy_group_id
  //
  // 从源项目读取
  // =================================================

  let groupId =
    copyGroupId;


  if (!groupId) {

    const {
      data: source,
      error: sourceError,
    } =
      await supabase
        .from(tableName)
        .select(
          "id, copy_group_id"
        )
        .eq(
          "id",
          sourceId
        )
        .single();


    if (sourceError) {

      return NextResponse.json(
        {
          success: false,
          error:
            sourceError.message,
        },
        {
          status: 500,
        }
      );

    }


    groupId =
      source?.copy_group_id ??
      null;

  }


  if (!groupId) {

    return NextResponse.json(
      {
        success: true,

        undone:
          false,

        deletedCount:
          0,

        message:
          "这个项目没有应用到其他月份。",
      }
    );

  }


  // =================================================
  // 删除复制出来的项目
  //
  // 注意：
  //
  // 不删除源项目
  // =================================================

  const {
    data: deletedItems,
    error: deleteError,
  } =
    await supabase
      .from(tableName)
      .delete()
      .eq(
        "copy_group_id",
        groupId
      )
      .neq(
        "id",
        sourceId
      )
      .select(
        "id, year, month, item_name, amount"
      );


  if (deleteError) {

    console.error(
      "Undo apply delete error:",
      deleteError
    );


    return NextResponse.json(
      {
        success: false,
        error:
          deleteError.message,
      },
      {
        status: 500,
      }
    );

  }


  // =================================================
  // 清除源项目的复制标记
  // =================================================

  const {
    error: clearSourceError,
  } =
    await supabase
      .from(tableName)
      .update(
        {
          copy_group_id:
            null,
        }
      )
      .eq(
        "id",
        sourceId
      );


  if (clearSourceError) {

    console.error(
      "Undo apply clear source error:",
      clearSourceError
    );


    return NextResponse.json(
      {
        success: false,
        error:
          clearSourceError.message,
      },
      {
        status: 500,
      }
    );

  }


  return NextResponse.json(
    {
      success: true,

      undone:
        true,

      deletedCount:
        deletedItems?.length ??
        0,

      deleted:
        deletedItems ??
        [],

      message:
        `已撤销应用，并删除 ${deletedItems?.length ?? 0} 个复制项目。`,
    }
  );

}


// =====================================================
// PATCH
//
// 专门处理：
//
// 1. 应用到其他月份
// 2. 撤销应用
// =====================================================

export async function PATCH(
  request: NextRequest
) {

  try {

    const body =
      await request.json();


    const action =
      cleanString(
        body?.action
      );


    if (
      action ===
      "apply"
    ) {

      return applyToOtherMonths(
        body
      );

    }


    if (
      action ===
      "undo"
    ) {

      return undoApply(
        body
      );

    }


    return NextResponse.json(
      {
        success: false,

        error:
          "action 必须是 apply 或 undo",
      },
      {
        status: 400,
      }
    );

  } catch (error) {

    console.error(
      "PATCH /api/monthly-savings error:",
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
// =====================================================

export async function DELETE(
  request: NextRequest
) {

  try {

    const searchParams =
      request.nextUrl.searchParams;


    const id =
      cleanString(
        searchParams.get(
          "id"
        )
      );


    const table: TableType =
      searchParams.get(
        "table"
      ) === "actual"
        ? "actual"
        : "estimate";


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


    const tableName =
      getTableName(
        table
      );


    const supabase =
      getSupabase();


    const {
      error,
    } =
      await supabase
        .from(tableName)
        .delete()
        .eq(
          "id",
          id
        );


    if (error) {

      console.error(
        "DELETE monthly savings error:",
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
      }
    );

  } catch (error) {

    console.error(
      "DELETE /api/monthly-savings error:",
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