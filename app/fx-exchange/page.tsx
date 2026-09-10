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
// 本页面不自动计算：
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
// 这里不包含任何系统预先计算的整数股候选组合。
// AI CFO 根据：
// 1. 家庭整体资产配置
// 2. 香港现有 VOO / GLDM 持仓
// 3. 当前 VOO / GLDM 价格
// 4. 本次投资金额
// 5. 香港账户不能购买碎股
// 6. 固定收益当前比例
// 7. 市场环境
//
// 最终决定实际整数股买入方案。
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
      `总资产（仅 holdings）：¥${formatMoney(
        totalAssets
      )}`
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
      `VOO 当前价格：$${formatUsd(
        vooPrice
      )}`
    );

    lines.push(
      `GLDM 当前价格：$${formatUsd(
        gldmPrice
      )}`
    );

    lines.push(
      `USD/CNY 当前汇率：${usdCny}`
    );

    lines.push("");

    // =================================================
    // 三、市场环境
    // =================================================

    lines.push(
      "三、当前市场环境"
    );

    lines.push(
      investmentDirection
    );

    if (market?.assessment) {
      lines.push(
        `市场判断：${market.assessment.status ?? "unavailable"}`
      );

      if (market.assessment.summary) {
        lines.push(
          `市场摘要：${market.assessment.summary}`
        );
      }
    }

    lines.push("");

    // =================================================
    // 四、固定收益计划
    // =================================================

    lines.push(
      "四、固定收益计划"
    );

    lines.push(
      `固定收益当前比例：${formatPct(
        currentAllocation.fixed_income
      )}`
    );

    lines.push(
      `固定收益每个工作日投入：¥${formatMoney(
        FIXED_INCOME_DAILY
      )}`
    );

    if (fixedIncomePlan.reached) {
      lines.push(
        "固定收益已经达到约45%，原则上停止继续增加固定收益。"
      );

      lines.push(
        "停止增加固定收益不代表停止家庭整体投资，新增资金应根据家庭整体配置转向其他低配资产。"
      );
    } else {
      lines.push(
        `按照当前计划继续每个工作日投入 ¥${formatMoney(
          FIXED_INCOME_DAILY
        )}，预计约 ${fixedIncomePlan.workdays} 个工作日达到45%左右。`
      );

      lines.push(
        "达到约45%后停止增加固定收益，不把系统计算的日期作为硬性停止条件。"
      );
    }

    lines.push("");

    // =================================================
    // 五、香港 / USD 现有持仓
    // =================================================

    lines.push(
      "五、当前香港 / USD 相关持仓"
    );

    lines.push(
      `当前 VOO：${currentVoo?.shares ?? 0} 股`
    );

    lines.push(
      `当前 GLDM：${currentGldm?.shares ?? 0} 股`
    );



    lines.push("");

    // =================================================
    // 六、投资规则
    // =================================================

    lines.push(
      "六、投资规则"
    );

       lines.push(
      "002849 暂停新增购买。当前中国股票已经超过允许上限，等待其他资产增长后自然稀释。"
    );

    lines.push(
      "SCHD 暂停新增购买。"
    );

    lines.push(
      "QQQ 暂停新增购买。"
    );

    lines.push(
      "香港新增资金的长期基准配置为：VOO 60%、GLDM 40%。"
    );

    lines.push(
      "VOO 60% / GLDM 40% 是香港新增资金的默认长期基准，不允许 AI CFO 每次根据短期市场波动随意改变。"
    );

    lines.push(
      "AI CFO 首先按照 VOO 60% / GLDM 40% 计算理论资金配置，然后再结合大陆 + 香港家庭整体资产配置进行必要修正。"
    );

    lines.push(
      "如果全球股票已经超过允许上限40%，应明显降低或暂停 VOO 新增；如果只是高于30%目标但仍在25%-40%允许区间内，不应仅因为高于目标就自动停止 VOO。"
    );

    lines.push(
      "如果黄金低于允许下限10%，应明显提高 GLDM 优先级；如果黄金仅低于15%目标但仍在10%-20%允许区间内，可以适度提高 GLDM，但不应自动变成100% GLDM。"
    );

    lines.push(
      "如果中国股票超过允许上限15%，禁止继续增加中国股票，002849保持暂停。"
    );

    lines.push(
      "固定收益当前目标45%，允许区间40%-55%；当前低于45%时，大陆继续每个工作日投入¥2,000，达到约45%后停止增加固定收益。"
    );

    lines.push(
      "停止增加固定收益不代表停止投资，后续新增资金仍应根据家庭整体资产配置重新分配。"
    );

    lines.push(
      "家庭最终决策必须同时考虑大陆 + 香港家庭总资产，而不是只看香港账户。"
    );

    lines.push(
      "市场环境只用于调整投资节奏和是否分批，不改变香港长期VOO 60% / GLDM 40%的基准配置。"
    );

    lines.push(
      "市场环境normal时，原则上一次性执行；caution时可以考虑分批；risk时优先考虑分批执行，但不得因此改变长期资产配置逻辑。"
    );

    lines.push(
      "香港账户不支持碎股，VOO 和 GLDM 均只能购买完整整数股。"
    );

    lines.push(
      "AI CFO 必须先计算理论配置，再在整数股约束下寻找实际可执行方案。"
    );

    lines.push(
      "整数股方案应尽可能使用本次投资资金，同时保持与60% VOO / 40% GLDM基准方向一致，并结合家庭整体资产配置进行自然再平衡。"
    );

    lines.push(
      "AI CFO 不能只给 VOO / GLDM 投资比例，必须进一步给出具体买入股数、实际使用资金和剩余现金。"
    );

    lines.push(
      "本页面不自动计算最佳整数股组合，最终整数股方案由 AI CFO 根据以上完整规则计算。"
    );
    lines.push("");

    // =================================================
    // 七、最终 AI CFO 决策问题
    // =================================================

    lines.push(
      "七、最终 AI CFO 决策"
    );

        lines.push(
      "请基于以上完整家庭资产、当前配置、香港现有持仓、当前市场环境、本次投资金额以及 VOO / GLDM 当前价格，按照固定的 AI CFO 决策规则，给出本次香港投资的最终可执行方案。"
    );

    lines.push(
      `1. 本次为既定的定投资金 $${formatUsd(
        investmentAmountUsd
      )}，不要判断“是否投资”，而是直接决定这笔资金如何配置。`
    );

    lines.push(
      "2. 香港新增资金长期基准为 VOO 60% / GLDM 40%，先以此作为本次投资的默认配置起点。"
    );

    lines.push(
      "3. 然后检查大陆 + 香港家庭整体资产配置：固定收益、全球股票、中国股票、黄金分别距离目标和允许区间还有多少。"
    );

    lines.push(
      "4. 如果某一资产已经超过允许上限，应优先停止增加该资产，并利用新增资金向其他低配资产自然再平衡。"
    );

    lines.push(
      "5. 全球股票只有在超过40%允许上限时，才应明显降低或暂停VOO；如果只是高于30%目标但仍在25%-40%允许区间内，不应仅因为高于目标就完全停止VOO。"
    );

    lines.push(
      "6. 黄金只有在低于10%允许下限时，才需要明显提高GLDM优先级；如果黄金处于10%-20%允许区间内，则仍以60% VOO / 40% GLDM作为主要基准，并根据整体配置适度调整。"
    );

    lines.push(
      "7. 中国股票目前已经超过15%允许上限，因此002849不得新增购买。"
    );

    lines.push(
      "8. 固定收益继续按照每个工作日¥2,000投入，达到约45%后停止增加固定收益；香港本次投资不需要为了补固定收益而改变VOO / GLDM的长期投资框架。"
    );

    lines.push(
      "9. 市场环境只用于判断投资节奏：normal原则上一次性投资；caution可以考虑分批；risk优先考虑分批。市场环境不能直接改变长期60% VOO / 40% GLDM基准。"
    );

    lines.push(
      "10. 必须考虑香港账户不支持碎股，VOO和GLDM只能购买完整整数股。"
    );

    lines.push(
      "11. 必须根据当前VOO价格、GLDM价格和本次实际投资金额，计算实际可以买入的整数股组合。"
    );

    lines.push(
      "12. 在整数股约束下，应尽可能提高资金使用效率，同时让实际组合尽可能接近经过家庭资产配置修正后的目标比例。"
    );

    lines.push(
      "13. 必须明确给出VOO买入股数、GLDM买入股数、实际使用美元金额以及剩余美元现金。"
    );

    lines.push(
      "14. 如果剩余现金较多，必须判断是保留现金、增加另一只ETF的整数股，还是留到下一次定投；不能为了消耗现金而破坏家庭资产配置。"
    );

    lines.push(
      "15. 必须明确判断是否需要分批；如果分批，必须明确第一批VOO股数、第一批GLDM股数以及第一批预计使用金额。"
    );

    lines.push(
      "16. 必须判断本次投资完成后，大陆 + 香港合计家庭资产配置是否更加接近长期目标。"
    );

    lines.push(
      "17. 最终输出必须给出唯一的推荐执行方案，而不是同时给出多个互相冲突的方案。"
    );

    lines.push(
      "18. 请说明最终方案最核心的2-4个理由，重点解释为什么当前家庭资产配置决定了本次VOO和GLDM的具体比例及整数股数量。"
    );


    lines.push("");

    lines.push(
      "============================================================"
    );

    lines.push(
      "AI CFO 最终输出格式"
    );

    lines.push(
      "============================================================"
    );

    lines.push(
      "最终必须严格按照以下结构回答："
    );

    lines.push("");

    lines.push(
      "【问题】"
    );

    lines.push(
      "本次香港投资需要解决的问题。"
    );

    lines.push("");

    lines.push(
      "【数据】"
    );

    lines.push(
      "列出最终决策使用的关键数据，包括本次投资金额、VOO价格、GLDM价格、USD/CNY、当前家庭资产配置等。"
    );

    lines.push("");

    lines.push(
      "【判断】"
    );

    lines.push(
      "说明为什么当前家庭整体资产配置决定本次投资比例。"
    );

    lines.push("");

    lines.push(
      "【监控条件】"
    );

    lines.push(
      "如果存在明确的价格、汇率或配置阈值，必须明确写出。"
    );

    lines.push(
      "如果没有明确阈值，写：无明确数值条件"
    );

    lines.push("");

    lines.push(
      "【Holding】"
    );

    lines.push(
      "涉及具体持仓时必须使用：资产名称 · Code。"
    );

    lines.push(
      "例如：VOO · VOO"
    );

    lines.push(
      "如果没有：无"
    );

    lines.push("");

    lines.push(
      "【建议动作】"
    );

    lines.push(
      "必须给出唯一的最终执行方案。"
    );

    lines.push(
      "必须明确 VOO 买入股数、GLDM 买入股数、实际使用美元金额以及剩余美元现金。"
    );

    lines.push("");

    lines.push(
      "【状态】"
    );

    lines.push(
      "只能使用：🟢 已达到条件 / 🟡 尚未达到条件 / ⚪ 无法判断"
    );

    lines.push("");

    lines.push(
      "不要提供多个互相冲突的最终方案。"
    );

    lines.push(
      "如果条件不足，必须明确说明无法判断，不得自行创造条件。"
    );

    lines.push("");
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
    investmentDirection,
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
      • 香港新增资金长期基准：VOO 60% / GLDM 40%
    </div>

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
      • 家庭资产配置：必须同时考虑大陆 + 香港
    </div>

    <div>
      • 全球股票超过40%允许上限时，降低或暂停VOO
    </div>

    <div>
      • 黄金低于10%允许下限时，提高GLDM优先级
    </div>

    <div>
      • 固定收益：每个工作日 ¥2,000，
      达到约45%后停止
    </div>

    <div>
      • 市场环境：只调整投资节奏，不改变长期60% VOO / 40% GLDM基准
    </div>

    <div>
      • 香港账户不支持碎股，VOO / GLDM只能购买整数股
    </div>

    <div>
      • 最终由 AI CFO 根据家庭配置、价格、资金和整数股约束决定具体股数
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