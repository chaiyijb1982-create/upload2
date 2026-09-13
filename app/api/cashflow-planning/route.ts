import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CashflowPlanningRow = {
  id?: string;

  year: number;
  month: number;
  role: "income" | "expense";

  project_id: string | null;
  name: string | null;
  value: number | null;

  independent: boolean | null;
  from_excel: boolean | null;

  source_row: number | null;
  source_col: number | null;
  source_offset: number | null;

  is_annuity_contribution: boolean | null;
  is_pension_payment: boolean | null;

  sort_order: number | null;
  deleted: boolean | null;

  manual_remaining: number | null;
  manual_total_cash: number | null;
  manual_annuity: number | null;

  original_opening_cash: number | null;
  original_opening_annuity: number | null;
};

function optionalNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : null;
}

function optionalBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * 用“业务字段”寻找数据库中的对应记录。
 *
 * 注意：
 * value / manual_* 等字段不能参与匹配，
 * 因为这些字段本来就是用户可能修改的内容。
 */
function buildMatchKey(row: {
  year: number;
  month: number;
  role: "income" | "expense";
  project_id: string | null;
  name: string | null;
  source_row: number | null;
  source_col: number | null;
  source_offset: number | null;
  is_annuity_contribution: boolean | null;
  is_pension_payment: boolean | null;
}) {
  return JSON.stringify([
    row.year,
    row.month,
    row.role,
    row.project_id,
    row.name,
    row.source_row,
    row.source_col,
    row.source_offset,
    row.is_annuity_contribution,
    row.is_pension_payment,
  ]);
}

/* =========================================================
 * GET
 *
 * 重点：
 * Supabase 默认最多返回 1000 条，
 * 所以这里必须分页。
 * ========================================================= */

export async function GET() {
  try {
    const supabase = createSupabaseServerClient();

    const PAGE_SIZE = 1000;

    const allData: CashflowPlanningRow[] = [];

    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;

      console.log(
        "[CASHFLOW-PLANNING GET] loading rows:",
        {
          from,
          to,
        }
      );

      const { data, error } = await supabase
        .from("cashflow_planning")
        .select(
          [
            "id",
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
            "is_annuity_contribution",
            "is_pension_payment",
            "sort_order",
            "deleted",
            "manual_remaining",
            "manual_total_cash",
            "manual_annuity",
            "original_opening_cash",
            "original_opening_annuity",
          ].join(",")
        )
        .order("year", {
          ascending: true,
        })
        .order("month", {
          ascending: true,
        })
        .order("role", {
          ascending: true,
        })
        .order("sort_order", {
          ascending: true,
          nullsFirst: false,
        })
        .range(from, to);

      if (error) {
        console.error(
          "[CASHFLOW-PLANNING GET] Supabase error:",
          error
        );

        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          {
            status: 500,
          }
        );
      }

      const pageData =
        (data ?? []) as unknown as CashflowPlanningRow[];

      allData.push(...pageData);

      console.log(
        "[CASHFLOW-PLANNING GET] page loaded:",
        pageData.length
      );

      if (pageData.length < PAGE_SIZE) {
        break;
      }

      from += PAGE_SIZE;
    }

    console.log(
      "[CASHFLOW-PLANNING GET] total rows:",
      allData.length
    );

    return NextResponse.json({
      ok: true,
      data: allData,
    });
  } catch (error) {
    console.error(
      "[CASHFLOW-PLANNING GET] unexpected error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
 * POST
 *
 * 非常重要：
 *
 * 这里 NEVER DELETE。
 *
 * 当前页面传过来的数据：
 *   已存在 -> UPDATE
 *   不存在 -> INSERT
 *
 * 数据库中存在、但当前页面没有传来的数据：
 *   保留不动
 *
 * 所以：
 * 页面只有 2033/01~03
 * 不会导致 2033/04~12 被删除。
 * ========================================================= */

export async function POST(request: Request) {
  try {

    const supabase = createSupabaseServerClient();
    const body = await request.json();

    const years = Array.isArray(body?.years)
      ? body.years
      : [];

    const projects = Array.isArray(body?.projects)
      ? body.projects
      : [];

    if (years.length === 0) {
      return NextResponse.json(
        {
          ok: false,
          error: "No years provided",
        },
        {
          status: 400,
        }
      );
    }

    const rows: CashflowPlanningRow[] = [];

    const incomingYearSet = new Set<number>();

    /**
     * =====================================================
     * 构建 incoming rows
     * =====================================================
     */

    for (const yearData of years) {
      if (!yearData) {
        continue;
      }

      const yearValue = Number(
        yearData.year ??
          yearData.value ??
          yearData.yearValue
      );

      if (!Number.isFinite(yearValue)) {
        continue;
      }

      incomingYearSet.add(yearValue);

      const months = Array.isArray(yearData.months)
        ? yearData.months
        : [];

      for (const monthData of months) {
        if (!monthData) {
          continue;
        }

        const monthValue = Number(
          monthData.month ??
            monthData.monthValue ??
            monthData.value
        );

        if (
          !Number.isFinite(monthValue) ||
          monthValue < 1 ||
          monthValue > 12
        ) {
          continue;
        }

        /**
         * =================================================
         * month meta
         *
         * 有些月份没有 income / expense 项目，
         * 但是仍然需要保存月份的手工数据。
         * =================================================
         */

        const monthMetaProjectId =
          `__month_meta__${yearValue}_${monthValue}`;

        const incomeItems = Array.isArray(
          monthData.income
        )
          ? monthData.income
          : [];

        const expenseItems = Array.isArray(
          monthData.expense
        )
          ? monthData.expense
          : [];

        /**
         * =================================================
         * 收入
         * =================================================
         */

        incomeItems.forEach(
          (
            item: any,
            index: number
          ) => {
            if (!item) {
              return;
            }

            const row: CashflowPlanningRow = {
              year: yearValue,
              month: monthValue,
              role: "income",

              project_id:
                optionalString(
                  item.project_id ??
                    item.projectId
                ),

              name:
                optionalString(
                  item.name ??
                    item.title ??
                    item.project_name
                ),

              value:
                optionalNumber(
                  item.value ??
                    item.amount
                ),

              independent:
                optionalBoolean(
                  item.independent
                ),

              from_excel:
                optionalBoolean(
                  item.from_excel ??
                    item.fromExcel
                ),

              source_row:
                optionalNumber(
                  item.source_row ??
                    item.sourceRow
                ),

              source_col:
                optionalNumber(
                  item.source_col ??
                    item.sourceCol
                ),

              source_offset:
                optionalNumber(
                  item.source_offset ??
                    item.sourceOffset
                ),

              is_annuity_contribution:
                optionalBoolean(
                  item.is_annuity_contribution ??
                    item.isAnnuityContribution
                ),

              is_pension_payment:
                optionalBoolean(
                  item.is_pension_payment ??
                    item.isPensionPayment
                ),

              sort_order:
                optionalNumber(
                  item.sort_order ??
                    item.sortOrder ??
                    index
                ),

              deleted:               
                  item.deleted === true,

              manual_remaining:
                optionalNumber(
                  item.manual_remaining ??
                    item.manualRemaining
                ),

              manual_total_cash:
                optionalNumber(
                  item.manual_total_cash ??
                    item.manualTotalCash
                ),

              manual_annuity:
                optionalNumber(
                  item.manual_annuity ??
                    item.manualAnnuity
                ),

              original_opening_cash:
                optionalNumber(
                  item.original_opening_cash ??
                    item.originalOpeningCash
                ),

              original_opening_annuity:
                optionalNumber(
                  item.original_opening_annuity ??
                    item.originalOpeningAnnuity
                ),
            };

            rows.push(row);
          }
        );

        /**
         * =================================================
         * 支出
         * =================================================
         */

        expenseItems.forEach(
          (
            item: any,
            index: number
          ) => {
            if (!item) {
              return;
            }

            const row: CashflowPlanningRow = {
              year: yearValue,
              month: monthValue,
              role: "expense",

              project_id:
                optionalString(
                  item.project_id ??
                    item.projectId
                ),

              name:
                optionalString(
                  item.name ??
                    item.title ??
                    item.project_name
                ),

              value:
                optionalNumber(
                  item.value ??
                    item.amount
                ),

              independent:
                optionalBoolean(
                  item.independent
                ),

              from_excel:
                optionalBoolean(
                  item.from_excel ??
                    item.fromExcel
                ),

              source_row:
                optionalNumber(
                  item.source_row ??
                    item.sourceRow
                ),

              source_col:
                optionalNumber(
                  item.source_col ??
                    item.sourceCol
                ),

              source_offset:
                optionalNumber(
                  item.source_offset ??
                    item.sourceOffset
                ),

              is_annuity_contribution:
                optionalBoolean(
                  item.is_annuity_contribution ??
                    item.isAnnuityContribution
                ),

              is_pension_payment:
                optionalBoolean(
                  item.is_pension_payment ??
                    item.isPensionPayment
                ),

              sort_order:
                optionalNumber(
                  item.sort_order ??
                    item.sortOrder ??
                    index
                ),

              deleted:               
                  item.deleted === true,

              manual_remaining:
                optionalNumber(
                  item.manual_remaining ??
                    item.manualRemaining
                ),

              manual_total_cash:
                optionalNumber(
                  item.manual_total_cash ??
                    item.manualTotalCash
                ),

              manual_annuity:
                optionalNumber(
                  item.manual_annuity ??
                    item.manualAnnuity
                ),

              original_opening_cash:
                optionalNumber(
                  item.original_opening_cash ??
                    item.originalOpeningCash
                ),

              original_opening_annuity:
                optionalNumber(
                  item.original_opening_annuity ??
                    item.originalOpeningAnnuity
                ),
            };

            rows.push(row);
          }
        );

        /**
         * =================================================
         * 如果这个月完全没有 income / expense，
         * 保存 month meta。
         *
         * 这里沿用原来的 __month_meta__ 逻辑。
         * =================================================
         */

        if (
          incomeItems.length === 0 &&
          expenseItems.length === 0
        ) {
          const monthMeta: any =
            monthData.meta ??
            monthData;

          rows.push({
            year: yearValue,
            month: monthValue,
            role: "expense",

            project_id:
              monthMetaProjectId,

            name: "__month_meta__",

            value:
              optionalNumber(
                monthMeta.value
              ),

            independent:
              optionalBoolean(
                monthMeta.independent
              ),

            from_excel:
              optionalBoolean(
                monthMeta.from_excel ??
                  monthMeta.fromExcel
              ),

            source_row:
              optionalNumber(
                monthMeta.source_row ??
                  monthMeta.sourceRow
              ),

            source_col:
              optionalNumber(
                monthMeta.source_col ??
                  monthMeta.sourceCol
              ),

            source_offset:
              optionalNumber(
                monthMeta.source_offset ??
                  monthMeta.sourceOffset
              ),

            is_annuity_contribution:
              optionalBoolean(
                monthMeta.is_annuity_contribution ??
                  monthMeta.isAnnuityContribution
              ),

            is_pension_payment:
              optionalBoolean(
                monthMeta.is_pension_payment ??
                  monthMeta.isPensionPayment
              ),

            sort_order:
              optionalNumber(
                monthMeta.sort_order ??
                  monthMeta.sortOrder ??
                  0
              ),

            deleted:
              monthMeta.deleted === true,

            manual_remaining:
              optionalNumber(
                monthMeta.manual_remaining ??
                  monthMeta.manualRemaining
              ),

            manual_total_cash:
              optionalNumber(
                monthMeta.manual_total_cash ??
                  monthMeta.manualTotalCash
              ),

            manual_annuity:
              optionalNumber(
                monthMeta.manual_annuity ??
                  monthMeta.manualAnnuity
              ),

            original_opening_cash:
              optionalNumber(
                monthMeta.original_opening_cash ??
                  monthMeta.originalOpeningCash
              ),

            original_opening_annuity:
              optionalNumber(
                monthMeta.original_opening_annuity ??
                  monthMeta.originalOpeningAnnuity
              ),
          });
        }
      }
    }

    const incomingYears = Array.from(
      incomingYearSet
    ).sort(
      (a, b) => a - b
    );

    if (
      incomingYears.length === 0 ||
      rows.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error: "No valid cashflow rows provided",
        },
        {
          status: 400,
        }
      );
    }

    console.log(
      "[CASHFLOW-PLANNING POST] incoming years:",
      incomingYears
    );

    console.log(
      "[CASHFLOW-PLANNING POST] incoming rows:",
      rows.length
    );

    /**
     * =====================================================
     * 关键修改
     *
     * 不再：
     *
     * supabase
     *   .from("cashflow_planning")
     *   .delete()
     *   .in("year", incomingYears)
     *
     * 这里永远不 DELETE。
     * =====================================================
     */

    /**
     * =====================================================
     * 第一步：
     * 读取数据库中这些年份已有的数据。
     *
     * 这里只读取，不删除。
     *
     * 为避免 Supabase 1000 行限制，同样分页。
     * =====================================================
     */

    const existingRows: any[] = [];

    const PAGE_SIZE = 1000;

    let from = 0;

    while (true) {
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("cashflow_planning")
        .select(
          [
            "id",
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
            "is_annuity_contribution",
            "is_pension_payment",
            "sort_order",
            "deleted",
            "manual_remaining",
            "manual_total_cash",
            "manual_annuity",
            "original_opening_cash",
            "original_opening_annuity",
          ].join(",")
        )
        .in(
          "year",
          incomingYears
        )
        .order("year", {
          ascending: true,
        })
        .order("month", {
          ascending: true,
        })
        .range(from, to);

      if (error) {
        console.error(
          "[CASHFLOW-PLANNING POST] load existing rows error:",
          error
        );

        return NextResponse.json(
          {
            ok: false,
            error: error.message,
          },
          {
            status: 500,
          }
        );
      }

      const page =
        data ?? [];

      existingRows.push(
        ...page
      );

      if (
        page.length <
        PAGE_SIZE
      ) {
        break;
      }

      from += PAGE_SIZE;
    }

    console.log(
      "[CASHFLOW-PLANNING POST] existing rows:",
      existingRows.length
    );

    /**
     * =====================================================
     * 第二步：
     * 建立数据库记录索引
     * =====================================================
     */

    const existingMap =
      new Map<
        string,
        any[]
      >();

    for (
      const existing of existingRows
    ) {
      const key =
        buildMatchKey(
          existing
        );

      const list =
        existingMap.get(
          key
        ) ?? [];

      list.push(
        existing
      );

      existingMap.set(
        key,
        list
      );
    }

    /**
     * =====================================================
     * 第三步：
     * 给 incoming rows 找对应的数据库 id
     *
     * 找到：
     *   带 id UPDATE
     *
     * 找不到：
     *   不带 id INSERT
     *
     * 注意：
     * 同一个 key 如果数据库里有多条，
     * 按顺序逐条对应，避免全部更新到第一条。
     * =====================================================
     */

    const usedExistingIds =
      new Set<string>();

    const rowsToUpsert =
      rows.map(
        (row) => {
          const key =
            buildMatchKey(
              row
            );

          const candidates =
            existingMap.get(
              key
            ) ?? [];

          let matched:
            | any
            | undefined;

          for (
            const candidate of candidates
          ) {
            if (
              candidate?.id &&
              !usedExistingIds.has(
                candidate.id
              )
            ) {
              matched =
                candidate;

              break;
            }
          }

          if (
            matched?.id
          ) {
            usedExistingIds.add(
              matched.id
            );

            return {
              id: matched.id,

              year: row.year,
              month: row.month,
              role: row.role,

              project_id:
                row.project_id,

              name:
                row.name,

              value:
                row.value,

              independent:
                row.independent,

              from_excel:
                row.from_excel,

              source_row:
                row.source_row,

              source_col:
                row.source_col,

              source_offset:
                row.source_offset,

              is_annuity_contribution:
                row.is_annuity_contribution,

              is_pension_payment:
                row.is_pension_payment,

              sort_order:
                row.sort_order,

              deleted:
                row.deleted,

              manual_remaining:
                row.manual_remaining,

              manual_total_cash:
                row.manual_total_cash,

              manual_annuity:
                row.manual_annuity,

              original_opening_cash:
                row.original_opening_cash,

              original_opening_annuity:
                row.original_opening_annuity,
            };
          }

          return {
  id: crypto.randomUUID(),

  year: row.year,
  month: row.month,
  role: row.role,

  project_id:
    row.project_id,

  name:
    row.name,

  value:
    row.value,

  independent:
    row.independent,

  from_excel:
    row.from_excel,

  source_row:
    row.source_row,

  source_col:
    row.source_col,

  source_offset:
    row.source_offset,

  is_annuity_contribution:
    row.is_annuity_contribution,

  is_pension_payment:
    row.is_pension_payment,

  sort_order:
    row.sort_order,

  deleted:
    row.deleted,

  manual_remaining:
    row.manual_remaining,

  manual_total_cash:
    row.manual_total_cash,

  manual_annuity:
    row.manual_annuity,

  original_opening_cash:
    row.original_opening_cash,

  original_opening_annuity:
    row.original_opening_annuity,
};
        }
      );

    /**
     * =====================================================
     * 第四步：
     * 使用 PRIMARY KEY(id) 做 upsert
     *
     * 因为：
     * cashflow_planning_pkey
     * = id
     *
     * 新数据没有 id -> INSERT
     * 已有数据有 id -> UPDATE
     *
     * 数据库中没有出现在本次 rowsToUpsert 的记录：
     * 完全不会被碰。
     * =====================================================
     */

    const UPSERT_BATCH_SIZE = 500;

    let totalSaved = 0;

    for (
      let i = 0;
      i < rowsToUpsert.length;
      i += UPSERT_BATCH_SIZE
    ) {
      const batch =
        rowsToUpsert.slice(
          i,
          i + UPSERT_BATCH_SIZE
        );

      console.log(
        "[CASHFLOW-PLANNING POST] upserting batch:",
        {
          start: i,
          count: batch.length,
        }
      );

      const {
        data,
        error,
      } = await supabase
        .from("cashflow_planning")
        .upsert(
          batch,
          {
            onConflict:
              "id",
          }
        )
        .select("id");

      if (error) {
        console.error(
          "[CASHFLOW-PLANNING POST] upsert error:",
          error
        );

        /**
         * 非常重要：
         *
         * 这里也绝对不 DELETE。
         *
         * 如果第 2 批失败：
         * 第 1 批已经保存的内容保留。
         * 数据库原有内容也保留。
         */
        return NextResponse.json(
          {
            ok: false,
            error:
              error.message,
            savedBeforeError:
              totalSaved,
          },
          {
            status: 500,
          }
        );
      }

      totalSaved +=
        data?.length ??
        batch.length;
    }

    console.log(
      "[CASHFLOW-PLANNING POST] save completed:",
      {
        incomingYears,
        incomingRows:
          rows.length,
        totalSaved,
        existingRows:
          existingRows.length,
      }
    );

    return NextResponse.json({
      ok: true,

      /**
       * 方便前端/日志确认
       */
      years:
        incomingYears,

      incomingRows:
        rows.length,

      savedRows:
        totalSaved,

      existingRows:
        existingRows.length,

      /**
       * 明确告诉前端：
       * 本次保存没有执行删除。
       */
      deletedRows: 0,
    });
  } catch (error) {
    console.error(
      "[CASHFLOW-PLANNING POST] unexpected error:",
      error
    );

    /**
     * 这里也绝对不 DELETE。
     */
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}

/* =========================================================
 * DELETE
 *
 * 这个是用户明确调用 DELETE API 时才执行。
 *
 * 我没有改它。
 * POST 不会调用这里。
 * ========================================================= */

export async function DELETE() {
  try {
    const supabase =
      createSupabaseServerClient();

    const {
      error,
    } = await supabase
      .from("cashflow_planning")
      .delete()
      .not(
        "id",
        "is",
        null
      );

    if (error) {
      console.error(
        "[CASHFLOW-PLANNING DELETE] error:",
        error
      );

      return NextResponse.json(
        {
          ok: false,
          error:
            error.message,
        },
        {
          status: 500,
        }
      );
    }

    return NextResponse.json({
      ok: true,
    });
  } catch (error) {
    console.error(
      "[CASHFLOW-PLANNING DELETE] unexpected error:",
      error
    );

    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown error",
      },
      {
        status: 500,
      }
    );
  }
}