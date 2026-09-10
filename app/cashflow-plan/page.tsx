"use client";

import { useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";

// ============================================================
// 类型
// ============================================================

type LineItem = {
  id: string;
  label: string;
  value: number | null;
  editable: boolean;
  originalValue: number | null;
};

type MonthPlan = {
  id: string;
  month: number;
  lines: LineItem[];

  income: number | null;
  remaining: number | null;
  totalCash: number | null;
  annuity: number | null;

  originalIncome: number | null;
  originalRemaining: number | null;
  originalTotalCash: number | null;
  originalAnnuity: number | null;
};

type YearPlan = {
  year: number;
  sheetName: string;
  months: MonthPlan[];
};

type Plan = {
  years: YearPlan[];
  fileName: string;
};

// ============================================================
// Excel布局
// ============================================================

const BLOCK_ROWS = [5, 26, 47];

const MONTH_COLUMNS = [
  {
    labelCol: 3, // C
    valueCol: 5, // E
  },
  {
    labelCol: 8, // H
    valueCol: 10, // J
  },
  {
    labelCol: 13, // M
    valueCol: 15, // O
  },
  {
    labelCol: 18, // R
    valueCol: 20, // T
  },
];

const YEARS = Array.from({ length: 12 }, (_, i) => 2026 + i);

const RESULT_LABELS = new Set([
  "收入",
  "本月剩下",
  "总现金剩下",
  "积累年金",
]);

// ============================================================
// 工具
// ============================================================

function uid(prefix = "item") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const text = String(value)
    .replace(/,/g, "")
    .replace(/¥/g, "")
    .replace(/\s/g, "")
    .trim();

  if (!text) return null;

  const n = Number(text);

  return Number.isFinite(n) ? n : null;
}

function formatMoney(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function cellValue(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number
): unknown {
  const address = XLSX.utils.encode_cell({
    r: row - 1,
    c: col - 1,
  });

  return sheet[address]?.v;
}

function cellFormula(
  sheet: XLSX.WorkSheet,
  row: number,
  col: number
): string | null {
  const address = XLSX.utils.encode_cell({
    r: row - 1,
    c: col - 1,
  });

  return sheet[address]?.f ?? null;
}

function cleanLabel(value: unknown) {
  if (value === null || value === undefined) return "";

  return String(value)
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .trim();
}

function isResultLabel(label: string) {
  return RESULT_LABELS.has(label);
}

function isAnnuityLine(label: string) {
  const text = label.replace(/\s/g, "");

  return (
    text.includes("养老保险") ||
    text.includes("转去养老") ||
    text.includes("养老")
  );
}

// ============================================================
// 解析单个月
// ============================================================

function parseMonth(
  sheet: XLSX.WorkSheet,
  headerRow: number,
  monthCol: {
    labelCol: number;
    valueCol: number;
  },
  year: number,
  month: number
): MonthPlan {
  const monthName = cleanLabel(
    cellValue(sheet, headerRow, monthCol.labelCol)
  );

  const lines: LineItem[] = [];

  /*
   * 原 Excel 每个月的主体大约 20 行。
   *
   * headerRow:
   *   5
   *
   * 数据:
   *   7 ~ 24
   *
   * 为了避免把空白行全部塞进页面，
   * 只读取真正有 label 或 numeric value 的行。
   */

  for (let offset = 2; offset <= 19; offset++) {
    const row = headerRow + offset;

    const label = cleanLabel(
      cellValue(sheet, row, monthCol.labelCol)
    );

    const value = asNumber(
      cellValue(sheet, row, monthCol.valueCol)
    );

    const formula = cellFormula(
      sheet,
      row,
      monthCol.valueCol
    );

    if (!label && value === null && !formula) {
      continue;
    }

    /*
     * 如果原 Excel 是公式，但缓存值是 #REF!，
     * value 会是 null。
     *
     * 这种情况保留空值，不能瞎猜。
     */

    lines.push({
      id: uid("line"),
      label: label || "未命名项目",
      value,
      originalValue: value,
      editable: !isResultLabel(label),
    });
  }

  const incomeLine = lines.find(
    (x) => x.label === "收入"
  );

  const remainingLine = lines.find(
    (x) => x.label === "本月剩下"
  );

  const totalCashLine = lines.find(
    (x) => x.label === "总现金剩下"
  );

  const annuityLine = lines.find(
    (x) => x.label === "积累年金"
  );

  return {
    id: uid("month"),
    month,
    lines,

    income: incomeLine?.value ?? null,
    remaining: remainingLine?.value ?? null,
    totalCash: totalCashLine?.value ?? null,
    annuity: annuityLine?.value ?? null,

    originalIncome: incomeLine?.value ?? null,
    originalRemaining: remainingLine?.value ?? null,
    originalTotalCash: totalCashLine?.value ?? null,
    originalAnnuity: annuityLine?.value ?? null,
  };
}

// ============================================================
// 找年度Sheet
// ============================================================

function findYearSheet(
  workbook: XLSX.WorkBook,
  year: number
) {
  const candidates = workbook.SheetNames.filter((name) =>
    name.includes(String(year))
  );

  if (candidates.length === 0) {
    return null;
  }

  /*
   * 优先使用：
   * 2027每月估算 (2)
   *
   * 避免误选旧版历史sheet。
   */
  const numbered = candidates
    .filter((x) => /\(\d+\)\s*$/.test(x))
    .sort((a, b) => {
      const na = Number(
        a.match(/\((\d+)\)\s*$/)?.[1] ?? 0
      );

      const nb = Number(
        b.match(/\((\d+)\)\s*$/)?.[1] ?? 0
      );

      return nb - na;
    });

  if (numbered.length > 0) {
    return numbered[0];
  }

  return candidates[0];
}

// ============================================================
// 解析Excel
// ============================================================

function parseWorkbook(
  workbook: XLSX.WorkBook,
  fileName: string
): Plan {
  const years: YearPlan[] = [];

  for (const year of YEARS) {
    const sheetName = findYearSheet(workbook, year);

    if (!sheetName) continue;

    const sheet = workbook.Sheets[sheetName];

    const months: MonthPlan[] = [];

    for (let blockIndex = 0; blockIndex < 3; blockIndex++) {
      const headerRow = BLOCK_ROWS[blockIndex];

      for (let colIndex = 0; colIndex < 4; colIndex++) {
        const config = MONTH_COLUMNS[colIndex];

        const rawMonth = cleanLabel(
          cellValue(
            sheet,
            headerRow,
            config.labelCol
          )
        );

        const match = rawMonth.match(/(\d{1,2})月/);

        if (!match) continue;

        const month = Number(match[1]);

        months.push(
          parseMonth(
            sheet,
            headerRow,
            config,
            year,
            month
          )
        );
      }
    }

    months.sort((a, b) => a.month - b.month);

    years.push({
      year,
      sheetName,
      months,
    });
  }

  years.sort((a, b) => a.year - b.year);

  /*
   * Excel导入后立即建立一次完整计算链。
   */
  return recalculatePlan({
    years,
    fileName,
  });
}

// ============================================================
// 找结果Line
// ============================================================

function findLine(
  month: MonthPlan,
  label: string
) {
  return month.lines.find(
    (line) => line.label === label
  );
}

// ============================================================
// 设置Line数值
// ============================================================

function setLineValue(
  month: MonthPlan,
  label: string,
  value: number | null
) {
  const line = findLine(month, label);

  if (!line) return;

  line.value = value;
}

// ============================================================
// 计算单个月
// ============================================================

function calculateMonth(
  month: MonthPlan,
  previousMonth: MonthPlan | null,
  previousYearLastMonth: MonthPlan | null
) {
  /*
   * ========================================================
   * 1. 收入
   *
   * Excel结构：
   *
   * LP
   * BX
   * SA
   * 其他
   * 收入
   *
   * 所以“收入”以前的数字项目全部视为收入来源。
   * ========================================================
   */

  const incomeIndex = month.lines.findIndex(
    (line) => line.label === "收入"
  );

  let income = 0;

  if (incomeIndex >= 0) {
    for (let i = 0; i < incomeIndex; i++) {
      const line = month.lines[i];

      if (line.value !== null) {
        income += line.value;
      }
    }
  }

  /*
   * ========================================================
   * 2. 本月剩下
   *
   * 收入 - 收入下面所有实际支出项目
   *
   * 一直计算到：
   * 本月剩下
   * 总现金剩下
   * 积累年金
   * ========================================================
   */

  let expense = 0;

  if (incomeIndex >= 0) {
    for (
      let i = incomeIndex + 1;
      i < month.lines.length;
      i++
    ) {
      const line = month.lines[i];

      if (isResultLabel(line.label)) {
        continue;
      }

      if (line.value !== null) {
        expense += line.value;
      }
    }
  }

  const remaining = income - expense;

  /*
   * ========================================================
   * 3. 总现金剩下
   *
   * 当前月：
   *
   * 上个月总现金
   * +
   * 本月剩下
   *
   * 第一月：
   *
   * 上一年度最后一个月总现金
   * +
   * 本月剩下
   *
   * 2027第一月则接2026年12月。
   * ========================================================
   */

  let openingCash = 0;

  if (previousMonth?.totalCash !== null &&
      previousMonth?.totalCash !== undefined) {
    openingCash = previousMonth.totalCash;
  } else if (
    previousYearLastMonth?.totalCash !== null &&
    previousYearLastMonth?.totalCash !== undefined
  ) {
    openingCash = previousYearLastMonth.totalCash;
  }

  const totalCash = openingCash + remaining;

  /*
   * ========================================================
   * 4. 积累年金
   *
   * 找“养老保险”相关项目。
   *
   * 例如：
   *
   * 转去养老保险
   *
   * 本月增加：
   *
   * 上个月积累年金
   * +
   * 本月养老保险转入
   *
   * ========================================================
   */

  let annuityContribution = 0;

  for (const line of month.lines) {
    if (
      isAnnuityLine(line.label) &&
      !isResultLabel(line.label)
    ) {
      if (line.value !== null) {
        annuityContribution += line.value;
      }
    }
  }

  let openingAnnuity = 0;

  if (
    previousMonth?.annuity !== null &&
    previousMonth?.annuity !== undefined
  ) {
    openingAnnuity = previousMonth.annuity;
  } else if (
    previousYearLastMonth?.annuity !== null &&
    previousYearLastMonth?.annuity !== undefined
  ) {
    openingAnnuity = previousYearLastMonth.annuity;
  }

  /*
   * 对于第一年第一月，如果没有上一年度可用数据，
   * 使用Excel原始值反推出opening。
   *
   * 这样不会因为2026的#REF导致整个模型被强行改成0。
   */
  if (
    !previousMonth &&
    !previousYearLastMonth &&
    month.originalAnnuity !== null
  ) {
    openingAnnuity =
      month.originalAnnuity -
      annuityContribution;
  }

  const annuity =
    openingAnnuity +
    annuityContribution;

  month.income = income;
  month.remaining = remaining;
  month.totalCash = totalCash;
  month.annuity = annuity;

  setLineValue(
    month,
    "收入",
    income
  );

  setLineValue(
    month,
    "本月剩下",
    remaining
  );

  setLineValue(
    month,
    "总现金剩下",
    totalCash
  );

  setLineValue(
    month,
    "积累年金",
    annuity
  );
}

// ============================================================
// 重新计算整个模型
// ============================================================

function recalculatePlan(
  plan: Plan
): Plan {
  const years = plan.years
    .map((year) => ({
      ...year,
      months: year.months.map((month) => ({
        ...month,
        lines: month.lines.map((line) => ({
          ...line,
        })),
      })),
    }))
    .sort((a, b) => a.year - b.year);

  let previousMonth: MonthPlan | null = null;

  for (let yearIndex = 0; yearIndex < years.length; yearIndex++) {
    const year = years[yearIndex];

    const previousYear =
      yearIndex > 0
        ? years[yearIndex - 1]
        : null;

    const previousYearLastMonth =
      previousYear &&
      previousYear.months.length > 0
        ? previousYear.months[
            previousYear.months.length - 1
          ]
        : null;

    for (
      let monthIndex = 0;
      monthIndex < year.months.length;
      monthIndex++
    ) {
      const month = year.months[monthIndex];

      calculateMonth(
        month,
        previousMonth,
        monthIndex === 0
          ? previousYearLastMonth
          : null
      );

      previousMonth = month;
    }
  }

  return {
    ...plan,
    years,
  };
}

// ============================================================
// 主页面
// ============================================================

export default function CashflowPlanPage() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [plan, setPlan] = useState<Plan | null>(null);

  const [selectedYear, setSelectedYear] =
    useState<number | null>(null);

  const [expandedMonth, setExpandedMonth] =
    useState<string | null>(null);

  const [dirty, setDirty] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  // ==========================================================
  // 上传
  // ==========================================================

  async function handleUpload(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0];

    if (!file) return;

    try {
      setError(null);

      const buffer =
        await file.arrayBuffer();

      const workbook =
        XLSX.read(buffer, {
          type: "array",
          cellFormula: true,
          cellNF: true,
          cellStyles: true,
        });

      const parsed =
        parseWorkbook(
          workbook,
          file.name
        );

      setPlan(parsed);

      setSelectedYear(
        parsed.years[0]?.year ?? null
      );

      setExpandedMonth(null);

      setDirty(false);
    } catch (err) {
      console.error(err);

      setError(
        "Excel读取失败，请确认上传的是有效的 NEW.xlsx。"
      );
    }

    event.target.value = "";
  }

  // ==========================================================
  // 当前年份
  // ==========================================================

  const currentYear = useMemo(() => {
    if (!plan || selectedYear === null) {
      return null;
    }

    return (
      plan.years.find(
        (year) =>
          year.year === selectedYear
      ) ?? null
    );
  }, [plan, selectedYear]);

  // ==========================================================
  // 修改项目名称
  // ==========================================================

  function renameLine(
    year: number,
    monthId: string,
    lineId: string,
    value: string
  ) {
    if (!plan) return;

    setPlan((current) => {
      if (!current) return current;

      const next: Plan = {
        ...current,
        years: current.years.map(
          (yearPlan) => {
            if (yearPlan.year !== year) {
              return yearPlan;
            }

            return {
              ...yearPlan,
              months:
                yearPlan.months.map(
                  (month) => {
                    if (
                      month.id !== monthId
                    ) {
                      return month;
                    }

                    return {
                      ...month,
                      lines:
                        month.lines.map(
                          (line) =>
                            line.id === lineId
                              ? {
                                  ...line,
                                  label:
                                    value,
                                }
                              : line
                        ),
                    };
                  }
                ),
            };
          }
        ),
      };

      setDirty(true);

      /*
       * 改名本身不改变金额，
       * 但如果把“养老保险”改成别的名字，
       * 那么模型识别规则也应该重新计算。
       */
      return recalculatePlan(next);
    });
  }

  // ==========================================================
  // 修改项目金额
  // ==========================================================

  function changeLineValue(
    year: number,
    monthId: string,
    lineId: string,
    rawValue: string
  ) {
    if (!plan) return;

    const value =
      rawValue === ""
        ? null
        : Number(rawValue);

    setPlan((current) => {
      if (!current) return current;

      const next: Plan = {
        ...current,
        years: current.years.map(
          (yearPlan) => {
            if (yearPlan.year !== year) {
              return yearPlan;
            }

            return {
              ...yearPlan,
              months:
                yearPlan.months.map(
                  (month) => {
                    if (
                      month.id !== monthId
                    ) {
                      return month;
                    }

                    return {
                      ...month,
                      lines:
                        month.lines.map(
                          (line) =>
                            line.id === lineId
                              ? {
                                  ...line,
                                  value:
                                    Number.isFinite(
                                      value
                                    )
                                      ? value
                                      : null,
                                }
                              : line
                        ),
                    };
                  }
                ),
            };
          }
        ),
      };

      setDirty(true);

      return recalculatePlan(next);
    });
  }

  // ==========================================================
  // 新增项目
  // ==========================================================

  function addLine(
    year: number,
    monthId: string
  ) {
    if (!plan) return;

    setPlan((current) => {
      if (!current) return current;

      const next: Plan = {
        ...current,
        years: current.years.map(
          (yearPlan) => {
            if (yearPlan.year !== year) {
              return yearPlan;
            }

            return {
              ...yearPlan,
              months:
                yearPlan.months.map(
                  (month) => {
                    if (
                      month.id !== monthId
                    ) {
                      return month;
                    }

                    const newLine: LineItem = {
                      id: uid("line"),
                      label: "新项目",
                      value: 0,
                      originalValue: null,
                      editable: true,
                    };

                    const resultIndex =
                      month.lines.findIndex(
                        (line) =>
                          line.label ===
                          "本月剩下"
                      );

                    const lines = [
                      ...month.lines,
                    ];

                    if (
                      resultIndex >= 0
                    ) {
                      lines.splice(
                        resultIndex,
                        0,
                        newLine
                      );
                    } else {
                      lines.push(
                        newLine
                      );
                    }

                    return {
                      ...month,
                      lines,
                    };
                  }
                ),
            };
          }
        ),
      };

      setDirty(true);

      return recalculatePlan(next);
    });
  }

  // ==========================================================
  // 删除项目
  // ==========================================================

  function deleteLine(
    year: number,
    monthId: string,
    lineId: string
  ) {
    if (!plan) return;

    setPlan((current) => {
      if (!current) return current;

      const next: Plan = {
        ...current,
        years: current.years.map(
          (yearPlan) => {
            if (yearPlan.year !== year) {
              return yearPlan;
            }

            return {
              ...yearPlan,
              months:
                yearPlan.months.map(
                  (month) => {
                    if (
                      month.id !== monthId
                    ) {
                      return month;
                    }

                    return {
                      ...month,
                      lines:
                        month.lines.filter(
                          (line) =>
                            line.id !==
                            lineId
                        ),
                    };
                  }
                ),
            };
          }
        ),
      };

      setDirty(true);

      return recalculatePlan(next);
    });
  }

  // ==========================================================
  // 恢复Excel原值
  // ==========================================================

  function restoreOriginal() {
    if (!plan) return;

    const restored: Plan = {
      ...plan,
      years: plan.years.map(
        (year) => ({
          ...year,
          months:
            year.months.map(
              (month) => ({
                ...month,
                lines:
                  month.lines.map(
                    (line) => ({
                      ...line,
                      value:
                        line.originalValue,
                    })
                  ),
              })
            ),
        })
      ),
    };

    setPlan(
      recalculatePlan(restored)
    );

    setDirty(false);
  }

  // ==========================================================
  // 汇总
  // ==========================================================

  const summary = useMemo(() => {
    if (!currentYear) {
      return {
        income: 0,
        remaining: 0,
        endCash: 0,
        endAnnuity: 0,
      };
    }

    const income =
      currentYear.months.reduce(
        (sum, month) =>
          sum + (month.income ?? 0),
        0
      );

    const remaining =
      currentYear.months.reduce(
        (sum, month) =>
          sum + (month.remaining ?? 0),
        0
      );

    const last =
      currentYear.months[
        currentYear.months.length - 1
      ];

    return {
      income,
      remaining,
      endCash:
        last?.totalCash ?? 0,
      endAnnuity:
        last?.annuity ?? 0,
    };
  }, [currentYear]);

  // ==========================================================
  // 未上传
  // ==========================================================

  if (!plan) {
    return (
      <main className="min-h-screen bg-white text-gray-900">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="mb-8">
            <h1 className="text-2xl font-semibold">
              家庭资金计划
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              导入 NEW.xlsx 后，可以直接修改项目名称和金额，
              所有后续月份会自动重新计算。
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center">
            <div className="text-lg font-medium">
              导入家庭资金计划
            </div>

            <p className="mt-2 text-sm text-gray-500">
              支持 2026–2037 年月度计划
            </p>

            <button
              type="button"
              onClick={() =>
                inputRef.current?.click()
              }
              className="mt-6 rounded-xl bg-black px-6 py-3 text-sm font-medium text-white"
            >
              上传 NEW.xlsx
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              className="hidden"
              onChange={handleUpload}
            />

            {error && (
              <div className="mt-5 text-sm text-red-600">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  // ==========================================================
  // 页面
  // ==========================================================

  return (
    <main className="min-h-screen bg-white text-gray-900">
      <div className="mx-auto max-w-7xl px-4 py-6 md:px-6">
        {/* ================================================== */}
        {/* 顶部 */}
        {/* ================================================== */}

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">
                家庭资金计划
              </h1>

              {dirty && (
                <span className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600">
                  已修改
                </span>
              )}
            </div>

            <div className="mt-1 text-xs text-gray-500">
              {plan.fileName}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() =>
                inputRef.current?.click()
              }
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
            >
              重新导入
            </button>

            <button
              type="button"
              onClick={restoreOriginal}
              disabled={!dirty}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
            >
              恢复 Excel 原值
            </button>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xlsm,.xls"
              className="hidden"
              onChange={handleUpload}
            />
          </div>
        </div>

        {/* ================================================== */}
        {/* 年份 */}
        {/* ================================================== */}

        <div className="mt-6 flex gap-2 overflow-x-auto border-b border-gray-200 pb-3">
          {plan.years.map((year) => (
            <button
              key={year.year}
              type="button"
              onClick={() => {
                setSelectedYear(
                  year.year
                );
                setExpandedMonth(null);
              }}
              className={`shrink-0 rounded-lg px-4 py-2 text-sm ${
                selectedYear === year.year
                  ? "bg-black text-white"
                  : "bg-gray-100 text-gray-700"
              }`}
            >
              {year.year}
            </button>
          ))}
        </div>

        {currentYear && (
          <>
            {/* ================================================= */}
            {/* 年度汇总 */}
            {/* ================================================= */}

            <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
              <SummaryCard
                title="全年收入"
                value={summary.income}
              />

              <SummaryCard
                title="全年本月剩下合计"
                value={summary.remaining}
              />

              <SummaryCard
                title="年末总现金"
                value={summary.endCash}
              />

              <SummaryCard
                title="年末积累年金"
                value={summary.endAnnuity}
              />
            </div>

            {/* ================================================= */}
            {/* 月份 */}
            {/* ================================================= */}

            <div className="mt-8 space-y-3">
              {currentYear.months.map(
                (month) => {
                  const open =
                    expandedMonth ===
                    month.id;

                  return (
                    <section
                      key={month.id}
                      className="overflow-hidden rounded-xl border border-gray-200"
                    >
                      {/* 月份标题 */}
                      <button
                        type="button"
                        onClick={() =>
                          setExpandedMonth(
                            open
                              ? null
                              : month.id
                          )
                        }
                        className="flex w-full items-center justify-between px-4 py-4 text-left hover:bg-gray-50"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-12 text-base font-semibold">
                            {month.month}月
                          </div>

                          <div className="hidden text-xs text-gray-500 md:block">
                            {month.lines.length} 个项目
                          </div>
                        </div>

                        <div className="flex items-center gap-5 text-sm">
                          <div>
                            <span className="mr-2 text-gray-400">
                              收入
                            </span>
                            <span className="font-medium">
                              ¥
                              {formatMoney(
                                month.income
                              )}
                            </span>
                          </div>

                          <div className="hidden md:block">
                            <span className="mr-2 text-gray-400">
                              本月剩下
                            </span>
                            <span className="font-medium">
                              ¥
                              {formatMoney(
                                month.remaining
                              )}
                            </span>
                          </div>

                          <div className="hidden md:block">
                            <span className="mr-2 text-gray-400">
                              总现金
                            </span>
                            <span className="font-medium">
                              ¥
                              {formatMoney(
                                month.totalCash
                              )}
                            </span>
                          </div>

                          <span className="text-gray-400">
                            {open
                              ? "−"
                              : "+"}
                          </span>
                        </div>
                      </button>

                      {/* ================================================= */}
                      {/* 月度详细编辑 */}
                      {/* ================================================= */}

                      {open && (
                        <div className="border-t border-gray-200">
                          <div className="overflow-x-auto">
                            <table className="w-full min-w-[720px] text-sm">
                              <thead>
                                <tr className="border-b border-gray-200 bg-gray-50 text-left text-xs text-gray-500">
                                  <th className="px-4 py-3 font-medium">
                                    项目
                                  </th>

                                  <th className="w-52 px-4 py-3 font-medium">
                                    金额
                                  </th>

                                  <th className="w-36 px-4 py-3 text-right font-medium">
                                    操作
                                  </th>
                                </tr>
                              </thead>

                              <tbody>
                                {month.lines.map(
                                  (line) => {
                                    const result =
                                      isResultLabel(
                                        line.label
                                      );

                                    return (
                                      <tr
                                        key={
                                          line.id
                                        }
                                        className="border-b border-gray-100 last:border-b-0"
                                      >
                                        {/* 项目名称 */}
                                        <td className="px-4 py-3">
                                          {result ? (
                                            <div className="font-medium">
                                              {
                                                line.label
                                              }
                                            </div>
                                          ) : (
                                            <input
                                              value={
                                                line.label
                                              }
                                              onChange={(
                                                e
                                              ) =>
                                                renameLine(
                                                  currentYear.year,
                                                  month.id,
                                                  line.id,
                                                  e
                                                    .target
                                                    .value
                                                )
                                              }
                                              className="w-full rounded-lg border border-transparent bg-transparent px-2 py-2 outline-none hover:border-gray-300 focus:border-gray-500"
                                            />
                                          )}
                                        </td>

                                        {/* 金额 */}
                                        <td className="px-4 py-3">
                                          {result ? (
                                            <div className="rounded-lg bg-gray-50 px-3 py-2 font-medium">
                                              ¥
                                              {formatMoney(
                                                line.value
                                              )}
                                            </div>
                                          ) : (
                                            <input
                                              type="number"
                                              step="0.01"
                                              value={
                                                line.value ??
                                                ""
                                              }
                                              onChange={(
                                                e
                                              ) =>
                                                changeLineValue(
                                                  currentYear.year,
                                                  month.id,
                                                  line.id,
                                                  e
                                                    .target
                                                    .value
                                                )
                                              }
                                              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-right outline-none focus:border-gray-500"
                                            />
                                          )}
                                        </td>

                                        {/* 操作 */}
                                        <td className="px-4 py-3 text-right">
                                          {!result && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                deleteLine(
                                                  currentYear.year,
                                                  month.id,
                                                  line.id
                                                )
                                              }
                                              className="text-xs text-gray-400 hover:text-red-600"
                                            >
                                              删除
                                            </button>
                                          )}
                                        </td>
                                      </tr>
                                    );
                                  }
                                )}
                              </tbody>
                            </table>
                          </div>

                          {/* 新增 */}
                          <div className="border-t border-gray-200 px-4 py-3">
                            <button
                              type="button"
                              onClick={() =>
                                addLine(
                                  currentYear.year,
                                  month.id
                                )
                              }
                              className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-gray-500 hover:text-gray-900"
                            >
                              ＋ 新增项目
                            </button>
                          </div>

                          {/* ================================================= */}
                          {/* 计算结果 */}
                          {/* ================================================= */}

                          <div className="grid grid-cols-1 border-t border-gray-200 bg-gray-50 md:grid-cols-3">
                            <ResultBox
                              title="本月剩下"
                              value={
                                month.remaining
                              }
                            />

                            <ResultBox
                              title="总现金剩下"
                              value={
                                month.totalCash
                              }
                            />

                            <ResultBox
                              title="积累年金"
                              value={
                                month.annuity
                              }
                            />
                          </div>
                        </div>
                      )}
                    </section>
                  );
                }
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}

// ============================================================
// Summary Card
// ============================================================

function SummaryCard({
  title,
  value,
}: {
  title: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-gray-200 p-4">
      <div className="text-xs text-gray-500">
        {title}
      </div>

      <div className="mt-2 text-lg font-semibold">
        ¥{formatMoney(value)}
      </div>
    </div>
  );
}

// ============================================================
// Result Box
// ============================================================

function ResultBox({
  title,
  value,
}: {
  title: string;
  value: number | null;
}) {
  return (
    <div className="border-b border-gray-200 p-4 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0">
      <div className="text-xs text-gray-500">
        {title}
      </div>

      <div className="mt-1 text-base font-semibold">
        ¥{formatMoney(value)}
      </div>
    </div>
  );
}