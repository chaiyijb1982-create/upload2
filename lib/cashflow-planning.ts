import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type CashflowRole =
  | "income"
  | "expense";

export type CashflowProject = {
  projectId: string;
  role: CashflowRole;
  name: string;
  custom: boolean;
  sourceOffset?: number;
  isAnnuityContribution?: boolean;
  isPensionPayment?: boolean;
};

export type CashflowCellItem = {
  id: string;

  year: number;
  month: number;

  role: CashflowRole;

  projectId: string;

  name: string;

  value: number;

  independent: boolean;

  fromExcel: boolean;

  // ===================================================
  // 拖拽排序
  // ===================================================
  sortOrder?: number;

  sourceRow?: number;
  sourceCol?: number;
  sourceOffset?: number;

  // ===================================================
  // 转去养老保险
  // ===================================================
  isAnnuityContribution?: boolean;

  // ===================================================
  // 本月交养老保险
  // ===================================================
  isPensionPayment?: boolean;

  deleted?: boolean;
};

export type CashflowMonthData = {
  year: number;

  month: number;

  income: CashflowCellItem[];

  expense: CashflowCellItem[];

  manualRemaining?: number;

  manualTotalCash?: number;

  manualAnnuity?: number;
};

export type CashflowYearData = {
  year: number;

  months: CashflowMonthData[];

  originalOpeningCash: number;

  originalOpeningAnnuity: number;
};

export type CashflowState = {
  years: CashflowYearData[];

  projects: CashflowProject[];
};

// =====================================================
// API response
// =====================================================

type CashflowPlanningRow = {
  year: number;

  month: number;

  role: CashflowRole;

  project_id: string;

  name: string;

  value: number;

  independent: boolean;

  from_excel: boolean;

  // ===================================================
  // 拖拽排序
  // ===================================================
  sort_order: number | null;

  source_row: number | null;

  source_col: number | null;

  source_offset: number | null;

  // ===================================================
  // 养老保险
  // ===================================================
  is_annuity_contribution: boolean;

  is_pension_payment: boolean;

  deleted: boolean;

  manual_remaining: number | null;

  manual_total_cash: number | null;

  manual_annuity: number | null;

  original_opening_cash: number | null;

  original_opening_annuity: number | null;
};

// =====================================================
// 通用 fetch
// =====================================================

async function apiRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  try {
    console.log(
      "[CASHFLOW API] request:",
      input,
      init?.method ?? "GET"
    );

    const response = await fetch(
      input,
      {
        ...init,

        headers: {
          "Content-Type":
            "application/json",

          ...(init?.headers ?? {}),
        },

        cache: "no-store",
      }
    );

    console.log(
      "[CASHFLOW API] response:",
      response.status,
      response.statusText
    );

    let body: any = null;

    try {
      body = await response.json();
    } catch {
      body = null;
    }

    if (
      !response.ok ||
      body?.ok === false
    ) {
      const message =
        body?.error ||
        body?.message ||
        `请求失败 (${response.status})`;

      throw new Error(message);
    }

    return body as T;
  } catch (error) {
    console.error(
      "[CASHFLOW API] fetch failed:",
      {
        input,
        method:
          init?.method ?? "GET",
        error,
      }
    );

    throw error;
  }
}

// =====================================================
// 数字
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

// =====================================================
// GET
// =====================================================

export async function loadCashflowPlanning(): Promise<{
  state: CashflowState | null;
  hasData: boolean;
}> {
  const result =
    await apiRequest<{
      ok: true;
      data: CashflowPlanningRow[];
    }>(
      "/api/cashflow-planning",
      {
        method: "GET",
      }
    );

  const data =
    Array.isArray(result.data)
      ? result.data
      : [];

  if (data.length === 0) {
    return {
      state: null,
      hasData: false,
    };
  }

  // ===================================================
  // 年
  // ===================================================

  const yearMap =
    new Map<
      number,
      CashflowYearData
    >();

  // ===================================================
  // 项目
  // ===================================================

  const projectMap =
    new Map<
      string,
      CashflowProject
    >();

  // ===================================================
  // 恢复数据库
  // ===================================================

  for (const row of data) {
    const yearValue =
      Number(row.year);

    const monthValue =
      Number(row.month);

    if (
      !Number.isFinite(yearValue) ||
      !Number.isFinite(monthValue)
    ) {
      continue;
    }

    // ===============================================
    // 创建 Year
    // ===============================================

    if (!yearMap.has(yearValue)) {
      yearMap.set(
        yearValue,
        {
          year: yearValue,

          months: [],

          originalOpeningCash:
            Number(
              row.original_opening_cash ??
                0
            ),

          originalOpeningAnnuity:
            Number(
              row.original_opening_annuity ??
                0
            ),
        }
      );
    }

    const year =
      yearMap.get(yearValue)!;

    // ===============================================
    // 创建 Month
    // ===============================================

    let month =
      year.months.find(
        (item) =>
          item.month ===
          monthValue
      );

    if (!month) {
      month = {
        year: yearValue,

        month: monthValue,

        income: [],

        expense: [],

        manualRemaining:
          optionalNumber(
            row.manual_remaining
          ) ?? undefined,

        manualTotalCash:
          optionalNumber(
            row.manual_total_cash
          ) ?? undefined,

        manualAnnuity:
          optionalNumber(
            row.manual_annuity
          ) ?? undefined,
      };

      year.months.push(month);
    }

    // ===============================================
    // month meta
    //
    // 不是实际收入/支出项目
    // ===============================================

    if (
      String(
        row.project_id
      ).startsWith(
        "__month_meta__"
      )
    ) {
      continue;
    }

    // ===============================================
    // role
    // ===============================================

    const role: CashflowRole =
      row.role === "expense"
        ? "expense"
        : "income";

    // ===============================================
    // 恢复项目
    // ===============================================

    const item: CashflowCellItem = {
      id:
        typeof crypto !==
          "undefined" &&
        typeof crypto.randomUUID ===
          "function"
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`,

      year: yearValue,

      month: monthValue,

      role,

      projectId:
        row.project_id,

      name:
        row.name ?? "",

      value:
        Number(
          row.value ?? 0
        ),

      independent:
        !!row.independent,

      fromExcel:
        !!row.from_excel,

      // =============================================
      // 拖拽排序
      // =============================================

      sortOrder:
        optionalNumber(
          row.sort_order
        ) ?? undefined,

      sourceRow:
        row.source_row ??
        undefined,

      sourceCol:
        row.source_col ??
        undefined,

      sourceOffset:
        row.source_offset ??
        undefined,

      // =============================================
      // 转去养老保险
      // =============================================

      isAnnuityContribution:
        !!row.is_annuity_contribution,

      // =============================================
      // 本月交养老保险
      // =============================================

      isPensionPayment:
        !!row.is_pension_payment,

      deleted:
        !!row.deleted,
    };

    // ===============================================
    // deleted 项目不恢复到显示列表
    // ===============================================

    if (!item.deleted) {
      month[role].push(item);
    }

    // ===============================================
    // Project metadata
    // ===============================================

    const projectKey =
      `${role}::${item.projectId}`;

    if (
      !projectMap.has(
        projectKey
      )
    ) {
      projectMap.set(
        projectKey,
        {
          projectId:
            item.projectId,

          role,

          name:
            item.name,

          custom:
            !item.fromExcel,

          sourceOffset:
            item.sourceOffset,

          isAnnuityContribution:
            item.isAnnuityContribution,

          isPensionPayment:
            item.isPensionPayment,
        }
      );
    }
  }

  // ===================================================
  // 排序
  //
  // 先按 sortOrder。
  //
  // 老数据如果没有 sortOrder，
  // 使用原来的数组顺序作为 fallback。
  // ===================================================

  for (const year of yearMap.values()) {
    year.months.sort(
      (a, b) =>
        a.month - b.month
    );

    for (const month of year.months) {
      month.income.sort(
        (a, b) => {
          const aOrder =
            typeof a.sortOrder ===
            "number"
              ? a.sortOrder
              : Number.MAX_SAFE_INTEGER;

          const bOrder =
            typeof b.sortOrder ===
            "number"
              ? b.sortOrder
              : Number.MAX_SAFE_INTEGER;

          return (
            aOrder - bOrder
          );
        }
      );

      month.expense.sort(
        (a, b) => {
          const aOrder =
            typeof a.sortOrder ===
            "number"
              ? a.sortOrder
              : Number.MAX_SAFE_INTEGER;

          const bOrder =
            typeof b.sortOrder ===
            "number"
              ? b.sortOrder
              : Number.MAX_SAFE_INTEGER;

          return (
            aOrder - bOrder
          );
        }
      );
    }
  }

  // ===================================================
  // 完整 State
  // ===================================================

  const state: CashflowState = {
    years: [
      ...yearMap.values(),
    ].sort(
      (a, b) =>
        a.year - b.year
    ),

    projects: [
      ...projectMap.values(),
    ],
  };

  return {
    state,

    hasData: true,
  };
}

// =====================================================
// SAVE
// =====================================================

export async function saveCashflowPlanning(
  state: CashflowState
): Promise<void> {
  await apiRequest(
    "/api/cashflow-planning",
    {
      method: "POST",

      body: JSON.stringify({
        years: state.years,

        projects:
          state.projects,
      }),
    }
  );
}

// =====================================================
// CLEAR
// =====================================================

export async function clearCashflowPlanning(): Promise<void> {
  await apiRequest(
    "/api/cashflow-planning",
    {
      method: "DELETE",
    }
  );
}

