"use client";


import React, {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
getLatestAsset,
getHoldingsHistoryComparison,
getPerformanceHistory,
} from "@/lib/asset";


// =====================================================
// 类型
// =====================================================

type PerformancePoint = {

date: string;

profit: number;

profitRate: number;

amount: number;

};

type ComparisonData = {

latestDate: string | null;

previousDate: string | null;

latest: any[];

previous: any[];

};

type Period =
| "daily"
| "weekly"
| "monthly"
| "yearly";

type SortDirection = "asc" | "desc";

type SortState = {
  key: string | null;
  direction: SortDirection;
};

// =====================================================
// 工具
// =====================================================

function toNumber(
value: any
): number {

const n =
Number(value);

return Number.isFinite(n)
? n
: 0;

}

// =====================================================
// 判断 market
// =====================================================

function normalizeMarket(
value: any
): string {

return String(
value ?? ""
)
.trim()
.toUpperCase();

}

function isMainlandMarket(
value: any
): boolean {

const market =
normalizeMarket(
value
);

return (
market === "CN" ||
market === "CHINA"
);

}

function isHongKongMarket(
value: any
): boolean {

const market =
normalizeMarket(
value
);

return (
market === "HK" ||
market === "HONGKONG" ||
market === "US" ||
market === "USA" ||
market === "LU" ||
market === "LUXEMBOURG"
);

}

// =====================================================
// Currency
// =====================================================

function formatMoney(
value: number
): string {

const amount =
Math.round(
value
);

if (
amount < 0
) {

 
return (
  "-¥" +
  Math.abs(
    amount
  ).toLocaleString(
    "zh-CN"
  )
);
 

}

return (
"¥" +
amount.toLocaleString(
"zh-CN"
)
);

}

function formatRate(
value: number
): string {

const n =
toNumber(
value
);

const sign =
n > 0
? "+"
: "";

return (
sign +
n.toFixed(2) +
"%"
);

}

function formatSignedMoney(value: number): string {
  const n = toNumber(value);

  return n > 0 ? "+" + formatMoney(n) : formatMoney(n);
}


function amountTrendColor(
  current: number,
  previous: number | undefined
): string {
  if (previous === undefined) return "text-gray-400";

  if (current > previous) return "text-red-600";
  if (current < previous) return "text-green-600";

  return "text-gray-400";
}
// =====================================================
// 资产分类
// =====================================================

type AssetCategory =
  | "fixed_income"
  | "china_stock"
  | "global_stock"
  | "gold";

const CATEGORY_ORDER: AssetCategory[] = [
  "fixed_income",
  "china_stock",
  "global_stock",
  "gold",
];

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  fixed_income: "Fixed Income",
  china_stock: "China Stock",
  global_stock: "Global Stock",
  gold: "Gold",
};

function getCategory(row: any): AssetCategory | null {
  const raw = String(
    row?.category ??
      row?.asset_class ??
      row?.asset_type ??
      row?.type ??
      ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (raw.includes("fixed")) return "fixed_income";
  if (raw.includes("gold")) return "gold";
  if (raw.includes("china")) return "china_stock";
  if (raw.includes("global")) return "global_stock";

  if (isMainlandMarket(row?.market)) return "china_stock";
  if (isHongKongMarket(row?.market)) return "global_stock";

  return null;
}

function hasValue(value: any): boolean {
  return value !== undefined && value !== null && value !== "";
}

function getPnl(row: any): { profit: number | null; base: number } {
  const amount = toNumber(row?.amount);

  const profitRaw = row?.profit ?? row?.pnl ?? row?.profit_amount;
  const costRaw = row?.cost ?? row?.cost_amount ?? row?.principal;

  if (hasValue(profitRaw)) {
    const profit = toNumber(profitRaw);

    return {
      profit,
      base: hasValue(costRaw) ? toNumber(costRaw) : amount - profit,
    };
  }

  if (hasValue(costRaw)) {
    const cost = toNumber(costRaw);

    return { profit: amount - cost, base: cost };
  }

  return { profit: null, base: 0 };
}

function pnlColor(value: number | null): string {
  if (value === null || value === 0) return "text-gray-400";

  return value > 0 ? "text-red-600" : "text-green-600";
}

function formatPercent(value: number): string {
  return value.toFixed(1) + "%";
}

function calcRate(profit: number | null, base: number): number | null {
  return profit !== null && base > 0 ? (profit / base) * 100 : null;
}

// =====================================================
// 排序工具
// =====================================================

function sortIcon(sort: SortState, key: string): string {
  if (sort.key !== key) return "↕";
  return sort.direction === "asc" ? "↑" : "↓";
}

function toggleSort(
  setter: React.Dispatch<React.SetStateAction<SortState>>,
  key: string
) {
  setter((prev) => {
    if (prev.key !== key) {
      return { key, direction: "asc" };
    }
    if (prev.direction === "asc") {
      return { key, direction: "desc" };
    }
    return { key: null, direction: "asc" };
  });
}

function SortableTh({
  label,
  sortKey,
  sort,
  setSort,
  align = "left",
  children,
  className = "",
}: {
  label?: string;
  sortKey: string;
  sort: SortState;
  setSort: React.Dispatch<React.SetStateAction<SortState>>;
  align?: "left" | "right" | "center";
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={`
        ${className}
        ${
          align === "right"
            ? "text-right"
            : align === "center"
              ? "text-center"
              : "text-left"
        }
      `}
    >
      <button
        type="button"
        onClick={() => toggleSort(setSort, sortKey)}
        className={`
          inline-flex
          w-full
          items-center
          gap-1
          ${
            align === "right"
              ? "justify-end"
              : align === "center"
                ? "justify-center"
                : "justify-start"
          }
        `}
      >
        {children ?? label}
        <span
          className={`text-[10px] ${
            sort.key === sortKey
              ? "font-bold text-gray-900"
              : "text-gray-300"
          }`}
        >
          {sortIcon(sort, sortKey)}
        </span>
      </button>
    </th>
  );
}

function compareValues(a: any, b: any): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;

  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }

  return String(a).localeCompare(String(b), "zh-CN", {
    numeric: true,
    sensitivity: "base",
  });
}

function applySort<T>(rows: T[], sort: SortState, getter: (row: T, key: string) => any): T[] {
  if (!sort.key) return rows;

  return [...rows].sort((a, b) => {
    const result = compareValues(
      getter(a, sort.key!),
      getter(b, sort.key!)
    );
    return sort.direction === "asc" ? result : -result;
  });
}

// =====================================================
// 今日表现计算
// =====================================================

function calculateTodayPerformance(
latest: any[],
previous: any[]
) {

const latestMap =
new Map<
string,
any
>();

const previousMap =
new Map<
string,
any
>();

latest.forEach(
row => {

  const key =
    String(
      row?.code ??
      ""
    )
      .trim()
      .toUpperCase();

  if (
    key
  ) {

    latestMap.set(
      key,
      row
    );

  }

}
);

previous.forEach(
row => {

  const key =
    String(
      row?.code ??
      ""
    )
      .trim()
      .toUpperCase();

  if (
    key
  ) {

    previousMap.set(
      key,
      row
    );

  }

}
);

let mainlandLatest =
0;

let mainlandPrevious =
0;

let hkLatest =
0;

let hkPrevious =
0;

const codes =
new Set<string>([
...latestMap.keys(),
...previousMap.keys(),
]);

codes.forEach(
code => {

  const current =
    latestMap.get(
      code
    );

  const previousRow =
    previousMap.get(
      code
    );

  const market =
    current?.market ??
    previousRow?.market;

  const currentAmount =
    toNumber(
      current?.amount
    );

  const previousAmount =
    toNumber(
      previousRow?.amount
    );

  if (
    isMainlandMarket(
      market
    )
  ) {

    mainlandLatest +=
      currentAmount;

    mainlandPrevious +=
      previousAmount;

  }
  else if (
    isHongKongMarket(
      market
    )
  ) {

    hkLatest +=
      currentAmount;

    hkPrevious +=
      previousAmount;

  }

}
);

const mainlandProfit =
mainlandLatest -
mainlandPrevious;

const hkProfit =
hkLatest -
hkPrevious;

const totalProfit =
mainlandProfit +
hkProfit;

const mainlandRate =
mainlandPrevious > 0
? (
mainlandProfit /
mainlandPrevious
) *
100
: 0;

const hkRate =
hkPrevious > 0
? (
hkProfit /
hkPrevious
) *
100
: 0;

const totalPrevious =
mainlandPrevious +
hkPrevious;

const totalRate =
totalPrevious > 0
? (
totalProfit /
totalPrevious
) *
100
: 0;

return {

mainland: {
  profit: mainlandProfit,
  rate: mainlandRate,
},

hk: {
  profit: hkProfit,
  rate: hkRate,
},

total: {
  profit: totalProfit,
  rate: totalRate,
},

};

}

// =====================================================
// 今日表现表格
// =====================================================

function TodayBlock({
  rows,
}: {
  rows: {
    label: string;
    profit: number;
    rate: number;
  }[];
}) {
  const [sort, setSort] = useState<SortState>({ key: null, direction: "asc" });

  const sorted = useMemo(
    () =>
      applySort(rows, sort, (row, key) => {
        if (key === "label") return row.label;
        if (key === "profit") return row.profit;
        if (key === "rate") return row.rate;
        return "";
      }),
    [rows, sort]
  );

  return (
    <div className="max-w-[600px] overflow-x-auto mx-auto [-webkit-overflow-scrolling:touch]">
      <table className="w-full table-fixed border-collapse text-sm bg-white">
        <colgroup>
          <col style={{ width: "34%" }} />
          <col style={{ width: "33%" }} />
          <col style={{ width: "33%" }} />
        </colgroup>

        <thead>
          <tr>
            <SortableTh
              label="项目"
              sortKey="label"
              sort={sort}
              setSort={setSort}
              className="border-b border-b-black/40 px-4 py-3 text-sm font-bold text-gray-800"
            />

            <SortableTh
              label="收益额"
              sortKey="profit"
              sort={sort}
              setSort={setSort}
              align="right"
              className="border-b border-b-black/40 px-4 py-3 text-sm font-bold text-gray-800"
            />

            <SortableTh
              label="收益率"
              sortKey="rate"
              sort={sort}
              setSort={setSort}
              align="right"
              className="border-b border-b-black/40 px-4 py-3 text-sm font-bold text-gray-800"
            />
          </tr>
        </thead>

        <tbody>
          {sorted.map((row, index) => (
            <tr
              key={row.label}
              className={
                index === sorted.length - 1
                  ? "[&>td]:border-b-black"
                  : ""
              }
            >
              <td className="border-b border-b-black/30 px-4 py-3 text-left font-semibold text-gray-900">
                {row.label}
              </td>

              <td
                className={`border-b border-b-black/30 px-4 py-3 text-right font-semibold whitespace-nowrap ${pnlColor(
                  row.profit
                )}`}
              >
                {formatSignedMoney(row.profit)}
              </td>

              <td
                className={`border-b border-b-black/30 px-4 py-3 text-right font-semibold whitespace-nowrap ${pnlColor(
                  row.rate
                )}`}
              >
                {formatRate(row.rate)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =====================================================
// 历史表格
// =====================================================

function HistoryTable({
  title,
  points,
  period,
}: {
  title: string;

  points: PerformancePoint[];

  period: Period;
}) {
  const displayLimit =
    period === "daily"
      ? 30
      : period === "weekly"
        ? 12
        : period === "monthly"
          ? 12
          : 5;

  const displayPoints = points.slice(0, displayLimit);

  const [sort, setSort] = useState<SortState>({ key: null, direction: "asc" });

  const sortedPoints = useMemo(() => {
    const withDerived = displayPoints.map((point, index) => {
      const previousAmount = points[index + 1]?.amount;
      const hasChange = previousAmount !== undefined;

      const changeAmount = hasChange
        ? point.amount - previousAmount
        : 0;

      const depositWithdrawal = hasChange
        ? changeAmount - point.profit
        : 0;

      return {
        ...point,
        changeAmount,
        depositWithdrawal,
        hasChange,
      };
    });

    return applySort(withDerived, sort, (row, key) => {
      if (key === "date") return row.date;
      if (key === "amount") return row.amount;
      if (key === "changeAmount") return row.changeAmount;
      if (key === "depositWithdrawal") return row.depositWithdrawal;
      if (key === "profit") return row.profit;
      if (key === "profitRate") return row.profitRate;
      return "";
    });
  }, [displayPoints, points, sort]);

  const cell = "border-b border-b-black/10 px-2 sm:px-4 py-3";
  const sep = "border-l border-l-black";
  const lastRow = "[&>td]:border-b-black";

  return (
    <section>
      {title ? (
        <div className="mb-4 text-lg font-semibold">{title}</div>
      ) : null}

      <div className="mb-1 text-center text-xs text-gray-400 sm:hidden">
        ← 左右滑动查看完整表格 →
      </div>
      <div className="max-w-[800px] overflow-x-auto mx-auto [-webkit-overflow-scrolling:touch]">
    <table className="w-full min-w-[680px] table-fixed border-collapse border border-black text-sm">
  <colgroup>
    <col style={{ width: "16%" }} />
    <col style={{ width: "17%" }} />
    <col style={{ width: "17%" }} />
    <col style={{ width: "17%" }} />
    <col style={{ width: "17%" }} />
    <col style={{ width: "16%" }} />
  </colgroup>

  <thead>
    <tr>
      <th
        rowSpan={2}
        className="border-b border-b-black bg-gray-100 px-4 py-3 text-left text-sm font-bold text-gray-800"
      >
        <button
          type="button"
          onClick={() => toggleSort(setSort, "date")}
          className="inline-flex w-full items-center gap-1 justify-start"
        >
          日期
          <span
            className={`text-[10px] ${
              sort.key === "date" ? "font-bold text-gray-900" : "text-gray-300"
            }`}
          >
            {sortIcon(sort, "date")}
          </span>
        </button>
      </th>

      <th
        rowSpan={2}
        className="border-l border-l-black border-b border-b-black bg-gray-100 px-4 py-3 text-right text-sm font-bold text-gray-800"
      >
        <button
          type="button"
          onClick={() => toggleSort(setSort, "amount")}
          className="inline-flex w-full items-center gap-1 justify-end"
        >
          资产金额
          <span
            className={`text-[10px] ${
              sort.key === "amount" ? "font-bold text-gray-900" : "text-gray-300"
            }`}
          >
            {sortIcon(sort, "amount")}
          </span>
        </button>
      </th>

      <th
        rowSpan={2}
        className="border-l border-l-black border-b border-b-black bg-gray-100 px-4 py-3 text-right text-sm font-bold text-gray-800"
      >
        <button
          type="button"
          onClick={() => toggleSort(setSort, "changeAmount")}
          className="inline-flex w-full items-center gap-1 justify-end"
        >
          <span>
            变动额
            <span className="block text-xs font-normal text-gray-400">
              (出入金+收益额)
            </span>
          </span>
          <span
            className={`text-[10px] ${
              sort.key === "changeAmount" ? "font-bold text-gray-900" : "text-gray-300"
            }`}
          >
            {sortIcon(sort, "changeAmount")}
          </span>
        </button>
      </th>

      <th
        rowSpan={2}
        className="border-l border-l-black border-b border-b-black bg-gray-100 px-4 py-3 text-right text-sm font-bold text-gray-800"
      >
        <button
          type="button"
          onClick={() => toggleSort(setSort, "depositWithdrawal")}
          className="inline-flex w-full items-center gap-1 justify-end"
        >
          出入金
          <span
            className={`text-[10px] ${
              sort.key === "depositWithdrawal" ? "font-bold text-gray-900" : "text-gray-300"
            }`}
          >
            {sortIcon(sort, "depositWithdrawal")}
          </span>
        </button>
      </th>

      <th
        colSpan={2}
        className="border-l border-l-black border-b border-b-black/10 bg-[#F3EBD3] px-2 py-2 text-center text-sm font-bold text-[#8A6A2A]"
      >
        收益
      </th>
    </tr>

    <tr>
      <th className="border-l border-l-black border-b border-b-black bg-[#FBF8EF] px-4 py-2 text-right text-xs font-medium text-gray-500">
        <button
          type="button"
          onClick={() => toggleSort(setSort, "profit")}
          className="inline-flex w-full items-center gap-1 justify-end"
        >
          收益额
          <span
            className={`text-[10px] ${
              sort.key === "profit" ? "font-bold text-gray-900" : "text-gray-300"
            }`}
          >
            {sortIcon(sort, "profit")}
          </span>
        </button>
      </th>

      <th className="border-b border-b-black bg-[#FBF8EF] px-4 py-2 text-right text-xs font-medium text-gray-500">
        <button
          type="button"
          onClick={() => toggleSort(setSort, "profitRate")}
          className="inline-flex w-full items-center gap-1 justify-end"
        >
          收益率
          <span
            className={`text-[10px] ${
              sort.key === "profitRate" ? "font-bold text-gray-900" : "text-gray-300"
            }`}
          >
            {sortIcon(sort, "profitRate")}
          </span>
        </button>
      </th>
    </tr>
  </thead>

  <tbody>
    {sortedPoints.length === 0 ? (
      <tr className={lastRow}>
        <td
          colSpan={6}
          className="border-b border-b-black bg-gray-50 px-4 py-8 text-center text-gray-400"
        >
          暂无历史数据
        </td>
      </tr>
    ) : (
      sortedPoints.map((point, index) => {
        const amountColor = amountTrendColor(
          point.amount,
          points[index + 1]?.amount
        );

        return (
          <tr
            key={point.date}
            className={`hover:brightness-95 ${
              index === sortedPoints.length - 1 ? lastRow : ""
            }`}
          >
            <td
              className={`${cell} bg-gray-50 text-left font-medium text-gray-900`}
            >
              {point.date}
            </td>

            <td
              className={`${cell} ${sep} bg-gray-50 text-right font-semibold whitespace-nowrap ${amountColor}`}
            >
              {formatMoney(point.amount)}
            </td>

            <td
              className={`${cell} ${sep} bg-gray-50 text-right font-semibold whitespace-nowrap ${
                point.hasChange ? pnlColor(point.changeAmount) : "text-gray-400"
              }`}
            >
              {point.hasChange ? formatSignedMoney(point.changeAmount) : "—"}
            </td>

            <td
              className={`${cell} ${sep} bg-gray-50 text-right font-semibold whitespace-nowrap ${
                point.hasChange ? pnlColor(point.depositWithdrawal) : "text-gray-400"
              }`}
            >
              {point.hasChange ? formatSignedMoney(point.depositWithdrawal) : "—"}
            </td>

            <td
              className={`${cell} ${sep} bg-[#FBF8EF] text-right font-semibold whitespace-nowrap ${pnlColor(
                point.profit
              )}`}
            >
              {formatSignedMoney(point.profit)}
            </td>

            <td
              className={`${cell} bg-[#FBF8EF] text-right font-semibold whitespace-nowrap ${pnlColor(
                point.profitRate
              )}`}
            >
              {formatRate(point.profitRate)}
            </td>
          </tr>
        );
      })
    )}
  </tbody>
</table>
      </div>

      {points.length > displayLimit && (
        <div className="mt-2 max-w-[800px] text-right text-xs text-gray-400 mx-auto">
          显示最近 {displayLimit} 条
        </div>
      )}
    </section>
  );
}

// =====================================================
// 历史区块
// =====================================================

function HistorySection({
title,
history,
}: {
title: string;

history: {
daily: PerformancePoint[];
weekly: PerformancePoint[];
monthly: PerformancePoint[];
yearly: PerformancePoint[];
};

}) {

const [
period,
setPeriod,
] =
useState<Period>(
"weekly"
);

const points =
Array.isArray(
history?.[period]
)
? history[period]
: [];

return (

 
<section>

  <div
    className="
      flex
      flex-wrap
      items-center
      gap-2
      sm:gap-4
      mb-4
      justify-center
    "
  >

    <h2
      className="
        text-xl
        font-semibold
      "
    >

      {title}

    </h2>


    <div
      className="
        inline-flex
        rounded-lg
        border
        bg-white
        p-1
      "
    >

      {[
        {
          key:
            "daily" as Period,

          label:
            "日",
        },

        {
          key:
            "weekly" as Period,

          label:
            "周",
        },

        {
          key:
            "monthly" as Period,

          label:
            "月",
        },

        {
          key:
            "yearly" as Period,

          label:
            "年",
        },

      ].map(
        item => (

          <button
            key={
              item.key
            }
            type="button"
            onClick={() =>
              setPeriod(
                item.key
              )
            }
            className={`
              rounded-md
              px-4
              py-1.5
              text-sm
              transition

              ${
                period ===
                item.key
                  ? `
                    bg-black
                    text-white
                  `
                  : `
                    text-gray-600
                    hover:bg-gray-100
                  `
              }
            `}
          >

            {
              item.label
            }

          </button>

        )
      )}

    </div>

  </div>


  <HistoryTable
    title=""
    points={
      points
    }
    period={
      period
    }
  />

</section>
 

);

}

function TodayAssetTable({
  title,
  latest,
  previous,
  filter,
  emptyText,
}: {
  title: string;

  latest: any[];

  previous: any[];

  filter: (market: any) => boolean;

  emptyText: string;
}) {
  const items = latest
    .filter((row) => filter(row?.market))
    .map((row) => {
      const code = String(row?.code ?? "").trim().toUpperCase();

      const previousRow = previous.find(
        (item) =>
          String(item?.code ?? "").trim().toUpperCase() === code
      );

      const currentAmount = toNumber(row?.amount);
      const previousAmount = toNumber(previousRow?.amount);

      const profit = currentAmount - previousAmount;

      const rate =
        previousAmount > 0 ? (profit / previousAmount) * 100 : 0;

      return {
        code,
        name: row?.name ?? "-",
        profit,
        rate,
      };
    });

  const [sort, setSort] = useState<SortState>({ key: null, direction: "asc" });

  const sortedItems = useMemo(
    () =>
      applySort(items, sort, (row, key) => {
        if (key === "name") return row.name;
        if (key === "code") return row.code;
        if (key === "profit") return row.profit;
        if (key === "rate") return row.rate;
        return "";
      }),
    [items, sort]
  );

  const cell = "border-b border-b-black/10 px-2 sm:px-4 py-3";
  const txt = `${cell} text-left break-words`;
  const num = `${cell} text-right whitespace-nowrap`;
  const sep = "border-l border-l-black";
  const lastRow = "[&>td]:border-b-black";

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold text-center">{title}</h2>

      <div className="max-w-[1100px] overflow-x-auto mx-auto [-webkit-overflow-scrolling:touch]">
        <table className="w-full table-fixed border-collapse border border-black text-sm">
          <colgroup>
            <col style={{ width: "34%" }} /> 
            <col style={{ width: "30%" }} /> 
            <col style={{ width: "18%" }} /> 
            <col style={{ width: "18%" }} /> 
          </colgroup>

          <thead>
            <tr>
              <SortableTh
                label="名称"
                sortKey="name"
                sort={sort}
                setSort={setSort}
                className="border-b border-b-black bg-gray-100 px-4 py-3 text-sm font-bold text-gray-800"
              />

              <SortableTh
                label="代码"
                sortKey="code"
                sort={sort}
                setSort={setSort}
                className="border-b border-b-black bg-gray-100 px-4 py-3 text-sm font-bold text-gray-800"
              />

              <SortableTh
                label="今日收益"
                sortKey="profit"
                sort={sort}
                setSort={setSort}
                align="right"
                className="border-l border-l-black border-b border-b-black bg-[#F3EBD3] px-4 py-3 text-sm font-bold text-[#8A6A2A]"
              />

              <SortableTh
                label="今日涨跌"
                sortKey="rate"
                sort={sort}
                setSort={setSort}
                align="right"
                className="border-b border-b-black bg-[#F3EBD3] px-4 py-3 text-sm font-bold text-[#8A6A2A]"
              />
            </tr>
          </thead>

          <tbody>
            {sortedItems.length === 0 ? (
              <tr className={lastRow}>
                <td
                  colSpan={4}
                  className="border-b border-b-black bg-gray-50 px-4 py-8 text-center text-gray-400"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              sortedItems.map((item, index) => (
                <tr
                  key={`${item.code}-${index}`}
                  className={`hover:brightness-95 ${
                    index === sortedItems.length - 1 ? lastRow : ""
                  }`}
                >
                  <td
                    className={`${txt} bg-gray-50 font-medium text-gray-900`}
                  >
                    {item.name}
                  </td>

                  <td className={`${txt} bg-gray-50 text-gray-500`}>
                    {item.code}
                  </td>

                  <td
                    className={`${num} ${sep} bg-[#FBF8EF] font-semibold ${pnlColor(
                      item.profit
                    )}`}
                  >
                    {formatSignedMoney(item.profit)}
                  </td>

                  <td
                    className={`${num} bg-[#FBF8EF] font-semibold ${pnlColor(
                      item.rate
                    )}`}
                  >
                    {formatRate(item.rate)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// =====================================================
// 资产分类明细表
// =====================================================

type AllocationItem = {
  code: string;
  name: string;
  amount: number;
  profit: number | null;
  base: number;
};

function AllocationTable({ rows }: { rows: any[] }) {
  const { groups, totalAmount, totalProfit, totalBase } = useMemo(() => {
    const map = new Map<AssetCategory, AllocationItem[]>();

    CATEGORY_ORDER.forEach((key) => map.set(key, []));

    rows.forEach((row) => {
      const category = getCategory(row);

      if (!category) return;

      const { profit, base } = getPnl(row);

      map.get(category)!.push({
        code: String(row?.code ?? "").trim().toUpperCase(),
        name: row?.name ?? "-",
        amount: toNumber(row?.amount),
        profit,
        base,
      });
    });

    const groups = CATEGORY_ORDER.map((key) => {
      const items = (map.get(key) ?? []).sort(
        (a, b) => b.amount - a.amount
      );

      const amount = items.reduce((sum, item) => sum + item.amount, 0);

      const hasPnl = items.some((item) => item.profit !== null);

      const profit = hasPnl
        ? items.reduce((sum, item) => sum + (item.profit ?? 0), 0)
        : null;

      const base = items.reduce(
        (sum, item) => sum + (item.profit !== null ? item.base : 0),
        0
      );

      return { key, items, amount, profit, base };
    });

    const totalAmount = groups.reduce((sum, g) => sum + g.amount, 0);

    const hasAnyPnl = groups.some((g) => g.profit !== null);

    const totalProfit = hasAnyPnl
      ? groups.reduce((sum, g) => sum + (g.profit ?? 0), 0)
      : null;

    const totalBase = groups.reduce((sum, g) => sum + g.base, 0);

    return { groups, totalAmount, totalProfit, totalBase };
  }, [rows]);

  const [sort, setSort] = useState<SortState>({ key: null, direction: "asc" });

  const sortedGroups = useMemo(() => {
    return groups.map((group) => {
      const items = applySort(group.items, sort, (item, key) => {
        if (key === "name") return item.name;
        if (key === "code") return item.code;
        if (key === "amount") return item.amount;
        if (key === "profit") return item.profit ?? 0;
        if (key === "profitRate") {
          return calcRate(item.profit, item.base) ?? 0;
        }
        if (key === "shareGroup") {
          return group.amount > 0 ? item.amount / group.amount : 0;
        }
        if (key === "shareTotal") {
          return totalAmount > 0 ? item.amount / totalAmount : 0;
        }
        return "";
      });

      return { ...group, items };
    });
  }, [groups, sort, totalAmount]);

  const share = (amount: number, total: number) =>
    total > 0 ? formatPercent((amount / total) * 100) : "—";

  const signedMoney = (value: number | null) =>
    value === null
      ? "—"
      : value > 0
        ? "+" + formatMoney(value)
        : formatMoney(value);

  const rateText = (rate: number | null) =>
    rate === null ? "—" : formatRate(rate);

  const bg = {
    base: "bg-gray-50",
    amount: "bg-[#F4F7F9]",
    pnl: "bg-[#FBF8EF]",
    share: "bg-[#F7F7F5]",
  };

  const bgStrong = {
    base: "bg-gray-200",
    amount: "bg-[#E6ECF1]",
    pnl: "bg-[#F3EBD3]",
    share: "bg-[#ECECE8]",
  };

  const sep = "border-l border-l-black";

  const tableCls =
    "w-full table-fixed border-collapse border border-black text-[10px] sm:text-sm";

  const cols = (
    <colgroup>
      <col className="w-[22%] sm:w-[25%]" />
      <col className="hidden sm:table-column sm:w-[22%]" />
      <col className="w-[22%] sm:w-[13%]" />
      <col className="w-[19%] sm:w-[11%]" />
      <col className="w-[13%] sm:w-[9%]" />
      <col className="w-[11%] sm:w-[9%]" />
      <col className="w-[13%] sm:w-[11%]" />
    </colgroup>
  );
  const cell = "border-b border-b-black/10 px-0.5 sm:px-4 py-2 sm:py-3";
  const txt = `${cell} text-left break-words`;
  const num = `${cell} text-right whitespace-nowrap tracking-tighter sm:tracking-normal`;

  const lastRow = "[&>td]:border-b-black";

  return (
    <div className="max-w-[1100px] space-y-4 overflow-x-auto mx-auto [-webkit-overflow-scrolling:touch] [-webkit-text-size-adjust:100%] [text-size-adjust:100%]">
      <table className={tableCls}>
        {cols}

        <thead>
          <tr>
            <th
              rowSpan={2}
              className="border-b border-b-black bg-gray-100 px-0.5 sm:px-4 py-3 text-left text-[10px] sm:text-sm font-bold text-gray-800"
            >
              <button
                type="button"
                onClick={() => toggleSort(setSort, "name")}
                className="inline-flex w-full items-center gap-1 justify-start"
              >
                名称
                <span
                  className={`text-[10px] ${
                    sort.key === "name" ? "font-bold text-gray-900" : "text-gray-300"
                  }`}
                >
                  {sortIcon(sort, "name")}
                </span>
              </button>
            </th>

            <th
              rowSpan={2}
              className="hidden sm:table-cell border-b border-b-black bg-gray-100 px-0.5 sm:px-4 py-3 text-left text-[10px] sm:text-sm font-bold text-gray-800"
            >
              <button
                type="button"
                onClick={() => toggleSort(setSort, "code")}
                className="inline-flex w-full items-center gap-1 justify-start"
              >
                代码
                <span
                  className={`text-[10px] ${
                    sort.key === "code" ? "font-bold text-gray-900" : "text-gray-300"
                  }`}
                >
                  {sortIcon(sort, "code")}
                </span>
              </button>
            </th>

            <th
              rowSpan={2}
              className="border-l border-l-black border-b border-b-black bg-[#E6ECF1] px-0.5 sm:px-4 py-3 text-right text-[10px] sm:text-sm font-bold text-[#3F5468]"
            >
              <button
                type="button"
                onClick={() => toggleSort(setSort, "amount")}
                className="inline-flex w-full items-center gap-1 justify-end"
              >
                现在金额
                <span
                  className={`text-[10px] ${
                    sort.key === "amount" ? "font-bold text-gray-900" : "text-gray-300"
                  }`}
                >
                  {sortIcon(sort, "amount")}
                </span>
              </button>
            </th>

            <th
              colSpan={2}
              className="border-l border-l-black border-b border-b-black/10 bg-[#F3EBD3] px-0.5 py-2 text-center text-[10px] sm:text-sm font-bold text-[#8A6A2A]"
            >
              盈亏
            </th>

            <th
              colSpan={2}
              className="border-l border-l-black border-b border-b-black/10 bg-[#ECECE8] px-0.5 py-2 text-center text-[10px] sm:text-sm font-bold text-[#6B6B63]"
            >
              占比
            </th>
          </tr>

          <tr>
            <th className="border-l border-l-black border-b border-b-black bg-[#FBF8EF] px-0.5 sm:px-4 py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">
              <button
                type="button"
                onClick={() => toggleSort(setSort, "profit")}
                className="inline-flex w-full items-center gap-1 justify-end"
              >
                盈亏额
                <span
                  className={`text-[10px] ${
                    sort.key === "profit" ? "font-bold text-gray-900" : "text-gray-300"
                  }`}
                >
                  {sortIcon(sort, "profit")}
                </span>
              </button>
            </th>

            <th className="border-b border-b-black bg-[#FBF8EF] px-0.5 sm:px-4 py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">
              <button
                type="button"
                onClick={() => toggleSort(setSort, "profitRate")}
                className="inline-flex w-full items-center gap-1 justify-end"
              >
                盈亏率
                <span
                  className={`text-[10px] ${
                    sort.key === "profitRate" ? "font-bold text-gray-900" : "text-gray-300"
                  }`}
                >
                  {sortIcon(sort, "profitRate")}
                </span>
              </button>
            </th>

            <th className="border-l border-l-black border-b border-b-black bg-[#F7F7F5] px-0.5 sm:px-4 py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">
              <button
                type="button"
                onClick={() => toggleSort(setSort, "shareGroup")}
                className="inline-flex w-full items-center gap-1 justify-end"
              >
                占本类
                <span
                  className={`text-[10px] ${
                    sort.key === "shareGroup" ? "font-bold text-gray-900" : "text-gray-300"
                  }`}
                >
                  {sortIcon(sort, "shareGroup")}
                </span>
              </button>
            </th>

            <th className="border-b border-b-black bg-[#F7F7F5] px-0.5 sm:px-4 py-2 text-right text-[10px] sm:text-xs font-medium text-gray-500">
              <button
                type="button"
                onClick={() => toggleSort(setSort, "shareTotal")}
                className="inline-flex w-full items-center gap-1 justify-end"
              >
                <span className="sm:hidden">占总</span><span className="hidden sm:inline">占总资产</span>
                <span
                  className={`text-[10px] ${
                    sort.key === "shareTotal" ? "font-bold text-gray-900" : "text-gray-300"
                  }`}
                >
                  {sortIcon(sort, "shareTotal")}
                </span>
              </button>
            </th>
          </tr>
        </thead>
      </table>

      {sortedGroups.map((group) => {
        const groupRate = calcRate(group.profit, group.base);
        const lastIndex = group.items.length - 1;

        return (
          <table key={group.key} className={tableCls}>
            {cols}

            <tbody>
              <tr className={lastRow}>
                <td
  className={`${txt} ${bgStrong.base} text-xs sm:text-base font-bold text-gray-900 sm:whitespace-nowrap`}
>
  {CATEGORY_LABEL[group.key]}
</td>
<td className={`${txt} ${bgStrong.base} hidden sm:table-cell`} />

                <td
                  className={`${num} ${sep} ${bgStrong.amount} font-bold text-gray-900`}
                >
                  {formatMoney(group.amount)}
                </td>

                <td
                  className={`${num} ${sep} ${bgStrong.pnl} font-bold ${pnlColor(
                    group.profit
                  )}`}
                >
                  {signedMoney(group.profit)}
                </td>

                <td
                  className={`${num} ${bgStrong.pnl} font-bold ${pnlColor(
                    group.profit
                  )}`}
                >
                  {rateText(groupRate)}
                </td>

                <td
                  className={`${num} ${sep} ${bgStrong.share} text-gray-400`}
                >
                  —
                </td>

                <td
                  className={`${num} ${bgStrong.share} font-bold text-gray-900`}
                >
                  {share(group.amount, totalAmount)}
                </td>
              </tr>

              {group.items.length === 0 ? (
                <tr className={lastRow}>
                  <td
  colSpan={6}
  className={`${txt} ${bg.base} text-gray-400`}
>
  暂无产品
</td>
<td className={`${txt} ${bg.base} hidden sm:table-cell`} />
                </tr>
              ) : (
                group.items.map((item, index) => {
                  const rate = calcRate(item.profit, item.base);

                  return (
                    <tr
                      key={`${group.key}-${item.code}-${index}`}
                      className={`hover:brightness-95 ${
                        index === lastIndex ? lastRow : ""
                      }`}
                    >
                      <td
                        className={`${txt} ${bg.base} font-medium text-gray-900`}
                      >
                        {item.name}
<span className="mt-0.5 block text-[10px] font-normal text-gray-500 sm:hidden">
  {item.code}
</span>
</td>
<td className={`${txt} ${bg.base} hidden sm:table-cell text-gray-500`}>
                        {item.code}
                      </td>

                      <td
                        className={`${num} ${sep} ${bg.amount} font-bold text-gray-900`}
                      >
                        {formatMoney(item.amount)}
                      </td>

                      <td
                        className={`${num} ${sep} ${bg.pnl} font-semibold ${pnlColor(
                          item.profit
                        )}`}
                      >
                        {signedMoney(item.profit)}
                      </td>

                      <td
                        className={`${num} ${bg.pnl} font-semibold ${pnlColor(
                          item.profit
                        )}`}
                      >
                        {rateText(rate)}
                      </td>

                      <td
                        className={`${num} ${sep} ${bg.share} text-gray-600`}
                      >
                        {share(item.amount, group.amount)}
                      </td>

                      <td
                        className={`${num} ${bg.share} font-semibold text-gray-800`}
                      >
                        {share(item.amount, totalAmount)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        );
      })}

      <table className={tableCls}>
        {cols}

        <tbody>
          <tr className={lastRow}>
            <td
  className={`${txt} ${bgStrong.base} text-xs sm:text-base font-bold text-gray-900`}
>
  合计
</td>
<td className={`${txt} ${bgStrong.base} hidden sm:table-cell`} />

            <td
              className={`${num} ${sep} ${bgStrong.amount} font-bold text-gray-900`}
            >
              {formatMoney(totalAmount)}
            </td>

            <td
              className={`${num} ${sep} ${bgStrong.pnl} font-bold ${pnlColor(
                totalProfit
              )}`}
            >
              {signedMoney(totalProfit)}
            </td>

            <td
              className={`${num} ${bgStrong.pnl} font-bold ${pnlColor(
                totalProfit
              )}`}
            >
              {rateText(calcRate(totalProfit, totalBase))}
            </td>

            <td
              className={`${num} ${sep} ${bgStrong.share} text-gray-400`}
            >
              —
            </td>

            <td
              className={`${num} ${bgStrong.share} font-bold text-gray-900`}
            >
              {totalAmount > 0 ? "100.0%" : "—"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// =====================================================
// 核心资产配置表
// =====================================================

function CoreAssetAllocationTable({
  rows,
}: {
  rows: any[];
}) {
  const groups = useMemo(() => {
    const getCode = (row: any) =>
      String(row?.code ?? "")
        .trim()
        .toUpperCase();

    const getName = (row: any) =>
      String(row?.name ?? "")
        .trim()
        .toUpperCase();

    const amountOf = (row: any) =>
      toNumber(row?.amount);

    const asset002849 = rows
      .filter((row) => {
        const code = getCode(row);
        return code === "002849";
      })
      .reduce(
        (sum, row) =>
          sum + amountOf(row),
        0
      );

    const usSp500 = rows
      .filter((row) => {
        const code = getCode(row);
        const name = getName(row);

        return (
          code === "519981" ||
          name.includes("长信标普100") ||
          name.includes("长信标普") ||
          name.includes("美股标普") ||
          name.includes("标普500") ||
          name.includes("标普 500") ||
          name.includes("S&P 500")
        );
      })
      .reduce(
        (sum, row) =>
          sum + amountOf(row),
        0
      );

    const usNasdaq = rows
      .filter((row) => {
        const code = getCode(row);
        const name = getName(row);

        return (
          name.includes("嘉实美股") ||
          name.includes("广发纳指") ||
          name.includes("南方纳指") ||
          name.includes("纳指F") ||
          name.includes("纳指I") ||
          name.includes("纳指A")
        );
      })
      .reduce(
        (sum, row) =>
          sum + amountOf(row),
        0
      );

    const gold = rows
      .filter((row) => {
        const code = getCode(row);
        const name = getName(row);

        return (
          name.includes("黄金") ||
          name.includes("GOLD") ||
          code === "518880" ||
          code === "159934" ||
          code === "GLDM"
        );
      })
      .reduce(
        (sum, row) =>
          sum + amountOf(row),
        0
      );

    const total =
      asset002849 +
      usSp500 +
      usNasdaq +
      gold;

    return [
      {
        key: "002849",
        name: "002849",
        detail: "002849 金信智能混合A",
        amount: asset002849,
      },
      {
        key: "us_sp500",
        name: "美国标普",
        detail: "长信标普100 + 美股标普",
        amount: usSp500,
      },
      {
        key: "us_nasdaq",
        name: "美国纳指",
        detail:
          "嘉实美股 + 广发纳指F + 南方纳指I + 南方纳指A",
        amount: usNasdaq,
      },
      {
        key: "gold",
        name: "黄金",
        detail: "黄金相关资产",
        amount: gold,
      },
    ].map((item) => ({
      ...item,
      share:
        total > 0
          ? (item.amount / total) * 100
          : 0,
    }));
  }, [rows]);

  const totalAmount =
    groups.reduce(
      (sum, item) =>
        sum + item.amount,
      0
    );

  const [sort, setSort] = useState<SortState>({ key: null, direction: "asc" });

  const sortedGroups = useMemo(
    () =>
      applySort(groups, sort, (item, key) => {
        if (key === "name") return item.name;
        if (key === "detail") return item.detail;
        if (key === "amount") return item.amount;
        if (key === "share") return item.share;
        return "";
      }),
    [groups, sort]
  );

  const tableCls =
    "w-full table-fixed border-collapse border border-black text-sm";

  const cell =
    "border-b border-b-black/10 px-4 py-3";

  const txt =
    `${cell} text-left break-words`;

  const num =
    `${cell} text-right whitespace-nowrap`;

  const sep =
    "border-l border-l-black";

  const lastRow =
    "[&>td]:border-b-black";

  return (
    <div className="max-w-[1100px] overflow-x-auto mx-auto [-webkit-overflow-scrolling:touch]">
      <table className={tableCls}>
        <colgroup>
          <col style={{ width: "20%" }} />
          <col style={{ width: "46%" }} />
          <col style={{ width: "17%" }} />
          <col style={{ width: "17%" }} />
        </colgroup>

        <thead>
          <tr>
            <SortableTh
              label="核心资产"
              sortKey="name"
              sort={sort}
              setSort={setSort}
              className="border-b border-b-black bg-gray-100 px-4 py-3 text-sm font-bold text-gray-800"
            />

            <SortableTh
              label="包含资产"
              sortKey="detail"
              sort={sort}
              setSort={setSort}
              className="border-b border-b-black bg-gray-100 px-4 py-3 text-sm font-bold text-gray-800"
            />

            <SortableTh
              label="金额"
              sortKey="amount"
              sort={sort}
              setSort={setSort}
              align="right"
              className="border-l border-l-black border-b border-b-black bg-[#E6ECF1] px-4 py-3 text-sm font-bold text-[#3F5468]"
            />

            <SortableTh
              label="占比"
              sortKey="share"
              sort={sort}
              setSort={setSort}
              align="right"
              className="border-b border-b-black bg-[#ECECE8] px-4 py-3 text-sm font-bold text-[#6B6B63]"
            />
          </tr>
        </thead>

        <tbody>
          {sortedGroups.map(
            (item, index) => (
              <tr
                key={item.key}
                className={
                  index ===
                  sortedGroups.length - 1
                    ? lastRow
                    : ""
                }
              >
                <td
                  className={`
                    ${txt}
                    bg-gray-50
                    font-bold
                    text-gray-900
                  `}
                >
                  {item.name}
                </td>

                <td
                  className={`
                    ${txt}
                    bg-gray-50
                    text-gray-600
                  `}
                >
                  {item.detail}
                </td>

                <td
                  className={`
                    ${num}
                    ${sep}
                    bg-[#F4F7F9]
                    font-bold
                    text-gray-900
                  `}
                >
                  {formatMoney(
                    item.amount
                  )}
                </td>

                <td
                  className={`
                    ${num}
                    bg-[#F7F7F5]
                    font-semibold
                    text-gray-800
                  `}
                >
                  {totalAmount > 0
                    ? item.share.toFixed(1) +
                      "%"
                    : "—"}
                </td>
              </tr>
            )
          )}

          <tr className={lastRow}>
            <td
              colSpan={2}
              className={`
                ${txt}
                bg-gray-200
                text-base
                font-bold
                text-gray-900
              `}
            >
              合计
            </td>

            <td
              className={`
                ${num}
                ${sep}
                bg-[#E6ECF1]
                font-bold
                text-gray-900
              `}
            >
              {formatMoney(
                totalAmount
              )}
            </td>

            <td
              className={`
                ${num}
                bg-[#ECECE8]
                font-bold
                text-gray-900
              `}
            >
              {totalAmount > 0
                ? "100.0%"
                : "—"}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// =====================================================
// Performance Page
// =====================================================

export default function Performance() {

const [
asset,
setAsset,
] =
useState<any>(null);

const [
comparison,
setComparison,
] =
useState<ComparisonData>({
latestDate:
null,

 
  previousDate:
    null,

  latest:
    [],

  previous:
    [],
});
 

const [
performanceHistory,
setPerformanceHistory,
] =
useState<any>(null);

const [
loading,
setLoading,
] =
useState(true);

useEffect(
() => {

 
  async function load() {

    try {

      const [
        latest,
        comparisonData,
        historyData,
      ] =
        await Promise.all([

          getLatestAsset(),

          getHoldingsHistoryComparison(),

          getPerformanceHistory(),

        ]);


      setAsset(
        latest
      );


      setComparison(
        comparisonData
      );


      setPerformanceHistory(
        historyData
      );

    }
    catch (
      error
    ) {

      console.error(
        "Performance load error:",
        error
      );

    }
    finally {

      setLoading(
        false
      );

    }

  }


  load();

},
[]
 

);

const today =
useMemo(
() => {

 
    return calculateTodayPerformance(

      comparison.latest,

      comparison.previous

    );

  },
  [
    comparison.latest,
    comparison.previous,
  ]
);
 

if (
loading ||
!asset ||
!performanceHistory
) {

 
return (

  <>

    <TopBar
      title="Performance"
    />


    <main
      className="
        p-10
      "
    >

      Loading...

    </main>

  </>

);
 

}

return (

 
<>

  <TopBar
    title="Performance"
    lastUpdate={
      asset.snapshot_date
    }
    usdCny={
      asset.usd_cny
    }
  />


  <main
    className="
      p-3
      sm:p-10
      space-y-10
      sm:space-y-12
    "
  >

    <section>

      <h1
        className="
          text-2xl
          font-semibold
          mb-6
          text-center
        "
      >

        今日表现

      </h1>


      <TodayBlock
        rows={[
          {
            label: "大陆",
            profit: today.mainland.profit,
            rate: today.mainland.rate,
          },
          {
            label: "香港",
            profit: today.hk.profit,
            rate: today.hk.rate,
          },
          {
            label: "合计",
            profit: today.total.profit,
            rate: today.total.rate,
          },
        ]}
      />

    </section>




 <section>
      <h1
        className="
          text-2xl
          font-semibold
          mb-8
          text-center
        "
      >
        今日各资产表现
      </h1>

      <div className="space-y-10">
        <TodayAssetTable
          title="大陆"
          latest={comparison.latest}
          previous={comparison.previous}
          filter={isMainlandMarket}
          emptyText="暂无大陆资产"
        />

        <TodayAssetTable
          title="香港"
          latest={comparison.latest}
          previous={comparison.previous}
          filter={isHongKongMarket}
          emptyText="暂无香港资产"
        />
      </div>
    </section>

 <section>
      <h1
        className="
          text-2xl
          font-semibold
          mb-8
          text-center
        "
      >
        资产分类明细
      </h1>

      <AllocationTable rows={comparison.latest} />
    </section>

    <section>

      <h1
        className="
          text-2xl
          font-semibold
          mb-8
          text-center
        "
      >

        历史收益

      </h1>


      <div
        className="
          space-y-10
        "
      >

        <HistorySection
          title="大陆资产"
          history={
            performanceHistory.mainland
          }
        />


        <HistorySection
          title="香港资产"
          history={
            performanceHistory.hk
          }
        />


        <HistorySection
          title="合计"
          history={
            performanceHistory.total
          }
        />

      </div>

    </section>


      <section>
    <h1
      className="
        text-2xl
        font-semibold
        mb-8
        text-center
      "
    >
      核心资产配置
    </h1>

    <CoreAssetAllocationTable
      rows={comparison.latest}
    />
  </section>
  </main>

</>


);

}