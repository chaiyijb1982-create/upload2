import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// =====================================================
// CASHFLOW-PLANNING API
//
// 浏览器
//   ↓
// /api/cashflow-planning
//   ↓
// Supabase Service Role
//   ↓
// cashflow_planning
//
// 个人单用户系统
// =====================================================

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

// =====================================================
// GET
// =====================================================

export async function GET() {
  try {
    const supabase =
      createSupabaseServerClient();

    const { data, error } =
      await supabase
        .from(
          "cashflow_planning"
        )
        .select(
          [
            "year",
            "month",
            "role",
            "project_id",
            "name",
            "value",
            "independent",
            "from_excel",
            "source_row",
            "source_col",
            "source_offset",

            // 养老保险
            "is_annuity_contribution",
            "is_pension_payment",

            // 拖拽排序
            "sort_order",

            "deleted",

            "manual_remaining",
            "manual_total_cash",
            "manual_annuity",

            "original_opening_cash",
            "original_opening_annuity",
          ].join(",")
        )
        .order(
          "year",
          {
            ascending: true,
          }
        )
        .order(
          "month",
          {
            ascending: true,
          }
        )
        .order(
          "role",
          {
            ascending: true,
          }
        )
        .order(
          "sort_order",
          {
            ascending: true,
            nullsFirst: false,
          }
        );

    if (error) {
      console.error(
        "CASHFLOW-PLANNING GET Supabase error:",
        error
      );

      return NextResponse.json(
        {
          ok: false,

          error:
            error.message,

          code:
            error.code,

          details:
            error.details,

          hint:
            error.hint,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,

      data:
        data ?? [],
    });
  } catch (error) {
    console.error(
      "CASHFLOW-PLANNING GET exception:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "读取 CASHFLOW-PLANNING 失败",
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
// 接收完整 CASHFLOW_STATE
//
// 每次保存：
// 1. 删除旧快照
// 2. 插入完整新快照
//
// 支持：
// - 修改金额
// - 新增收入
// - 新增支出
// - 删除项目
// - 下月定投联动
// - 复制年份
// - 手工修改本月剩下
// - 手工修改总现金剩下
// - 手工修改积累年金
// - 拖拽排序
// - 养老保险属性
// =====================================================

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    if (
      !body ||
      typeof body !== "object"
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "请求数据格式错误",
        },
        {
          status: 400,
        }
      );
    }

    const years =
      Array.isArray(body.years)
        ? body.years
        : [];

    const projects =
      Array.isArray(body.projects)
        ? body.projects
        : [];

    const supabase =
      createSupabaseServerClient();

    // =================================================
    // 先删除旧数据
    // =================================================

    const {
      error: deleteError,
    } = await supabase
      .from(
        "cashflow_planning"
      )
      .delete()
      .not(
        "id",
        "is",
        null
      );

    if (deleteError) {
      console.error(
        "CASHFLOW-PLANNING DELETE before save error:",
        deleteError
      );

      return NextResponse.json(
        {
          ok: false,

          error:
            deleteError.message,

          code:
            deleteError.code,

          details:
            deleteError.details,

          hint:
            deleteError.hint,
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // 转换成数据库 rows
    // =================================================

    const rows:
      Record<string, unknown>[] =
      [];

    for (const year of years) {
      if (
        !year ||
        typeof year !== "object"
      ) {
        continue;
      }

      const yearValue =
        Number(year.year);

      if (
        !Number.isFinite(
          yearValue
        )
      ) {
        continue;
      }

      const months =
        Array.isArray(
          year.months
        )
          ? year.months
          : [];

      for (const month of months) {
        if (
          !month ||
          typeof month !== "object"
        ) {
          continue;
        }

        const monthValue =
          Number(month.month);

        if (
          !Number.isFinite(
            monthValue
          ) ||
          monthValue < 1 ||
          monthValue > 12
        ) {
          continue;
        }

        const income =
          Array.isArray(
            month.income
          )
            ? month.income
            : [];

        const expense =
          Array.isArray(
            month.expense
          )
            ? month.expense
            : [];

        // =================================================
        // 注意：
        //
        // 收入和支出各自从 0 开始排序。
        //
        // 不会因为把 income + expense 合并，
        // 导致 expense 的 sort_order 从 income 后面继续。
        // =================================================

        const items = [
          ...income.map(
            (
              item: any,
              index: number
            ) => ({
              ...item,

              role: "income",

              sortOrder:
                index,
            })
          ),

          ...expense.map(
            (
              item: any,
              index: number
            ) => ({
              ...item,

              role: "expense",

              sortOrder:
                index,
            })
          ),
        ];

        // =============================================
        // month meta
        //
        // 即使这个月没有任何收入/支出，
        // 也保存一行。
        // =============================================

        if (
          items.length === 0
        ) {
          rows.push({
            year: yearValue,

            month: monthValue,

            role: "income",

            project_id:
              `__month_meta__${yearValue}_${monthValue}`,

            name: "",

            value: 0,

            independent: true,

            from_excel: false,

            sort_order: null,

            source_row: null,

            source_col: null,

            source_offset: null,

            is_annuity_contribution:
              false,

            is_pension_payment:
              false,

            deleted: true,

            manual_remaining:
              optionalNumber(
                month.manualRemaining
              ),

            manual_total_cash:
              optionalNumber(
                month.manualTotalCash
              ),

            manual_annuity:
              optionalNumber(
                month.manualAnnuity
              ),

            original_opening_cash:
              optionalNumber(
                year.originalOpeningCash
              ) ?? 0,

            original_opening_annuity:
              optionalNumber(
                year.originalOpeningAnnuity
              ) ?? 0,
          });

          continue;
        }

        // =============================================
        // 实际项目
        // =============================================

        for (const item of items) {
          if (
            !item ||
            typeof item !== "object"
          ) {
            continue;
          }

          const role =
            item.role ===
            "expense"
              ? "expense"
              : "income";

          const projectId =
            typeof item.projectId ===
              "string" &&
            item.projectId.trim()
              ? item.projectId
              : `__item__${yearValue}_${monthValue}_${Math.random()
                  .toString(36)
                  .slice(2)}`;

          const name =
            typeof item.name ===
            "string"
              ? item.name
              : "";

          const value =
            Number.isFinite(
              item.value
            )
              ? Number(
                  item.value
                )
              : 0;

          const sortOrder =
            Number.isFinite(
              item.sortOrder
            )
              ? Number(
                  item.sortOrder
                )
              : null;

          rows.push({
            year: yearValue,

            month: monthValue,

            role,

            project_id:
              projectId,

            name,

            value,

            independent:
              !!item.independent,

            from_excel:
              !!item.fromExcel,

            // =========================================
            // 拖拽排序
            // =========================================

            sort_order:
              sortOrder,

            source_row:
              optionalNumber(
                item.sourceRow
              ),

            source_col:
              optionalNumber(
                item.sourceCol
              ),

            source_offset:
              optionalNumber(
                item.sourceOffset
              ),

            // =========================================
            // 转去养老保险
            // =========================================

            is_annuity_contribution:
              !!item.isAnnuityContribution,

            // =========================================
            // 本月交养老保险
            // =========================================

            is_pension_payment:
              !!item.isPensionPayment,

            deleted:
              !!item.deleted,

            // =========================================
            // 月度手工数据
            // =========================================

            manual_remaining:
              optionalNumber(
                month.manualRemaining
              ),

            manual_total_cash:
              optionalNumber(
                month.manualTotalCash
              ),

            manual_annuity:
              optionalNumber(
                month.manualAnnuity
              ),

            // =========================================
            // 年度初始数据
            // =========================================

            original_opening_cash:
              optionalNumber(
                year.originalOpeningCash
              ) ?? 0,

            original_opening_annuity:
              optionalNumber(
                year.originalOpeningAnnuity
              ) ?? 0,
          });
        }
      }
    }

    // =================================================
    // 没有数据
    // =================================================

    if (
      rows.length === 0
    ) {
      return NextResponse.json({
        ok: true,

        saved: 0,

        projects:
          projects.length,
      });
    }

    // =================================================
    // 分批插入
    // =================================================

    const BATCH_SIZE =
      500;

    for (
      let i = 0;
      i < rows.length;
      i += BATCH_SIZE
    ) {
      const batch =
        rows.slice(
          i,
          i + BATCH_SIZE
        );

      const {
        error,
      } = await supabase
        .from(
          "cashflow_planning"
        )
        .insert(batch);

      if (error) {
        console.error(
          "CASHFLOW-PLANNING INSERT error:",
          error
        );

        // =============================================
        // 如果中途失败，
        // 清理已经写入的数据，
        // 避免留下半套快照。
        // =============================================

        await supabase
          .from(
            "cashflow_planning"
          )
          .delete()
          .not(
            "id",
            "is",
            null
          );

        return NextResponse.json(
          {
            ok: false,

            error:
              error.message,

            code:
              error.code,

            details:
              error.details,

            hint:
              error.hint,
          },
          {
            status: 500,
          }
        );
      }
    }

    return NextResponse.json({
      ok: true,

      saved:
        rows.length,

      projects:
        projects.length,
    });
  } catch (error) {
    console.error(
      "CASHFLOW-PLANNING POST exception:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "保存 CASHFLOW-PLANNING 失败",
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

export async function DELETE() {
  try {
    const supabase =
      createSupabaseServerClient();

    const {
      error,
    } = await supabase
      .from(
        "cashflow_planning"
      )
      .delete()
      .not(
        "id",
        "is",
        null
      );

    if (error) {
      console.error(
        "CASHFLOW-PLANNING DELETE error:",
        error
      );

      return NextResponse.json(
        {
          ok: false,

          error:
            error.message,

          code:
            error.code,

          details:
            error.details,

          hint:
            error.hint,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,

      deleted: true,
    });
  } catch (error) {
    console.error(
      "CASHFLOW-PLANNING DELETE exception:",
      error
    );

    return NextResponse.json(
      {
        ok: false,

        error:
          error instanceof Error
            ? error.message
            : "清空 CASHFLOW-PLANNING 失败",
      },
      {
        status: 500,
      }
    );
  }
}

// =====================================================
// Helpers
// =====================================================

function optionalNumber(
  value: unknown
): number | null {
  return (
    typeof value === "number" &&
    Number.isFinite(value)
  )
    ? value
    : null;
}

