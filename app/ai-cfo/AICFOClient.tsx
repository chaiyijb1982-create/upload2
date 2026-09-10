"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import TopBar from "@/components/TopBar";
import { supabase } from "@/lib/supabase";

// =====================================================
// AI CFO
// =====================================================
// 目标：
// 1. 读取 AI Wealth OS 当前财务数据
// 2. 不修改数据库
// 3. 不依赖不存在的可选表
// 4. 统一生成 CFO Context
// 5. 一键复制给 ChatGPT
// =====================================================

type AnyRecord = Record<string, any>;

type Dataset = {
  name: string;
  table: string;
  description: string;
  data: AnyRecord[];
  error?: string;
  optional?: boolean;
};

type CFOData = {
  generated_at: string;

  summary: {
    total_asset: number;
    fixed_income: number;
    total_debt: number;
    net_asset: number;
    holdings_count: number;
    loans_count: number;
  };

  asset_history: AnyRecord[];
  holdings: AnyRecord[];
  holding_native_currency: AnyRecord[];
  fixed_income_assets: AnyRecord[];
  loans: AnyRecord[];
  insurance: AnyRecord[];
  insurance_cash_value_history: AnyRecord[];
  expense_transactions: AnyRecord[];
  credit_card_monthly_bills: AnyRecord[];
  credit_card_monthly_funding: AnyRecord[];
  financial_freedom_history: AnyRecord[];
  fx_exchanges: AnyRecord[];
};

type TableConfig = {
  key: keyof CFOData;
  name: string;
  table: string;
  description: string;
  optional?: boolean;
};

// =====================================================
// 数据表配置
// =====================================================

const TABLES: TableConfig[] = [
  {
    key: "asset_history",
    name: "资产历史",
    table: "asset_history",
    description: "家庭总资产历史快照",
  },

  {
    key: "holdings",
    name: "投资持仓",
    table: "holdings",
    description: "股票、基金、ETF、黄金等投资持仓",
  },

  {
    key: "holding_native_currency",
    name: "原币种持仓",
    table: "holding_native_currency",
    description: "非 CNY 持仓的原币种金额",
    optional: true,
  },

  {
    key: "fixed_income_assets",
    name: "固定收益",
    table: "fixed_income_assets",
    description: "固收产品",
  },

  {
    key: "loans",
    name: "贷款",
    table: "loans",
    description: "房贷、保险贷款、信用卡分期等负债",
  },

  // ---------------------------------------------------
  // 保险表目前不是数据库必需表
  // ---------------------------------------------------

  {
    key: "insurance",
    name: "保险",
    table: "insurance",
    description: "保险产品信息",
    optional: true,
  },

  {
    key: "insurance_cash_value_history",
    name: "保险现金价值历史",
    table: "insurance_cash_value_history",
    description: "保险现金价值变化",
    optional: true,
  },

  {
    key: "expense_transactions",
    name: "消费流水",
    table: "expense_transactions",
    description: "家庭消费流水",
  },

  {
    key: "credit_card_monthly_bills",
    name: "信用卡月账单",
    table: "credit_card_monthly_bills",
    description: "信用卡月度实际账单",
    optional: true,
  },

  {
    key: "credit_card_monthly_funding",
    name: "信用卡资金安排",
    table: "credit_card_monthly_funding",
    description: "信用卡资金安排",
    optional: true,
  },

  {
    key: "financial_freedom_history",
    name: "财务自由历史",
    table: "financial_freedom_history",
    description: "Financial Freedom 历史快照",
    optional: true,
  },

  {
    key: "fx_exchanges",
    name: "换汇记录",
    table: "fx_exchanges",
    description: "CNY / USD / HKD 等币种换汇",
    optional: true,
  },
];

// =====================================================
// 工具函数
// =====================================================

function toNumber(value: any): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function safeJson(value: any): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function cleanRecord(record: AnyRecord): AnyRecord {
  const result: AnyRecord = {};

  Object.entries(record || {}).forEach(([key, value]) => {
    if (value !== undefined) {
      result[key] = value;
    }
  });

  return result;
}

// =====================================================
// 判断是否属于“表不存在”
// =====================================================

function isTableNotFoundError(message: string): boolean {
  const text = String(message || "").toLowerCase();

  return (
    text.includes("could not find the table") ||
    text.includes("schema cache") ||
    text.includes("does not exist") ||
    text.includes("relation") &&
      text.includes("does not exist")
  );
}

// =====================================================
// 读取单张表
// =====================================================

async function readTable(
  config: TableConfig
): Promise<Dataset> {
  try {
    const result = await supabase
      .from(config.table)
      .select("*");

    // ---------------------------------------------------
    // Supabase 返回错误
    // ---------------------------------------------------

    if (result.error) {
      const message =
        result.error.message || "读取数据失败";

      const tableNotFound =
        isTableNotFoundError(message);

      // -------------------------------------------------
      // 可选表不存在
      //
      // 不算错误
      // -------------------------------------------------

      if (
        config.optional &&
        tableNotFound
      ) {
        return {
          name: config.name,
          table: config.table,
          description: config.description,
          data: [],
          optional: true,
        };
      }

      // -------------------------------------------------
      // 必要表不存在 / 真正读取失败
      // -------------------------------------------------

      return {
        name: config.name,
        table: config.table,
        description: config.description,
        data: [],
        error: message,
        optional: config.optional,
      };
    }

    // ---------------------------------------------------
    // 正常读取
    // ---------------------------------------------------

    return {
      name: config.name,
      table: config.table,
      description: config.description,
      data: Array.isArray(result.data)
        ? result.data.map(cleanRecord)
        : [],
      optional: config.optional,
    };
  } catch (error: any) {
    const message =
      error?.message || "读取数据失败";

    // ---------------------------------------------------
    // 可选表不存在
    // ---------------------------------------------------

    if (
      config.optional &&
      isTableNotFoundError(message)
    ) {
      return {
        name: config.name,
        table: config.table,
        description: config.description,
        data: [],
        optional: true,
      };
    }

    return {
      name: config.name,
      table: config.table,
      description: config.description,
      data: [],
      error: message,
      optional: config.optional,
    };
  }
}

// =====================================================
// 主页面
// =====================================================

export default function AICFOPage() {
  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [copied, setCopied] =
    useState(false);

  const [lastUpdated, setLastUpdated] =
    useState("");

  const [datasets, setDatasets] =
    useState<Record<string, Dataset>>({});

  // ===================================================
  // 加载全部数据
  // ===================================================

  const loadAllData = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const results =
          await Promise.all(
            TABLES.map(readTable)
          );

        const next: Record<
          string,
          Dataset
        > = {};

        results.forEach((item) => {
          next[item.table] = item;
        });

        setDatasets(next);

        setLastUpdated(
          new Date().toLocaleString(
            "zh-CN"
          )
        );
      } catch (error) {
        console.error(
          "AI CFO load error:",
          error
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ===================================================
  // 获取数据
  // ===================================================

  const getData = useCallback(
    (table: string): AnyRecord[] => {
      return (
        datasets[table]?.data || []
      );
    },
    [datasets]
  );

  // ===================================================
  // Asset History
  // ===================================================

  const assetHistory =
    getData("asset_history");

  const latestAsset = useMemo(() => {
    if (!assetHistory.length) {
      return null;
    }

    return [...assetHistory].sort(
      (a, b) => {
        const da = String(
          a.snapshot_date ??
            a.date ??
            a.created_at ??
            ""
        );

        const db = String(
          b.snapshot_date ??
            b.date ??
            b.created_at ??
            ""
        );

        return db.localeCompare(da);
      }
    )[0];
  }, [assetHistory]);

  const latestAssetValue =
    toNumber(
      latestAsset?.total_asset ??
        latestAsset?.asset ??
        latestAsset?.amount
    );

  // ===================================================
  // Holdings
  // ===================================================

  const holdings =
    getData("holdings");

  const holdingsTotal =
    holdings.reduce(
      (sum, item) =>
        sum +
        toNumber(
          item.amount ??
            item.market_value ??
            item.value
        ),
      0
    );

  const holdingsCost =
    holdings.reduce(
      (sum, item) =>
        sum +
        toNumber(
          item.cost ??
            item.cost_amount
        ),
      0
    );

  const holdingsProfit =
    holdings.reduce(
      (sum, item) =>
        sum +
        toNumber(
          item.profit ??
            item.pnl
        ),
      0
    );

  // ===================================================
  // Fixed Income
  // ===================================================

  const fixedIncome =
    getData(
      "fixed_income_assets"
    );

  const fixedIncomeTotal =
    fixedIncome.reduce(
      (sum, item) =>
        sum +
        toNumber(
          item.amount ??
            item.balance ??
            item.value
        ),
      0
    );

  // ===================================================
  // Loans
  // ===================================================

  const loans =
    getData("loans");

  const totalDebt =
    loans.reduce(
      (sum, loan) =>
        sum +
        toNumber(
          loan.remaining_amount ??
            loan.balance ??
            loan.amount
        ),
      0
    );

  // ===================================================
  // 注意
  //
  // 不改变原有 Financial Freedom 计算规则。
  //
  // 这里只做 AI CFO 数据摘要。
  // ===================================================

  const estimatedGrossAsset =
    latestAssetValue +
    fixedIncomeTotal;

  const estimatedNetAsset =
    estimatedGrossAsset -
    totalDebt;

  // ===================================================
  // Financial Freedom
  // ===================================================

  const financialFreedom =
    getData(
      "financial_freedom_history"
    );

  const latestFinancialFreedom =
    financialFreedom.length
      ? [...financialFreedom].sort(
          (a, b) =>
            String(
              b.snapshot_date ??
                b.date ??
                b.created_at ??
                ""
            ).localeCompare(
              String(
                a.snapshot_date ??
                  a.date ??
                  a.created_at ??
                  ""
              )
            )
        )[0]
      : null;

  // ===================================================
  // 数据状态
  // ===================================================

  const successfulTables =
    TABLES.filter((table) => {
      const result =
        datasets[table.table];

      return (
        result &&
        !result.error
      );
    }).length;

  const failedTables =
    TABLES.filter((table) => {
      const result =
        datasets[table.table];

      return (
        result?.error &&
        !table.optional
      );
    }).length;

  const missingOptionalTables =
    TABLES.filter((table) => {
      const result =
        datasets[table.table];

      return (
        table.optional &&
        result &&
        !result.error &&
        result.data.length === 0
      );
    }).length;

  const totalRows =
    TABLES.reduce(
      (sum, table) =>
        sum +
        (
          datasets[table.table]
            ?.data.length || 0
        ),
      0
    );

  // ===================================================
  // CFO Context
  // ===================================================

  const cfoContext =
    useMemo(() => {
      const generatedAt =
        new Date().toISOString();

      const data: CFOData = {
        generated_at:
          generatedAt,

        summary: {
          total_asset:
            latestAssetValue,

          fixed_income:
            fixedIncomeTotal,

          total_debt:
            totalDebt,

          net_asset:
            estimatedNetAsset,

          holdings_count:
            holdings.length,

          loans_count:
            loans.length,
        },

        asset_history:
          getData("asset_history"),

        holdings:
          getData("holdings"),

        holding_native_currency:
          getData(
            "holding_native_currency"
          ),

        fixed_income_assets:
          getData(
            "fixed_income_assets"
          ),

        loans:
          getData("loans"),

        insurance:
          getData("insurance"),

        insurance_cash_value_history:
          getData(
            "insurance_cash_value_history"
          ),

        expense_transactions:
          getData(
            "expense_transactions"
          ),

        credit_card_monthly_bills:
          getData(
            "credit_card_monthly_bills"
          ),

        credit_card_monthly_funding:
          getData(
            "credit_card_monthly_funding"
          ),

        financial_freedom_history:
          getData(
            "financial_freedom_history"
          ),

        fx_exchanges:
          getData("fx_exchanges"),
      };

      return safeJson(data);
    }, [
      getData,
      latestAssetValue,
      fixedIncomeTotal,
      totalDebt,
      estimatedNetAsset,
      holdings.length,
      loans.length,
    ]);


    const aiDecisionInstruction = `
============================================================
AI WEALTH OS — AI 决策规则
============================================================

你现在是 AI Wealth OS 的家庭 CFO。

你必须区分：

1. 【事实】
只能使用 AI Wealth OS 提供的数据。
不得凭空创造资产、金额、收益率、汇率或持仓。

2. 【计算】
涉及收益率、资产配置、盈亏、现金流、财务自由等，
必须先根据数据计算，再给结论。

3. 【判断】
必须说明为什么得出这个结论。

4. 【建议】
必须给出明确、可执行的建议。
如果数据不足，明确说“无法判断”，不要猜。

============================================================
监控条件统一规则
============================================================

盈利5%
→ 收益率 ≥ 5%

盈利10%
→ 收益率 ≥ 10%

亏损5%
→ 收益率 ≤ -5%

亏损10%
→ 收益率 ≤ -10%

回本
→ 收益率 ≥ 0%（回本）

如果用户只说：

止损
止盈
检查
监控
观察

但没有给出具体百分比：

不得自行创造百分比。

必须写：

无明确数值条件

============================================================
涉及 Holding 时
============================================================

必须使用：

资产名称 · Code

例如：

金信智能混合A · 002849

不要只写：

002849

============================================================
最终回答格式
============================================================

【问题】
用户正在解决的问题。

【数据】
只列出与当前问题直接相关的数据。

【判断】
说明当前状态以及计算依据。

【监控条件】
明确写出：

收益率 ≥ 5%
收益率 ≤ -5%
收益率 ≥ 0%（回本）

如果没有明确条件：

无明确数值条件

【Holding】
资产名称 · Code

如果没有：

无

【建议动作】
明确说明下一步应该做什么。

【状态】
只能使用：

🟢 已达到条件
🟡 尚未达到条件
⚪ 无法判断

如果属于持续观察类任务：

🟡 持续监控

============================================================
重要原则
============================================================

不要为了给出答案而编造数据。

不要把“盈利5%”理解成“盈利即可卖出”。

不要把“止损”自动理解成某一个百分比。

不要因为某个资产当前亏损，就自动建议卖出。

程序数据优先，用户明确规则优先，AI负责分析和决策。
`;
  // ===================================================
  // 复制
  // ===================================================

  const copyAllData =
    async () => {
      try {
        await navigator.clipboard.writeText(
          cfoContext
          "\n\n" +
        aiDecisionInstruction
        );

        setCopied(true);

        setTimeout(() => {
          setCopied(false);
        }, 2500);
      } catch {
        const textarea =
          document.createElement(
            "textarea"
          );

        textarea.value =
              cfoContext +
              "\n\n" +
              aiDecisionInstruction;

        textarea.style.position =
          "fixed";

        textarea.style.left =
          "-9999px";

        document.body.appendChild(
          textarea
        );

        textarea.select();

        document.execCommand(
          "copy"
        );

        textarea.remove();

        setCopied(true);

        setTimeout(() => {
          setCopied(false);
        }, 2500);
      }
    };

  // ===================================================
  // 下载 JSON
  // ===================================================

  const downloadJson =
    () => {
      const blob =
        new Blob(
          [cfoContext],
          {
            type:
              "application/json;charset=utf-8",
          }
        );

      const url =
        URL.createObjectURL(blob);

      const a =
        document.createElement(
          "a"
        );

      const date =
        new Date()
          .toISOString()
          .slice(0, 10);

      a.href = url;

      a.download =
        `AI-CFO-${date}.json`;

      document.body.appendChild(
        a
      );

      a.click();

      a.remove();

      URL.revokeObjectURL(url);
    };

  // ===================================================
  // 下载 TXT
  // ===================================================

  const downloadTxt =
    () => {
      const header = `
============================================================
AI WEALTH OS — AI CFO CONTEXT
============================================================

生成时间：
${new Date().toLocaleString("zh-CN")}

说明：
本文件用于提供给 AI CFO / ChatGPT 分析。
数据来自 AI Wealth OS 当前数据库。

============================================================

`;

      const blob =
        new Blob(
          [
            header +
              cfoContext,
          ],
          {
            type:
              "text/plain;charset=utf-8",
          }
        );

      const url =
        URL.createObjectURL(blob);

      const a =
        document.createElement(
          "a"
        );

      const date =
        new Date()
          .toISOString()
          .slice(0, 10);

      a.href = url;

      a.download =
        `AI-CFO-${date}.txt`;

      document.body.appendChild(
        a
      );

      a.click();

      a.remove();

      URL.revokeObjectURL(url);
    };

  // ===================================================
  // Loading
  // ===================================================

  if (loading) {
    return (
      <>
        <TopBar title="AI CFO"/>

        <main className="min-h-screen bg-gray-50 p-4 md:p-6">
          <div className="mx-auto max-w-7xl">
            <div className="rounded-2xl border bg-white p-10 text-center shadow-sm">
              <div className="text-lg font-semibold text-gray-900">
                AI CFO 正在读取家庭财务数据……
              </div>

              <div className="mt-2 text-sm text-gray-500">
                正在读取资产、投资、固收、贷款、消费和财务自由数据
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <>
      <TopBar title="AI CFO"/>

      <main className="min-h-screen bg-gray-50 p-4 md:p-6">
        <div className="mx-auto max-w-7xl space-y-6">

          {/* ================================================= */}
          {/* Header */}
          {/* ================================================= */}

          <section className="rounded-2xl border bg-white p-5 shadow-sm md:p-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">

              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-2xl font-bold text-gray-900">
                    AI CFO
                  </h1>

                  <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                    Financial Context
                  </span>
                </div>

                <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-500">
                  把 AI Wealth OS 当前家庭财务数据统一整理成 AI CFO Context。
                  复制后可以直接粘贴给 ChatGPT 进行分析。
                </p>

                {lastUpdated && (
                  <p className="mt-2 text-xs text-gray-400">
                    数据更新时间：
                    {lastUpdated}
                  </p>
                )}
              </div>

              <div className="flex flex-wrap gap-2">

                <button
                  onClick={() =>
                    loadAllData(true)
                  }
                  disabled={refreshing}
                  className="rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                >
                  {refreshing
                    ? "刷新中…"
                    : "刷新数据"}
                </button>

                <button
                  onClick={downloadJson}
                  className="rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
                >
                  下载 JSON
                </button>

                <button
                  onClick={downloadTxt}
                  className="rounded-xl border px-4 py-2.5 text-sm font-medium hover:bg-gray-50"
                >
                  下载 TXT
                </button>

                <button
                  onClick={copyAllData}
                  className="rounded-xl bg-black px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                >
                  {copied
                    ? "✓ 已复制"
                    : "复制全部数据"}
                </button>

              </div>
            </div>
          </section>

          {/* ================================================= */}
          {/* 核心资产 */}
          {/* ================================================= */}

          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">

            <MetricCard
              title="资产历史最新值"
              value={`¥${formatMoney(
                latestAssetValue
              )}`}
            />

            <MetricCard
              title="固收"
              value={`¥${formatMoney(
                fixedIncomeTotal
              )}`}
            />

            <MetricCard
              title="估算总资产"
              value={`¥${formatMoney(
                estimatedGrossAsset
              )}`}
            />

            <MetricCard
              title="总负债"
              value={`¥${formatMoney(
                totalDebt
              )}`}
            />

            <MetricCard
              title="估算净资产"
              value={`¥${formatMoney(
                estimatedNetAsset
              )}`}
            />

            <MetricCard
              title="投资持仓"
              value={`${holdings.length} 项`}
            />

          </section>

          {/* ================================================= */}
          {/* AI 使用说明 */}
          {/* ================================================= */}

          <section className="rounded-2xl border bg-black p-5 text-white shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

              <div>
                <div className="text-lg font-semibold">
                  AI CFO 数据已准备
                </div>

                <div className="mt-1 text-sm leading-6 text-gray-300">
                  点击「复制全部数据」，然后直接发给 ChatGPT。
                  AI 可以基于完整资产、持仓、负债、消费和财务自由数据进行分析。
                </div>
              </div>

              <button
                onClick={copyAllData}
                className="shrink-0 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-gray-100"
              >
                {copied
                  ? "✓ 数据已复制"
                  : "复制全部数据"}
              </button>

            </div>
          </section>

          {/* ================================================= */}
          {/* 数据源状态 */}
          {/* ================================================= */}

          <section className="rounded-2xl border bg-white p-5 shadow-sm">

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>
                <h2 className="text-lg font-semibold text-gray-900">
                  数据源
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  AI CFO 当前读取的数据表。
                </p>
              </div>

              <div className="flex flex-wrap gap-4 text-right text-sm">

                <div>
                  <div className="font-semibold text-gray-900">
                    {successfulTables} /{" "}
                    {TABLES.length}
                  </div>

                  <div className="text-xs text-gray-400">
                    已读取
                  </div>
                </div>

                <div>
                  <div className="font-semibold text-gray-900">
                    {totalRows.toLocaleString()}
                  </div>

                  <div className="text-xs text-gray-400">
                    数据行
                  </div>
                </div>

                {missingOptionalTables > 0 && (
                  <div>
                    <div className="font-semibold text-gray-500">
                      {missingOptionalTables}
                    </div>

                    <div className="text-xs text-gray-400">
                      未启用模块
                    </div>
                  </div>
                )}

                {failedTables > 0 && (
                  <div>
                    <div className="font-semibold text-gray-700">
                      {failedTables}
                    </div>

                    <div className="text-xs text-gray-400">
                      必要表读取失败
                    </div>
                  </div>
                )}

              </div>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">

              {TABLES.map(
                (table) => {
                  const result =
                    datasets[
                      table.table
                    ];

                  const ok =
                    result &&
                    !result.error;

                  const count =
                    result?.data
                      ?.length || 0;

                  const optionalMissing =
                    table.optional &&
                    result &&
                    !result.error &&
                    count === 0;

                  return (
                    <div
                      key={table.table}
                      className="rounded-xl border p-4"
                    >

                      <div className="flex items-start justify-between gap-3">

                        <div className="min-w-0">

                          <div className="font-medium text-gray-900">
                            {table.name}
                          </div>

                          <div className="mt-1 truncate text-xs text-gray-400">
                            {table.table}
                          </div>

                        </div>

                        <span
                          className={
                            ok && !optionalMissing
                              ? "shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-700"
                              : table.optional
                              ? "shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500"
                              : "shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500"
                          }
                        >
                          {optionalMissing
                            ? "未启用"
                            : ok
                            ? `${count} 条`
                            : "读取失败"}
                        </span>

                      </div>

                      <div className="mt-2 text-xs leading-5 text-gray-500">
                        {table.description}
                      </div>

                      {/* 必要表错误 */}
                      {result?.error &&
                        !table.optional && (
                          <div className="mt-2 break-all text-xs text-gray-500">
                            {result.error}
                          </div>
                        )}

                      {/* 可选表不存在 */}
                      {optionalMissing && (
                        <div className="mt-2 text-xs text-gray-400">
                          当前数据库未启用此模块
                        </div>
                      )}

                    </div>
                  );
                }
              )}

            </div>

          </section>

          {/* ================================================= */}
          {/* 当前投资 */}
          {/* ================================================= */}

          <section className="rounded-2xl border bg-white shadow-sm">

            <div className="border-b p-5">
              <h2 className="text-lg font-semibold text-gray-900">
                当前投资持仓
              </h2>

              <div className="mt-1 text-sm text-gray-500">
                AI CFO 会读取当前 Holdings 原始数据。
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 p-5 md:grid-cols-4">

              <MetricCard
                title="持仓数量"
                value={`${holdings.length} 项`}
              />

              <MetricCard
                title="持仓金额"
                value={`¥${formatMoney(
                  holdingsTotal
                )}`}
              />

              <MetricCard
                title="投入成本"
                value={`¥${formatMoney(
                  holdingsCost
                )}`}
              />

              <MetricCard
                title="累计盈亏"
                value={`¥${formatMoney(
                  holdingsProfit
                )}`}
              />

            </div>

            {holdings.length > 0 && (
              <div className="overflow-x-auto border-t">

                <table className="min-w-full text-sm">

                  <thead className="bg-gray-50">
                    <tr>

                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        Code
                      </th>

                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        Name
                      </th>

                      <th className="px-4 py-3 text-left font-medium text-gray-500">
                        Category
                      </th>

                      <th className="px-4 py-3 text-right font-medium text-gray-500">
                        Amount
                      </th>

                      <th className="px-4 py-3 text-right font-medium text-gray-500">
                        Cost
                      </th>

                      <th className="px-4 py-3 text-right font-medium text-gray-500">
                        Profit
                      </th>

                      <th className="px-4 py-3 text-right font-medium text-gray-500">
                        Shares
                      </th>

                    </tr>
                  </thead>

                  <tbody className="divide-y">

                    {holdings.map(
                      (
                        item,
                        index
                      ) => (
                        <tr
                          key={
                            item.id ??
                            index
                          }
                          className="hover:bg-gray-50"
                        >

                          <td className="whitespace-nowrap px-4 py-3 font-medium">
                            {item.code ??
                              "—"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3">
                            {item.name ??
                              "—"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                            {item.category ??
                              "—"}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {formatMoney(
                              toNumber(
                                item.amount ??
                                  item.market_value ??
                                  item.value
                              )
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {formatMoney(
                              toNumber(
                                item.cost
                              )
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {formatMoney(
                              toNumber(
                                item.profit ??
                                  item.pnl
                              )
                            )}
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-right">
                            {item.shares ??
                              "—"}
                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>
            )}

          </section>

          {/* ================================================= */}
          {/* Financial Freedom */}
          {/* ================================================= */}

          <section className="rounded-2xl border bg-white p-5 shadow-sm">

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="text-lg font-semibold text-gray-900">
                  Financial Freedom
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  这里只展示数据库中的 Financial Freedom 历史数据，
                  不在 AI CFO 页面重新计算。
                </p>

              </div>

              {latestFinancialFreedom && (
                <div className="text-left md:text-right">

                  <div className="text-xs text-gray-400">
                    最新快照
                  </div>

                  <div className="font-semibold text-gray-900">
                    {latestFinancialFreedom.snapshot_date ??
                      latestFinancialFreedom.date ??
                      "—"}
                  </div>

                </div>
              )}

            </div>

            {latestFinancialFreedom ? (
              <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-3">

                <MetricCard
                  title="Family Asset"
                  value={`¥${formatMoney(
                    toNumber(
                      latestFinancialFreedom.family_asset ??
                        latestFinancialFreedom.total_asset
                    )
                  )}`}
                />

                <MetricCard
                  title="Freedom Target"
                  value={`¥${formatMoney(
                    toNumber(
                      latestFinancialFreedom.freedom_target
                    )
                  )}`}
                />

                <MetricCard
                  title="Freedom Gap"
                  value={`¥${formatMoney(
                    toNumber(
                      latestFinancialFreedom.freedom_gap
                    )
                  )}`}
                />

              </div>
            ) : (
              <div className="mt-5 rounded-xl bg-gray-50 p-5 text-sm text-gray-500">
                当前没有 Financial Freedom 历史数据。
              </div>
            )}

          </section>

          {/* ================================================= */}
          {/* AI Context */}
          {/* ================================================= */}

          <section className="rounded-2xl border bg-white shadow-sm">

            <div className="flex flex-col gap-3 border-b p-5 md:flex-row md:items-center md:justify-between">

              <div>

                <h2 className="text-lg font-semibold text-gray-900">
                  AI CFO Context
                </h2>

                <p className="mt-1 text-sm text-gray-500">
                  这是实际复制给 ChatGPT 的完整数据。
                </p>

              </div>

              <button
                onClick={copyAllData}
                className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
              >
                {copied
                  ? "✓ 已复制"
                  : "复制"}
              </button>

            </div>

            <div className="max-h-[600px] overflow-auto bg-gray-950 p-5">

              <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-gray-200">
                {cfoContext}
              </pre>

            </div>

          </section>

          {/* ================================================= */}
          {/* Footer */}
          {/* ================================================= */}

          <div className="pb-10 text-center text-xs text-gray-400">
            AI Wealth OS · AI CFO Context
          </div>

        </div>
      </main>
    </>
  );
}

// =====================================================
// Metric Card
// =====================================================

function MetricCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4">

      <div className="text-xs text-gray-500">
        {title}
      </div>

      <div className="mt-2 text-lg font-semibold text-gray-900">
        {value}
      </div>

    </div>
  );
}