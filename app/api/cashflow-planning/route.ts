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

function normalizeName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * 用业务字段寻找数据库中的对应记录。
 *
 * value / manual_* 等字段不能参与匹配，
 * 因为这些字段本来就是用户可能修改的内容。
 *
 * 特殊项目：
 *
 * 1. SAL
 *    同一个年月只能存在一条 active。
 *
 * 2. 转去养老保险
 *    同一个年月只能存在一条 active。
 *
 * 3. 本月交养老保险
 *    同一个年月只能存在一条 active。
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
  const name = normalizeName(row.name);

  // =========================================================
  // SAL
  // =========================================================

  if (
    row.role === "income" &&
    name === "sal"
  ) {
    return JSON.stringify([
      row.year,
      row.month,
      "income",
      "__SPECIAL_SAL__",
    ]);
  }

  // =========================================================
  // 转去养老保险
  // =========================================================

  if (
    row.role === "expense" &&
    name === "转去养老保险"
  ) {
    return JSON.stringify([
      row.year,
      row.month,
      "expense",
      "__SPECIAL_TRANSFER_TO_PENSION__",
    ]);
  }

  // =========================================================
  // 本月交养老保险
  // =========================================================

  if (
    row.role === "expense" &&
    (
      row.project_id === "fixed:pension-payment" ||
      row.is_pension_payment === true ||
      name === "本月交养老保险"
    )
  ) {
    return JSON.stringify([
      row.year,
      row.month,
      "expense",
      "__SPECIAL_PENSION_PAYMENT__",
    ]);
  }

  // =========================================================
  // 普通项目
  // =========================================================

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
 * Supabase 默认最多返回 1000 条，
 * 所以这里分页读取。
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

    void projects;

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

    /* =====================================================
     * 构建 incoming rows
     * ===================================================== */

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

        /* =================================================
         * 收入
         * ================================================= */

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
                item.is_pension_payment === true ||
                item.isPensionPayment === true,

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

        /* =================================================
         * 支出
         * ================================================= */

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
                item.is_pension_payment === true ||
                item.isPensionPayment === true,

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

        /* =================================================
         * 如果这个月完全没有 income / expense，
         * 保存 month meta。
         * ================================================= */

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
              monthMeta.is_pension_payment === true ||
              monthMeta.isPensionPayment === true,

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

    /* =====================================================
     * 第一步：
     * 读取数据库中这些年份已有的数据。
     *
     * 这里只读取，不删除。
     * ===================================================== */

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

    /* =====================================================
     * 第二步：
     * 建立数据库记录索引
     * ===================================================== */

    const existingMap =
      new Map<string, any[]>();

    for (const existing of existingRows) {
      const key =
        buildMatchKey(existing);

      const list =
        existingMap.get(key) ?? [];

      list.push(existing);

      existingMap.set(
        key,
        list
      );
    }

    /* =====================================================
     * 第二步-A：
     * 清理数据库历史特殊项目重复记录
     *
     * 重要：
     * NEVER DELETE。
     *
     * 多余历史记录：
     *     deleted = true
     *
     * 每个年月最终只保留 1 条 active。
     *
     * 注意：
     * 这里使用 UPDATE，
     * 不能使用 upsert({id, deleted})。
     *
     * 同时不写 updated_at，
     * 避免数据库不存在该字段导致 500。
     * ===================================================== */

    const duplicateIdsToMarkDeleted: string[] = [];

    for (const [
      key,
      candidates,
    ] of existingMap.entries()) {
      if (candidates.length <= 1) {
        continue;
      }

      const isSpecial =
        key.includes(
          "__SPECIAL_SAL__"
        ) ||
        key.includes(
          "__SPECIAL_TRANSFER_TO_PENSION__"
        ) ||
        key.includes(
          "__SPECIAL_PENSION_PAYMENT__"
        );

      if (!isSpecial) {
        continue;
      }

      const activeCandidates =
        candidates.filter(
          (row) =>
            row.deleted !== true
        );

      if (
        activeCandidates.length <= 1
      ) {
        continue;
      }

      /*
       * 保留第一条 active。
       * 其他 active 标记 deleted=true。
       */

      const keep =
        activeCandidates[0];

      for (
        let i = 1;
        i < activeCandidates.length;
        i++
      ) {
        const duplicate =
          activeCandidates[i];

        if (
          duplicate?.id &&
          duplicate.id !== keep?.id
        ) {
          duplicateIdsToMarkDeleted.push(
            duplicate.id
          );
        }
      }
    }

    if (
      duplicateIdsToMarkDeleted.length >
      0
    ) {
      console.log(
        "[CASHFLOW-PLANNING POST] marking historical duplicates deleted:",
        duplicateIdsToMarkDeleted.length
      );

      const DELETE_MARK_BATCH_SIZE =
        500;

      for (
        let i = 0;
        i <
        duplicateIdsToMarkDeleted.length;
        i +=
          DELETE_MARK_BATCH_SIZE
      ) {
        const batch =
          duplicateIdsToMarkDeleted.slice(
            i,
            i +
              DELETE_MARK_BATCH_SIZE
          );

        /*
         * 这里只 UPDATE deleted。
         *
         * 不使用 DELETE。
         * 不使用部分字段 upsert。
         */

        const {
          error:
            duplicateMarkError,
        } = await supabase
          .from(
            "cashflow_planning"
          )
          .update({
            deleted: true,
          })
          .in(
            "id",
            batch
          );

        if (
          duplicateMarkError
        ) {
          console.error(
            "[CASHFLOW-PLANNING POST] duplicate cleanup error:",
            duplicateMarkError
          );

          return NextResponse.json(
            {
              ok: false,
              error:
                duplicateMarkError.message,
            },
            {
              status: 500,
            }
          );
        }
      }

      /*
       * 同步修改内存里的 existingRows。
       */

      for (
        const id of
          duplicateIdsToMarkDeleted
      ) {
        const found =
          existingRows.find(
            (row) =>
              row.id === id
          );

        if (found) {
          found.deleted = true;
        }
      }

      /*
       * 同步修改 existingMap。
       */

      for (
        const candidates of
          existingMap.values()
      ) {
        for (
          const candidate of
            candidates
        ) {
          if (
            candidate?.id &&
            duplicateIdsToMarkDeleted.includes(
              candidate.id
            )
          ) {
            candidate.deleted = true;
          }
        }
      }
    }

    /* =====================================================
     * 第二步-B：
     * 本次 incoming rows 特殊项目去重
     *
     * 特殊项目：
     *   SAL
     *   转去养老保险
     *   本月交养老保险
     *
     * 同一个：
     *   年 + 月 + 特殊项目
     *
     * 最终只允许进入数据库 1 条。
     *
     * 普通项目完全不改变。
     * ===================================================== */

    const dedupedRows: CashflowPlanningRow[] =
      [];

    const incomingSpecialKeys =
      new Set<string>();

    for (const row of rows) {
      const name =
        normalizeName(
          row.name
        );

      const isSpecial =
        (
          row.role === "income" &&
          name === "sal"
        ) ||
        (
          row.role === "expense" &&
          name ===
            "转去养老保险"
        ) ||
        (
          row.role === "expense" &&
          (
            row.project_id ===
              "fixed:pension-payment" ||
            row.is_pension_payment ===
              true ||
            name ===
              "本月交养老保险"
          )
        );

      /*
       * 普通项目原样保留。
       */

      if (!isSpecial) {
        dedupedRows.push(
          row
        );

        continue;
      }

      const key =
        buildMatchKey(row);

      /*
       * 同一个特殊项目已经出现：
       * 跳过后面的重复。
       */

      if (
        incomingSpecialKeys.has(
          key
        )
      ) {
        continue;
      }

      incomingSpecialKeys.add(
        key
      );

      dedupedRows.push(
        row
      );
    }

    console.log(
      "[CASHFLOW-PLANNING POST] rows after special dedupe:",
      {
        before:
          rows.length,
        after:
          dedupedRows.length,
      }
    );

    /* =====================================================
     * 第三步：
     * 给 incoming rows 找对应的数据库 id
     *
     * 匹配顺序：
     *
     * 1. 优先 active
     * 2. 没有 active，再使用历史 deleted
     * 3. 都没有，新建完整记录
     * ===================================================== */

    const usedExistingIds =
      new Set<string>();

    const rowsToUpsert =
      dedupedRows.map(
        (row) => {
          const key =
            buildMatchKey(row);

          const candidates =
            existingMap.get(key) ??
            [];

          let matched:
            | (typeof candidates)[number]
            | undefined;

          /*
           * ---------------------------------------------
           * 第一优先：
           * active 记录
           * ---------------------------------------------
           */

          for (
            const candidate of
              candidates
          ) {
            if (
              candidate?.id &&
              candidate.deleted !== true &&
              !usedExistingIds.has(
                candidate.id
              )
            ) {
              matched =
                candidate;

              break;
            }
          }

          /*
           * ---------------------------------------------
           * 第二优先：
           * 历史 deleted 记录
           * ---------------------------------------------
           */

          for (
            const candidate of
              candidates
          ) {
            if (matched) {
              break;
            }

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

          /*
           * ---------------------------------------------
           * 找到数据库记录
           * ---------------------------------------------
           */

          if (matched?.id) {
            usedExistingIds.add(
              matched.id
            );

            return {
              id:
                matched.id,

              year:
                row.year,

              month:
                row.month,

              role:
                row.role,

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

              /*
               * 本次 incoming 数据重新成为 active。
               */
              deleted:
                false,

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

          /*
           * ---------------------------------------------
           * 完全没有对应记录：
           * 创建新记录。
           *
           * year/month/role 等 NOT NULL 字段
           * 全部完整写入。
           * ---------------------------------------------
           */

          return {
            id:
              crypto.randomUUID(),

            year:
              row.year,

            month:
              row.month,

            role:
              row.role,

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
              false,

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

    /* =====================================================
     * 第四步：
     * 最终安全检查
     *
     * is_pension_payment:
     *   true / false
     *
     * deleted:
     *   true / false
     *
     * 永远不会主动写 null。
     * ===================================================== */

    const safeRowsToUpsert =
      rowsToUpsert.map(
        (row) => ({
          ...row,

          is_pension_payment:
            row.is_pension_payment ===
            true,

          deleted:
            row.deleted === true,
        })
      );

    console.log(
      "[CASHFLOW-PLANNING POST] prepared rows:",
      safeRowsToUpsert.length
    );

    /* =====================================================
     * 第五步：
     * 使用 id 做 upsert
     *
     * 不 DELETE。
     * ===================================================== */

    const UPSERT_BATCH_SIZE =
      500;

    let totalSaved =
      0;

    for (
      let i = 0;
      i <
      safeRowsToUpsert.length;
      i +=
        UPSERT_BATCH_SIZE
    ) {
      const batch =
        safeRowsToUpsert.slice(
          i,
          i +
            UPSERT_BATCH_SIZE
        );

      console.log(
        "[CASHFLOW-PLANNING POST] upserting batch:",
        {
          start:
            i,
          count:
            batch.length,
        }
      );

      const {
        data,
        error,
      } = await supabase
        .from(
          "cashflow_planning"
        )
        .upsert(
          batch,
          {
            onConflict:
              "id",
          }
        )
        .select(
          "id"
        );

      if (error) {
        console.error(
          "[CASHFLOW-PLANNING POST] upsert error:",
          error
        );

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

      years:
        incomingYears,

      incomingRows:
        rows.length,

      savedRows:
        totalSaved,

      existingRows:
        existingRows.length,

      /*
       * POST 本次没有执行 DELETE。
       */
      deletedRows:
        0,
    });
  } catch (error) {
    console.error(
      "[CASHFLOW-PLANNING POST] unexpected error:",
      error
    );

    /*
     * 这里绝对不 DELETE。
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
 * 只有明确调用 DELETE API 时才执行。
 *
 * POST 不会调用这里。
 * ========================================================= */

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

