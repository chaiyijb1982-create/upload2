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
//
// 严格按照 holdings.market
//
// CN / CHINA
// → 大陆
//
// HK / HONGKONG
// US / USA
// LU / LUXEMBOURG
// → 香港
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

// 盈利带 +，亏损自带 -
function formatSignedMoney(value: number): string {
  const n = toNumber(value);

  return n > 0 ? "+" + formatMoney(n) : formatMoney(n);
}


// 资产金额涨跌颜色：比上一条记录 多→红，少→绿，相同→灰（跟 pnlColor 一致）
// 资产金额涨跌颜色：比上一条记录 多→红，少→绿，相同/无数据→灰
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
// 资产分类：Fixed Income / China Stock / Global Stock / Gold
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

// 先读分类字段（category / asset_class / asset_type / type），
// 读不到时回退到 market：CN → China Stock，HK/US/LU → Global Stock
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

// 盈亏额：优先读 profit / pnl；没有就用 金额 - 成本(cost)。
// base = 成本，用来算盈亏率。都读不到时 profit 为 null，页面显示 "—"。
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

// 中国习惯：盈利红色，亏损绿色
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

// ===================================================
// 使用所有出现过的 code
// ===================================================

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

  profit:
    mainlandProfit,

  rate:
    mainlandRate,

},

hk: {

  profit:
    hkProfit,

  rate:
    hkRate,

},

total: {

  profit:
    totalProfit,

  rate:
    totalRate,

},


};

}

// =====================================================
// 今日表现卡片
// =====================================================

function TodayBlock({
title,
profit,
rate,
}: {
title: string;

profit: number;

rate: number;

}) {

return (

 
<div
  className="
    rounded-2xl
    border
    bg-white
    p-6
    shadow-sm
  "
>

  <div
    className="
      text-lg
      font-semibold
      mb-5
    "
  >

    {title}

  </div>


  <div
    className="
      grid
      grid-cols-2
      gap-6
    "
  >

    <div>

      <div
        className="
          text-sm
          text-gray-500
          mb-1
        "
      >

        收益额

      </div>


      <div
        className="
          text-2xl
          font-semibold
        "
      >

        {
          formatMoney(
            profit
          )
        }

      </div>

    </div>


    <div>

      <div
        className="
          text-sm
          text-gray-500
          mb-1
        "
      >

        收益率

      </div>


      <div
        className="
          text-2xl
          font-semibold
        "
      >

        {
          formatRate(
            rate
          )
        }

      </div>

    </div>

  </div>

</div>
 

);

}

// =====================================================
// 历史表格
//
// 默认显示数量：
//
// daily   → 30 条
// weekly  → 12 条
// monthly → 12 条
// yearly  → 5 条
//
// 这里前端只负责限制显示数量。
// getPerformanceHistory() 仍然可以返回完整历史数据。
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

  const cell = "border-b border-b-black/10 px-4 py-3";
  const sep = "border-l border-l-black";
  const lastRow = "[&>td]:border-b-black";

  return (
    <section>
      {title ? (
        <div className="mb-4 text-lg font-semibold">{title}</div>
      ) : null}

      <div className="max-w-[800px] overflow-x-auto">
    <table className="w-full table-fixed border-collapse border border-black text-sm">
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
        日期
      </th>

      <th
        rowSpan={2}
        className="border-l border-l-black border-b border-b-black bg-gray-100 px-4 py-3 text-right text-sm font-bold text-gray-800"
      >
        资产金额
      </th>

      <th
        rowSpan={2}
        className="border-l border-l-black border-b border-b-black bg-gray-100 px-4 py-3 text-right text-sm font-bold text-gray-800"
      >
          <div>变动额</div>
  <div className="text-xs font-normal text-gray-400">
    (出入金+收益额)</div>
      </th>

      <th
        rowSpan={2}
        className="border-l border-l-black border-b border-b-black bg-gray-100 px-4 py-3 text-right text-sm font-bold text-gray-800"
      >
        出入金
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
        收益额
      </th>

      <th className="border-b border-b-black bg-[#FBF8EF] px-4 py-2 text-right text-xs font-medium text-gray-500">
        收益率
      </th>
    </tr>
  </thead>

  <tbody>
    {displayPoints.length === 0 ? (
      <tr className={lastRow}>
        <td
          colSpan={6}
          className="border-b border-b-black bg-gray-50 px-4 py-8 text-center text-gray-400"
        >
          暂无历史数据
        </td>
      </tr>
    ) : (
      displayPoints.map((point, index) => {
        const previousAmount = points[index + 1]?.amount;
        const hasChange = previousAmount !== undefined;

        const changeAmount = hasChange
          ? point.amount - previousAmount
          : 0;

        const depositWithdrawal = hasChange
          ? changeAmount - point.profit
          : 0;

        const amountColor = amountTrendColor(
          point.amount,
          previousAmount
        );

        return (
          <tr
            key={point.date}
            className={`hover:brightness-95 ${
              index === displayPoints.length - 1 ? lastRow : ""
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
                hasChange ? pnlColor(changeAmount) : "text-gray-400"
              }`}
            >
              {hasChange ? formatSignedMoney(changeAmount) : "—"}
            </td>

            <td
              className={`${cell} ${sep} bg-gray-50 text-right font-semibold whitespace-nowrap ${
                hasChange ? pnlColor(depositWithdrawal) : "text-gray-400"
              }`}
            >
              {hasChange ? formatSignedMoney(depositWithdrawal) : "—"}
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
        <div className="mt-2 max-w-[800px] text-right text-xs text-gray-400">
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

// ===================================================
// 默认：周
// ===================================================

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
      items-center
      gap-4
      mb-4
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

  const cell = "border-b border-b-black/10 px-4 py-3";
  const txt = `${cell} text-left break-words`;
  const num = `${cell} text-right whitespace-nowrap`;
  const sep = "border-l border-l-black";
  const lastRow = "[&>td]:border-b-black";

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">{title}</h2>

      <div className="max-w-[1100px] overflow-x-auto">
        <table className="w-full table-fixed border-collapse border border-black text-sm">
          <colgroup>
            <col style={{ width: "34%" }} /> 
            <col style={{ width: "30%" }} /> 
            <col style={{ width: "18%" }} /> 
            <col style={{ width: "18%" }} /> 
          </colgroup>

          <thead>
            <tr>
              <th className="border-b border-b-black bg-gray-100 px-4 py-3 text-left text-sm font-bold text-gray-800">
                名称
              </th>

              <th className="border-b border-b-black bg-gray-100 px-4 py-3 text-left text-sm font-bold text-gray-800">
                代码
              </th>

              <th className="border-l border-l-black border-b border-b-black bg-[#F3EBD3] px-4 py-3 text-right text-sm font-bold text-[#8A6A2A]">
                今日收益
              </th>

              <th className="border-b border-b-black bg-[#F3EBD3] px-4 py-3 text-right text-sm font-bold text-[#8A6A2A]">
                今日涨跌
              </th>
            </tr>
          </thead>

          <tbody>
            {items.length === 0 ? (
              <tr className={lastRow}>
                <td
                  colSpan={4}
                  className="border-b border-b-black bg-gray-50 px-4 py-8 text-center text-gray-400"
                >
                  {emptyText}
                </td>
              </tr>
            ) : (
              items.map((item, index) => (
                <tr
                  key={`${item.code}-${index}`}
                  className={`hover:brightness-95 ${
                    index === items.length - 1 ? lastRow : ""
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

// =====================================================================
// 第 2 部分：放在 "Performance Page" 那段注释的上面
//           （即 HistorySection 函数后面）
// =====================================================================

// =====================================================
// 资产分类明细表
// =====================================================
// =====================================================================
// 只需要替换这一段：
// 从  type AllocationItem = {  开始，
// 到  AllocationTable 函数结束的最后一个 }  为止，整段替换。
// 其他地方都不用动（import 里的 React 可以留着，也可以改回原来的写法）。
// =====================================================================

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

  // ---------- 显示工具 ----------
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

  // ---------- 样式 ----------
  // 普通行底色
  const bg = {
    base: "bg-gray-50",
    amount: "bg-[#F4F7F9]",
    pnl: "bg-[#FBF8EF]",
    share: "bg-[#F7F7F5]",
  };

  // 分类汇总行 / 合计行底色（深一档）
  const bgStrong = {
    base: "bg-gray-200",
    amount: "bg-[#E6ECF1]",
    pnl: "bg-[#F3EBD3]",
    share: "bg-[#ECECE8]",
  };

  const sep = "border-l border-l-black"; // 组与组之间的黑竖线

  // 每个“黑框”就是一张独立的表，所有表共用同一套列宽，所以上下对齐
  const tableCls =
    "w-full table-fixed border-collapse border border-black text-sm";

  const cols = (
    <colgroup>
      <col style={{ width: "25%" }} />
      <col style={{ width: "22%" }} /> 
      <col style={{ width: "13%" }} /> 
      <col style={{ width: "11%" }} /> 
      <col style={{ width: "9%" }} /> 
      <col style={{ width: "9%" }} /> 
      <col style={{ width: "11%" }} />
    </colgroup>
  );

  const cell = "border-b border-b-black/10 px-4 py-3";
  const txt = `${cell} text-left break-words`; // 名称 / 代码：靠左
  const num = `${cell} text-right whitespace-nowrap`; // 数字：靠右

  // 每个黑框最后一行的下边线要是黑色
  const lastRow = "[&>td]:border-b-black";

  return (
    <div className="max-w-[1100px] space-y-4 overflow-x-auto">
      {/* =================== 表头（单独一个黑框） =================== */}
      <table className={tableCls}>
        {cols}

        <thead>
          <tr>
            <th
              rowSpan={2}
              className="border-b border-b-black bg-gray-100 px-4 py-3 text-left text-sm font-bold text-gray-800"
            >
              名称
            </th>

            <th
              rowSpan={2}
              className="border-b border-b-black bg-gray-100 px-4 py-3 text-left text-sm font-bold text-gray-800"
            >
              代码
            </th>

            <th
              rowSpan={2}
              className="border-l border-l-black border-b border-b-black bg-[#E6ECF1] px-4 py-3 text-right text-sm font-bold text-[#3F5468]"
            >
              现在金额
            </th>

            <th
              colSpan={2}
              className="border-l border-l-black border-b border-b-black/10 bg-[#F3EBD3] px-2 py-2 text-center text-sm font-bold text-[#8A6A2A]"
            >
              盈亏
            </th>

            <th
              colSpan={2}
              className="border-l border-l-black border-b border-b-black/10 bg-[#ECECE8] px-2 py-2 text-center text-sm font-bold text-[#6B6B63]"
            >
              占比
            </th>
          </tr>

          <tr>
            <th className="border-l border-l-black border-b border-b-black bg-[#FBF8EF] px-4 py-2 text-right text-xs font-medium text-gray-500">
              盈亏额
            </th>

            <th className="border-b border-b-black bg-[#FBF8EF] px-4 py-2 text-right text-xs font-medium text-gray-500">
              盈亏率
            </th>

            <th className="border-l border-l-black border-b border-b-black bg-[#F7F7F5] px-4 py-2 text-right text-xs font-medium text-gray-500">
              占本类
            </th>

            <th className="border-b border-b-black bg-[#F7F7F5] px-4 py-2 text-right text-xs font-medium text-gray-500">
              占总资产
            </th>
          </tr>
        </thead>
      </table>

      {/* =================== 每一类一个黑框 =================== */}
      {groups.map((group) => {
        const groupRate = calcRate(group.profit, group.base);
        const lastIndex = group.items.length - 1;

        return (
          <table key={group.key} className={tableCls}>
            {cols}

            <tbody>
              {/* 分类汇总行 */}
              <tr className={lastRow}>
                <td
                  colSpan={2}
                  className={`${txt} ${bgStrong.base} text-base font-bold text-gray-900`}
                >
                  {CATEGORY_LABEL[group.key]}
                </td>

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

              {/* 产品明细行 */}
              {group.items.length === 0 ? (
                <tr className={lastRow}>
                  <td
                    colSpan={7}
                    className={`${txt} ${bg.base} text-gray-400`}
                  >
                    暂无产品
                  </td>
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
                      </td>

                      <td className={`${txt} ${bg.base} text-gray-500`}>
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

      {/* =================== 合计（单独一个黑框） =================== */}
      <table className={tableCls}>
        {cols}

        <tbody>
          <tr className={lastRow}>
            <td
              colSpan={2}
              className={`${txt} ${bgStrong.base} text-base font-bold text-gray-900`}
            >
              合计
            </td>

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

// ===================================================
// Load
// ===================================================

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

// ===================================================
// 今日表现
// ===================================================

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
 

// ===================================================
// Loading
// ===================================================

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

// ===================================================
// Render
// ===================================================

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
      p-10
      space-y-12
    "
  >

    {/* =================================================
        今日表现
    ================================================= */}

    <section>

      <h1
        className="
          text-2xl
          font-semibold
          mb-6
        "
      >

        今日表现

      </h1>


      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-6
        "
      >

        <TodayBlock
          title="大陆"
          profit={
            today.mainland.profit
          }
          rate={
            today.mainland.rate
          }
        />


        <TodayBlock
          title="香港"
          profit={
            today.hk.profit
          }
          rate={
            today.hk.rate
          }
        />


        <TodayBlock
          title="合计"
          profit={
            today.total.profit
          }
          rate={
            today.total.rate
          }
        />

      </div>

    </section>


    {/* =================================================
        历史收益
    ================================================= */}

    <section>

      <h1
        className="
          text-2xl
          font-semibold
          mb-8
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


    {/* =================================================
        每个基金 / 股票今日表现
    //
    // 放在整个页面最下面
    //
    // 严格按照 market：
    // CN → 大陆
    // HK / US / LU → 香港
    // ================================================= */}

 <section>
      <h1
        className="
          text-2xl
          font-semibold
          mb-8
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
        "
      >
        资产分类明细
      </h1>

      <AllocationTable rows={comparison.latest} />
    </section>
  </main>

</>


);

}
