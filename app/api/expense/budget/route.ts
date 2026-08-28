import { NextRequest, NextResponse } from "next/server";

import { supabase } from "@/lib/supabase";


// =====================================================
// 类型
// =====================================================

type BudgetRow = {
  id: string;
  year: number;
  category: string;
  budget_amount: number;
};


// =====================================================
// GET
//
// 获取某一年的年度额度
//
// 当前表结构：
// expense_category_budgets
//
// id
// year
// category
// budget_amount
//
// 注意：
// category 字段这里实际保存“账本名称”。
// 因为你最终确定的是：
// 按账本设置年度额度，而不是按消费分类。
// =====================================================

export async function GET(
  request: NextRequest
) {
  try {

    const yearParam =
      request.nextUrl.searchParams.get(
        "year"
      );

    const year =
      Number(yearParam);


    if (
      !Number.isInteger(year)
    ) {

      return NextResponse.json(
        {
          success: false,
          error: "年份无效",
        },
        {
          status: 400,
        }
      );

    }


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "expense_category_budgets"
        )
        .select(
          "id, year, category, budget_amount"
        )
        .eq(
          "year",
          year
        )
        .order(
          "category",
          {
            ascending: true,
          }
        );


    if (error) {

      console.error(
        "GET expense budgets database error:",
        error
      );

      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
          details:
            error.details ?? null,
          hint:
            error.hint ?? null,
          code:
            error.code ?? null,
        },
        {
          status: 500,
        }
      );

    }


    return NextResponse.json(
      {
        success: true,
        data:
          (data ??
            []) as BudgetRow[],
      },
      {
        status: 200,
      }
    );

  } catch (
    error
  ) {

    console.error(
      "GET expense budgets error:",
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
// 新增年度额度
//
// 用于 INSERT
//
// body:
// {
//   year: 2026,
//   category: "旅游",
//   budget_amount: 50000
// }
// =====================================================

export async function POST(
  request: NextRequest
) {
  try {

    const body =
      await request.json();


    const year =
      Number(
        body?.year
      );


    const category =
      String(
        body?.category ??
          ""
      ).trim();


    const budgetAmount =
      Number(
        body?.budget_amount
      );


    if (
      !Number.isInteger(
        year
      )
    ) {

      return NextResponse.json(
        {
          success: false,
          error: "年份无效",
        },
        {
          status: 400,
        }
      );

    }


    if (!category) {

      return NextResponse.json(
        {
          success: false,
          error: "账本名称不能为空",
        },
        {
          status: 400,
        }
      );

    }


    if (
      !Number.isFinite(
        budgetAmount
      ) ||
      budgetAmount < 0
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "年度额度必须是大于等于 0 的数字",
        },
        {
          status: 400,
        }
      );

    }


    const {
      data,
      error,
    } =
      await supabase
        .from(
          "expense_category_budgets"
        )
        .insert(
          {
            year,
            category,
            budget_amount:
              budgetAmount,
            updated_at:
              new Date().toISOString(),
          }
        )
        .select(
          "id, year, category, budget_amount"
        )
        .single();


    if (error) {

      console.error(
        "POST expense budget database error:",
        error
      );


      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
          details:
            error.details ?? null,
          hint:
            error.hint ?? null,
          code:
            error.code ?? null,
        },
        {
          status: 500,
        }
      );

    }


    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        status: 201,
      }
    );

  } catch (
    error
  ) {

    console.error(
      "POST expense budget error:",
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
// 新增 / 修改年度额度
//
// 如果 year + category 已存在：
// UPDATE
//
// 如果不存在：
// INSERT
//
// 适合 PAGE 自动保存。
// =====================================================

export async function PUT(
  request: NextRequest
) {
  try {

    const body =
      await request.json();


    const year =
      Number(
        body?.year
      );


    const category =
      String(
        body?.category ??
          ""
      ).trim();


    const budgetAmount =
      Number(
        body?.budget_amount
      );


    if (
      !Number.isInteger(
        year
      )
    ) {

      return NextResponse.json(
        {
          success: false,
          error: "年份无效",
        },
        {
          status: 400,
        }
      );

    }


    if (!category) {

      return NextResponse.json(
        {
          success: false,
          error: "账本名称不能为空",
        },
        {
          status: 400,
        }
      );

    }


    if (
      !Number.isFinite(
        budgetAmount
      ) ||
      budgetAmount < 0
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "年度额度必须是大于等于 0 的数字",
        },
        {
          status: 400,
        }
      );

    }


    const {
      data,
      error
    } =
      await supabase
        .from(
          "expense_category_budgets"
        )
        .upsert(
          {
            year,
            category,
            budget_amount:
              budgetAmount,
            updated_at:
              new Date().toISOString(),
          },
          {
            onConflict:
              "year,category",
          }
        )
        .select(
          "id, year, category, budget_amount"
        )
        .single();


    if (error) {

      console.error(
        "PUT expense budget database error:",
        error
      );


      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
          details:
            error.details ?? null,
          hint:
            error.hint ?? null,
          code:
            error.code ?? null,
        },
        {
          status: 500,
        }
      );

    }


    return NextResponse.json(
      {
        success: true,
        data,
      },
      {
        status: 200,
      }
    );

  } catch (
    error
  ) {

    console.error(
      "PUT expense budget error:",
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
// 删除年度额度
//
// 支持：
//
// {
//   id: "xxxx"
// }
//
// 或：
//
// {
//   year: 2026,
//   category: "旅游"
// }
// =====================================================

export async function DELETE(
  request: NextRequest
) {
  try {

    const body =
      await request.json();


    const id =
      body?.id
        ? String(
            body.id
          ).trim()
        : "";


    const year =
      body?.year !== undefined
        ? Number(
            body.year
          )
        : null;


    const category =
      body?.category !== undefined
        ? String(
            body.category
          ).trim()
        : "";


    // =================================================
    // 优先按照 id 删除
    // =================================================

    if (id) {

      const {
        error
      } =
        await supabase
          .from(
            "expense_category_budgets"
          )
          .delete()
          .eq(
            "id",
            id
          );


      if (error) {

        console.error(
          "DELETE expense budget by id error:",
          error
        );


        return NextResponse.json(
          {
            success: false,
            error:
              error.message,
            details:
              error.details ?? null,
            hint:
              error.hint ?? null,
            code:
              error.code ?? null,
          },
          {
            status: 500,
          }
        );

      }


      return NextResponse.json(
        {
          success: true,
        },
        {
          status: 200,
        }
      );

    }


    // =================================================
    // 按 year + category 删除
    // =================================================

    if (
      !Number.isInteger(
        year
      ) ||
      !category
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "删除额度需要提供 id，或者 year + category",
        },
        {
          status: 400,
        }
      );

    }


    const {
      error
    } =
      await supabase
        .from(
          "expense_category_budgets"
        )
        .delete()
        .eq(
          "year",
          year
        )
        .eq(
          "category",
          category
        );


    if (error) {

      console.error(
        "DELETE expense budget error:",
        error
      );


      return NextResponse.json(
        {
          success: false,
          error:
            error.message,
          details:
            error.details ?? null,
          hint:
            error.hint ?? null,
          code:
            error.code ?? null,
        },
        {
          status: 500,
        }
      );

    }


    return NextResponse.json(
      {
        success: true,
      },
      {
        status: 200,
      }
    );

  } catch (
    error
  ) {

    console.error(
      "DELETE expense budget error:",
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