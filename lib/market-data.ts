// =====================================================
// lib/market-data.ts
//
// 全球资产市场数据
//
// 数据源：
//
// 中国基金
// → 天天基金 / 东方财富
//
// 美股 / ETF
// → Finnhub
//
// HK / LU 基金
// → StockEvents
//
// USD/CNY
// → Frankfurter
//
// 注意：
// 只能在服务器端使用
// 不要在 client component 中直接 import
// =====================================================


// =====================================================
// 类型
// =====================================================

export type MarketPrice = {

  price: number;

  date?: string;

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


function cleanCode(
  value: any
): string {

  return String(
    value ?? ""
  )
    .trim()
    .toUpperCase();

}


// =====================================================
// 1. 中国基金
//
// 代码：6位数字
//
// 例如：
// 015736
// 002849
// 519981
// 021000
// =====================================================

export async function getChinaFundPrice(
  code: string
): Promise<MarketPrice | null> {

  const codeStr =
    cleanCode(code)
      .replace(/\D/g, "")
      .padStart(6, "0");


  if (
    !/^\d{6}$/.test(
      codeStr
    )
  ) {

    return null;

  }


  const url =
    `https://fund.eastmoney.com/${codeStr}.html`;


  try {

    const response =
      await fetch(
        url,
        {
          headers: {

            "User-Agent":
              "Mozilla/5.0",

            "Accept":
              "text/html,application/xhtml+xml",

          },

          cache:
            "no-store",

        }
      );


    if (
      !response.ok
    ) {

      console.error(
        "China fund HTTP error:",
        response.status,
        codeStr
      );

      return null;

    }


    const html =
      await response.text();


    // =================================================
    // 单位净值日期
    // =================================================

    const dateMatch =
      html.match(
        /单位净值[^\(]*\(([^)]+)\)/
      );


    // =================================================
    // 单位净值
    // =================================================

    const valueMatch =
      html.match(
        /单位净值[^>]*>[\s\S]*?<span[^>]*>([\d.]+)</
      );


    if (
      !dateMatch ||
      !valueMatch
    ) {

      console.error(
        "China fund parse failed:",
        codeStr
      );

      return null;

    }


    const price =
      toNumber(
        valueMatch[1]
      );


    if (
      price <= 0
    ) {

      return null;

    }


    return {

      price,

      date:
        dateMatch[1]
          ?.trim(),

    };

  } catch (
    error
  ) {

    console.error(
      "getChinaFundPrice error:",
      codeStr,
      error
    );

    return null;

  }

}


// =====================================================
// 2. Finnhub
//
// 美股 / ETF
//
// 例如：
// VOO
// QQQ
// GLD
// TSM
// INTC
//
// 注意：
// 服务器端使用
//
// 这一版增加了完整调试信息：
//
// 1. HTTP 状态
// 2. RAW 返回
// 3. JSON 数据
// 4. current price
// 5. previous close
// 6. timestamp
//
// 目的：
// 定位 Vercel 环境为什么获取 Finnhub 失败
// =====================================================

export async function getFinnhubPrice(
  code: string
): Promise<MarketPrice | null> {

  const symbol =
    cleanCode(code);


  // =================================================
  // Symbol
  // =================================================

  if (
    !symbol
  ) {

    console.error(
      "❌ Finnhub symbol 为空"
    );

    return null;

  }


  // =================================================
  // API Key
  // =================================================

  const apiKey =
    process.env.FINNHUB_KEY;


  if (
    !apiKey
  ) {

    console.error(
      "❌ FINNHUB_KEY 未配置"
    );

    return null;

  }


  // =================================================
  // URL
  // =================================================

  const url =
    "https://finnhub.io/api/v1/quote" +
    `?symbol=${encodeURIComponent(symbol)}` +
    `&token=${encodeURIComponent(apiKey)}`;


  try {

    // =================================================
    // DEBUG
    // =================================================

    console.log(
      "====================================="
    );

    console.log(
      "Finnhub 请求:",
      symbol
    );

    console.log(
      "Finnhub URL:",
      url.replace(
        apiKey,
        "***"
      )
    );


    // =================================================
    // Request
    // =================================================

    const response =
      await fetch(
        url,
        {
          method:
            "GET",

          cache:
            "no-store",

          headers: {

            "Accept":
              "application/json",

            "User-Agent":
              "AI-Wealth-OS",

          },

        }
      );


    // =================================================
    // 先读取 RAW
    //
    // 不直接 response.json()
    //
    // 这样即使 Finnhub 返回错误文本，
    // 我们也可以看到真实内容。
    // =================================================

    const text =
      await response.text();


    // =================================================
    // HTTP 状态
    // =================================================

    console.log(
      "Finnhub HTTP:",
      symbol,
      response.status,
      response.statusText
    );


    // =================================================
    // RAW
    // =================================================

    console.log(
      "Finnhub RAW:",
      symbol,
      text
    );


    // =================================================
    // HTTP Error
    // =================================================

    if (
      !response.ok
    ) {

      console.error(
        "❌ Finnhub HTTP error:",
        symbol,
        response.status,
        text
      );

      return null;

    }


    // =================================================
    // JSON
    // =================================================

    let data:
      any;


    try {

      data =
        JSON.parse(
          text
        );

    } catch (
      error
    ) {

      console.error(
        "❌ Finnhub JSON parse failed:",
        symbol,
        text
      );

      return null;

    }


    // =================================================
    // JSON DEBUG
    // =================================================

    console.log(
      "Finnhub DATA:",
      symbol,
      data
    );


    // =================================================
    // Finnhub Quote
    //
    // c
    // = current price
    //
    // pc
    // = previous close
    //
    // t
    // = Unix timestamp
    // =================================================

    let price =
      toNumber(
        data?.c
      );


    // =================================================
    // 如果当前价格无效
    //
    // 使用 previous close
    //
    // 这样即使当前市场没有实时价格，
    // 也能取得最近有效价格。
    // =================================================

    if (
      price <= 0
    ) {

      price =
        toNumber(
          data?.pc
        );

    }


    // =================================================
    // 仍然没有价格
    // =================================================

    if (
      price <= 0
    ) {

      console.error(
        "❌ Finnhub 没有有效价格:",
        symbol,
        data
      );

      return null;

    }


    // =================================================
    // 日期
    // =================================================

    let date =
      new Date()
        .toISOString()
        .slice(
          0,
          10
        );


    // =================================================
    // 如果 Finnhub 有 timestamp
    // 使用 Finnhub 时间
    // =================================================

    if (
      data?.t
    ) {

      const timestamp =
        Number(
          data.t
        );


      if (
        Number.isFinite(
          timestamp
        ) &&
        timestamp > 0
      ) {

        date =
          new Date(
            timestamp * 1000
          )
            .toISOString()
            .slice(
              0,
              10
            );

      }

    }


    // =================================================
    // 成功日志
    // =================================================

    console.log(
      "✅ Finnhub 成功:",
      {
        symbol,

        price,

        date,

        current:
          data?.c,

        previousClose:
          data?.pc,

        timestamp:
          data?.t,

      }
    );


    // =================================================
    // 返回
    // =================================================

    return {

      price,

      date,

    };

  } catch (
    error
  ) {

    console.error(
      "❌ getFinnhubPrice exception:",
      symbol,
      error
    );

    return null;

  }

}


// =====================================================
// 3. StockEvents
//
// HK / LU 基金
//
// 例如：
//
// HK0000584737
// HK0000591468
// LU0912262788
// LU0098860793
// =====================================================

export async function getStockEventsPrice(
  code: string
): Promise<MarketPrice | null> {

  const clean =
    cleanCode(code);


  if (
    !clean
  ) {

    return null;

  }


  const url =
    "https://stockevents.app/api/graphql";


  const query = `
    query(
      $symbols:[String],
      $timezone:String,
      $currency:String
    ){

      quotesCompact(
        symbols:$symbols,
        timezone:$timezone,
        currency:$currency
      ){

        symbols

      }

    }
  `;


  const symbol =
    `${clean}.FUND`;


  const body = {

    query,

    variables: {

      symbols: [
        symbol
      ],

      timezone:
        "Asia/Shanghai",

      currency:
        "USD",

    },

  };


  try {

    const response =
      await fetch(
        url,
        {
          method:
            "POST",

          headers: {

            "Content-Type":
              "application/json",

            "User-Agent":
              "Mozilla/5.0",

          },

          body:
            JSON.stringify(
              body
            ),

          cache:
            "no-store",

        }
      );


    if (
      !response.ok
    ) {

      console.error(
        "StockEvents HTTP error:",
        response.status,
        clean
      );

      return null;

    }


    const data =
      await response.json();


    const result =
      data
        ?.data
        ?.quotesCompact
        ?.symbols;


    const item =
      result?.[symbol];


    if (
      !Array.isArray(item) ||
      item.length < 2
    ) {

      return null;

    }


    const price =
      toNumber(
        item[1]
      );


    if (
      price <= 0
    ) {

      return null;

    }


    return {

      price,

      date:
        new Date()
          .toISOString()
          .slice(
            0,
            10
          ),

    };

  } catch (
    error
  ) {

    console.error(
      "getStockEventsPrice error:",
      clean,
      error
    );

    return null;

  }

}


// =====================================================
// 4. USD/CNY
//
// Frankfurter
// =====================================================

export async function getUsdCny(): Promise<number | null> {

  const url =
    "https://api.frankfurter.app/latest?from=USD&to=CNY";


  try {

    const response =
      await fetch(
        url,
        {
          cache:
            "no-store",

        }
      );


    if (
      !response.ok
    ) {

      console.error(
        "USD/CNY HTTP error:",
        response.status
      );

      return null;

    }


    const data =
      await response.json();


    const rate =
      toNumber(
        data
          ?.rates
          ?.CNY
      );


    if (
      rate <= 0
    ) {

      return null;

    }


    return rate;

  } catch (
    error
  ) {

    console.error(
      "getUsdCny error:",
      error
    );

    return null;

  }

}


// =====================================================
// 5. 自动判断数据源
//
// 不看 market
//
// 规则：
//
// 6位数字
// → China Fund
//
// HKxxxxxxxxxx
// → StockEvents
//
// LUxxxxxxxxxx
// → StockEvents
//
// 其他
// → Finnhub
//
// 注意：
// WELAB_GOLD / HK_CASH 特殊跳过
// =====================================================

export type MarketSource =
  | "china"
  | "finnhub"
  | "stockevents"
  | "skip";


export function detectMarketSource(
  code: string
): MarketSource {

  const clean =
    cleanCode(code);


  // =================================================
  // 特殊资产
  // =================================================

  if (
    clean === "WELAB_GOLD" ||
    clean === "HK_CASH"
  ) {

    return "skip";

  }


  // =================================================
  // 中国基金
  // =================================================

  if (
    /^\d{6}$/.test(
      clean
    )
  ) {

    return "china";

  }


  // =================================================
  // 香港基金
  // =================================================

  if (
    clean.startsWith(
      "HK"
    )
  ) {

    return "stockevents";

  }


  // =================================================
  // 卢森堡基金
  // =================================================

  if (
    clean.startsWith(
      "LU"
    )
  ) {

    return "stockevents";

  }


  // =================================================
  // 其他
  //
  // 默认按照美股 / ETF
  // =================================================

  return "finnhub";

}


// =====================================================
// 6. 自动获取价格
// =====================================================

export async function getMarketPrice(
  code: string
): Promise<{
  source: MarketSource;
  data: MarketPrice | null;
}> {

  const source =
    detectMarketSource(
      code
    );


  // =================================================
  // 特殊资产
  // =================================================

  if (
    source === "skip"
  ) {

    return {

      source,

      data:
        null,

    };

  }


  // =================================================
  // 中国基金
  // =================================================

  if (
    source === "china"
  ) {

    return {

      source,

      data:
        await getChinaFundPrice(
          code
        ),

    };

  }


  // =================================================
  // HK / LU
  // =================================================

  if (
    source === "stockevents"
  ) {

    return {

      source,

      data:
        await getStockEventsPrice(
          code
        ),

    };

  }


  // =================================================
  // US / ETF
  // =================================================

  return {

    source:
      "finnhub",

    data:
      await getFinnhubPrice(
        code
      ),

  };

}
