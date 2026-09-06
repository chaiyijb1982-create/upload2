"use client";

import { useEffect, useMemo, useState } from "react";

import TopBar from "@/components/TopBar";

import {
  createFxExchange,
  deleteFxExchange,
  getFxExchanges,
  type FxExchange,
} from "@/lib/fx-exchanges";

import { getHoldings, type Holding } from "@/lib/asset";

// =====================================================
// 类型
// =====================================================

type CategoryKey =
  | "fixed_income"
  | "global_stock"
  | "china_stock"
  | "gold";

type CategoryAmount = Record<CategoryKey, number>;

type MarketStatus =
  | "normal"
  | "caution"
  | "risk"
  | "unavailable";

type MarketItem = {
  symbol: string;
  name: string;
  price: number | null;
  previousClose: number | null;
  changePct: number | null;
  return1M: number | null;
  return3M: number | null;
  return6M: number | null;
  return1Y: number | null;
  high52w: number | null;
  low52w: number | null;
  drawdown52w: number | null;
  error?: string;
};

type MarketOverview = {
  success: boolean;
  updatedAt: string;
  dataStatus: "ok" | "partial" | "unavailable";
  market: {
    voo: MarketItem | null;
    gldm: MarketItem | null;
    sp500: MarketItem | null;
    vix: MarketItem | null;
    treasury10y: MarketItem | null;
    usdcny: MarketItem | null;
  };
  assessment: {
    status: MarketStatus;
    score: number;
    summary: string;
    direction: string;
  };
  notes: string[];
};

// =====================================================
// 常量
// =====================================================

const TARGETS: Record<CategoryKey, number> = {
  fixed_income: 0.45,
  global_stock: 0.30,
  china_stock: 0.10,
  gold: 0.15,
};

const RANGES: Record<
  CategoryKey,
  {
    min: number;
    max: number;
  }
> = {
  fixed_income: {
    min: 0.40,
    max: 0.55,
  },
  global_stock: {
    min: 0.25,
    max: 0.40,
  },
  china_stock: {
    min: 0.05,
    max: 0.15,
  },
  gold: {
    min: 0.10,
    max: 0.20,
  },
};

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  fixed_income: "固定收益",
  global_stock: "全球股票",
  china_stock: "中国股票",
  gold: "黄金",
};

const INVESTMENT_AMOUNT_DEFAULT = 1500;

const DEFAULT_VOO_PRICE = 710.72;
const DEFAULT_GLDM_PRICE = 88.52;
const DEFAULT_USD_CNY = 7.10;

const FIXED_INCOME_DAILY = 2000;

// =====================================================
// 工具函数
// =====================================================

function todayString(): string {
  const d = new Date();

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatPctPoint(value: number): string {
  return `${(value * 100).toFixed(1)} pp`;
}

function formatPrice(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `$${value.toFixed(2)}`;
}

function formatMarketPct(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function getHoldingAmount(item: Holding): number {
  const amount = Number(item.amount ?? 0);

  return Number.isFinite(amount) ? amount : 0;
}

function marketStatusLabel(status: MarketStatus): string {
  if (status === "risk") return "风险偏高";
  if (status === "caution") return "谨慎";
  if (status === "unavailable") return "数据不可用";

  return "正常";
}

function marketStatusClass(status: MarketStatus): string {
  if (status === "risk") {
    return "bg-red-100 text-red-700";
  }

  if (status === "caution") {
    return "bg-amber-100 text-amber-700";
  }

  if (status === "unavailable") {
    return "bg-slate-100 text-slate-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function categoryStatus(
  key: CategoryKey,
  currentPct: number
): {
  label: string;
  className: string;
} {
  const range = RANGES[key];

  if (currentPct < range.min) {
    return {
      label: "低于区间",
      className: "bg-amber-100 text-amber-700",
    };
  }

  if (currentPct > range.max) {
    return {
      label: "高于区间",
      className: "bg-red-100 text-red-700",
    };
  }

  return {
    label: "区间内",
    className: "bg-emerald-100 text-emerald-700",
  };
}

function addBusinessDays(
  startDate: string,
  days: number
): string {
  const date = new Date(`${startDate}T12:00:00`);

  let remaining = Math.max(0, days);

  while (remaining > 0) {
    date.setDate(date.getDate() + 1);

    const weekday = date.getDay();

    if (weekday !== 0 && weekday !== 6) {
      remaining--;
    }
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFixedIncomePlan(
  fixedIncome: number,
  totalAssets: number
) {
  if (totalAssets <= 0) {
    return {
      needed: 0,
      workdays: 0,
      stopDate: todayString(),
      reached: false,
    };
  }

  const target = TARGETS.fixed_income;

  if (fixedIncome / totalAssets >= target) {
    return {
      needed: 0,
      workdays: 0,
      stopDate: todayString(),
      reached: true,
    };
  }

  const needed =
    (target * totalAssets - fixedIncome) /
    (1 - target);

  const workdays = Math.ceil(
    Math.max(0, needed) / FIXED_INCOME_DAILY
  );

  return {
    needed: Math.max(0, needed),
    workdays,
    stopDate: addBusinessDays(
      todayString(),
      workdays
    ),
    reached: false,
  };
}

// =====================================================
// 页面
// =====================================================

export default function FxExchangePage() {
  // ===================================================
  // 换汇数据
  // ===================================================

  const [exchanges, setExchanges] = useState<FxExchange[]>([]);

  const [holdings, setHoldings] = useState<Holding[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // ===================================================
  // 换汇表单
  // ===================================================

  const [exchangeDate, setExchangeDate] =
    useState(todayString());

  const [fromCurrency, setFromCurrency] =
    useState("CNY");

  const [fromAmount, setFromAmount] =
    useState("");

  const [toCurrency, setToCurrency] =
    useState("USD");

  const [toAmount, setToAmount] =
    useState("");

  const [fee, setFee] = useState("");

  const [remark, setRemark] = useState("");

  // ===================================================
  // AI 投资决策
  // ===================================================

  const [investmentAmountUsd, setInvestmentAmountUsd] =
    useState(INVESTMENT_AMOUNT_DEFAULT);

  const [vooPrice, setVooPrice] =
    useState(DEFAULT_VOO_PRICE);

  const [gldmPrice, setGldmPrice] =
    useState(DEFAULT_GLDM_PRICE);

  const [usdCny, setUsdCny] =
    useState(DEFAULT_USD_CNY);

  // ===================================================
  // 市场数据
  // ===================================================

  const [market, setMarket] =
    useState<MarketOverview | null>(null);

  const [marketLoading, setMarketLoading] =
    useState(false);

  const [marketError, setMarketError] =
    useState("");

  // ===================================================
  // 初始化
  // ===================================================

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const [exchangeData, holdingsData] =
          await Promise.all([
            getFxExchanges(),
            getHoldings(),
          ]);

        setExchanges(exchangeData);
        setHoldings(holdingsData);
      } catch (error) {
        console.error(error);
        alert("数据加载失败");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // ===================================================
  // 市场数据
  // ===================================================

  async function loadMarket() {
    try {
      setMarketLoading(true);
      setMarketError("");

      const response = await fetch(
        "/api/market-overview",
        {
          cache: "no-store",
        }
      );

      const json =
        (await response.json()) as MarketOverview;

      if (!response.ok || !json.success) {
        throw new Error(
          "市场数据获取失败"
        );
      }

      setMarket(json);

      // 如果实时价格有效，则同步到可编辑参考价格
      if (
        json.market.voo?.price !== null &&
        json.market.voo?.price !== undefined &&
        Number.isFinite(json.market.voo.price)
      ) {
        setVooPrice(json.market.voo.price);
      }

      if (
        json.market.gldm?.price !== null &&
        json.market.gldm?.price !== undefined &&
        Number.isFinite(json.market.gldm.price)
      ) {
        setGldmPrice(json.market.gldm.price);
      }

      if (
        json.market.usdcny?.price !== null &&
        json.market.usdcny?.price !== undefined &&
        Number.isFinite(json.market.usdcny.price)
      ) {
        setUsdCny(json.market.usdcny.price);
      }
    } catch (error) {
      console.error(error);

      setMarketError(
        error instanceof Error
          ? error.message
          : "市场数据获取失败"
      );
    } finally {
      setMarketLoading(false);
    }
  }

  useEffect(() => {
    loadMarket();
  }, []);

  // ===================================================
  // 换汇
  // ===================================================

  const actualRate = useMemo(() => {
    const from = Number(fromAmount);
    const to = Number(toAmount);

    if (
      !Number.isFinite(from) ||
      !Number.isFinite(to) ||
      from <= 0 ||
      to <= 0
    ) {
      return null;
    }

    return from / to;
  }, [fromAmount, toAmount]);

  async function handleSaveExchange() {
    try {
      const from = Number(fromAmount);
      const to = Number(toAmount);
      const feeNumber = Number(fee || 0);

      if (
        !Number.isFinite(from) ||
        from <= 0
      ) {
        alert("请输入有效的换出金额");
        return;
      }

      if (
        !Number.isFinite(to) ||
        to <= 0
      ) {
        alert("请输入有效的换入金额");
        return;
      }

      if (
        !Number.isFinite(feeNumber) ||
        feeNumber < 0
      ) {
        alert("请输入有效手续费");
        return;
      }

      setSaving(true);

      const created =
        await createFxExchange({
          exchange_date: exchangeDate,
          from_currency: fromCurrency,
          from_amount: from,
          to_currency: toCurrency,
          to_amount: to,
          fee: feeNumber,
          remark,
        });

      setExchanges((prev) => [
        created,
        ...prev,
      ]);

      setFromAmount("");
      setToAmount("");
      setFee("");
      setRemark("");

      alert("换汇记录已保存");
    } catch (error) {
      console.error(error);
      alert(
        error instanceof Error
          ? error.message
          : "保存失败"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteExchange(id: string) {
    if (!confirm("确定删除这条换汇记录吗？")) {
      return;
    }

    try {
      await deleteFxExchange(id);

      setExchanges((prev) =>
        prev.filter((item) => item.id !== id)
      );
    } catch (error) {
      console.error(error);
      alert("删除失败");
    }
  }

  // ===================================================
  // 换汇统计
  // ===================================================

  const exchangeCount = exchanges.length;

  const totalCnyToUsd = exchanges
    .filter(
      (item) =>
        item.from_currency === "CNY" &&
        item.to_currency === "USD"
    )
    .reduce(
      (sum, item) =>
        sum + Number(item.from_amount || 0),
      0
    );

  const totalUsd = exchanges
    .filter(
      (item) =>
        item.from_currency === "CNY" &&
        item.to_currency === "USD"
    )
    .reduce(
      (sum, item) =>
        sum + Number(item.to_amount || 0),
      0
    );

  // ===================================================
  // 家庭资产分类
  //
  // 重要：
  // 这里只使用 holdings
  // 不使用 fixed_income_assets
  // 不自动查 HK_CASH
  // ===================================================

  const categoryAmounts =
    useMemo<CategoryAmount>(() => {
      const result: CategoryAmount = {
        fixed_income: 0,
        global_stock: 0,
        china_stock: 0,
        gold: 0,
      };

      for (const item of holdings) {
        const category = String(
          item?.category ?? ""
        )
          .trim()
          .toLowerCase() as CategoryKey;

        const amount =
          getHoldingAmount(item);

        if (category === "fixed_income") {
          result.fixed_income += amount;
        }

        if (category === "global_stock") {
          result.global_stock += amount;
        }

        if (category === "china_stock") {
          result.china_stock += amount;
        }

        if (category === "gold") {
          result.gold += amount;
        }
      }

      return result;
    }, [holdings]);

  const totalAssets =
    categoryAmounts.fixed_income +
    categoryAmounts.global_stock +
    categoryAmounts.china_stock +
    categoryAmounts.gold;

  // ===================================================
  // 当前比例
  // ===================================================

  const currentAllocation =
    useMemo(() => {
      if (totalAssets <= 0) {
        return {
          fixed_income: 0,
          global_stock: 0,
          china_stock: 0,
          gold: 0,
        };
      }

      return {
        fixed_income:
          categoryAmounts.fixed_income /
          totalAssets,

        global_stock:
          categoryAmounts.global_stock /
          totalAssets,

        china_stock:
          categoryAmounts.china_stock /
          totalAssets,

        gold:
          categoryAmounts.gold /
          totalAssets,
      };
    }, [
      categoryAmounts,
      totalAssets,
    ]);

  // ===================================================
  // 固收未来资金
  // ===================================================

  const fixedIncomePlan =
    useMemo(
      () =>
        getFixedIncomePlan(
          categoryAmounts.fixed_income,
          totalAssets
        ),
      [
        categoryAmounts.fixed_income,
        totalAssets,
      ]
    );

  // ===================================================
  // 香港 / USD 相关现有持仓
  //
  // HK_CASH 明确排除
  // ===================================================

  const hkUsdHoldings =
    useMemo(() => {
      return holdings.filter((item) => {
        if (
          String(item.code ?? "")
            .trim()
            .toUpperCase() === "HK_CASH"
        ) {
          return false;
        }

        return (
          item.market === "HK" ||
          item.currency === "USD"
        );
      });
    }, [holdings]);

  // ===================================================
  // 当前 VOO / GLDM
  // ===================================================

  const currentVoo =
    holdings.find(
      (item) =>
        String(item.code)
          .trim()
          .toUpperCase() === "VOO"
    );

  const currentGldm =
    holdings.find(
      (item) =>
        String(item.code)
          .trim()
          .toUpperCase() === "GLDM"
    );

  // ===================================================
  // 当前投资建议
  //
  // 已删除：
  // 系统最佳整数股组合
  //
  // 本页面不再自动计算：
  // VOO 买多少股
  // GLDM 买多少股
  //
  // 由 AI CFO 根据完整信息最终判断
  // ===================================================

  const investmentDirection =
    useMemo(() => {
      const status =
        market?.assessment.status ??
        "unavailable";

      if (status === "risk") {
        return "市场风险偏高：优先考虑分批执行，不建议一次性提高风险资产仓位。";
      }

      if (status === "caution") {
        return "市场进入谨慎区间：可以执行配置，但建议控制节奏，优先考虑当前家庭配置中更需要补足的资产。";
      }

      if (status === "unavailable") {
        return "市场数据暂不可用：按照家庭资产配置执行，不使用未经验证的市场判断。";
      }

      return "市场环境正常：按照家庭资产配置执行，结合大陆 + 香港家庭总资产判断本次投资节奏。";
    }, [market]);

  // ===================================================
  // AI CFO 信息
  //
  // 注意：
  // 这里不包含任何整数股候选组合信息
  // ===================================================

  const aiDecisionText =
    useMemo(() => {
      const lines: string[] = [];

      lines.push(
        "AI Wealth OS 家庭投资决策信息"
      );

      lines.push(
        `数据日期：${todayString()}`
      );

      lines.push("");

      // =================================================
      // 一、家庭资产配置
      // =================================================

      lines.push(
        "一、家庭资产配置"
      );

      lines.push(
        `总资产（仅 holdings）：¥${formatMoney(totalAssets)}`
      );

      for (const key of [
        "fixed_income",
        "global_stock",
        "china_stock",
        "gold",
      ] as CategoryKey[]) {
        lines.push(
          `${CATEGORY_LABELS[key]}：¥${formatMoney(
            categoryAmounts[key]
          )}，当前 ${formatPct(
            currentAllocation[key]
          )}，目标 ${formatPct(
            TARGETS[key]
          )}，允许 ${formatPct(
            RANGES[key].min
          )}-${formatPct(
            RANGES[key].max
          )}`
        );
      }

      lines.push("");

      // =================================================
      // 二、本次香港投资
      // =================================================

      lines.push(
        "二、本次香港投资"
      );

      lines.push(
        `本次投资金额：$${formatUsd(
          investmentAmountUsd
        )}`
      );

      lines.push(
        `VOO参考价格：$${vooPrice.toFixed(2)}`
      );

      lines.push(
        `GLDM参考价格：$${gldmPrice.toFixed(2)}`
      );

      lines.push(
        `USD/CNY：${usdCny.toFixed(4)}`
      );

      lines.push("");

      // =================================================
      // 三、固定收益未来资金
      // =================================================

      lines.push(
        "三、固定收益未来资金"
      );

      lines.push(
        `每个工作日投入固定收益：¥${formatMoney(
          FIXED_INCOME_DAILY
        )}`
      );

      if (fixedIncomePlan.reached) {
        lines.push(
          "当前固定收益已经达到约45%，继续投入前需要重新判断。"
        );
      } else {
        lines.push(
          `距离45%约还需要：¥${formatMoney(
            fixedIncomePlan.needed
          )}`
        );

        lines.push(
          `按¥2,000/工作日约需要：${fixedIncomePlan.workdays}个工作日`
        );

        lines.push(
          `预计达到45%的日期：${fixedIncomePlan.stopDate}`
        );
      }

      lines.push("");

      // =================================================
      // 四、市场环境
      // =================================================

      lines.push(
        "四、市场环境"
      );

      if (market) {
        lines.push(
          `市场状态：${marketStatusLabel(
            market.assessment.status
          )}`
        );

        lines.push(
          `市场评分：${market.assessment.score}`
        );

        lines.push(
          `市场判断：${market.assessment.summary}`
        );

        lines.push(
          `投资方向：${market.assessment.direction}`
        );

        const voo =
          market.market.voo;

        const gldm =
          market.market.gldm;

        const sp500 =
          market.market.sp500;

        const vix =
          market.market.vix;

        const treasury =
          market.market.treasury10y;

        const fx =
          market.market.usdcny;

        if (voo) {
          lines.push(
            `VOO：${formatPrice(
              voo.price
            )}，日变动 ${formatMarketPct(
              voo.changePct
            )}，1M ${formatMarketPct(
              voo.return1M
            )}`
          );
        }

        if (gldm) {
          lines.push(
            `GLDM：${formatPrice(
              gldm.price
            )}，日变动 ${formatMarketPct(
              gldm.changePct
            )}，1M ${formatMarketPct(
              gldm.return1M
            )}`
          );
        }

        if (sp500) {
          lines.push(
            `S&P 500：${formatPrice(
              sp500.price
            )}，日变动 ${formatMarketPct(
              sp500.changePct
            )}，1M ${formatMarketPct(
              sp500.return1M
            )}`
          );
        }

        if (vix) {
          lines.push(
            `VIX：${
              vix.price === null
                ? "--"
                : vix.price.toFixed(2)
            }`
          );
        }

        if (treasury) {
          lines.push(
            `10Y Treasury：${
              treasury.price === null
                ? "--"
                : treasury.price.toFixed(2)
            }`
          );
        }

        if (fx) {
          lines.push(
            `USD/CNY：${
              fx.price === null
                ? "--"
                : fx.price.toFixed(4)
            }`
          );
        }
      } else {
        lines.push(
          "市场数据暂不可用。"
        );
      }

      lines.push("");

      // =================================================
      // 五、香港 / 美元相关现有持仓
      // =================================================

      lines.push(
        "五、香港 / 美元相关现有持仓"
      );

      if (hkUsdHoldings.length === 0) {
        lines.push(
          "暂无相关持仓。"
        );
      } else {
        for (const item of hkUsdHoldings) {
          lines.push(
            `${item.code} ${item.name}：市场=${item.market ?? "--"}，类别=${
              CATEGORY_LABELS[
                item.category as CategoryKey
              ] ?? item.category ?? "--"
            }，金额=¥${formatMoney(
              getHoldingAmount(item)
            )}，股数=${
              item.shares ?? "--"
            }`
          );
        }
      }

      lines.push("");

      // =================================================
      // 六、当前 VOO / GLDM 持仓
      // =================================================

      lines.push(
        "六、当前 VOO / GLDM 持仓"
      );

      lines.push(
        `VOO当前持仓：${currentVoo?.shares ?? 0} 股`
      );

      lines.push(
        `GLDM当前持仓：${currentGldm?.shares ?? 0} 股`
      );

      lines.push("");

      // =================================================
      // 七、投资规则
      // =================================================

      lines.push(
        "七、投资规则"
      );

      lines.push(
        "002849 暂停新增购买。"
      );

      lines.push(
        "SCHD 暂停新增购买。"
      );

      lines.push(
        "QQQ 暂停新增购买。"
      );

      lines.push(
        "香港新增资金主要考虑 VOO + GLDM。"
      );

      lines.push(
        "家庭最终决策必须同时考虑大陆 + 香港资产。"
      );

      lines.push(
        "市场环境用于调整投资节奏，不改变家庭长期目标比例。"
      );

      lines.push(
        "本页面不自动计算最佳整数股组合，由 AI CFO 根据完整信息进行最终判断。"
      );

      lines.push("");

      // =================================================
      // 最终 AI CFO 决策问题
      //
      // 不包含任何整数股候选组合信息
      // =================================================

      lines.push(
        "请基于以上完整家庭资产、当前配置、香港现有持仓、当前市场环境和本次投资金额，给出本次香港投资的最终建议："
      );

      lines.push(
        "1. 是否现在投资；"
      );

      lines.push(
        "2. 如果投资，建议主要投资 VOO 还是 GLDM，或者两者都投资；"
      );

      lines.push(
        "3. 如果投资，建议大约投入多少比例到 VOO / GLDM；"
      );

      lines.push(
        "4. 是否需要分批；"
      );

      lines.push(
        "5. 如果建议分批，请说明第一批建议投入多少；"
      );

      lines.push(
        "6. 为什么；"
      );

      return lines.join("\n");
    }, [
      totalAssets,
      categoryAmounts,
      currentAllocation,
      investmentAmountUsd,
      vooPrice,
      gldmPrice,
      usdCny,
      fixedIncomePlan,
      market,
      hkUsdHoldings,
      currentVoo,
      currentGldm,
    ]);

  // ===================================================
  // JSX
  // ===================================================

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar title="换汇" />

      <main className="mx-auto max-w-7xl px-4 py-6">

        {/* =================================================
            一、换汇
        ================================================= */}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            换汇
          </h1>

          <p className="mt-1 text-sm text-slate-500">
            记录实际换汇交易
          </p>

          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">

            <div>
              <label className="text-sm text-slate-600">
                换汇日期
              </label>

              <input
                type="date"
                value={exchangeDate}
                onChange={(e) =>
                  setExchangeDate(
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="text-sm text-slate-600">
                换出币种
              </label>

              <select
                value={fromCurrency}
                onChange={(e) =>
                  setFromCurrency(
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="CNY">
                  CNY
                </option>

                <option value="USD">
                  USD
                </option>

                <option value="HKD">
                  HKD
                </option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-600">
                换出金额
              </label>

              <input
                type="number"
                value={fromAmount}
                onChange={(e) =>
                  setFromAmount(
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-sm text-slate-600">
                换入币种
              </label>

              <select
                value={toCurrency}
                onChange={(e) =>
                  setToCurrency(
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="USD">
                  USD
                </option>

                <option value="CNY">
                  CNY
                </option>

                <option value="HKD">
                  HKD
                </option>
              </select>
            </div>

            <div>
              <label className="text-sm text-slate-600">
                换入金额
              </label>

              <input
                type="number"
                value={toAmount}
                onChange={(e) =>
                  setToAmount(
                    e.target.value
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="0"
              />
            </div>

            <div>
              <label className="text-sm text-slate-600">
                手续费
              </label>

              <input
                type="number"
                value={fee}
                onChange={(e) =>
                  setFee(e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="0"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-sm text-slate-600">
                备注
              </label>

              <input
                value={remark}
                onChange={(e) =>
                  setRemark(e.target.value)
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="备注"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-4">

            <div className="text-sm text-slate-600">
              实际汇率：

              <span className="font-semibold text-slate-900">
                {actualRate === null
                  ? "--"
                  : actualRate.toFixed(6)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleSaveExchange}
              disabled={saving}
              className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {saving
                ? "保存中..."
                : "保存换汇"}
            </button>

          </div>
        </section>

        {/* =================================================
            二、换汇统计
        ================================================= */}

        <section className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              换汇次数
            </div>

            <div className="mt-2 text-2xl font-semibold">
              {exchangeCount}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              CNY → USD 总额
            </div>

            <div className="mt-2 text-2xl font-semibold">
              ¥{formatMoney(totalCnyToUsd)}
            </div>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="text-sm text-slate-500">
              获得 USD
            </div>

            <div className="mt-2 text-2xl font-semibold">
              ${formatUsd(totalUsd)}
            </div>
          </div>

        </section>

        {/* =================================================
            三、换汇历史
        ================================================= */}

        <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">

          <h2 className="text-lg font-semibold">
            换汇历史
          </h2>

          <div className="mt-4 overflow-x-auto">

            <table className="min-w-full text-sm">

              <thead>
                <tr className="border-b text-left text-slate-500">

                  <th className="px-3 py-3">
                    日期
                  </th>

                  <th className="px-3 py-3">
                    换出
                  </th>

                  <th className="px-3 py-3">
                    换入
                  </th>

                  <th className="px-3 py-3">
                    汇率
                  </th>

                  <th className="px-3 py-3">
                    手续费
                  </th>

                  <th className="px-3 py-3">
                    备注
                  </th>

                  <th className="px-3 py-3">
                    操作
                  </th>

                </tr>
              </thead>

              <tbody>

                {loading ? (

                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      加载中...
                    </td>
                  </tr>

                ) : exchanges.length === 0 ? (

                  <tr>
                    <td
                      colSpan={7}
                      className="px-3 py-8 text-center text-slate-500"
                    >
                      暂无换汇记录
                    </td>
                  </tr>

                ) : (

                  exchanges.map((item) => (

                    <tr
                      key={item.id}
                      className="border-b last:border-0"
                    >

                      <td className="px-3 py-3">
                        {item.exchange_date}
                      </td>

                      <td className="px-3 py-3">
                        {item.from_currency}{" "}
                        {item.from_amount.toFixed(2)}
                      </td>

                      <td className="px-3 py-3">
                        {item.to_currency}{" "}
                        {item.to_amount.toFixed(2)}
                      </td>

                      <td className="px-3 py-3">
                        {item.actual_rate === null
                          ? "--"
                          : item.actual_rate.toFixed(6)}
                      </td>

                      <td className="px-3 py-3">
                        {item.fee.toFixed(2)}
                      </td>

                      <td className="px-3 py-3">
                        {item.remark || "--"}
                      </td>

                      <td className="px-3 py-3">

                        <button
                          type="button"
                          onClick={() =>
                            handleDeleteExchange(
                              item.id
                            )
                          }
                          className="text-red-600 hover:underline"
                        >
                          删除
                        </button>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>
        </section>

        {/* =================================================
            AI 投资决策
        ================================================= */}

        <section className="mt-10">

          <div className="mb-5">

            <h2 className="text-2xl font-bold text-slate-900">
              AI 投资决策
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              基于家庭大陆 + 香港资产配置，
              当前市场环境和本次投资金额，
              辅助判断本次香港资金如何配置。
            </p>

          </div>

          {/* =================================================
              一、本次香港投资
          ================================================= */}

          <section className="rounded-2xl bg-white p-5 shadow-sm">

            <h3 className="text-lg font-semibold">
              一、本次香港投资
            </h3>

            <div className="mt-4 max-w-md">

              <label className="text-sm text-slate-600">
                本次投资金额 USD
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={investmentAmountUsd}
                onChange={(e) =>
                  setInvestmentAmountUsd(
                    Number(e.target.value)
                  )
                }
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-lg"
              />

              <p className="mt-2 text-xs text-slate-500">
                这是本次投资决策使用的投资金额。
                系统不自动读取或显示 HK_CASH。
              </p>

            </div>

          </section>

          {/* =================================================
              二、家庭资产配置
          ================================================= */}

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">

            <h3 className="text-lg font-semibold">
              二、当前家庭资产配置
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              大陆 + 香港，数据来源仅为 holdings。
              不包含 fixed_income_assets。
            </p>

            <div className="mt-5 overflow-x-auto">

              <table className="min-w-full text-sm">

                <thead>

                  <tr className="border-b text-left text-slate-500">

                    <th className="px-3 py-3">
                      类别
                    </th>

                    <th className="px-3 py-3">
                      金额
                    </th>

                    <th className="px-3 py-3">
                      当前
                    </th>

                    <th className="px-3 py-3">
                      目标
                    </th>

                    <th className="px-3 py-3">
                      允许区间
                    </th>

                    <th className="px-3 py-3">
                      偏离
                    </th>

                    <th className="px-3 py-3">
                      状态
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {(
                    [
                      "fixed_income",
                      "global_stock",
                      "china_stock",
                      "gold",
                    ] as CategoryKey[]
                  ).map((key) => {

                    const current =
                      currentAllocation[key];

                    const deviation =
                      current -
                      TARGETS[key];

                    const status =
                      categoryStatus(
                        key,
                        current
                      );

                    return (

                      <tr
                        key={key}
                        className="border-b last:border-0"
                      >

                        <td className="px-3 py-4 font-medium">
                          {CATEGORY_LABELS[key]}
                        </td>

                        <td className="px-3 py-4">
                          ¥
                          {formatMoney(
                            categoryAmounts[key]
                          )}
                        </td>

                        <td className="px-3 py-4 font-semibold">
                          {formatPct(current)}
                        </td>

                        <td className="px-3 py-4">
                          {formatPct(
                            TARGETS[key]
                          )}
                        </td>

                        <td className="px-3 py-4">
                          {formatPct(
                            RANGES[key].min
                          )}{" "}
                          -{" "}
                          {formatPct(
                            RANGES[key].max
                          )}
                        </td>

                        <td
                          className={`px-3 py-4 ${
                            deviation > 0
                              ? "text-red-600"
                              : deviation < 0
                              ? "text-amber-600"
                              : "text-emerald-600"
                          }`}
                        >
                          {deviation >= 0
                            ? "+"
                            : ""}
                          {formatPctPoint(
                            deviation
                          )}
                        </td>

                        <td className="px-3 py-4">

                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                          >
                            {status.label}
                          </span>

                        </td>

                      </tr>

                    );
                  })}

                </tbody>

              </table>

            </div>

            <div className="mt-5 rounded-xl bg-slate-50 p-4">

              <div className="text-sm text-slate-500">
                家庭金融资产合计
              </div>

              <div className="mt-1 text-2xl font-bold">
                ¥{formatMoney(totalAssets)}
              </div>

            </div>

          </section>

          {/* =================================================
              三、固定收益未来资金
          ================================================= */}

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">

            <h3 className="text-lg font-semibold">
              三、固定收益未来资金
            </h3>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  当前固定收益
                </div>

                <div className="mt-1 text-lg font-semibold">
                  ¥
                  {formatMoney(
                    categoryAmounts.fixed_income
                  )}
                </div>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  当前比例
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {formatPct(
                    currentAllocation.fixed_income
                  )}
                </div>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  每工作日投入
                </div>

                <div className="mt-1 text-lg font-semibold">
                  ¥
                  {formatMoney(
                    FIXED_INCOME_DAILY
                  )}
                </div>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  达到45%所需
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {fixedIncomePlan.reached
                    ? "已达到"
                    : `约 ${fixedIncomePlan.workdays} 个工作日`}
                </div>

              </div>

            </div>

            <div className="mt-4 text-sm text-slate-600">

              {fixedIncomePlan.reached ? (
                <>
                  当前固定收益已经达到约45%，
                  原则上可以停止继续增加固定收益，
                  后续根据家庭总资产变化重新判断。
                </>
              ) : (
                <>
                  继续按照每个工作日 ¥2,000
                  增加固定收益，

                  <strong>
                    达到约45%后停止
                  </strong>

                  ，不把
                  {fixedIncomePlan.stopDate}
                  作为硬性停止条件。
                </>
              )}

            </div>

          </section>

          {/* =================================================
              四、香港 / USD 持仓
          ================================================= */}

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">

            <h3 className="text-lg font-semibold">
              四、香港 / 美元相关现有持仓
            </h3>

            <p className="mt-1 text-xs text-slate-500">
              仅作为投资决策背景信息；HK_CASH
              不显示。
            </p>

            <div className="mt-4 overflow-x-auto">

              <table className="min-w-full text-sm">

                <thead>

                  <tr className="border-b text-left text-slate-500">

                    <th className="px-3 py-3">
                      代码
                    </th>

                    <th className="px-3 py-3">
                      名称
                    </th>

                    <th className="px-3 py-3">
                      市场
                    </th>

                    <th className="px-3 py-3">
                      类别
                    </th>

                    <th className="px-3 py-3">
                      金额
                    </th>

                    <th className="px-3 py-3">
                      股数
                    </th>

                  </tr>

                </thead>

                <tbody>

                  {hkUsdHoldings.length === 0 ? (

                    <tr>

                      <td
                        colSpan={6}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        暂无相关持仓
                      </td>

                    </tr>

                  ) : (

                    hkUsdHoldings.map(
                      (item) => (

                        <tr
                          key={item.id}
                          className="border-b last:border-0"
                        >

                          <td className="px-3 py-3 font-medium">
                            {item.code}
                          </td>

                          <td className="px-3 py-3">
                            {item.name}
                          </td>

                          <td className="px-3 py-3">
                            {item.market}
                          </td>

                          <td className="px-3 py-3">
                            {
                              CATEGORY_LABELS[
                                item.category as CategoryKey
                              ] ??
                              item.category ??
                              "--"
                            }
                          </td>

                          <td className="px-3 py-3">
                            ¥
                            {formatMoney(
                              getHoldingAmount(item)
                            )}
                          </td>

                          <td className="px-3 py-3">
                            {item.shares ?? "--"}
                          </td>

                        </tr>

                      )
                    )

                  )}

                </tbody>

              </table>

            </div>

          </section>

          {/* =================================================
              五、价格输入
          ================================================= */}

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>

                <h3 className="text-lg font-semibold">
                  五、VOO / GLDM 参考价格
                </h3>

                <p className="mt-1 text-xs text-slate-500">
                  默认自动使用市场数据；也可以手工修改。
                </p>

              </div>

              <button
                type="button"
                onClick={loadMarket}
                disabled={marketLoading}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
              >
                {marketLoading
                  ? "更新中..."
                  : "刷新市场数据"}
              </button>

            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">

              <div>

                <label className="text-sm text-slate-600">
                  VOO USD
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={vooPrice}
                  onChange={(e) =>
                    setVooPrice(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />

              </div>

              <div>

                <label className="text-sm text-slate-600">
                  GLDM USD
                </label>

                <input
                  type="number"
                  step="0.01"
                  value={gldmPrice}
                  onChange={(e) =>
                    setGldmPrice(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />

              </div>

              <div>

                <label className="text-sm text-slate-600">
                  USD/CNY
                </label>

                <input
                  type="number"
                  step="0.0001"
                  value={usdCny}
                  onChange={(e) =>
                    setUsdCny(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2"
                />

              </div>

            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  当前 VOO 持仓
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {currentVoo?.shares ?? 0} 股
                </div>

              </div>

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  当前 GLDM 持仓
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {currentGldm?.shares ?? 0} 股
                </div>

              </div>

            </div>

          </section>

          {/* =================================================
              六、投资规则
          ================================================= */}

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">

            <h3 className="text-lg font-semibold">
              六、AI 投资规则
            </h3>

            <div className="mt-4 space-y-2 text-sm text-slate-700">

              <div>
                • 002849：暂停新增购买
              </div>

              <div>
                • SCHD：暂停新增购买
              </div>

              <div>
                • QQQ：暂停新增购买
              </div>

              <div>
                • 香港新增资金：主要考虑 VOO + GLDM
              </div>

              <div>
                • 固定收益：每个工作日 ¥2,000，
                达到约45%后停止
              </div>

              <div>
                • 最终决策：必须看大陆 + 香港家庭总资产
              </div>

              <div>
                • 市场环境：用于调整投资节奏，
                不改变长期目标配置
              </div>

              <div>
                • VOO / GLDM 的具体买入数量由 AI CFO 根据完整信息最终判断
              </div>

            </div>

          </section>

          {/* =================================================
              七、当前市场环境
          ================================================= */}

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">

            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

              <div>

                <h3 className="text-lg font-semibold">
                  七、当前市场环境
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  自动读取市场数据，用于辅助本次投资节奏判断
                </p>

              </div>

              {market && (

                <span
                  className={`rounded-full px-3 py-1 text-sm font-medium ${marketStatusClass(
                    market.assessment.status
                  )}`}
                >
                  {marketStatusLabel(
                    market.assessment.status
                  )}
                </span>

              )}

            </div>

            {marketError && (

              <div className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                {marketError}
              </div>

            )}

            <div className="mt-5 grid grid-cols-2 gap-4 md:grid-cols-6">

              {/* VOO */}

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  VOO
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {formatPrice(
                    market?.market.voo
                      ?.price ?? null
                  )}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  1M{" "}
                  {formatMarketPct(
                    market?.market.voo
                      ?.return1M ?? null
                  )}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  日变动{" "}
                  {formatMarketPct(
                    market?.market.voo
                      ?.changePct ?? null
                  )}
                </div>

              </div>

              {/* GLDM */}

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  GLDM
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {formatPrice(
                    market?.market.gldm
                      ?.price ?? null
                  )}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  1M{" "}
                  {formatMarketPct(
                    market?.market.gldm
                      ?.return1M ?? null
                  )}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  日变动{" "}
                  {formatMarketPct(
                    market?.market.gldm
                      ?.changePct ?? null
                  )}
                </div>

              </div>

              {/* S&P */}

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  S&P 500
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {formatPrice(
                    market?.market.sp500
                      ?.price ?? null
                  )}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  1M{" "}
                  {formatMarketPct(
                    market?.market.sp500
                      ?.return1M ?? null
                  )}
                </div>

              </div>

              {/* VIX */}

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  VIX
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {market?.market.vix
                    ?.price == null
                    ? "--"
                    : market.market.vix.price.toFixed(
                        2
                      )}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  市场波动率
                </div>

              </div>

              {/* Treasury */}

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  10Y Treasury
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {market?.market
                    .treasury10y
                    ?.price == null
                    ? "--"
                    : `${market.market.treasury10y.price.toFixed(
                        2
                      )}%`}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  美国10年期
                </div>

              </div>

              {/* FX */}

              <div className="rounded-xl bg-slate-50 p-4">

                <div className="text-xs text-slate-500">
                  USD/CNY
                </div>

                <div className="mt-1 text-lg font-semibold">
                  {market?.market
                    .usdcny?.price == null
                    ? "--"
                    : market.market.usdcny.price.toFixed(
                        4
                      )}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  美元人民币
                </div>

              </div>

            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">

              <div className="rounded-xl border border-slate-200 p-4">

                <div className="text-sm font-medium">
                  市场判断依据
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {market
                    ? market.assessment.summary
                    : "等待市场数据"}
                </div>

              </div>

              <div className="rounded-xl border border-slate-200 p-4">

                <div className="text-sm font-medium">
                  本次投资建议方向
                </div>

                <div className="mt-2 text-sm text-slate-600">
                  {investmentDirection}
                </div>

              </div>

            </div>

            <div className="mt-4 text-xs text-slate-400">

              市场数据更新时间：

              {market?.updatedAt
                ? new Date(
                    market.updatedAt
                  ).toLocaleString("zh-CN")
                : "--"}

            </div>

          </section>

          {/* =================================================
              九、复制给 AI CFO
              
              注意：
              这里不包含「整数股候选组合」
              ================================================= */}

          <section className="mt-5 rounded-2xl bg-white p-5 shadow-sm">

            <h3 className="text-lg font-semibold">
              八、复制给 AI CFO
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              复制下面完整信息，让 AI CFO 做最终投资判断。
              不包含系统整数股候选组合。
            </p>

            <textarea
              readOnly
              value={aiDecisionText}
              className="mt-4 min-h-[420px] w-full rounded-xl border border-slate-300 bg-slate-50 p-4 font-mono text-xs leading-6"
            />

            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(
                    aiDecisionText
                  );

                  alert(
                    "AI 决策信息已复制"
                  );
                } catch {
                  alert(
                    "复制失败，请手动复制"
                  );
                }
              }}
              className="mt-4 rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white"
            >
              复制 AI 决策信息
            </button>

          </section>

        </section>

      </main>
    </div>
  );
}