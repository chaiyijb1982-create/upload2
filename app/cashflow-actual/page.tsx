"use client";

import { JSX } from 'react';

import { useEffect, useMemo, useState } from "react";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  useDroppable,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

import {
  loadCashflowPlanning,
  type CashflowState,
} from "@/lib/cashflow-planning";

import { supabase } from "@/lib/supabase";

// ============================================================
// CASHFLOW 实际
// ============================================================

type Role = "income" | "expense";

type CellItem = {
  id: string;
  year: number;
  month: number;
  role: Role;
  projectId: string;
  name: string;
  value: number;
  independent: boolean;
  isAnnuityContribution?: boolean;
  isPensionPayment?: boolean;
  deleted?: boolean;
};

type MonthData = {
  year: number;
  month: number;
  income: CellItem[];
  expense: CellItem[];
};

type YearData = {
  year: number;
  months: MonthData[];
  originalOpeningCash: number;
  originalOpeningAnnuity: number;
};

type ActualState = {
  [key: string]: number;
};

type ExpenseGroupName =
  | "储蓄类"
  | "开销类"
  | "xx类"
  | "交养老保险类"
  | "其他类";

type ExpenseGroupAssignments = {
  [projectKey: string]: ExpenseGroupName;
};

type ExpenseOrderState = {
  [groupName: string]: string[];
};

type SupabaseActualState = {
  actualState: ActualState;
  expenseGroupAssignments: ExpenseGroupAssignments;
  expenseOrder: ExpenseOrderState;
};

const ACTUAL_TABLE = "cashflow_actual";
const ACTUAL_ROW_ID = "default";

const DEFAULT_EXPENSE_GROUPS: Array<{
  groupName: ExpenseGroupName;
  items: string[];
}> = [
  {
    groupName: "储蓄类",
    items: ["年金", "下月定投", "下月定存", "转去养老保险"],
  },
  {
    groupName: "开销类",
    items: ["房贷", "还信用卡+给妈", "还信用卡常规"],
  },
  {
    groupName: "xx类",
    items: ["xx红包", "xx法会"],
  },
  {
    groupName: "交养老保险类",
    items: ["本月交养老保险"],
  },
  {
    groupName: "其他类",
    items: [],
  },
];

const EXPENSE_GROUP_ORDER: ExpenseGroupName[] = [
  "储蓄类",
  "开销类",
  "xx类",
  "交养老保险类",
  "其他类",
];

function getDefaultGroupName(name: string): ExpenseGroupName {
  const normalized = normalizeName(name);

  for (const group of DEFAULT_EXPENSE_GROUPS) {
    if (
      group.items.some(
        (x) => normalizeName(x) === normalized
      )
    ) {
      return group.groupName;
    }
  }

  return "其他类";
}

function getExpenseSortKey(item: {
  role: Role;
  projectId: string;
  name: string;
}) {
  return `${item.role}::${item.projectId}::${normalizeName(item.name)}`;
}

function getGroupNameForItem(
  item: {
    role: Role;
    projectId: string;
    name: string;
  },
  assignments: ExpenseGroupAssignments
): ExpenseGroupName {
  const key = getExpenseSortKey(item);

  if (assignments[key]) {
    return assignments[key];
  }

  return getDefaultGroupName(item.name);
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "—";

  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return "—";

  const abs = Math.abs(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;

  return "0";
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function getActualKey(
  year: number,
  month: number,
  role: Role,
  projectId: string,
  name: string
) {
  return `${year}-${month}-${role}-${projectId}-${normalizeName(
    name
  )}`;
}

export default function CashflowActualPage() {
  const [years, setYears] = useState<YearData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [currentYear, setCurrentYear] = useState<number>(
    new Date().getFullYear()
  );

  const [currentMonth, setCurrentMonth] = useState<number>(
    new Date().getMonth() + 1
  );

  const [actualState, setActualState] = useState<ActualState>({});

  const [expenseGroupAssignments, setExpenseGroupAssignments] =
    useState<ExpenseGroupAssignments>({});

  const [expenseOrder, setExpenseOrder] =
    useState<ExpenseOrderState>({});

  const [saving, setSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const cloud = await loadCashflowPlanning();

        if (!mounted) return;

        if (
          !cloud.hasData ||
          !cloud.state ||
          !Array.isArray(cloud.state.years) ||
          cloud.state.years.length === 0
        ) {
          throw new Error(
            "Supabase 中没有 CASHFLOW-PLANNING 数据，请先完成一次初始化。"
          );
        }

        setYears(cloud.state.years as YearData[]);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "读取现金流规划数据失败"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadActual() {
      try {
        const { data, error } = await supabase
          .from(ACTUAL_TABLE)
          .select("state")
          .eq("id", ACTUAL_ROW_ID)
          .maybeSingle();

        if (error) {
          console.error(
            "[CASHFLOW-ACTUAL] 读取失败：",
            JSON.stringify(error, null, 2),
            error.message,
            error.details,
            error.hint,
            error.code
          );
          return;
        }

        if (!mounted) return;

        if (data?.state) {
          const state = data.state as SupabaseActualState;

          if (state.actualState) {
            setActualState(state.actualState);
          }

          if (state.expenseGroupAssignments) {
            setExpenseGroupAssignments(
              state.expenseGroupAssignments
            );
          }

          if (state.expenseOrder) {
            setExpenseOrder(state.expenseOrder);
          }
        }
      } catch (err) {
        console.error("[CASHFLOW-ACTUAL] 读取异常：", err);
      }
    }

    loadActual();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    const timer = window.setTimeout(async () => {
      try {
        setSaving(true);

        const state: SupabaseActualState = {
          actualState,
          expenseGroupAssignments,
          expenseOrder,
        };

        const { error } = await supabase
          .from(ACTUAL_TABLE)
          .upsert(
            {
              id: ACTUAL_ROW_ID,
              state,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );

        if (error) {
          console.error(
            "[CASHFLOW-ACTUAL] 保存失败：",
            JSON.stringify(error, null, 2),
            error.message,
            error.details,
            error.hint,
            error.code
          );
        }
      } catch (err) {
        console.error("[CASHFLOW-ACTUAL] 保存异常：", err);
      } finally {
        if (mounted) {
          setSaving(false);
        }
      }
    }, 700);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [actualState, expenseGroupAssignments, expenseOrder]);

  const targetYear = years.find((y) => y.year === currentYear);
  const targetMonth = targetYear?.months.find((m) => m.month === currentMonth);

  const incomeItems = targetMonth?.income.filter((x) => !x.deleted) || [];
  const expenseItems = targetMonth?.expense.filter((x) => !x.deleted) || [];

  function getActualWithDefault(
    year: number,
    month: number,
    role: Role,
    item: CellItem
  ) {
    const key = getActualKey(
      year,
      month,
      role,
      item.projectId,
      item.name
    );

    if (typeof actualState[key] === "number") {
      return actualState[key];
    }

    return item.value;
  }

  function handleExpenseDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (
      activeId.startsWith("expense-") &&
      overId.startsWith("group-")
    ) {
      const item = (active.data.current as any)?.item as CellItem;

      if (!item) return;

      const targetGroupName = overId.replace(
        "group-",
        ""
      ) as ExpenseGroupName;

      const key = getExpenseSortKey(item);

      setExpenseGroupAssignments((prev) => ({
        ...prev,
        [key]: targetGroupName,
      }));

      return;
    }

    if (
      activeId.startsWith("expense-") &&
      overId.startsWith("expense-")
    ) {
      const item = (active.data.current as any)?.item as CellItem;

      if (!item) return;

      const groupName = getGroupNameForItem(
        item,
        expenseGroupAssignments
      );

      const groupItems = expenseItems.filter(
        (x) =>
          getGroupNameForItem(
            x,
            expenseGroupAssignments
          ) === groupName
      );

      const currentOrder =
        expenseOrder[groupName] ??
        groupItems.map((x) => getExpenseSortKey(x));

      const activeKey = getExpenseSortKey(item);

      const overItem = groupItems.find(
        (x) => `expense-${x.id}` === overId
      );

      if (!overItem) return;

      const overKey = getExpenseSortKey(overItem);

      const oldIndex = currentOrder.indexOf(activeKey);
      const newIndex = currentOrder.indexOf(overKey);

      if (oldIndex < 0 || newIndex < 0) return;

      const next = arrayMove(currentOrder, oldIndex, newIndex);

      setExpenseOrder((prev) => ({
        ...prev,
        [groupName]: next,
      }));
    }
  }

  const yearSummary = useMemo(() => {
    const incomeMap = new Map<
      string,
      {
        name: string;
        planned: number;
        actual: number;
        diff: number;
      }
    >();

    const expenseMap = new Map<
      string,
      {
        name: string;
        planned: number;
        actual: number;
        diff: number;
        role: Role;
        projectId: string;
      }
    >();

    if (!targetYear) {
      return {
        incomeRows: [],
        expenseRows: [],
        totalIncomePlanned: 0,
        totalIncomeActual: 0,
        totalExpensePlanned: 0,
        totalExpenseActual: 0,
        totalExpenseWithoutMonthlyInvestPlanned: 0,
        totalExpenseWithoutMonthlyInvestActual: 0,
        netCashFlowPlanned: 0,
        netCashFlowActual: 0,
        creditCardMomActual: 0,
        creditCardMomPlanned: 0,
      };
    }

    for (const month of targetYear.months) {
      for (const item of month.income) {
        if (item.deleted) continue;

        const key = normalizeName(item.name);

        if (!incomeMap.has(key)) {
          incomeMap.set(key, {
            name: item.name,
            planned: 0,
            actual: 0,
            diff: 0,
          });
        }

        const row = incomeMap.get(key)!;

        row.planned += item.value;

        const actual = getActualWithDefault(
          currentYear,
          month.month,
          "income",
          item
        );

        row.actual += actual;
        row.diff = row.actual - row.planned;
      }

      for (const item of month.expense) {
        if (item.deleted) continue;

        const key = normalizeName(item.name);

        if (!expenseMap.has(key)) {
          expenseMap.set(key, {
            name: item.name,
            planned: 0,
            actual: 0,
            diff: 0,
            role: item.role,
            projectId: item.projectId,
          });
        }

        const row = expenseMap.get(key)!;

        row.planned += item.value;

        const actual = getActualWithDefault(
          currentYear,
          month.month,
          "expense",
          item
        );

        row.actual += actual;
        row.diff = row.actual - row.planned;
      }
    }

    const incomeRows = Array.from(incomeMap.values()).sort(
      (a, b) => b.planned - a.planned
    );

    const expenseRows = Array.from(expenseMap.values());

    const totalIncomePlanned = incomeRows.reduce(
      (s, x) => s + x.planned,
      0
    );

    const totalIncomeActual = incomeRows.reduce(
      (s, x) => s + x.actual,
      0
    );

    const totalExpensePlanned = expenseRows.reduce(
      (s, x) => s + x.planned,
      0
    );

    const totalExpenseActual = expenseRows.reduce(
      (s, x) => s + x.actual,
      0
    );

    const totalExpenseWithoutMonthlyInvestPlanned = expenseRows
      .filter(
        (x) => normalizeName(x.name) !== normalizeName("下月定投")
      )
      .reduce((s, x) => s + x.planned, 0);

    const totalExpenseWithoutMonthlyInvestActual = expenseRows
      .filter(
        (x) => normalizeName(x.name) !== normalizeName("下月定投")
      )
      .reduce((s, x) => s + x.actual, 0);

    const netCashFlowPlanned =
      totalIncomePlanned - totalExpensePlanned;

    const netCashFlowActual =
      totalIncomeActual - totalExpenseActual;

    const creditCardMomPlanned = expenseRows
      .filter(
        (x) =>
          normalizeName(x.name) === normalizeName("还信用卡+给妈")
      )
      .reduce((s, x) => s + x.planned, 0);

    const creditCardMomActual = expenseRows
      .filter(
        (x) =>
          normalizeName(x.name) === normalizeName("还信用卡+给妈")
      )
      .reduce((s, x) => s + x.actual, 0);

    return {
      incomeRows,
      expenseRows,
      totalIncomePlanned,
      totalIncomeActual,
      totalExpensePlanned,
      totalExpenseActual,
      totalExpenseWithoutMonthlyInvestPlanned,
      totalExpenseWithoutMonthlyInvestActual,
      netCashFlowPlanned,
      netCashFlowActual,
      creditCardMomActual,
      creditCardMomPlanned,
    };
  }, [targetYear, actualState, currentYear]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="text-sm text-gray-500">
          正在读取 CASHFLOW-PLANNING 数据……
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
          {error}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col justify-center bg-gray-50 text-gray-900">
      <div className="w-full px-6 py-4">
        {/* 头部 */}
        <div className="mb-2 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              CASHFLOW 实际
            </h1>
            <div className="mt-0.5 text-xs text-gray-500">
              只记录当前月的实际数字，自动和 CASHFLOW-PLANNING 对比
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={currentYear}
              onChange={(e) => setCurrentYear(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              {years.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year}
                </option>
              ))}
            </select>

            <select
              value={currentMonth}
              onChange={(e) => setCurrentMonth(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>

            <span className="text-xs text-gray-400">
              {saving ? "保存中…" : "已保存"}
            </span>
          </div>
        </div>

        {/* 左右两栏 */}
        <div className="grid gap-4 lg:grid-cols-[520px_560px] lg:justify-center lg:items-stretch">
          {/* 左栏：收入 + 支出 */}
          <div className="flex h-full flex-col gap-2.5">
            {/* 收入明细 */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-l-4 border-gray-200 border-l-rose-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                收入明细
              </div>

              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-500">
                    <th className="border-b border-gray-100 px-2 py-1.5 text-left font-medium">
                      项目
                    </th>
                    <th className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium w-24">
                      计划
                    </th>
                    <th className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium w-28">
                      实际
                    </th>
                    <th className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium w-24">
                      差额
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {incomeItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="border-b border-gray-100 px-2 py-1.5 text-center text-gray-400"
                      >
                        无收入项目
                      </td>
                    </tr>
                  ) : (
                    incomeItems.map((item) => {
                      const key = getActualKey(
                        currentYear,
                        currentMonth,
                        "income",
                        item.projectId,
                        item.name
                      );

                      const actual = getActualWithDefault(
                        currentYear,
                        currentMonth,
                        "income",
                        item
                      );

                      const diff = actual - item.value;

                      return (
                        <tr key={item.id} className="bg-white transition-colors hover:bg-gray-50/70">
                          <td className="border-b border-gray-100 px-2 py-1.5 text-gray-700">
                            {item.name}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums text-gray-600">
                            {formatMoney(item.value)}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums">
                            <input
                              value={actual}
                              onChange={(e) =>
                                setActualState((prev) => ({
                                  ...prev,
                                  [key]: Number(
                                    e.target.value.replace(/,/g, "")
                                  ) || 0,
                                }))
                              }
                              inputMode="decimal"
                              className="w-24 rounded-md border border-gray-200 bg-gray-50/60 px-2 py-0.5 text-right tabular-nums text-[13px] outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                            />
                          </td>
                          <td
                            className={`border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium ${
                              diff >= 0
                                ? "text-rose-600"
                                : "text-emerald-600"
                            }`}
                          >
                            {formatSigned(diff)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </section>

            {/* 支出明细 */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleExpenseDragEnd}
            >
              <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-l-4 border-gray-200 border-l-emerald-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                  支出明细
                </div>

                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-gray-50/80 text-gray-500">
                      <th className="border-b border-gray-100 px-1 py-1.5 w-6"></th>
                      <th className="border-b border-gray-100 px-2 py-1.5 text-left font-medium">
                        项目
                      </th>
                      <th className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium w-24">
                        计划
                      </th>
                      <th className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium w-28">
                        实际
                      </th>
                      <th className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium w-24">
                        差额
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {expenseItems.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="border-b border-gray-100 px-2 py-1.5 text-center text-gray-400"
                        >
                          无支出项目
                        </td>
                      </tr>
                    ) : (
                      (() => {
                        const rows: JSX.Element[] = [];

                        for (const groupName of EXPENSE_GROUP_ORDER) {
                          const groupItems = expenseItems.filter(
                            (item) =>
                              getGroupNameForItem(
                                item,
                                expenseGroupAssignments
                              ) === groupName
                          );

                          rows.push(
                            <DroppableGroupHeader
                              key={`group-${groupName}`}
                              groupName={groupName}
                            />
                          );

                          if (groupItems.length === 0) {
                            rows.push(
                              <tr key={`empty-${groupName}`}>
                                <td
                                  colSpan={5}
                                  className="border-b border-gray-100 px-2 py-1.5 pl-6 text-[13px] text-gray-400"
                                >
                                  暂无项目
                                </td>
                              </tr>
                            );
                            continue;
                          }

                          const orderKeys =
                            expenseOrder[groupName] ??
                            groupItems.map((x) => getExpenseSortKey(x));

                          const sortedItems = groupItems.slice().sort(
                            (a, b) => {
                              const ia = orderKeys.indexOf(
                                getExpenseSortKey(a)
                              );
                              const ib = orderKeys.indexOf(
                                getExpenseSortKey(b)
                              );

                              if (ia < 0 && ib < 0) return 0;
                              if (ia < 0) return 1;
                              if (ib < 0) return -1;

                              return ia - ib;
                            }
                          );

                          rows.push(
                            <SortableContext
                              key={`sort-${groupName}`}
                              items={sortedItems.map((x) => x.id)}
                              strategy={verticalListSortingStrategy}
                            >
                              {sortedItems.map((item) => {
                                const key = getActualKey(
                                  currentYear,
                                  currentMonth,
                                  "expense",
                                  item.projectId,
                                  item.name
                                );

                                const actual = getActualWithDefault(
                                  currentYear,
                                  currentMonth,
                                  "expense",
                                  item
                                );

                                const diff = actual - item.value;

                                return (
                                  <DraggableExpenseRow
                                    key={item.id}
                                    item={item}
                                  >
                                    <td className="border-b border-gray-100 px-2 py-1.5 pl-5 text-gray-700">
                                      {item.name}
                                    </td>
                                    <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums text-gray-600">
                                      {formatMoney(item.value)}
                                    </td>
                                    <td className="border-b border-gray-100 px-2 py-1.5 text-right tabular-nums">
                                      <input
                                        value={actual}
                                        onChange={(e) =>
                                          setActualState((prev) => ({
                                            ...prev,
                                            [key]: Number(
                                              e.target.value.replace(/,/g, "")
                                            ) || 0,
                                          }))
                                        }
                                        inputMode="decimal"
                                        className="w-24 rounded-md border border-gray-200 bg-gray-50/60 px-2 py-0.5 text-right tabular-nums text-[13px] outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
                                      />
                                    </td>
                                    <td
                                      className={`border-b border-gray-100 px-2 py-1.5 text-right tabular-nums font-medium ${
                                        diff >= 0
                                          ? "text-rose-600"
                                          : "text-emerald-600"
                                      }`}
                                    >
                                      {formatSigned(diff)}
                                    </td>
                                  </DraggableExpenseRow>
                                );
                              })}
                            </SortableContext>
                          );
                        }

                        return rows;
                      })()
                    )}
                  </tbody>
                </table>
              </section>
            </DndContext>
          </div>

          {/* 右栏：年度汇总 */}
          <div className="flex h-full flex-col gap-2.5">
            <section className="flex flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-l-4 border-gray-200 border-l-amber-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                {currentYear} 年收支明细统计
              </div>

              <div className="flex flex-1 flex-col">
                <div className="grid gap-2.5 p-2.5 md:grid-cols-3">
                  <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-1.5">
                    <div className="text-xs text-gray-500">
                      全年收入（实际 / 预估）
                    </div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-rose-600">
                      ¥{formatMoney(yearSummary.totalIncomeActual)}
                      <span className="ml-1 text-xs text-gray-500">
                        / ¥{formatMoney(yearSummary.totalIncomePlanned)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-1.5">
                    <div className="text-xs text-gray-500">
                      全年支出（实际 / 预估）
                    </div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-600">
                      ¥{formatMoney(yearSummary.totalExpenseActual)}
                      <span className="ml-1 text-xs text-gray-500">
                        / ¥{formatMoney(yearSummary.totalExpensePlanned)}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-1.5">
                    <div className="text-xs text-gray-500">
                      净现金流（实际 / 预估）
                    </div>
                    <div
                      className={`mt-0.5 text-sm font-semibold tabular-nums ${
                        yearSummary.netCashFlowActual >= 0
                          ? "text-rose-600"
                          : "text-emerald-600"
                      }`}
                    >
                      ¥{formatSigned(yearSummary.netCashFlowActual)}
                      <span className="ml-1 text-xs text-gray-500">
                        / ¥{formatSigned(yearSummary.netCashFlowPlanned)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2.5 px-2.5 pb-2.5 md:grid-cols-2">
                  <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-1.5">
                    <div className="text-xs text-gray-500">
                      支出合计(不算下月定投)（实际 / 预估）
                    </div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-emerald-600">
                      ¥
                      {formatMoney(
                        yearSummary.totalExpenseWithoutMonthlyInvestActual
                      )}
                      <span className="ml-1 text-xs text-gray-500">
                        / ¥
                        {formatMoney(
                          yearSummary.totalExpenseWithoutMonthlyInvestPlanned
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-1.5">
                    <div className="text-xs text-gray-500">
                      还信用卡+给妈（实际 / 预估）
                    </div>
                    <div className="mt-0.5 text-sm font-semibold tabular-nums text-rose-600">
                      ¥{formatMoney(yearSummary.creditCardMomActual)}
                      <span className="ml-1 text-xs text-gray-500">
                        / ¥{formatMoney(yearSummary.creditCardMomPlanned)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-1 flex-col gap-2.5 px-2.5 pb-2.5">
                  {/* 年度收入明细 */}
                  <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800">
                      收入明细
                    </div>

                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50/80 text-gray-500">
                          <th className="border-b border-gray-100 px-2 py-[5px] text-left font-medium">
                            项目
                          </th>
                          <th className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums font-medium w-24">
                            今年累计实际
                          </th>
                          <th className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums font-medium w-24">
                            今年预估
                          </th>
                          <th className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums font-medium w-20">
                            差额
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {yearSummary.incomeRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="border-b border-gray-100 px-2 py-[5px] text-center text-gray-400"
                            >
                              无收入项目
                            </td>
                          </tr>
                        ) : (
                          yearSummary.incomeRows.map((row) => (
                            <tr key={row.name} className="bg-white transition-colors hover:bg-gray-50/70">
                              <td className="border-b border-gray-100 px-2 py-[5px] text-gray-700">
                                {row.name}
                              </td>
                              <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-rose-600">
                                {formatMoney(row.actual)}
                              </td>
                              <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-gray-600">
                                {formatMoney(row.planned)}
                              </td>
                              <td
                                className={`border-b border-gray-100 px-2 py-[5px] text-right tabular-nums font-medium ${
                                  row.diff >= 0
                                    ? "text-rose-600"
                                    : "text-emerald-600"
                                }`}
                              >
                                {formatSigned(row.diff)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>

                      <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                          <td className="border-b border-gray-100 px-2 py-[5px] text-gray-800">
                            收入合计
                          </td>
                          <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-rose-600">
                            {formatMoney(yearSummary.totalIncomeActual)}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-gray-700">
                            {formatMoney(yearSummary.totalIncomePlanned)}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-gray-700">
                            {formatSigned(
                              yearSummary.totalIncomeActual -
                                yearSummary.totalIncomePlanned
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* 年度支出明细 */}
                  <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
                    <div className="border-b border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-800">
                      支出明细
                    </div>

                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className="bg-gray-50/80 text-gray-500">
                          <th className="border-b border-gray-100 px-2 py-[5px] text-left font-medium">
                            项目
                          </th>
                          <th className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums font-medium w-24">
                            今年累计实际
                          </th>
                          <th className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums font-medium w-24">
                            今年预估
                          </th>
                          <th className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums font-medium w-20">
                            差额
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {yearSummary.expenseRows.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="border-b border-gray-100 px-2 py-[5px] text-center text-gray-400"
                            >
                              无支出项目
                            </td>
                          </tr>
                        ) : (
                          (() => {
                            const rows: JSX.Element[] = [];

                            for (const groupName of EXPENSE_GROUP_ORDER) {
                              const groupRows =
                                yearSummary.expenseRows.filter(
                                  (row) =>
                                    getGroupNameForItem(
                                      {
                                        role: row.role,
                                        projectId: row.projectId,
                                        name: row.name,
                                      },
                                      expenseGroupAssignments
                                    ) === groupName
                                );

                              rows.push(
                                <tr key={`year-group-${groupName}`}>
                                  <td
                                    colSpan={4}
                                    className="border-b border-amber-100 bg-amber-50/70 px-3 py-1.5 text-xs font-semibold text-amber-700"
                                  >
                                    {groupName}
                                  </td>
                                </tr>
                              );

                              if (groupRows.length === 0) {
                                continue;
                              }

                              const orderKeys =
                                expenseOrder[groupName] ??
                                groupRows.map((x) =>
                                  getExpenseSortKey({
                                    role: x.role,
                                    projectId: x.projectId,
                                    name: x.name,
                                  })
                                );

                              const sortedGroupRows = groupRows
                                .slice()
                                .sort((a, b) => {
                                  const ia = orderKeys.indexOf(
                                    getExpenseSortKey({
                                      role: a.role,
                                      projectId: a.projectId,
                                      name: a.name,
                                    })
                                  );
                                  const ib = orderKeys.indexOf(
                                    getExpenseSortKey({
                                      role: b.role,
                                      projectId: b.projectId,
                                      name: b.name,
                                    })
                                  );

                                  if (ia < 0 && ib < 0) return 0;
                                  if (ia < 0) return 1;
                                  if (ib < 0) return -1;

                                  return ia - ib;
                                });

                              for (const row of sortedGroupRows) {
                                rows.push(
                                  <tr key={row.name} className="bg-white transition-colors hover:bg-gray-50/70">
                                    <td className="border-b border-gray-100 px-2 py-[5px] pl-5 text-gray-700">
                                      {row.name}
                                    </td>
                                    <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-rose-600">
                                      {formatMoney(row.actual)}
                                    </td>
                                    <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-gray-600">
                                      {formatMoney(row.planned)}
                                    </td>
                                    <td
                                      className={`border-b border-gray-100 px-2 py-[5px] text-right tabular-nums font-medium ${
                                        row.diff >= 0
                                          ? "text-emerald-600"
                                          : "text-rose-600"
                                      }`}
                                    >
                                      {formatSigned(row.diff)}
                                    </td>
                                  </tr>
                                );
                              }
                            }

                            return rows;
                          })()
                        )}
                      </tbody>

                      <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                          <td className="border-b border-gray-100 px-2 py-[5px] text-gray-800">
                            支出合计
                          </td>
                          <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-rose-600">
                            {formatMoney(yearSummary.totalExpenseActual)}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-gray-700">
                            {formatMoney(yearSummary.totalExpensePlanned)}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-gray-700">
                            {formatSigned(
                              yearSummary.totalExpenseActual -
                                yearSummary.totalExpensePlanned
                            )}
                          </td>
                        </tr>

                        <tr className="bg-gray-50 font-semibold">
                          <td className="border-b border-gray-100 px-2 py-[5px] text-gray-800">
                            支出合计(不算下月定投)
                          </td>
                          <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-rose-600">
                            {formatMoney(
                              yearSummary.totalExpenseWithoutMonthlyInvestActual
                            )}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-gray-700">
                            {formatMoney(
                              yearSummary.totalExpenseWithoutMonthlyInvestPlanned
                            )}
                          </td>
                          <td className="border-b border-gray-100 px-2 py-[5px] text-right tabular-nums text-gray-700">
                            {formatSigned(
                              yearSummary.totalExpenseWithoutMonthlyInvestActual -
                                yearSummary.totalExpenseWithoutMonthlyInvestPlanned
                            )}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

// ============================================================
// Sortable / Draggable Expense Row
// ============================================================

function DraggableExpenseRow({
  item,
  children,
}: {
  item: CellItem;
  children: React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: `expense-${item.id}`,
    data: { item },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={isDragging ? "bg-amber-50" : "bg-white"}
    >
      <td
        {...attributes}
        {...listeners}
        className="cursor-grab border-b border-gray-100 px-1 py-1.5 text-center text-gray-300 hover:text-gray-500"
        title="拖动换类别或调顺序"
      >
        ⋮⋮
      </td>
      {children}
    </tr>
  );
}

// ============================================================
// Droppable Group Header
// ============================================================

function DroppableGroupHeader({
  groupName,
}: {
  groupName: ExpenseGroupName;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `group-${groupName}`,
  });

  return (
    <tr ref={setNodeRef}>
      <td
        colSpan={5}
        className={`border-b border-gray-100 px-3 py-1.5 text-[13px] font-semibold ${
          isOver
            ? "bg-amber-200 text-amber-900"
            : "bg-amber-50/70 text-amber-700"
        }`}
      >
        {groupName}
      </td>
    </tr>
  );
}