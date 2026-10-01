"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  loadCashflowPlanning,
  saveCashflowPlanning,
  clearCashflowPlanning,
  type CashflowState,
} from "@/lib/cashflow-planning";

import {
  getLoans,
} from "@/lib/loan";

import {
  calculateRemainingPeriods,
} from "@/lib/loan-calculations";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";

import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";

import { CSS } from "@dnd-kit/utilities";

// ============================================================
// AI Wealth OS
// CASHFLOW-PLANNING
//
// 功能：
// 1. 收入 / 支出分开
// 2. 新增项目 → 同步全部年月
// 3. 改名 → 同项目全部年月同步
// 4. 删除 → 同项目全部年月删除
// 5. 独立 → 当前年月脱离联动
// 6. 金额 → 每个月独立填写
// 7. AI 分析数据导出
// 8. 还信用卡常规 → 自动读取 /loan 里的信用卡分期
//
// 重要：
// years 不再手写汇总，全部由 months 实时重算。
// ============================================================

const TARGET_START_YEAR = 2026;

const TARGET_END_YEAR = 2042;

// ============================================================
// 还信用卡常规
// ============================================================

const CREDIT_CARD_REGULAR_PROJECT_ID =
  "shared:expense:还信用卡常规";

// ============================================================
// 类型
// ============================================================

type Role = "income" | "expense";

type Project = {
  projectId: string;
  role: Role;
  name: string;
  custom: boolean;
  sourceOffset?: number;
  isAnnuityContribution?: boolean;
  isPensionPayment?: boolean;
};

type CellItem = {
  id: string;

  year: number;
  month: number;

  role: Role;

  projectId: string;

  name: string;

  value: number;

  independent: boolean;

  fromExcel: boolean;

  sourceRow?: number;
  sourceCol?: number;
  sourceOffset?: number;

  isAnnuityContribution?: boolean;
  isPensionPayment?: boolean;

  deleted?: boolean;
};

type MonthData = {
  year: number;
  month: number;
  income: CellItem[];
  expense: CellItem[];

  manualRemaining?: number;
  manualTotalCash?: number;
  manualAnnuity?: number;
};

type YearData = {
  year: number;
  months: MonthData[];

  originalOpeningCash: number;
  originalOpeningAnnuity: number;
};

type CalculationMonth = {
  income: number;
  expense: number;
  remaining: number;
  totalCash: number;
  annuity: number;
};

type YearCalculation = {
  year: number;
  months: CalculationMonth[];
  endingCash: number;
  endingAnnuity: number;
};

// ============================================================
// 工具
// ============================================================

function uid(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function projectUid(role: Role) {
  return `${role}_${Date.now()}_${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function numberValue(value: unknown): number {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  if (typeof value === "string") {
    const cleaned = value
      .replace(/,/g, "")
      .replace(/¥/g, "")
      .replace(/\$/g, "")
      .replace(/\s/g, "")
      .trim();

    if (
      !cleaned ||
      cleaned === "#REF!" ||
      cleaned === "#VALUE!"
    ) {
      return 0;
    }

    const n = Number(cleaned);

    return Number.isFinite(n) ? n : 0;
  }

  return 0;
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function formatSigned(value: number) {
  if (!Number.isFinite(value)) {
    return "—";
  }

  const abs = Math.abs(value).toLocaleString(
    "zh-CN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }
  );

  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;

  return "0";
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function isValidName(name: string) {
  return normalizeName(name).length > 0;
}

// ============================================================
// 判断是不是「还信用卡常规」
// ============================================================

function isCreditCardRegular(
  item: Pick<CellItem, "projectId" | "name">
) {
  if (
    item.projectId ===
    CREDIT_CARD_REGULAR_PROJECT_ID
  ) {
    return true;
  }

  return (
    normalizeName(item.name) ===
    "还信用卡常规"
  );
}

// ============================================================
// 取「还信用卡常规」动态金额
// ============================================================

function getCreditCardRegularAmount(
  creditCardMonthlyMap: Map<string, number>,
  year: number,
  month: number
) {
  const key = `${year}-${String(month).padStart(
    2,
    "0"
  )}`;

  return creditCardMonthlyMap.get(key) || 0;
}

// ============================================================
// 计算某个支出项目的实际金额
// ============================================================

function getExpenseItemAmount(
  item: CellItem,
  creditCardMonthlyMap: Map<string, number>
) {
  if (isCreditCardRegular(item)) {
    return getCreditCardRegularAmount(
      creditCardMonthlyMap,
      item.year,
      item.month
    );
  }

  return item.value;
}

// ============================================================
// 信用卡分期每月应还合计
// ============================================================

async function getCreditCardMonthlyMap() {
  const loans = await getLoans();

  const map = new Map<string, number>();

  const today = new Date();

  for (const loan of loans || []) {
    if (loan.type !== "信用卡分期") {
      continue;
    }

    const monthly = Number(
      loan.monthly_payment || 0
    );

    if (monthly <= 0) {
      continue;
    }

    let periods = 0;

    let startDate: Date | null = null;

    if (loan.start_date) {
      startDate = new Date(loan.start_date);
    }

    if (loan.end_date) {
      const end = new Date(loan.end_date);

      const start = startDate || today;

      periods =
        (end.getFullYear() -
          start.getFullYear()) *
          12 +
        (end.getMonth() -
          start.getMonth()) +
        1;
    } else {
      periods =
        calculateRemainingPeriods(loan);

      startDate = today;
    }

    if (!startDate || periods <= 0) {
      continue;
    }

    for (let i = 0; i < periods; i++) {
      const d = new Date(startDate);

      d.setMonth(d.getMonth() + i);

      const key = `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`;

      map.set(
        key,
        (map.get(key) || 0) + monthly
      );
    }
  }

  return map;
}

// ============================================================
// 项目
// ============================================================

function getProjectById(
  projects: Project[],
  projectId: string
) {
  return projects.find(
    (p) =>
      p.projectId === projectId
  );
}

function findSharedProject(
  projects: Project[],
  role: Role,
  name: string
) {
  const normalized =
    normalizeName(name);

  return projects.find(
    (p) =>
      p.role === role &&
      normalizeName(p.name) ===
        normalized
  );
}

// ============================================================
// 新增全局项目
// ============================================================

function addGlobalProject(
  years: YearData[],
  projects: Project[],
  role: Role,
  name: string
) {
  const cleanName =
    name.trim();

  if (!isValidName(cleanName)) {
    return {
      years,
      projects,
    };
  }

  let project =
    findSharedProject(
      projects,
      role,
      cleanName
    );

  if (!project) {
    project = {
      projectId:
        projectUid(role),

      role,

      name: cleanName,

      custom: true,

      isAnnuityContribution:
        false,
    };

    projects.push(project);
  }

  for (const year of years) {
    for (const month of year.months) {
      const list =
        role === "income"
          ? month.income
          : month.expense;

      const exists =
        list.some(
          (item) =>
            item.projectId ===
              project!.projectId &&
            !item.deleted
        );

      if (!exists) {
        list.push({
          id: uid("cell"),

          year: year.year,

          month: month.month,

          role,

          projectId:
            project!.projectId,

          name:
            project!.name,

          value: 0,

          independent: false,

          fromExcel: false,

          isAnnuityContribution:
            false,
        });
      }
    }
  }

  return {
    years,
    projects,
  };
}

// ============================================================
// 单月新增项目
// ============================================================

function addMonthlyProject(
  years: YearData[],
  yearValue: number,
  monthValue: number,
  role: Role,
  name: string,
  value = 0
) {
  const cleanName = name.trim();

  if (!isValidName(cleanName)) {
    return years;
  }

  const normalizedName =
    normalizeName(cleanName);

  const isSAL =
    role === "income" &&
    normalizedName === "sal";

  const isTransferToPension =
    role === "expense" &&
    normalizedName === "转去养老保险";

  for (const year of years) {
    if (year.year !== yearValue) {
      continue;
    }

    for (const month of year.months) {
      if (month.month !== monthValue) {
        continue;
      }

      const list =
        role === "income"
          ? month.income
          : month.expense;

      if (
        isSAL ||
        isTransferToPension
      ) {
        const matches =
          list.filter(
            (item) =>
              !item.deleted &&
              item.role === role &&
              normalizeName(item.name) ===
                normalizedName
          );

        if (matches.length > 0) {
          const target =
            matches[0];

          target.name =
            cleanName;

          target.value =
            Number.isFinite(value)
              ? value
              : 0;

          target.deleted =
            false;

          if (isTransferToPension) {
            target.isAnnuityContribution =
              true;
          }

          for (
            const duplicate of matches.slice(1)
          ) {
            const index =
              list.indexOf(
                duplicate
              );

            if (index >= 0) {
              list.splice(
                index,
                1
              );
            }
          }
        } else {
          list.push({
            id: uid("cell"),

            year:
              yearValue,

            month:
              monthValue,

            role,

            projectId:
              projectUid(role),

            name:
              cleanName,

            value:
              Number.isFinite(value)
                ? value
                : 0,

            independent:
              true,

            fromExcel:
              false,

            isAnnuityContribution:
              isTransferToPension,
          });
        }
      } else {
        list.push({
          id: uid("cell"),

          year:
            yearValue,

          month:
            monthValue,

          role,

          projectId:
            projectUid(role),

          name:
            cleanName,

          value:
            Number.isFinite(value)
              ? value
              : 0,

          independent:
            true,

          fromExcel:
            false,

          isAnnuityContribution:
            false,
        });
      }
    }
  }

  if (isTransferToPension) {
    for (const year of years) {
      for (const month of year.months) {
        const isAfterOrEqual =
          year.year > yearValue ||
          (
            year.year === yearValue &&
            month.month >= monthValue
          );

        if (isAfterOrEqual) {
          delete month.manualAnnuity;
        }
      }
    }
  }

  return years;
}

// ============================================================
// 删除
// ============================================================

function deleteProject(
  years: YearData[],
  projects: Project[],
  item: CellItem
) {
  if (item.independent) {
    for (const year of years) {
      for (const month of year.months) {
        if (
          year.year !== item.year ||
          month.month !== item.month
        ) {
          continue;
        }

        const list =
          item.role === "income"
            ? month.income
            : month.expense;

        const target = list.find(
          (x) => x.id === item.id
        );

        if (target) {
          target.deleted = true;
        }
      }
    }

    return {
      years,
      projects,
    };
  }

  const normalized =
    normalizeName(item.name);

  for (const year of years) {
    for (const month of year.months) {
      for (const x of [
        ...month.income,
        ...month.expense,
      ]) {
        if (
          x.role === item.role &&
          normalizeName(x.name) === normalized
        ) {
          x.deleted = true;
        }
      }
    }
  }

  return {
    years,
    projects: projects.filter(
      (p) =>
        !(
          p.role === item.role &&
          normalizeName(p.name) === normalized
        )
    ),
  };
}

// ============================================================
// 独立
// ============================================================

function toggleIndependent(
  years: YearData[],
  projects: Project[],
  item: CellItem
) {
  if (!item.independent) {
    const newProjectId =
      projectUid(item.role);

    projects.push({
      projectId:
        newProjectId,

      role: item.role,

      name: item.name,

      custom: true,

      sourceOffset:
        item.sourceOffset,

      isAnnuityContribution:
        item.isAnnuityContribution,
    });

    for (const year of years) {
      for (const month of year.months) {
        for (const x of [
          ...month.income,
          ...month.expense,
        ]) {
          if (
            x.id === item.id
          ) {
            x.projectId =
              newProjectId;

            x.independent =
              true;
          }
        }
      }
    }

    return {
      years,
      projects,
    };
  }

  let targetProject =
    findSharedProject(
      projects,
      item.role,
      item.name
    );

  if (!targetProject) {
    targetProject = {
      projectId:
        projectUid(
          item.role
        ),

      role: item.role,

      name: item.name,

      custom: true,

      isAnnuityContribution:
        item.isAnnuityContribution,
    };

    projects.push(
      targetProject
    );
  }

  for (const year of years) {
    for (const month of year.months) {
      for (const x of [
        ...month.income,
        ...month.expense,
      ]) {
        if (
          x.id === item.id
        ) {
          x.projectId =
            targetProject!.projectId;

          x.independent =
            false;
        }
      }
    }
  }

  return {
    years,
    projects,
  };
}

// ============================================================
// 改名
// ============================================================

function renameItem(
  years: YearData[],
  projects: Project[],
  item: CellItem,
  newName: string
) {
  const cleanName =
    newName.trim();

  if (!isValidName(cleanName)) {
    return {
      years,
      projects,
    };
  }

  if (item.independent) {
    for (const year of years) {
      for (const month of year.months) {
        for (const x of [
          ...month.income,
          ...month.expense,
        ]) {
          if (
            x.id === item.id
          ) {
            x.name =
              cleanName;
          }
        }
      }
    }

    const project =
      getProjectById(
        projects,
        item.projectId
      );

    if (project) {
      project.name =
        cleanName;
    }

    return {
      years,
      projects,
    };
  }

  const project =
    getProjectById(
      projects,
      item.projectId
    );

  if (project) {
    project.name =
      cleanName;
  }

  for (const year of years) {
    for (const month of year.months) {
      for (const x of [
        ...month.income,
        ...month.expense,
      ]) {
        if (
          x.projectId ===
            item.projectId &&
          !x.independent
        ) {
          x.name =
            cleanName;
        }
      }
    }
  }

  return {
    years,
    projects,
  };
}

// ============================================================
// 金额
// ============================================================

function updateItemValue(
  years: YearData[],
  item: CellItem,
  value: number,
  propagate = true
) {
  const safeValue =
    Number.isFinite(value)
      ? value
      : 0;

  const shouldPropagate =
    propagate &&
    item.isPensionPayment !== true;

  const shouldResetAnnuity =
    item.role === "expense" &&
    (
      item.isAnnuityContribution === true ||
      item.isPensionPayment === true
    );

  for (const year of years) {
    for (const month of year.months) {
      const isAfterOrEqual =
        year.year > item.year ||
        (
          year.year === item.year &&
          month.month >= item.month
        );

      for (const x of [
        ...month.income,
        ...month.expense,
      ]) {
        const sameProject =
          x.projectId === item.projectId &&
          x.role === item.role;

        const shouldUpdate =
          x.id === item.id ||
          (
            shouldPropagate &&
            sameProject &&
            isAfterOrEqual
          );

        if (shouldUpdate) {
          x.value = safeValue;
        }
      }

      if (
        isAfterOrEqual &&
        (
          item.role === "income" ||
          item.role === "expense"
        ) &&
        item.isPensionPayment !== true
      ) {
        delete month.manualRemaining;
        delete month.manualTotalCash;
      }

      if (
        shouldResetAnnuity &&
        isAfterOrEqual
      ) {
        delete month.manualAnnuity;
      }
    }
  }
}

// ============================================================
// 固定养老保险缴费
// ============================================================

function getPensionPayment(
  year: number,
  month: number
): number {
  if (year === 2026) {
    if (month === 10) return 221000;
    return 0;
  }

  if (year === 2027) {
    if (month === 7) return 503000;
    if (month === 10) return 221000;
    return 0;
  }

  if (year >= 2028 && year <= 2032) {
    if (month === 7) return 393000;
    if (month === 10) return 221000;
    return 0;
  }

  if (year === 2033) {
    if (month === 7) return 130000;
    if (month === 10) return 221000;
    return 0;
  }

  if (year >= 2034 && year <= 2037) {
    if (month === 7) return 130000;
    if (month === 10) return 129000;
    return 0;
  }

  if (year === 2038) {
    if (month === 10) return 129000;
    return 0;
  }

  if (year >= 2039 && year <= 2042) {
    if (month === 10) return 39000;
    return 0;
  }

  return 0;
}

function ensurePensionPaymentItems(
  years: YearData[],
  projects: Project[],
  preserveExistingValues = true
) {
  const nextYears = clone(years);
  const nextProjects = clone(projects);

  const projectId = "fixed:pension-payment";

  let project =
    nextProjects.find(
      (item) =>
        item.projectId === projectId
    );

  if (!project) {
    project = {
      projectId,
      role: "expense",
      name: "本月交养老保险",
      custom: false,
      isPensionPayment: true,
      isAnnuityContribution: false,
    };

    nextProjects.push(project);
  } else {
    project.role = "expense";
    project.name = "本月交养老保险";
    project.isPensionPayment = true;
    project.isAnnuityContribution = false;
  }

  for (const year of nextYears) {
    for (const month of year.months) {
      const amount = getPensionPayment(
        year.year,
        month.month
      );

      const existingIndex =
        month.expense.findIndex(
          (item) =>
            item.projectId ===
              projectId ||
            (
              item.role === "expense" &&
              item.isPensionPayment === true
            )
        );

      if (amount > 0) {
        const item =
          existingIndex >= 0
            ? month.expense[existingIndex]
            : null;

        if (item) {
          item.projectId = projectId;
          item.name = "本月交养老保险";
          item.role = "expense";

          if (!preserveExistingValues) {
            item.value = amount;
          }

          item.independent = false;
          item.fromExcel = false;
          item.isPensionPayment = true;
          item.isAnnuityContribution = false;
          item.deleted = false;
        } else {
          month.expense.push({
            id: `pension-${year.year}-${month.month}`,
            year: year.year,
            month: month.month,
            role: "expense",
            projectId,
            name: "本月交养老保险",
            value: amount,
            independent: false,
            fromExcel: false,
            isPensionPayment: true,
            isAnnuityContribution: false,
          });
        }
      } else {
        if (existingIndex >= 0) {
          month.expense.splice(
            existingIndex,
            1
          );
        }
      }
    }
  }

  return {
    years: nextYears,
    projects: nextProjects,
  };
}

// ============================================================
// 计算
// ============================================================

function calculateYears(
  years: YearData[],
  creditCardMonthlyMap: Map<string, number>
): YearCalculation[] {
  const sorted =
    [...years].sort(
      (a, b) =>
        a.year - b.year
    );

  const results: YearCalculation[] =
    [];

  let previousCash:
    | number
    | null = null;

  let previousAnnuity:
    | number
    | null = null;

  for (const year of sorted) {
    const months: CalculationMonth[] =
      [];

    let runningCash: number =
      previousCash ??
      year.originalOpeningCash;

    let runningAnnuity: number =
      previousAnnuity ??
      year.originalOpeningAnnuity;

    for (const month of year.months) {
      const income =
        month.income.reduce(
          (sum, item) =>
            sum +
            (item.deleted
              ? 0
              : item.value),
          0
        );

      const expense =
        month.expense
          .filter(
            (item) =>
              !item.deleted &&
              !item.isPensionPayment
          )
          .reduce(
            (sum, item) =>
              sum +
              getExpenseItemAmount(
                item,
                creditCardMonthlyMap
              ),
            0
          );

      const calculatedRemaining =
        income - expense;

      const remaining =
        Number.isFinite(month.manualRemaining)
          ? month.manualRemaining!
          : calculatedRemaining;

      const calculatedTotalCash =
        runningCash + remaining;

      const totalCash =
        Number.isFinite(month.manualTotalCash)
          ? month.manualTotalCash!
          : calculatedTotalCash;

      runningCash = totalCash;

      const annuityContribution =
        month.expense
          .filter(
            (item) =>
              item.isAnnuityContribution &&
              !item.deleted
          )
          .reduce(
            (sum, item) =>
              sum + item.value,
            0
          );

      const pensionPayment =
        month.expense
          .filter(
            (item) =>
              item.isPensionPayment &&
              !item.deleted
          )
          .reduce(
            (sum, item) =>
              sum + item.value,
            0
          );

      const calculatedAnnuity =
        runningAnnuity +
        annuityContribution -
        pensionPayment;

      const annuity =
        Number.isFinite(month.manualAnnuity)
          ? month.manualAnnuity!
          : calculatedAnnuity;

      runningAnnuity = annuity;

      months.push({
        income,
        expense,
        remaining,
        totalCash,
        annuity,
      });
    }

    const endingCash: number =
      months.length > 0
        ? months[
            months.length - 1
          ].totalCash
        : runningCash;

    const endingAnnuity: number =
      months.length > 0
        ? months[
            months.length - 1
          ].annuity
        : runningAnnuity;

    results.push({
      year: year.year,

      months,

      endingCash,

      endingAnnuity,
    });

    previousCash =
      endingCash;

    previousAnnuity =
      endingAnnuity;
  }

  return results;
}

// ============================================================
// 年度汇总（和 months 对齐）
// ============================================================

function buildYearSummary(
  years: YearData[],
  calculations: YearCalculation[],
  creditCardMonthlyMap: Map<string, number>
) {
  return years
    .map((year) => {
      const calc =
        calculations.find(
          (x) =>
            x.year === year.year
        );

      let totalIncome = 0;
      let totalExpense = 0;

      for (const month of year.months) {
        for (const item of month.income) {
          if (item.deleted) continue;
          totalIncome += item.value;
        }

        for (const item of month.expense) {
          if (item.deleted) continue;
          if (item.isPensionPayment) continue;

          totalExpense +=
            getExpenseItemAmount(
              item,
              creditCardMonthlyMap
            );
        }
      }

      return {
        year: year.year,

        totalIncome,

        totalExpense,

        netCashFlow:
          totalIncome - totalExpense,

        endingCash:
          calc?.endingCash ?? 0,

        endingAnnuity:
          calc?.endingAnnuity ?? 0,
      };
    })
    .sort((a, b) => a.year - b.year);
}

// ============================================================
// AI 数据生成
// ============================================================

function buildAIExport(
  years: YearData[],
  calculations: YearCalculation[],
  creditCardMonthlyMap: Map<string, number>
) {
  const yearSummary =
    buildYearSummary(
      years,
      calculations,
      creditCardMonthlyMap
    );

  const monthData =
    years.flatMap(
      (year) =>
        year.months.map(
          (month) => {
            const calc =
              calculations
                .find(
                  (x) =>
                    x.year ===
                    year.year
                )
                ?.months.find(
                  (_, index) =>
                    year.months[
                      index
                    ]?.month ===
                    month.month
                );

            return {
              year:
                year.year,

              month:
                month.month,

              income:
                month.income
                  .filter(
                    (x) =>
                      !x.deleted
                  )
                  .map(
                    (x) => ({
                      name:
                        x.name,

                      amount:
                        x.value,

                      independent:
                        x.independent,

                      projectId:
                        x.projectId,
                    })
                  ),

              expense:
                month.expense
                  .filter(
                    (x) =>
                      !x.deleted
                  )
                  .map(
                    (x) => ({
                      name:
                        x.name,

                      amount:
                        getExpenseItemAmount(
                          x,
                          creditCardMonthlyMap
                        ),

                      independent:
                        x.independent,

                      projectId:
                        x.projectId,

                      isAnnuityContribution:
                        !!x.isAnnuityContribution,
                    })
                  ),

              calculated: {
                income:
                  calc?.income ??
                  0,

                expense:
                  calc?.expense ??
                  0,

                remaining:
                  calc?.remaining ??
                  0,

                totalCash:
                  calc?.totalCash ??
                  0,

                annuity:
                  calc?.annuity ??
                  0,
              },
            };
          }
        )
    );

  const projectSummary =
    Array.from(
      new Map(
        years
          .flatMap(
            (year) =>
              year.months
          )
          .flatMap(
            (month) => [
              ...month.income,
              ...month.expense,
            ]
          )
          .filter(
            (item) =>
              !item.deleted
          )
          .map((item) => [
            `${item.role}::${item.projectId}`,
            {
              projectId:
                item.projectId,

              role:
                item.role,

              name:
                item.name,

              independent:
                item.independent,
            },
          ])
      ).values()
    );

  return {
    meta: {
      system:
        "AI Wealth OS",

      module:
        "CASHFLOW-PLANNING",

      exportTime:
        new Date().toISOString(),

      description:
        "家庭资金计划完整现金流数据",

      rules: {
        newProjectSync:
          "新增项目同步所有年份所有月份",

        rename:
          "共享项目改名同步全部年月",

        delete:
          "共享项目删除同步全部年月",

        independent:
          "独立项目只影响当前年月",

        amount:
          "金额每个月独立填写",

        creditCardRegular:
          "还信用卡常规自动读取 /loan 里的信用卡分期",

        negativeBalanceInterest:
          false,
      },
    },

    years:
      yearSummary,

    projects:
      projectSummary,

    months:
      monthData,
  };
}

function buildAIPrompt(
  years: YearData[],
  calculations: YearCalculation[],
  creditCardMonthlyMap: Map<string, number>
) {
  const data =
    buildAIExport(
      years,
      calculations,
      creditCardMonthlyMap
    );

  return `你现在是我的家庭财务 CFO。

下面是 AI Wealth OS 的 CASHFLOW-PLANNING 完整数据。

请不要修改原始数据，也不要自行假设不存在的数据。

请从以下几个方面分析：

1. 整体现金流
   - 每年的收入
   - 每年的支出
   - 每年的净现金流
   - 哪些年份压力最大

2. 月度现金流
   - 哪些月份现金流明显偏弱
   - 是否存在现金余额快速下降的月份
   - 是否存在潜在现金流断裂

3. 支出结构
   - 哪些支出项目占比最大
   - 哪些支出增长最快
   - 哪些项目属于固定支出
   - 哪些项目值得优化

4. 年金
   - 积累年金增长速度
   - 哪些年份增长最快
   - 是否存在明显的大额转入/转出
   - 这些变化对现金流有什么影响

5. 财务安全
   - 哪些年份最危险
   - 哪些年份现金最充裕
   - 是否应该提前准备现金缓冲
   - 是否存在资金安排过于集中的问题

6. 给我具体建议
   - 最重要的 3~5 个问题
   - 最值得调整的 3~5 个项目
   - 如果不调整，未来可能发生什么
   - 如果调整，建议怎么调整

7. 最后给一个结论：
   - 当前家庭资金计划：健康 / 基本健康 / 有压力 / 需要调整
   - 最需要关注的年份
   - 最需要关注的项目
   - 最重要的一项行动

请尽量使用数字说明，不要只给泛泛的理财建议。

==============================
以下是原始结构化数据
==============================

${JSON.stringify(
  data,
  null,
  2
)}
`;
}

// ============================================================
// Year Summary Table
// ============================================================

type ExpenseRow = {
  name: string;
  amount: number;
  transferToPensionTotal?: number;
};

type YearSummaryTableProps = {
  year: YearData;
  creditCardMonthlyMap: Map<string, number>;
};

function YearSummaryTable({
  year,
  creditCardMonthlyMap,
}: YearSummaryTableProps) {
  const incomeMap = new Map<string, number>();
  const expenseMap = new Map<string, ExpenseRow>();

  let totalIncome = 0;
  let totalExpense = 0;

  let transferToPensionTotal = 0;
  let pensionPaymentTotal = 0;
  let monthlyInvestTotal = 0;

  for (const month of year.months) {
    for (const item of month.income) {
      if (item.deleted) continue;

      const key = item.name;

      incomeMap.set(
        key,
        (incomeMap.get(key) || 0) + item.value
      );

      totalIncome += item.value;
    }

    for (const item of month.expense) {
      if (item.deleted) continue;

      const amount =
        getExpenseItemAmount(
          item,
          creditCardMonthlyMap
        );

      const isTransferToPension =
        normalizeName(item.name) === "转去养老保险";

      const isPensionPayment =
        normalizeName(item.name) === "本月交养老保险";

      const isMonthlyInvest =
        normalizeName(item.name) === "下月定投";

      // 转去养老保险：单独累计，不直接进 expenseMap
      if (isTransferToPension) {
        transferToPensionTotal += amount;
        continue;
      }

      // 本月交养老保险：单独累计，不直接进 expenseMap
      if (isPensionPayment) {
        pensionPaymentTotal += amount;
        continue;
      }

      // 下月定投：正常进 expenseMap 和 totalExpense，
      // 同时额外累计，用于“支出合计(不算下月定投)”
      if (isMonthlyInvest) {
        monthlyInvestTotal += amount;
      }

      const key = item.name;

      const existing = expenseMap.get(key);

      if (existing) {
        existing.amount += amount;
      } else {
        expenseMap.set(key, {
          name: item.name,
          amount,
        });
      }

      totalExpense += amount;
    }
  }

  // 合并“本月交养老保险”和“转去养老保险”
  if (pensionPaymentTotal > 0) {
    expenseMap.set("本月交养老保险", {
      name: "本月交养老保险",
      amount: pensionPaymentTotal,
      transferToPensionTotal,
    });

    totalExpense += pensionPaymentTotal;
  }

  const incomeRows = Array.from(
    incomeMap.entries()
  ).sort((a, b) => b[1] - a[1]);

  const expenseRows = Array.from(
    expenseMap.entries()
  ).sort((a, b) => b[1].amount - a[1].amount);

  const totalExpenseWithoutMonthlyInvest =
    totalExpense - monthlyInvestTotal;

  const netCashFlow =
    totalIncome - totalExpense;

  return (
    <div className="border-b border-gray-200 bg-white px-4 py-4">
      <div className="mb-3 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-sm font-semibold text-gray-800">
            {year.year} 年收支明细统计
          </div>

          <div className="mt-0.5 text-xs text-gray-500">
            按项目汇总全年收入与支出
          </div>
        </div>

        <div className="flex flex-wrap gap-4 text-xs">
          <div>
            <span className="text-gray-500">
              全年收入
            </span>

            <span className="ml-2 font-semibold text-emerald-600">
              ¥{formatMoney(totalIncome)}
            </span>
          </div>

          <div>
            <span className="text-gray-500">
              全年支出
            </span>

            <span className="ml-2 font-semibold text-rose-600">
              ¥{formatMoney(totalExpense)}
            </span>
          </div>

          <div>
            <span className="text-gray-500">
              净现金流
            </span>

            <span
              className={`ml-2 font-semibold ${
                netCashFlow >= 0
                  ? "text-emerald-600"
                  : "text-rose-600"
              }`}
            >
              ¥{formatSigned(netCashFlow)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {/* 收入明细 */}
        <div className="overflow-hidden rounded-xl border border-emerald-100">
          <div className="border-b border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
            收入明细
          </div>

          <div className="divide-y divide-emerald-50">
            {incomeRows.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">
                无收入项目
              </div>
            ) : (
              incomeRows.map(([name, amount]) => (
                <div
                  key={name}
                  className="flex items-center justify-between px-3 py-2 text-xs"
                >
                  <span className="truncate text-gray-700">
                    {name}
                  </span>

                  <span className="ml-3 shrink-0 font-medium text-emerald-600">
                    ¥{formatMoney(amount)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-emerald-100 bg-emerald-50 px-3 py-2 text-xs font-semibold">
            <span className="text-emerald-700">
              收入合计
            </span>

            <span className="text-emerald-700">
              ¥{formatMoney(totalIncome)}
            </span>
          </div>
        </div>

        {/* 支出明细 */}
        <div className="overflow-hidden rounded-xl border border-rose-100">
          <div className="border-b border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
            支出明细
          </div>

          <div className="divide-y divide-rose-50">
            {expenseRows.length === 0 ? (
              <div className="px-3 py-2 text-xs text-gray-400">
                无支出项目
              </div>
            ) : (
              expenseRows.map(([key, row]) => (
                <div
                  key={key}
                  className="flex items-center justify-between px-3 py-2 text-xs"
                >
                  <span className="truncate text-gray-700">
                    {row.name}

                    {typeof row.transferToPensionTotal ===
                      "number" &&
                      row.transferToPensionTotal > 0 && (
                        <>
                          {" "}
                          [
                          <span className="text-orange-500">
                            转去养老保险 ¥
                            {formatMoney(
                              row.transferToPensionTotal
                            )}
                          </span>
                          ]
                        </>
                      )}
                  </span>

                  <span className="ml-3 shrink-0 font-medium text-rose-600">
                    ¥{formatMoney(row.amount)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-between border-t border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold">
            <span className="text-rose-700">
              支出合计
            </span>

            <span className="text-rose-700">
              ¥{formatMoney(totalExpense)}
            </span>
          </div>

          <div className="flex items-center justify-between border-t border-rose-100 bg-rose-50 px-3 py-2 text-xs font-semibold">
            <span className="text-rose-700">
              支出合计(不算下月定投)
            </span>

            <span className="text-rose-700">
              ¥{formatMoney(totalExpenseWithoutMonthlyInvest)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Month Card
// ============================================================

type MonthCardProps = {
  month: MonthData;
  monthCalc?: CalculationMonth;
  creditCardMonthlyMap: Map<string, number>;

  editingId: string | null;
  editingValue: string;

  setEditingId: (
    value: string | null
  ) => void;

  setEditingValue: (
    value: string
  ) => void;

  onRename: (
    item: CellItem,
    value: string
  ) => void;

  onValueCommit: (
    item: CellItem
  ) => void;

  onDelete: (
    item: CellItem
  ) => void;

  onDeleteMonth: (
    year: number,
    month: number
  ) => void;

  onToggleIndependent: (
    item: CellItem
  ) => void;

  onReorderItems: (
    year: number,
    month: number,
    role: Role,
    activeId: string,
    overId: string
  ) => void;

  onAddMonthlyItem: (
    year: number,
    month: number,
    role: Role,
    name: string
  ) => void;

  editingCalcKey: string | null;
  editingCalcValue: string;
  setEditingCalcKey: (value: string | null) => void;
  setEditingCalcValue: (value: string) => void;
  onCalculationCommit: (
    month: MonthData,
    field: "remaining" | "totalCash" | "annuity"
  ) => void;
};

function MonthCard({
  month,
  monthCalc,
  creditCardMonthlyMap,
  editingId,
  editingValue,
  setEditingId,
  setEditingValue,
  onRename,
  onValueCommit,
  onDelete,
  onDeleteMonth,
  onToggleIndependent,
  onReorderItems,
  onAddMonthlyItem,
  editingCalcKey,
  editingCalcValue,
  setEditingCalcKey,
  setEditingCalcValue,
  onCalculationCommit,
}: MonthCardProps) {
  const [addingRole, setAddingRole] = useState<Role | null>(null);
  const [addingName, setAddingName] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const incomeIds = month.income.map(
      (item) => item.id
    );

    const expenseIds = month.expense.map(
      (item) => item.id
    );

    if (
      incomeIds.includes(activeId) &&
      incomeIds.includes(overId)
    ) {
      onReorderItems(
        month.year,
        month.month,
        "income",
        activeId,
        overId
      );
      return;
    }

    if (
      expenseIds.includes(activeId) &&
      expenseIds.includes(overId)
    ) {
      onReorderItems(
        month.year,
        month.month,
        "expense",
        activeId,
        overId
      );
    }
  }

  function submitMonthlyItem() {
    if (!addingRole || !addingName.trim()) return;

    onAddMonthlyItem(
      month.year,
      month.month,
      addingRole,
      addingName
    );

    setAddingName("");
    setAddingRole(null);
  }

  const incomeTotal =
    month.income.reduce(
      (sum, item) =>
        sum +
        (item.deleted
          ? 0
          : item.value),
      0
    );

  const expenseTotal =
    month.expense
      .filter(
        (item) =>
          !item.deleted &&
          !item.isPensionPayment
      )
      .reduce(
        (sum, item) =>
          sum +
          getExpenseItemAmount(
            item,
            creditCardMonthlyMap
          ),
        0
      );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200">

        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2.5">

          <div className="text-sm font-semibold">
            {month.month}月
          </div>

          <button
            type="button"
            onClick={() =>
              onDeleteMonth(
                month.year,
                month.month
              )
            }
            className="
              rounded
              px-2
              py-1
              text-[10px]
              font-medium
              text-gray-400
              transition
              hover:bg-gray-100
              hover:text-gray-700
            "
            title={`删除 ${month.year}年${month.month}月`}
          >
            DEL
          </button>

        </div>

        <div className="bg-slate-50 px-2.5 py-2.5">

          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">
              收入
            </div>

            <div className="text-xs font-medium">
              ¥
              {formatMoney(
                incomeTotal
              )}
            </div>
          </div>

          <SortableContext
            items={month.income.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {month.income.filter((item) => !item.deleted).length === 0 ? (
                <div className="py-2 text-center text-xs text-gray-400">
                  无收入项目
                </div>
              ) : (
                month.income
                  .filter((item) => !item.deleted)
                  .map((item) => (
                    <ProjectRow
                      key={item.id}
                      item={item}
                      editingId={editingId}
                      editingValue={editingValue}
                      setEditingId={setEditingId}
                      setEditingValue={setEditingValue}
                      onRename={onRename}
                      onValueCommit={onValueCommit}
                      onDelete={onDelete}
                      onToggleIndependent={onToggleIndependent}
                    />
                  ))
              )}
            </div>
          </SortableContext>

          <div className="mt-2 flex items-center gap-1.5">
            {addingRole === "income" ? (
              <div className="flex min-w-0 flex-1 gap-1.5">
                <input
                  autoFocus
                  value={addingName}
                  onChange={(e) => setAddingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitMonthlyItem();
                    if (e.key === "Escape") {
                      setAddingRole(null);
                      setAddingName("");
                    }
                  }}
                  placeholder="收入项目名称"
                  className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-gray-500"
                />
                <button
                  type="button"
                  onClick={submitMonthlyItem}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-100"
                >
                  添加
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingRole("income")}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
              >
                ＋收入
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 bg-stone-50 px-2.5 py-2.5">

          <div className="mb-2 flex items-center justify-between">
            <div className="text-xs font-semibold text-gray-700">
              支出
            </div>

            <div className="text-xs font-medium">
              ¥
              {formatMoney(
                expenseTotal
              )}
            </div>
          </div>

          <SortableContext
            items={month.expense.map((item) => item.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-1.5">
              {month.expense.filter((item) => !item.deleted).length === 0 ? (
                <div className="py-2 text-center text-xs text-gray-400">
                  无支出项目
                </div>
              ) : (
                month.expense
                  .filter((item) => !item.deleted)
                  .map((item) => {
                    const dynamicAmount =
                      isCreditCardRegular(item)
                        ? getCreditCardRegularAmount(
                            creditCardMonthlyMap,
                            item.year,
                            item.month
                          )
                        : null;

                    return (
                      <ProjectRow
                        key={item.id}
                        item={item}
                        dynamicAmount={dynamicAmount}
                        editingId={editingId}
                        editingValue={editingValue}
                        setEditingId={setEditingId}
                        setEditingValue={setEditingValue}
                        onRename={onRename}
                        onValueCommit={onValueCommit}
                        onDelete={onDelete}
                        onToggleIndependent={onToggleIndependent}
                      />
                    );
                  })
              )}
            </div>
          </SortableContext>

          <div className="mt-2 flex items-center gap-1.5">
            {addingRole === "expense" ? (
              <div className="flex min-w-0 flex-1 gap-1.5">
                <input
                  autoFocus
                  value={addingName}
                  onChange={(e) => setAddingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitMonthlyItem();
                    if (e.key === "Escape") {
                      setAddingRole(null);
                      setAddingName("");
                    }
                  }}
                  placeholder="支出项目名称"
                  className="min-w-0 flex-1 rounded border border-gray-300 bg-white px-2 py-1 text-xs outline-none focus:border-gray-500"
                />
                <button
                  type="button"
                  onClick={submitMonthlyItem}
                  className="rounded border border-gray-300 bg-white px-2 py-1 text-xs hover:bg-gray-100"
                >
                  添加
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingRole("expense")}
                className="rounded border border-gray-300 bg-white px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-100"
              >
                ＋支出
              </button>
            )}
          </div>
        </div>

        <div className="border-t border-gray-200 bg-white px-3 py-2.5">

          <CalculationEditRow
            label="本月剩下"
            value={monthCalc?.remaining ?? incomeTotal - expenseTotal}
            signed
            editKey={`${month.year}-${month.month}-remaining`}
            editingCalcKey={editingCalcKey}
            editingCalcValue={editingCalcValue}
            setEditingCalcKey={setEditingCalcKey}
            setEditingCalcValue={setEditingCalcValue}
            onCommit={() =>
              onCalculationCommit(month, "remaining")
            }
          />

          <CalculationEditRow
            label="总现金剩下"
            value={monthCalc?.totalCash ?? 0}
            editKey={`${month.year}-${month.month}-totalCash`}
            editingCalcKey={editingCalcKey}
            editingCalcValue={editingCalcValue}
            setEditingCalcKey={setEditingCalcKey}
            setEditingCalcValue={setEditingCalcValue}
            onCommit={() =>
              onCalculationCommit(month, "totalCash")
            }
          />

          <CalculationEditRow
            label="积累年金"
            value={monthCalc?.annuity ?? 0}
            editKey={`${month.year}-${month.month}-annuity`}
            editingCalcKey={editingCalcKey}
            editingCalcValue={editingCalcValue}
            setEditingCalcKey={setEditingCalcKey}
            setEditingCalcValue={setEditingCalcValue}
            onCommit={() =>
              onCalculationCommit(month, "annuity")
            }
          />
        </div>
      </div>
    </DndContext>
  );
}

// ============================================================
// Calculation Edit Row
// ============================================================

type CalculationEditRowProps = {
  label: string;
  value: number;
  signed?: boolean;
  editKey: string;
  editingCalcKey: string | null;
  editingCalcValue: string;
  setEditingCalcKey: (value: string | null) => void;
  setEditingCalcValue: (value: string) => void;
  onCommit: () => void;
};

function CalculationEditRow({
  label,
  value,
  signed = false,
  editKey,
  editingCalcKey,
  editingCalcValue,
  setEditingCalcKey,
  setEditingCalcValue,
  onCommit,
}: CalculationEditRowProps) {
  const editing = editingCalcKey === editKey;

  function startEdit() {
    setEditingCalcKey(editKey);
    setEditingCalcValue(String(value));
  }

  return (
    <div className="flex items-center justify-between py-1 text-xs">
      <span className="text-gray-500">
        {label}
      </span>

      {editing ? (
        <div className="flex min-w-0 items-center gap-1">
          <span className="text-gray-500">¥</span>
          <input
            autoFocus
            value={editingCalcValue}
            onChange={(e) =>
              setEditingCalcValue(e.target.value)
            }
            onBlur={() => onCommit()}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onCommit();
              }

              if (e.key === "Escape") {
                setEditingCalcKey(null);
                setEditingCalcValue("");
              }
            }}
            inputMode="decimal"
            className="w-28 rounded border border-gray-200 bg-white px-1.5 py-1 text-right text-xs outline-none focus:border-gray-400"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={startEdit}
          title="点击修改；修改后会作为下个月的起点继续计算"
          className="rounded px-1.5 py-0.5 text-right font-semibold hover:bg-gray-50"
        >
          ¥{signed ? formatSigned(value) : formatMoney(value)}
        </button>
      )}
    </div>
  );
}

// ============================================================
// Project Row
// ============================================================

type ProjectRowProps = {
  item: CellItem;

  dynamicAmount?: number | null;

  editingId: string | null;
  editingValue: string;

  setEditingId: (
    value: string | null
  ) => void;

  setEditingValue: (
    value: string
  ) => void;

  onRename: (
    item: CellItem,
    value: string
  ) => void;

  onValueCommit: (
    item: CellItem
  ) => void;

  onDelete: (
    item: CellItem
  ) => void;

  onToggleIndependent: (
    item: CellItem
  ) => void;
};

function ProjectRow({
  item,
  dynamicAmount = null,
  editingId,
  editingValue,
  setEditingId,
  setEditingValue,
  onRename,
  onValueCommit,
  onDelete,
  onToggleIndependent,
}: ProjectRowProps) {
  const nameEditing =
    editingId === item.id;

  const valueEditing =
    editingId ===
    `value:${item.id}`;

  const hasDynamicAmount =
    typeof dynamicAmount === "number";

  const displayValue =
    hasDynamicAmount
      ? dynamicAmount
      : item.value;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-lg border border-gray-200 bg-white px-2 py-1.5 ${
        isDragging ? "shadow-lg" : ""
      }`}
    >

      <div className="flex min-w-0 items-center gap-1.5">

        <button
          type="button"
          {...attributes}
          {...listeners}
          title="拖动调整顺序"
          className="shrink-0 cursor-grab touch-none rounded px-1 text-gray-300 hover:bg-gray-100 hover:text-gray-500 active:cursor-grabbing"
        >
          ⋮⋮
        </button>

        <div className="min-w-0 flex-1">

          {nameEditing ? (
            <input
              autoFocus
              value={
                editingValue
              }
              onChange={(e) =>
                setEditingValue(
                  e.target.value
                )
              }
              onBlur={() => {
                onRename(
                  item,
                  editingValue
                );

                setEditingId(
                  null
                );

                setEditingValue(
                  ""
                );
              }}
              onKeyDown={(e) => {
                if (
                  e.key ===
                  "Enter"
                ) {
                  onRename(
                    item,
                    editingValue
                  );

                  setEditingId(
                    null
                  );

                  setEditingValue(
                    ""
                  );
                }

                if (
                  e.key ===
                  "Escape"
                ) {
                  setEditingId(
                    null
                  );

                  setEditingValue(
                    ""
                  );
                }
              }}
              className="w-full rounded border border-gray-300 px-1.5 py-1 text-xs outline-none"
            />
          ) : (
            <button
              type="button"
              title={
                item.independent
                  ? "独立项目"
                  : "点击修改名称；共享项目会同步全部年月"
              }
              onClick={() => {
                setEditingId(
                  item.id
                );

                setEditingValue(
                  item.name
                );
              }}
              className="block w-full truncate text-left text-xs text-gray-800 hover:underline"
            >
              {item.name}
            </button>
          )}
        </div>

        <label
          title={
            item.independent
              ? "当前年月独立"
              : "勾选后当前年月脱离联动"
          }
          className="flex shrink-0 cursor-pointer items-center gap-1 text-[10px] text-gray-500"
        >
          <input
            type="checkbox"
            checked={
              item.independent
            }
            onChange={() =>
              onToggleIndependent(
                item
              )
            }
            className="h-3 w-3"
          />

          <span>
            独立
          </span>
        </label>

        <div className="w-[82px] shrink-0">
          <input
            value={
              hasDynamicAmount
                ? String(displayValue)
                : valueEditing
                  ? editingValue
                  : String(displayValue)
            }
            readOnly={
              hasDynamicAmount
            }
            onFocus={() => {
              if (hasDynamicAmount) {
                return;
              }

              setEditingId(
                `value:${item.id}`
              );

              setEditingValue(
                String(
                  item.value
                )
              );
            }}
            onChange={(e) => {
              if (hasDynamicAmount) {
                return;
              }

              setEditingValue(
                e.target.value
              );
            }}
            onBlur={() => {
              if (hasDynamicAmount) {
                return;
              }

              if (
                valueEditing
              ) {
                onValueCommit(
                  item
                );
              }
            }}
            onKeyDown={(e) => {
              if (hasDynamicAmount) {
                return;
              }

              if (
                e.key ===
                "Enter"
              ) {
                onValueCommit(
                  item
                );
              }

              if (
                e.key ===
                "Escape"
              ) {
                setEditingId(
                  null
                );

                setEditingValue(
                  ""
                );
              }
            }}
            inputMode="decimal"
            className={`w-full rounded border bg-white px-1.5 py-1 text-right text-xs outline-none focus:border-gray-400 ${
              hasDynamicAmount
                ? "border-gray-100 bg-gray-50 text-gray-500"
                : "border-gray-200"
            }`}
          />
        </div>

        <button
          type="button"
          title={
            item.independent
              ? "删除当前年月"
              : "删除全部年月中的该项目"
          }
          onClick={() =>
            onDelete(item)
          }
          className="shrink-0 rounded px-1.5 py-1 text-[10px] text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          DEL
        </button>
      </div>

      {item.independent && (
        <div className="mt-1 text-[9px] text-gray-400">
          当前年月独立
        </div>
      )}
    </div>
  );
}

// ============================================================
// 年份清洗
// ============================================================

function sanitizeYears(years: YearData[]) {
  const map = new Map<number, YearData>();

  for (const sourceYear of years) {
    if (
      sourceYear.year < TARGET_START_YEAR ||
      sourceYear.year > TARGET_END_YEAR
    ) {
      continue;
    }

    if (map.has(sourceYear.year)) {
      continue;
    }

    const year = sourceYear;

    for (const month of year.months) {
      month.income = month.income.filter(
        (item) => item.deleted !== true
      );

      month.expense = month.expense.filter(
        (item) => item.deleted !== true
      );

      const dedupeSpecial = (items: CellItem[]) => {
        const seen = new Set<string>();

        const result: CellItem[] = [];

        const sharedMap = new Map<string, CellItem>();

        for (const item of items) {
          const normalized = normalizeName(item.name);

          const isSAL =
            item.role === "income" && normalized === "sal";

          const isTransferToPension =
            item.role === "expense" &&
            normalized === "转去养老保险";

          const isPensionPayment =
            item.role === "expense" &&
            (item.projectId === "fixed:pension-payment" ||
              item.isPensionPayment === true ||
              normalized === "本月交养老保险");

          if (isSAL) {
            const key = `${item.year}::${item.month}::income::sal`;

            if (seen.has(key)) {
              continue;
            }

            seen.add(key);
            result.push(item);
            continue;
          }

          if (isTransferToPension) {
            const key = `${item.year}::${item.month}::expense::转去养老保险`;

            if (seen.has(key)) {
              continue;
            }

            item.isAnnuityContribution = true;

            seen.add(key);
            result.push(item);
            continue;
          }

          if (isPensionPayment) {
            const key = `${item.year}::${item.month}::expense::fixed:pension-payment`;

            if (seen.has(key)) {
              continue;
            }

            item.projectId = "fixed:pension-payment";

            item.isPensionPayment = true;

            item.isAnnuityContribution = false;

            seen.add(key);
            result.push(item);
            continue;
          }

          if (item.independent) {
            result.push(item);
            continue;
          }

          const sharedKey = `${item.role}::${normalized}`;

          const existing = sharedMap.get(sharedKey);

          if (!existing) {
            item.projectId = `shared:${item.role}:${normalized}`;

            sharedMap.set(sharedKey, item);

            result.push(item);
          } else {
            // 丢弃重复
          }
        }

        return result;
      };

      month.income = dedupeSpecial(month.income);

      month.expense = dedupeSpecial(month.expense);
    }

    map.set(year.year, year);
  }

  return Array.from(map.values()).sort(
    (a, b) => a.year - b.year
  );
}

// ============================================================
// 快速录入
// ============================================================

const DEFAULT_QUICK_ENTRY =
  "支出 报销 1-11月4596，12月6396\n收入 房租 1/4/7/10月6000\n支出 转去养老保险 1月55000 2月160000 3月80000 4月0  5月32000 6月47000 7月50000 8月40000  9月47000 10月57000 11月0 12月139926";

function parseQuickEntry(text: string) {
  const lines = text
    .split(/[\n;；]+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const parsed: Array<{
    role: Role;
    name: string;
    monthValues: Map<number, number>;
  }> = [];

  const scheduleRegex = /(\d{1,2})\s*-\s*(\d{1,2})\s*月\s*([\d,.]+)|(\d{1,2}(?:\s*[\/、,，]\s*\d{1,2})+)\s*月\s*([\d,.]+)|(\d{1,2})\s*月\s*([\d,.]+)/g;

  for (const line of lines) {
    const roleMatch = line.match(/(收入|支出)/);
    if (!roleMatch) continue;

    const role: Role =
      roleMatch[1] === "收入" ? "income" : "expense";

    const firstMatch = scheduleRegex.exec(line);
    scheduleRegex.lastIndex = 0;
    if (!firstMatch) continue;

    const roleIndex = roleMatch.index ?? 0;

    const name = line
      .slice(
        roleIndex + roleMatch[0].length,
        firstMatch.index
      )
      .replace(/^[\s:：\-—]+|[\s:：\-—]+$/g, "")
      .trim();

    if (!name) continue;

    const monthValues = new Map<number, number>();
    let match: RegExpExecArray | null;

    while ((match = scheduleRegex.exec(line))) {
      if (match[1] && match[2] && match[3]) {
        const start = Number(match[1]);
        const end = Number(match[2]);
        const value = numberValue(match[3]);
        for (let month = start; month <= end; month++) {
          if (month >= 1 && month <= 12) {
            monthValues.set(month, value);
          }
        }
      } else if (match[4] && match[5]) {
        const value = numberValue(match[5]);
        for (const part of match[4].split(/[\/、,，]/)) {
          const month = Number(part.trim());
          if (month >= 1 && month <= 12) {
            monthValues.set(month, value);
          }
        }
      } else if (match[6] && match[7]) {
        const month = Number(match[6]);
        const value = numberValue(match[7]);
        if (month >= 1 && month <= 12) {
          monthValues.set(month, value);
        }
      }
    }

    if (monthValues.size > 0) {
      parsed.push({ role, name, monthValues });
    }
  }

  return parsed;
}

function applyQuickEntry(
  years: YearData[],
  projects: Project[],
  text: string
) {
  const entries = parseQuickEntry(text);

  if (entries.length === 0) {
    return {
      years,
      projects,
      count: 0,
      message:
        "没有识别到可填写的内容。格式例如：支出 报销 1-11月4596，12月6396",
    };
  }

  let count = 0;

  for (const entry of entries) {
    let project = findSharedProject(
      projects,
      entry.role,
      entry.name
    );

    const isTransferToPension =
      entry.role === "expense" &&
      normalizeName(entry.name) ===
        "转去养老保险";

    if (!project) {
      project = {
        projectId: projectUid(entry.role),
        role: entry.role,
        name: entry.name,
        custom: true,
        isAnnuityContribution:
          isTransferToPension,
      };

      projects.push(project);
    } else if (isTransferToPension) {
      project.isAnnuityContribution = true;
    }

    for (const year of years) {
      for (const month of year.months) {
        const list =
          entry.role === "income"
            ? month.income
            : month.expense;

        const normalizedEntryName =
          normalizeName(
            entry.name
          );

        const isSAL =
          entry.role ===
            "income" &&
          normalizedEntryName ===
            "sal";

        const isTransferToPension =
          entry.role ===
            "expense" &&
          normalizedEntryName ===
            "转去养老保险";

        let matches: CellItem[];

        if (
          isSAL ||
          isTransferToPension
        ) {
          matches =
            list.filter(
              (item) =>
                !item.deleted &&
                item.role ===
                  entry.role &&
                normalizeName(
                  item.name
                ) ===
                  normalizedEntryName
            );
        } else {
          matches =
            list.filter(
              (item) =>
                !item.deleted &&
                !item.independent &&
                item.projectId ===
                  project!.projectId &&
                item.role ===
                  entry.role
            );
        }

        let target =
          matches[0];

        for (
          const duplicate of
            matches.slice(1)
        ) {
          const index =
            list.indexOf(
              duplicate
            );

          if (
            index >= 0
          ) {
            list.splice(
              index,
              1
            );
          }
        }

        if (!target) {
          target = {
            id:
              uid("quick"),

            year:
              year.year,

            month:
              month.month,

            role:
              entry.role,

            projectId:
              project!.projectId,

            name:
              project!.name,

            value:
              0,

            independent:
              false,

            fromExcel:
              false,

            isAnnuityContribution:
              isTransferToPension,
          };

          list.push(
            target
          );
        }

        if (
          isTransferToPension
        ) {
          target.isAnnuityContribution =
            true;
        }

        const value =
          entry.monthValues.get(
            month.month
          );

        if (value !== undefined) {
          if (target.value !== value) {
            count++;
          }

          target.value = value;
          target.deleted = false;

          if (isTransferToPension) {
            target.isAnnuityContribution =
              true;
          }
        }
      }
    }
  }

  for (const year of years) {
    for (const month of year.months) {
      delete month.manualRemaining;
      delete month.manualTotalCash;
    }
  }

  return {
    years,
    projects,
    count,
    message: `已快速填写 ${entries.length} 个项目，共更新 ${count} 个金额。`,
  };
}

// ============================================================
// 页面
// ============================================================

export default function CashflowPlanningPage() {
  const [years, setYears] =
    useState<YearData[]>([]);

  const [projects, setProjects] =
    useState<Project[]>([]);

  const [
    creditCardMonthlyMap,
    setCreditCardMonthlyMap,
  ] = useState<Map<string, number>>(
    new Map()
  );

  const [selectedYear, setSelectedYear] =
    useState<number | null>(
      null
    );

  const [copySourceYear, setCopySourceYear] =
    useState<number | null>(null);

  const [copySingleYear, setCopySingleYear] =
    useState(true);

  const [copyTargetStartYear, setCopyTargetStartYear] =
    useState<number | null>(null);

  const [copyTargetEndYear, setCopyTargetEndYear] =
    useState<number | null>(null);

  const [copyMessage, setCopyMessage] =
    useState<string | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(
      null
    );

  const [saved, setSaved] =
    useState(false);

  const [saving, setSaving] =
    useState(false);

  const [newIncomeName, setNewIncomeName] =
    useState("");

  const [newExpenseName, setNewExpenseName] =
    useState("");

  const [quickEntryText, setQuickEntryText] =
    useState(
      "支出 报销 1-11月4596，12月6396\n收入 房租 1/4/7/10月6000 \n支出 转去养老保险 1月55000 2月160000 3月80000 4月0  5月32000 6月47000 7月50000 8月40000  9月47000 10月57000 11月0 12月139926"
    );

  const [quickEntryMessage, setQuickEntryMessage] =
    useState<string | null>(null);

  const [editingId, setEditingId] =
    useState<string | null>(
      null
    );

  const [editingValue, setEditingValue] =
    useState("");

  const [
    pendingValueChange,
    setPendingValueChange,
  ] = useState<{
    item: CellItem;
    value: number;
    affectedMonths: string[];
  } | null>(null);

  const [editingCalcKey, setEditingCalcKey] =
    useState<string | null>(null);

  const [editingCalcValue, setEditingCalcValue] =
    useState("");

  const [aiText, setAiText] =
    useState("");

  const [aiGenerated, setAiGenerated] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const skipInitialSaveRef = useRef(true);

  const skipNextAutoSaveRef = useRef(false);

  const saveChainRef = useRef<Promise<void>>(
    Promise.resolve()
  );

  const pendingMonthDeletesRef = useRef<
    Array<{
      year: number;
      month: number;
    }>
  >([]);

  // ==========================================================
  // 加载信用卡分期每月应还
  // ==========================================================
  useEffect(() => {
    let mounted = true;

    async function loadCreditCardMonthly() {
      try {
        const map =
          await getCreditCardMonthlyMap();

        if (!mounted) return;

        setCreditCardMonthlyMap(map);

        console.log(
          "[CASHFLOW] 信用卡分期每月应还：",
          Array.from(map.entries())
        );
      } catch (error) {
        console.error(
          "[CASHFLOW] 读取信用卡分期失败：",
          error
        );
      }
    }

    loadCreditCardMonthly();

    return () => {
      mounted = false;
    };
  }, []);

  // ==========================================================
  // Supabase 初始化
  // ==========================================================
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        console.log(
          "[CASHFLOW] 开始读取 Supabase..."
        );

        const cloud = await Promise.race([
          loadCashflowPlanning(),

          new Promise<never>((_, reject) => {
            window.setTimeout(() => {
              reject(
                new Error(
                  "读取 Supabase 现金流数据超过 15 秒，请检查 /api/cashflow-planning"
                )
              );
            }, 15000);
          }),
        ]);

        if (!mounted) {
          return;
        }

        console.log(
          "[CASHFLOW] Supabase 返回：",
          cloud
        );

        console.log(
          "[CASHFLOW] 原始 Supabase 年份明细：",
          [...new Set((cloud.state?.years ?? []).map((y) => y.year))]
        );

        console.log(
          "[CASHFLOW] loadCashflowPlanning 年份：",
          cloud.state?.years?.map((y) => y.year)
        );

        if (
          !cloud.hasData ||
          !cloud.state ||
          !Array.isArray(
            cloud.state.years
          ) ||
          cloud.state.years.length === 0
        ) {
          throw new Error(
            "Supabase 中没有现金流规划数据，请先完成一次初始化。"
          );
        }

        const rebuilt =
          rebuildProjectLinks(
            sanitizeYears(
              clone(
                cloud.state.years
              )
            ),
            clone(
              cloud.state.projects ?? []
            )
          );

        console.log(
          "[CASHFLOW] rebuildProjectLinks 后年份：",
          rebuilt.years.map((y) => y.year)
        );

        const withPension =
          ensurePensionPaymentItems(
            rebuilt.years,
            rebuilt.projects
          );

        console.log(
          "[CASHFLOW] ensurePensionPaymentItems 后年份：",
          withPension.years.map((y) => y.year)
        );

        if (!mounted) {
          return;
        }

        skipInitialSaveRef.current =
          true;

        setYears(
          withPension.years
        );

        setProjects(
          withPension.projects
        );

        setSelectedYear(
          withPension.years.find(
            (year) =>
              year.year === 2026
          )?.year ??
            withPension.years[0]
              ?.year ??
            null
        );

        console.log(
          "[CASHFLOW] Supabase 读取完成：",
          {
            years:
              withPension.years.map(
                (year) => year.year
              ),
            projectCount:
              withPension.projects.length,
          }
        );
      } catch (err) {
        console.error(
          "[CASHFLOW] Supabase 初始化失败：",
          err
        );

        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "读取现金流规划数据失败"
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

  // ==========================================================
  // 自动保存
  // ==========================================================
  useEffect(() => {
    if (loading || years.length === 0) return;

    if (skipInitialSaveRef.current) {
      skipInitialSaveRef.current = false;
      return;
    }

    if (skipNextAutoSaveRef.current) {
      skipNextAutoSaveRef.current = false;
      return;
    }

    const snapshot: CashflowState = clone({
      years,
      projects,
    });

    const deleteMonths =
      pendingMonthDeletesRef.current.map(
        (item) => ({
          year: item.year,
          month: item.month,
        })
      );

    pendingMonthDeletesRef.current = [];

    setSaved(true);
    setSaving(true);

    const savedTimer =
      window.setTimeout(() => {
        setSaved(false);
      }, 1000);

    const saveTimer =
      window.setTimeout(() => {
        saveChainRef.current =
          saveChainRef.current
            .catch((previousError) => {
              console.error(
                "CASHFLOW-PLANNING 上一次 Supabase 保存失败：",
                previousError
              );
            })
            .then(async () => {
              try {
                await saveCashflowPlanning(
                  snapshot,
                  deleteMonths
                );
              } catch (saveError) {
                console.error(
                  "CASHFLOW-PLANNING Supabase 保存失败：",
                  saveError
                );

                throw saveError;
              } finally {
                setSaving(false);
              }
            });
      }, 700);

    return () => {
      window.clearTimeout(savedTimer);
      window.clearTimeout(saveTimer);
    };
  }, [
    years,
    projects,
    loading,
  ]);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () =>
      window.removeEventListener(
        "beforeunload",
        handleBeforeUnload
      );
  }, [saving]);

  function saveImmediately(
    nextYears: YearData[],
    nextProjects: Project[]
  ) {
    const snapshot: CashflowState = clone({
      years: nextYears,
      projects: nextProjects,
    });

    const deleteMonths =
      pendingMonthDeletesRef.current.map(
        (item) => ({
          year: item.year,
          month: item.month,
        })
      );

    pendingMonthDeletesRef.current = [];

    setSaved(true);
    setSaving(true);

    window.setTimeout(() => {
      setSaved(false);
    }, 1000);

    saveChainRef.current =
      saveChainRef.current
        .catch((previousError) => {
          console.error(
            "CASHFLOW-PLANNING 上一次 Supabase 保存失败：",
            previousError
          );
        })
        .then(async () => {
          try {
            await saveCashflowPlanning(
              snapshot,
              deleteMonths
            );
          } catch (saveError) {
            console.error(
              "CASHFLOW-PLANNING Supabase 保存失败：",
              saveError
            );

            throw saveError;
          } finally {
            setSaving(false);
          }
        });
  }

  // ==========================================================
  // 计算
  // ==========================================================
  const calculations =
    useMemo(
      () =>
        calculateYears(
          years,
          creditCardMonthlyMap
        ),
      [years, creditCardMonthlyMap]
    );

  const calculationMap =
    useMemo(() => {
      const map =
        new Map<
          number,
          YearCalculation
        >();

      for (const calc of calculations) {
        map.set(
          calc.year,
          calc
        );
      }

      return map;
    }, [calculations]);

  const visibleYears =
    selectedYear == null
      ? years
      : years.filter(
          (year) =>
            year.year ===
            selectedYear
        );

  function handleAddMonthlyItem(
    yearValue: number,
    monthValue: number,
    role: Role,
    name: string
  ) {
    const nextYears = addMonthlyProject(
      clone(years),
      yearValue,
      monthValue,
      role,
      name
    );

    setYears(nextYears);
  }

  function handleAddProject(
    role: Role
  ) {
    const name =
      role === "income"
        ? newIncomeName
        : newExpenseName;

    if (
      !isValidName(name)
    ) {
      return;
    }

    const result =
      addGlobalProject(
        clone(years),
        clone(projects),
        role,
        name
      );

    setYears(
      result.years
    );

    setProjects(
      result.projects
    );

    if (
      role === "income"
    ) {
      setNewIncomeName(
        ""
      );
    } else {
      setNewExpenseName(
        ""
      );
    }
  }

  function handleQuickEntry() {
    const nextYears = clone(years);
    const nextProjects = clone(projects);

    const result = applyQuickEntry(
      nextYears,
      nextProjects,
      quickEntryText
    );

    setYears(result.years);
    setProjects(result.projects);
    setQuickEntryMessage(result.message);
  }

  function handleDelete(
    item: CellItem
  ) {
    const nextYears = clone(years);
    const nextProjects = clone(projects);

    const result =
      deleteProject(
        nextYears,
        nextProjects,
        item
      );

    skipNextAutoSaveRef.current = true;

    setYears(
      result.years
    );

    setProjects(
      result.projects
    );

    saveImmediately(
      result.years,
      result.projects
    );
  }

  function handleDeleteMonth(
    yearValue: number,
    monthValue: number
  ) {
    const confirmed = window.confirm(
      `确定删除 ${yearValue} 年 ${monthValue} 月吗？\n\n这个月份的收入、支出、现金和年金数据都会被删除。`
    );

    if (!confirmed) {
      return;
    }

    const nextDeleteMonths = [
      ...pendingMonthDeletesRef.current,
    ];

    const alreadyPending =
      nextDeleteMonths.some(
        (item) =>
          item.year === yearValue &&
          item.month === monthValue
      );

    if (!alreadyPending) {
      nextDeleteMonths.push({
        year: yearValue,
        month: monthValue,
      });
    }

    pendingMonthDeletesRef.current =
      nextDeleteMonths;

    console.log(
      "[CASHFLOW] pending month delete:",
      pendingMonthDeletesRef.current
    );

    const nextYears = clone(years);

    for (const year of nextYears) {
      if (year.year !== yearValue) {
        continue;
      }

      year.months =
        year.months.filter(
          (month) =>
            month.month !== monthValue
        );
    }

    skipNextAutoSaveRef.current = true;

    setYears(nextYears);

    saveImmediately(nextYears, projects);
  }

  function handleReorderItems(
    yearValue: number,
    monthValue: number,
    role: Role,
    activeId: string,
    overId: string
  ) {
    const nextYears = clone(years);

    const targetYear = nextYears.find(
      (year) =>
        year.year === yearValue
    );

    const targetMonth =
      targetYear?.months.find(
        (month) =>
          month.month === monthValue
      );

    if (!targetMonth) {
      return;
    }

    const list =
      role === "income"
        ? targetMonth.income
        : targetMonth.expense;

    const oldIndex = list.findIndex(
      (item) =>
        item.id === activeId
    );

    const newIndex = list.findIndex(
      (item) =>
        item.id === overId
    );

    if (
      oldIndex < 0 ||
      newIndex < 0 ||
      oldIndex === newIndex
    ) {
      return;
    }

    const reordered = arrayMove(
      list,
      oldIndex,
      newIndex
    );

    if (role === "income") {
      targetMonth.income =
        reordered;
    } else {
      targetMonth.expense =
        reordered;
    }

    setYears(nextYears);
  }

  function handleToggleIndependent(
    item: CellItem
  ) {
    const result =
      toggleIndependent(
        clone(years),
        clone(projects),
        item
      );

    setYears(
      result.years
    );

    setProjects(
      result.projects
    );
  }

  function handleRename(
    item: CellItem,
    value: string
  ) {
    const result =
      renameItem(
        clone(years),
        clone(projects),
        item,
        value
      );

    setYears(
      result.years
    );

    setProjects(
      result.projects
    );
  }

  function commitValue(
    item: CellItem
  ) {
    const value =
      Number(
        editingValue
          .replace(/,/g, "")
          .trim()
      );

    const safeValue =
      Number.isFinite(value)
        ? value
        : 0;

    const affectedMonths: string[] = [];

    for (const year of years) {
      for (const month of year.months) {
        const isAfter =
          year.year > item.year ||
          (
            year.year === item.year &&
            month.month > item.month
          );

        if (!isAfter) {
          continue;
        }

        const list =
          item.role === "income"
            ? month.income
            : month.expense;

        const exists =
          list.some(
            (x) =>
              x.projectId ===
                item.projectId &&
              x.role === item.role &&
              !x.deleted
          );

        if (exists) {
          affectedMonths.push(
            `${year.year}年${month.month}月`
          );
        }
      }
    }

    setEditingId(null);
    setEditingValue("");

    if (affectedMonths.length === 0) {
      const nextYears =
        clone(years);

      updateItemValue(
        nextYears,
        item,
        safeValue,
        false
      );

      setYears(nextYears);

      return;
    }

    setPendingValueChange({
      item,
      value: safeValue,
      affectedMonths,
    });
  }

  function handleCancelValuePropagation() {
    if (!pendingValueChange) {
      return;
    }

    const nextYears =
      clone(years);

    updateItemValue(
      nextYears,
      pendingValueChange.item,
      pendingValueChange.value,
      false
    );

    setYears(nextYears);

    setPendingValueChange(null);
  }

  function handleConfirmValuePropagation() {
    if (!pendingValueChange) {
      return;
    }

    const nextYears =
      clone(years);

    updateItemValue(
      nextYears,
      pendingValueChange.item,
      pendingValueChange.value,
      true
    );

    setYears(nextYears);

    setPendingValueChange(null);
  }

  function commitCalculation(
    month: MonthData,
    field: "remaining" | "totalCash" | "annuity"
  ) {
    const value = Number(
      editingCalcValue
        .replace(/,/g, "")
        .trim()
    );

    const nextYears = clone(years);

    const targetYear = nextYears.find(
      (year) => year.year === month.year
    );

    const targetMonth = targetYear?.months.find(
      (x) => x.month === month.month
    );

    if (targetMonth) {
      const safeValue = Number.isFinite(value)
        ? value
        : 0;

      if (field === "remaining") {
        targetMonth.manualRemaining = safeValue;
      } else if (field === "totalCash") {
        targetMonth.manualTotalCash = safeValue;
      } else {
        targetMonth.manualAnnuity = safeValue;
      }
    }

    setYears(nextYears);
    setEditingCalcKey(null);
    setEditingCalcValue("");
  }

  function handleGenerateAI() {
    const prompt =
      buildAIPrompt(
        years,
        calculations,
        creditCardMonthlyMap
      );

    setAiText(
      prompt
    );

    setAiGenerated(
      true
    );

    setCopied(
      false
    );

    window.setTimeout(
      () => {
        document
          .getElementById(
            "ai-analysis-box"
          )
          ?.scrollIntoView({
            behavior:
              "smooth",
            block:
              "start",
          });
      },
      50
    );
  }

  async function handleCopyAI() {
    if (!aiText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        aiText
      );

      setCopied(
        true
      );

      window.setTimeout(
        () => {
          setCopied(
            false
          );
        },
        1800
      );
    } catch {
      setCopied(false);
    }
  }

  function handleDownloadAI() {
    if (!aiText) {
      return;
    }

    const blob =
      new Blob(
        [aiText],
        {
          type:
            "text/plain;charset=utf-8",
        }
      );

    const url =
      URL.createObjectURL(
        blob
      );

    const a =
      document.createElement(
        "a"
      );

    a.href = url;

    a.download =
      "AI-Wealth-OS-Cashflow-Analysis.txt";

    a.click();

    URL.revokeObjectURL(
      url
    );
  }

  function handleCopyYearRange() {
    if (copySourceYear == null) {
      setCopyMessage("请选择模板年份");
      return;
    }

    const targetStart = copySingleYear
      ? copyTargetStartYear
      : copyTargetStartYear;
    const targetEnd = copySingleYear
      ? copyTargetStartYear
      : copyTargetEndYear;

    if (targetStart == null || targetEnd == null) {
      setCopyMessage("请选择目标年份");
      return;
    }

    if (targetStart <= copySourceYear || targetEnd <= copySourceYear) {
      setCopyMessage("目标年份必须在模板年份之后");
      return;
    }

    if (targetStart > targetEnd) {
      setCopyMessage("目标年份的起始年份不能大于结束年份");
      return;
    }

    const sourceYear = years.find((year) => year.year === copySourceYear);
    if (!sourceYear) {
      setCopyMessage(`找不到 ${copySourceYear} 年`);
      return;
    }

    const nextYears = clone(years);
    const targetCount = targetEnd - targetStart + 1;

    for (let targetYear = targetStart; targetYear <= targetEnd; targetYear++) {
      const existingIndex = nextYears.findIndex((year) => year.year === targetYear);

      const copiedYear: YearData = {
        year: targetYear,
        originalOpeningCash: sourceYear.originalOpeningCash,
        originalOpeningAnnuity: sourceYear.originalOpeningAnnuity,
        months: sourceYear.months.map((sourceMonth) => ({
          year: targetYear,
          month: sourceMonth.month,
          income: sourceMonth.income.map((item) => ({
            ...clone(item),
            id: `${targetYear}-${sourceMonth.month}-${item.role}-${item.projectId}-income-${Math.random().toString(36).slice(2, 10)}`,
            year: targetYear,
            month: sourceMonth.month,
            fromExcel: false,
          })),
          expense: sourceMonth.expense.map((item) => ({
            ...clone(item),
            id: `${targetYear}-${sourceMonth.month}-${item.role}-${item.projectId}-expense-${Math.random().toString(36).slice(2, 10)}`,
            year: targetYear,
            month: sourceMonth.month,
            fromExcel: false,
          })),
          manualRemaining: undefined,
          manualTotalCash: undefined,
          manualAnnuity: undefined,
        })),
      };

      if (existingIndex >= 0) {
        nextYears[existingIndex] = copiedYear;
      } else {
        nextYears.push(copiedYear);
      }
    }

    const sortedYears = sanitizeYears(nextYears);
    const rebuilt = rebuildProjectLinks(sortedYears, projects);
    const withPension = ensurePensionPaymentItems(
      rebuilt.years,
      rebuilt.projects,
      false
    );

    setYears(withPension.years);
    setProjects(withPension.projects);
    setSelectedYear(targetEnd);
    setCopyMessage(
      `已复制：${copySourceYear} 年模板 → ${targetStart}${targetStart === targetEnd ? "" : `～${targetEnd}`} 年（共 ${targetCount} 年）`
    );
  }

  async function clearSaved() {
    try {
      await clearCashflowPlanning();
      window.location.reload();
    } catch (clearError) {
      console.error(
        "清除 Supabase CASHFLOW-PLANNING 失败：",
        clearError
      );
      setError(
        clearError instanceof Error
          ? clearError.message
          : "清除 Supabase 数据失败"
      );
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="text-sm text-gray-500">
          正在读取 Supabase 现金流数据……
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
    <main className="min-h-screen bg-white text-gray-900">

      <div className="mx-auto max-w-[1800px] px-4 py-5 md:px-6">

        <div className="mb-5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              家庭资金计划
            </h1>

            <div className="mt-1 text-xs text-gray-500">
              CASHFLOW-PLANNING · Supabase 版
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <select
              value={
                selectedYear ?? ""
              }
              onChange={(e) =>
                setSelectedYear(
                  e.target.value
                    ? Number(
                        e.target.value
                      )
                    : null
                )
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none"
            >
              <option value="">
                全部年份
              </option>

              {years.map(
                (year) => (
                  <option
                    key={
                      year.year
                    }
                    value={
                      year.year
                    }
                  >
                    {year.year}
                  </option>
                )
              )}
            </select>

            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2.5">
              <span className="text-sm font-medium text-gray-700">复制年度计划</span>

              <label className="flex items-center gap-1.5 text-xs text-gray-600">
                <span>模板年份</span>
                <select
                  value={copySourceYear ?? ""}
                  onChange={(e) => {
                    const value = e.target.value ? Number(e.target.value) : null;
                    setCopySourceYear(value);
                    setCopyMessage(null);
                    if (value != null) {
                      setCopyTargetStartYear(value + 1);
                      setCopyTargetEndYear(value + 1);
                    }
                  }}
                  className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none"
                >
                  <option value="">请选择</option>
                  {years.map((year) => (
                    <option key={`copy-template-${year.year}`} value={year.year}>
                      {year.year}
                    </option>
                  ))}
                </select>
              </label>

              <label className="flex cursor-pointer items-center gap-1.5 text-xs text-gray-600">
                <input
                  type="checkbox"
                  checked={copySingleYear}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setCopySingleYear(checked);
                    setCopyMessage(null);
                    if (checked && copySourceYear != null) {
                      setCopyTargetStartYear(copySourceYear + 1);
                      setCopyTargetEndYear(copySourceYear + 1);
                    }
                  }}
                  className="h-4 w-4"
                />
                只复制 1 年
              </label>

              {copySingleYear ? (
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span>目标年份</span>
                  <select
                    value={copyTargetStartYear ?? ""}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : null;
                      setCopyTargetStartYear(value);
                      setCopyTargetEndYear(value);
                      setCopyMessage(null);
                    }}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none"
                  >
                    <option value="">请选择</option>
                    {Array.from(
                      { length: TARGET_END_YEAR - TARGET_START_YEAR + 1 },
                      (_, index) => TARGET_START_YEAR + index
                    ).map((year) => (
                      <option key={`copy-one-${year}`} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              ) : (
                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                  <span>目标年份</span>
                  <select
                    value={copyTargetStartYear ?? ""}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : null;
                      setCopyTargetStartYear(value);
                      setCopyMessage(null);
                    }}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none"
                  >
                    <option value="">起始年份</option>
                    {Array.from(
                      { length: TARGET_END_YEAR - TARGET_START_YEAR + 1 },
                      (_, index) => TARGET_START_YEAR + index
                    ).map((year) => (
                      <option key={`copy-start-${year}`} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>

                  <span className="text-gray-400">至</span>

                  <select
                    value={copyTargetEndYear ?? ""}
                    onChange={(e) => {
                      const value = e.target.value ? Number(e.target.value) : null;
                      setCopyTargetEndYear(value);
                      setCopyMessage(null);
                    }}
                    className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm outline-none"
                  >
                    <option value="">结束年份</option>
                    {Array.from(
                      { length: TARGET_END_YEAR - TARGET_START_YEAR + 1 },
                      (_, index) => TARGET_START_YEAR + index
                    ).map((year) => (
                      <option key={`copy-end-${year}`} value={year}>
                        {year}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <button
                type="button"
                onClick={handleCopyYearRange}
                disabled={
                  copySourceYear == null ||
                  (copySingleYear
                    ? copyTargetStartYear == null
                    : copyTargetStartYear == null || copyTargetEndYear == null)
                }
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                复制年度计划
              </button>

              {copySourceYear != null && (
                <span className="text-xs text-gray-500">
                  {copySingleYear
                    ? copyTargetStartYear != null
                      ? `将 ${copySourceYear} 年模板复制到 ${copyTargetStartYear} 年，共 1 年`
                      : `将 ${copySourceYear} 年模板复制到下一年`
                    : copyTargetStartYear != null && copyTargetEndYear != null && copyTargetEndYear >= copyTargetStartYear
                      ? `将 ${copySourceYear} 年模板复制到 ${copyTargetStartYear}～${copyTargetEndYear} 年，共 ${copyTargetEndYear - copyTargetStartYear + 1} 年`
                      : `将 ${copySourceYear} 年模板复制到目标年份区间`}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={
                clearSaved
              }
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50"
            >
              清除保存
            </button>

            {saving ? (
              <span className="text-xs font-medium text-blue-500">
                保存中…
              </span>
            ) : saved ? (
              <span className="text-xs text-gray-400">
                已保存
              </span>
            ) : null}
          </div>
        </div>

        <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-xs text-gray-600">

          <div className="flex flex-wrap gap-x-5 gap-y-1">

            <span>
              <b>
                新增项目：
              </b>
              自动同步全部年份 × 全部月份
            </span>

            <span>
              <b>
                改名：
              </b>
              同项目全部年月同步
            </span>

            <span>
              <b>
                删除：
              </b>
              同项目全部年月删除
            </span>

            <span>
              <b>
                独立：
              </b>
              当前年月脱离联动
            </span>

            <span>
              <b>
                金额：
              </b>
              每个月独立填写
            </span>

            <span>
              <b>
                还信用卡常规：
              </b>
              自动读取 /loan 里的信用卡分期
            </span>
          </div>
        </div>

        <section className="mb-5 rounded-xl border border-gray-200 bg-white p-4">
          <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-semibold">快速填写</div>
              <div className="mt-0.5 text-xs text-gray-500">
                直接用一句话写月份和金额，系统会自动填入全部年份；同一项目同一月份不会重复。
              </div>
            </div>
            <div className="text-xs text-gray-400">
              例如：支出 报销 1-11月4596，12月6396, 支出 转去养老保险 1月55000 2月160000 3月80000 4月0  5月32000 6月47000 7月50000 8月40000  9月47000 10月57000 11月0 12月139926
            </div>
          </div>

          <textarea
            value={quickEntryText}
            onChange={(e) => setQuickEntryText(e.target.value)}
            className="min-h-[86px] w-full resize-y rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm leading-6 outline-none focus:border-gray-500"
            placeholder={'支出 报销 1-11月4596，12月6396\n收入 房租 1/4/7/10月6000'}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleQuickEntry}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
            >
              一键填写
            </button>

            <button
              type="button"
              onClick={() => setQuickEntryText(DEFAULT_QUICK_ENTRY)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 hover:bg-gray-100"
            >
              恢复示例
            </button>

            {quickEntryMessage && (
              <span className="text-xs text-gray-500">
                {quickEntryMessage}
              </span>
            )}
          </div>
        </section>

        <section className="mb-6 grid gap-3 lg:grid-cols-2">

          <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">

            <div className="mb-3">
              <div className="text-sm font-semibold">
                新增收入项目
              </div>

              <div className="mt-0.5 text-xs text-gray-500">
                新项目会自动加入全部年月
              </div>
            </div>

            <div className="flex gap-2">

              <input
                value={
                  newIncomeName
                }
                onChange={(e) =>
                  setNewIncomeName(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    handleAddProject(
                      "income"
                    );
                  }
                }}
                placeholder="例如：年终奖"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
              />

              <button
                type="button"
                onClick={() =>
                  handleAddProject(
                    "income"
                  )
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
              >
                ＋新增
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-stone-50 p-4">

            <div className="mb-3">
              <div className="text-sm font-semibold">
                新增支出项目
              </div>

              <div className="mt-0.5 text-xs text-gray-500">
                新项目会自动加入全部年月
              </div>
            </div>

            <div className="flex gap-2">

              <input
                value={
                  newExpenseName
                }
                onChange={(e) =>
                  setNewExpenseName(
                    e.target.value
                  )
                }
                onKeyDown={(e) => {
                  if (
                    e.key ===
                    "Enter"
                  ) {
                    handleAddProject(
                      "expense"
                    );
                  }
                }}
                placeholder="例如：转去养老保险"
                className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
              />

              <button
                type="button"
                onClick={() =>
                  handleAddProject(
                    "expense"
                  )
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
              >
                ＋新增
              </button>
            </div>
          </div>
        </section>

        <div className="space-y-6">

          {visibleYears.map(
            (year) => {
              const calc =
                calculationMap.get(
                  year.year
                );

              return (
                <section
                  key={
                    year.year
                  }
                  className="overflow-hidden rounded-2xl border border-gray-200 bg-white"
                >

                  <div className="flex flex-col gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 md:flex-row md:items-center md:justify-between">

                    <div>
                      <div className="text-base font-semibold">
                        {year.year}
                      </div>

                      <div className="text-xs text-gray-500">
                         共 {year.months.length} 个月
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-4 text-xs">

                      <div>
                        <span className="text-gray-500">
                          年末现金
                        </span>

                        <span className="ml-2 font-semibold">
                          ¥
                          {formatMoney(
                            calc?.endingCash ??
                              0
                          )}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-500">
                          年末积累年金
                        </span>

                        <span className="ml-2 font-semibold">
                          ¥
                          {formatMoney(
                            calc?.endingAnnuity ??
                              0
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">

                    {year.months.map(
                      (
                        month,
                        monthIndex
                      ) => (
                        <MonthCard
                          key={`${year.year}-${month.month}`}
                          month={
                            month
                          }
                          monthCalc={
                            calc
                              ?.months[
                              monthIndex
                            ]
                          }
                          creditCardMonthlyMap={
                            creditCardMonthlyMap
                          }
                          editingId={
                            editingId
                          }
                          editingValue={
                            editingValue
                          }
                          setEditingId={
                            setEditingId
                          }
                          setEditingValue={
                            setEditingValue
                          }
                          onRename={
                            handleRename
                          }
                          onValueCommit={
                            commitValue
                          }
                          onDelete={
                            handleDelete
                          }
                          onDeleteMonth={
                             handleDeleteMonth
                          }
                          onToggleIndependent={
                            handleToggleIndependent
                          }
                          onReorderItems={
                           handleReorderItems
                          }
                          onAddMonthlyItem={
                            handleAddMonthlyItem
                          }
                          editingCalcKey={editingCalcKey}
                          editingCalcValue={editingCalcValue}
                          setEditingCalcKey={setEditingCalcKey}
                          setEditingCalcValue={setEditingCalcValue}
                          onCalculationCommit={
                            commitCalculation
                          }
                        />
                      )
                    )}
                  </div>

                  <YearSummaryTable
                    year={year}
                    creditCardMonthlyMap={creditCardMonthlyMap}
                  />
                </section>
              );
            }
          )}
        </div>

        <section
          id="ai-analysis-box"
          className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white"
        >

          <div className="border-b border-gray-200 bg-gray-50 px-5 py-4">

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>
                <div className="text-base font-semibold">
                  AI 现金流分析
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  把当前 CASHFLOW-PLANNING
                  的完整数据整理成 AI 可以直接分析的格式
                </div>
              </div>

              <button
                type="button"
                onClick={
                  handleGenerateAI
                }
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-100"
              >
                ✦ 生成 AI 分析数据
              </button>
            </div>
          </div>

          <div className="p-5">

            {!aiGenerated ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-8 text-center">

                <div className="text-sm font-medium text-gray-700">
                  准备把这份现金流交给 AI 分析
                </div>

                <div className="mx-auto mt-2 max-w-xl text-xs leading-5 text-gray-500">
                  点击上面的「生成 AI 分析数据」，
                  系统会把全部年份、月份、收入、支出、
                  项目关系、现金余额和积累年金整理出来。
                </div>
              </div>
            ) : (
              <div className="space-y-3">

                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

                  <div className="text-xs text-gray-500">
                    已生成完整 AI 分析数据
                  </div>

                  <div className="flex gap-2">

                    <button
                      type="button"
                      onClick={
                        handleCopyAI
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-100"
                    >
                      {copied
                        ? "✓ 已复制"
                        : "复制给 AI"}
                    </button>

                    <button
                      type="button"
                      onClick={
                        handleDownloadAI
                      }
                      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-medium hover:bg-gray-100"
                    >
                      下载 TXT
                    </button>
                  </div>
                </div>

                <textarea
                  value={
                    aiText
                  }
                  onChange={(e) =>
                    setAiText(
                      e.target.value
                    )
                  }
                  className="min-h-[500px] w-full resize-y rounded-xl border border-gray-300 bg-gray-50 p-4 font-mono text-xs leading-5 outline-none focus:border-gray-500"
                  spellCheck={
                    false
                  }
                />

                <div className="rounded-lg bg-gray-50 px-4 py-3 text-xs leading-5 text-gray-500">
                  <b className="text-gray-700">
                    使用方法：
                  </b>
                  点击「复制给 AI」→
                  回到 ChatGPT →
                  直接粘贴。
                  <br />
                  AI 会根据你的实际现金流数据进行分析，
                  而不是重新猜测你的家庭资金情况。
                </div>
              </div>
            )}
          </div>
        </section>

        {pendingValueChange && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white shadow-2xl">

              <div className="border-b border-gray-200 px-5 py-4">
                <div className="text-base font-semibold text-gray-900">
                  确认同步修改？
                </div>

                <div className="mt-1 text-xs text-gray-500">
                  你修改了一个月份的金额，
                  系统发现后面还有相同项目。
                </div>
              </div>

              <div className="px-5 py-4">

                <div className="rounded-xl bg-gray-50 px-4 py-3">
                  <div className="text-sm font-medium text-gray-800">
                    {pendingValueChange.item.name}
                  </div>

                  <div className="mt-1 text-xs text-gray-500">
                    {pendingValueChange.item.year}年
                    {pendingValueChange.item.month}月
                  </div>

                  <div className="mt-2 text-sm">
                    修改为：
                    <span className="ml-1 font-semibold text-gray-900">
                      ¥
                      {formatMoney(
                        pendingValueChange.value
                      )}
                    </span>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-xs font-medium text-gray-700">
                    后续以下月份也存在这个项目：
                  </div>

                  <div className="mt-2 max-h-32 overflow-y-auto rounded-lg border border-gray-200 bg-white px-3 py-2">
                    <div className="flex flex-wrap gap-x-3 gap-y-1">
                      {pendingValueChange.affectedMonths.map(
                        (month) => (
                          <span
                            key={month}
                            className="text-xs text-gray-600"
                          >
                            {month}
                          </span>
                        )
                      )}
                    </div>
                  </div>

                  <div className="mt-3 text-xs leading-5 text-gray-500">
                    <span className="font-medium text-gray-700">
                      取消
                    </span>
                    ：只修改当前月份。
                    <br />
                    <span className="font-medium text-gray-700">
                      确认同步
                    </span>
                    ：当前月份及以上列出的后续月份一起修改。
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 border-t border-gray-200 px-5 py-4">
                <button
                  type="button"
                  onClick={
                    handleCancelValuePropagation
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>

                <button
                  type="button"
                  onClick={
                    handleConfirmValuePropagation
                  }
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  确认同步
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ============================================================
// 恢复项目关系
// ============================================================

function rebuildProjectLinks(
  years: YearData[],
  oldProjects: Project[]
) {
  const projects =
    clone(oldProjects);

  const map = new Map<
    string,
    string
  >();

  for (const year of years) {
    for (const month of year.months) {
      for (const item of [
        ...month.income,
        ...month.expense,
      ]) {
        if (
          item.independent
        ) {
          continue;
        }

        const key =
          `${item.role}::${normalizeName(
            item.name
          )}`;

        let projectId =
          map.get(key);

        if (!projectId) {
          const existing =
            findSharedProject(
              projects,
              item.role,
              item.name
            );

          if (existing) {
            projectId =
              existing.projectId;
          } else {
            projectId =
              projectUid(
                item.role
              );

            projects.push({
              projectId,

              role:
                item.role,

              name:
                item.name,

              custom: false,

              sourceOffset:
                item.sourceOffset,

              isAnnuityContribution:
                item.isAnnuityContribution,
            });
          }

          map.set(
            key,
            projectId
          );
        }

        item.projectId =
          projectId;
      }
    }
  }

  return {
    years,
    projects,
  };
}