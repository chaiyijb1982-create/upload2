import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// =====================================================
// Yahoo Finance Chart API
// =====================================================

type YahooChartResult = {
  meta?: {
    symbol?: string;
    regularMarketPrice?: number;
    previousClose?: number;
    chartPreviousClose?: number;
    regularMarketTime?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
  };

  timestamp?: number[];

  indicators?: {
    quote?: Array<{
      close?: Array<number | null>;
    }>;
  };
};

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[];
    error?: unknown;
  };
};

type MarketItem = {
  symbol: string;
  price: number | null;
  previousClose: number | null;
  dailyChangePct: number | null;
  return1M: number | null;
  return3M: number | null;
  return6M: number | null;
  return1Y: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  drawdownFromHighPct: number | null;
  updatedAt: string | null;
  error?: string;
};

type MarketAssessment = {
  status: "normal" | "caution" | "risk" | "unavailable";
  score: number;
  summary: string;
  direction: string;
};

// =====================================================
// 获取 Yahoo 数据
// =====================================================

async function fetchYahooChart(
  symbol: string,
  range = "1y"
): Promise<YahooChartResult> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/` +
    `${encodeURIComponent(symbol)}` +
    `?range=${range}` +
    `&interval=1d` +
    `&events=history` +
    `&includeAdjustedClose=true`;

  const response = await fetch(url, {
    cache: "no-store",
    headers: {
      Accept: "application/json",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Yahoo Finance ${symbol} HTTP ${response.status}`
    );
  }

  const json =
    (await response.json()) as YahooChartResponse;

  const result = json.chart?.result?.[0];

  if (!result) {
    throw new Error(
      `Yahoo Finance ${symbol} 返回数据为空`
    );
  }

  return result;
}

// =====================================================
// 清理价格
// =====================================================

function cleanPrices(
  result: YahooChartResult
): Array<{ timestamp: number; close: number }> {
  const timestamps = result.timestamp ?? [];

  const closes =
    result.indicators?.quote?.[0]?.close ?? [];

  const output: Array<{
    timestamp: number;
    close: number;
  }> = [];

  for (let i = 0; i < timestamps.length; i++) {
    const timestamp = timestamps[i];
    const close = closes[i];

    if (
      Number.isFinite(timestamp) &&
      typeof close === "number" &&
      Number.isFinite(close) &&
      close > 0
    ) {
      output.push({
        timestamp,
        close,
      });
    }
  }

  return output;
}

// =====================================================
// 根据交易日数据计算历史收益
// =====================================================

function returnFromDays(
  prices: Array<{ timestamp: number; close: number }>,
  days: number,
  currentPrice: number | null
): number | null {
  if (
    !prices.length ||
    currentPrice == null ||
    !Number.isFinite(currentPrice)
  ) {
    return null;
  }

  const targetTimestamp =
    Math.floor(Date.now() / 1000) -
    days * 24 * 60 * 60;

  let base = prices[0];

  for (const item of prices) {
    if (item.timestamp <= targetTimestamp) {
      base = item;
    } else {
      break;
    }
  }

  if (
    !base ||
    !Number.isFinite(base.close) ||
    base.close <= 0
  ) {
    return null;
  }

  return (
    ((currentPrice - base.close) / base.close) *
    100
  );
}

// =====================================================
// 创建 Market Item
// =====================================================

function buildMarketItem(
  symbol: string,
  result: YahooChartResult
): MarketItem {
  const meta = result.meta ?? {};

  const price =
    typeof meta.regularMarketPrice === "number" &&
    Number.isFinite(meta.regularMarketPrice)
      ? meta.regularMarketPrice
      : null;

  const previousCloseRaw =
    meta.previousClose ??
    meta.chartPreviousClose ??
    null;

  const previousClose =
    typeof previousCloseRaw === "number" &&
    Number.isFinite(previousCloseRaw)
      ? previousCloseRaw
      : null;

  const dailyChangePct =
    price != null &&
    previousClose != null &&
    previousClose > 0
      ? ((price - previousClose) / previousClose) * 100
      : null;

  const prices = cleanPrices(result);

  const fiftyTwoWeekHigh =
    typeof meta.fiftyTwoWeekHigh === "number" &&
    Number.isFinite(meta.fiftyTwoWeekHigh)
      ? meta.fiftyTwoWeekHigh
      : null;

  const fiftyTwoWeekLow =
    typeof meta.fiftyTwoWeekLow === "number" &&
    Number.isFinite(meta.fiftyTwoWeekLow)
      ? meta.fiftyTwoWeekLow
      : null;

  const drawdownFromHighPct =
    price != null &&
    fiftyTwoWeekHigh != null &&
    fiftyTwoWeekHigh > 0
      ? ((price - fiftyTwoWeekHigh) /
          fiftyTwoWeekHigh) *
        100
      : null;

  const updatedAt =
    typeof meta.regularMarketTime === "number"
      ? new Date(
          meta.regularMarketTime * 1000
        ).toISOString()
      : null;

  return {
    symbol,
    price,
    previousClose,
    dailyChangePct,
    return1M: returnFromDays(
      prices,
      30,
      price
    ),
    return3M: returnFromDays(
      prices,
      90,
      price
    ),
    return6M: returnFromDays(
      prices,
      180,
      price
    ),
    return1Y: returnFromDays(
      prices,
      365,
      price
    ),
    fiftyTwoWeekHigh,
    fiftyTwoWeekLow,
    drawdownFromHighPct,
    updatedAt,
  };
}

// =====================================================
// 安全获取
// =====================================================

async function safeFetchMarketItem(
  symbol: string
): Promise<MarketItem> {
  try {
    const result =
      await fetchYahooChart(symbol);

    return buildMarketItem(
      symbol,
      result
    );
  } catch (error) {
    return {
      symbol,
      price: null,
      previousClose: null,
      dailyChangePct: null,
      return1M: null,
      return3M: null,
      return6M: null,
      return1Y: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      drawdownFromHighPct: null,
      updatedAt: null,
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

// =====================================================
// 市场判断
//
// 注意：
// 市场环境只用于“投资节奏”。
// 不改变家庭长期资产目标。
// =====================================================

function buildAssessment(
  voo: MarketItem,
  gldm: MarketItem,
  sp500: MarketItem,
  vix: MarketItem,
  treasury10Y: MarketItem
): MarketAssessment {
  const coreValues = [
    voo.price,
    gldm.price,
    sp500.price,
    vix.price,
    treasury10Y.price,
  ];

  const validCoreCount =
    coreValues.filter(
      (value) =>
        typeof value === "number" &&
        Number.isFinite(value)
    ).length;

  if (validCoreCount === 0) {
    return {
      status: "unavailable",
      score: 0,
      summary:
        "核心市场数据暂时无法取得，系统不会在数据缺失时自动判断为正常。",
      direction:
        "暂停自动节奏判断，建议等待市场数据恢复后再决定是否执行本次投资。",
    };
  }

  let score = 0;
  const reasons: string[] = [];

  // ---------------------------------------------------
  // VIX
  // ---------------------------------------------------

  if (vix.price != null) {
    if (vix.price >= 30) {
      score += 4;
      reasons.push(
        `VIX ${vix.price.toFixed(
          2
        )}，市场波动明显偏高`
      );
    } else if (vix.price >= 25) {
      score += 3;
      reasons.push(
        `VIX ${vix.price.toFixed(
          2
        )}，市场波动偏高`
      );
    } else if (vix.price >= 20) {
      score += 2;
      reasons.push(
        `VIX ${vix.price.toFixed(
          2
        )}，市场波动有所升高`
      );
    } else if (vix.price >= 15) {
      score += 1;
      reasons.push(
        `VIX ${vix.price.toFixed(
          2
        )}，波动率略高`
      );
    }
  }

  // ---------------------------------------------------
  // VOO 回撤
  // ---------------------------------------------------

  if (voo.drawdownFromHighPct != null) {
    if (voo.drawdownFromHighPct <= -15) {
      score += 2;
      reasons.push(
        `VOO 较52周高点回撤 ${Math.abs(
          voo.drawdownFromHighPct
        ).toFixed(1)}%`
      );
    } else if (voo.drawdownFromHighPct <= -10) {
      score += 1;
      reasons.push(
        `VOO 较52周高点回撤 ${Math.abs(
          voo.drawdownFromHighPct
        ).toFixed(1)}%`
      );
    }
  }

  // ---------------------------------------------------
  // VOO 短期涨幅
  // ---------------------------------------------------

  if (voo.return1M != null) {
    if (voo.return1M >= 10) {
      score += 2;
      reasons.push(
        `VOO 近1个月上涨 ${voo.return1M.toFixed(
          1
        )}%`
      );
    } else if (voo.return1M >= 8) {
      score += 1;
      reasons.push(
        `VOO 近1个月上涨 ${voo.return1M.toFixed(
          1
        )}%`
      );
    }
  }

  // ---------------------------------------------------
  // GLDM 短期涨幅
  // ---------------------------------------------------

  if (gldm.return1M != null) {
    if (gldm.return1M >= 10) {
      score += 1;
      reasons.push(
        `GLDM 近1个月上涨 ${gldm.return1M.toFixed(
          1
        )}%`
      );
    }
  }

  // ---------------------------------------------------
  // 美国10年期国债
  // ---------------------------------------------------

  if (treasury10Y.price != null) {
    if (treasury10Y.price >= 4.75) {
      score += 1;
      reasons.push(
        `美国10年期国债收益率 ${treasury10Y.price.toFixed(
          2
        )}%`
      );
    }
  }

  // ---------------------------------------------------
  // 综合状态
  // ---------------------------------------------------

  let status:
    | "normal"
    | "caution"
    | "risk";

  if (score >= 6) {
    status = "risk";
  } else if (score >= 3) {
    status = "caution";
  } else {
    status = "normal";
  }

  let summary = "";

  let direction = "";

  if (status === "risk") {
    summary =
      reasons.length > 0
        ? `市场风险指标偏高：${reasons.join(
            "；"
          )}。`
        : "市场风险指标偏高。";

    direction =
      "不建议一次性把计划资金全部投入，优先考虑分批投资，并适当提高防守性资产的优先级。";
  } else if (status === "caution") {
    summary =
      reasons.length > 0
        ? `市场存在一定压力或短期涨幅偏快：${reasons.join(
            "；"
          )}。`
        : "市场存在一定压力或短期涨幅偏快。";

    direction =
      "可以投资，但建议控制节奏；家庭资产配置优先，市场环境主要用于决定一次投入还是分批投入。";
  } else {
    summary =
      reasons.length > 0
        ? `市场整体没有达到明显风险阈值：${reasons.join(
            "；"
          )}。`
        : "市场整体没有达到明显风险阈值。";

    direction =
      "可以按照家庭资产配置执行本次投资，市场环境暂不需要明显降低投资力度。";
  }

  return {
    status,
    score,
    summary,
    direction,
  };
}

// =====================================================
// GET
// =====================================================

export async function GET() {
  const symbols = [
    "VOO",
    "GLDM",
    "^GSPC",
    "^VIX",
    "^TNX",
    "CNY=X",
  ];

  const [
    voo,
    gldm,
    sp500,
    vix,
    treasury10Y,
    usdCny,
  ] = await Promise.all(
    symbols.map(
      (symbol) =>
        safeFetchMarketItem(symbol)
    )
  );

  const assessment =
    buildAssessment(
      voo,
      gldm,
      sp500,
      vix,
      treasury10Y
    );

  const updatedTimes = [
    voo.updatedAt,
    gldm.updatedAt,
    sp500.updatedAt,
    vix.updatedAt,
    treasury10Y.updatedAt,
    usdCny.updatedAt,
  ].filter(Boolean) as string[];

  const updatedAt =
    updatedTimes.length > 0
      ? updatedTimes.sort().at(-1) ?? null
      : null;

  const validCount = [
    voo,
    gldm,
    sp500,
    vix,
    treasury10Y,
    usdCny,
  ].filter(
    (item) =>
      typeof item.price === "number" &&
      Number.isFinite(item.price)
  ).length;

  return NextResponse.json({
    success: true,

    updatedAt,

    dataStatus:
      validCount === 0
        ? "unavailable"
        : validCount < symbols.length
        ? "partial"
        : "complete",

    market: {
      voo,
      gldm,
      sp500,
      vix,
      treasury10Y,
      usdCny,
    },

    assessment,

    notes: [
      "市场数据来自 Yahoo Finance Chart API。",
      "市场环境仅用于调整投资节奏，不改变家庭长期资产配置目标。",
      "市场数据缺失时不会自动判断为正常。",
    ],
  });
}

