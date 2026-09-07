import {
  NextRequest,
  NextResponse,
} from "next/server";

type Currency =
  | "CNY"
  | "USD"
  | "HKD";

function isValidCurrency(
  value: string
): value is Currency {
  return (
    value === "CNY" ||
    value === "USD" ||
    value === "HKD"
  );
}

function isValidDate(
  value: string
): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value
  );
}

function isFutureDate(
  value: string
): boolean {
  if (!isValidDate(value)) {
    return false;
  }

  const requested =
    new Date(
      `${value}T00:00:00Z`
    );

  const today = new Date();

  const todayUtc =
    new Date(
      Date.UTC(
        today.getUTCFullYear(),
        today.getUTCMonth(),
        today.getUTCDate()
      )
    );

  return requested > todayUtc;
}

// =====================================================
// 从 Frankfurter 获取汇率
//
// 最新：
// /latest?from=USD&to=CNY
//
// 历史：
// /2026-09-04?from=USD&to=CNY
// =====================================================

async function fetchFrankfurterRate(
  currency: "USD" | "HKD",
  date?: string
): Promise<{
  rate: number;
  date: string | null;
  source: string;
}> {
  const errors: string[] = [];

  // ---------------------------------------------------
  // 1. 如果没有日期
  //    直接使用 latest
  // ---------------------------------------------------

  if (!date) {
    try {
      const url =
        new URL(
          "https://api.frankfurter.app/latest"
        );

      url.searchParams.set(
        "from",
        currency
      );

      url.searchParams.set(
        "to",
        "CNY"
      );

      const response =
        await fetch(
          url.toString(),
          {
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (response.ok) {
        const rate =
          Number(
            data?.rates?.CNY
          );

        if (
          Number.isFinite(rate) &&
          rate > 0
        ) {
          return {
            rate,
            date:
              typeof data?.date ===
              "string"
                ? data.date
                : null,
            source:
              "Frankfurter latest",
          };
        }
      }

      errors.push(
        `Frankfurter latest HTTP ${response.status}`
      );
    } catch (error) {
      errors.push(
        `Frankfurter latest：${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  // ---------------------------------------------------
  // 2. 指定日期
  // ---------------------------------------------------

  if (date) {
    try {
      const url =
        new URL(
          `https://api.frankfurter.app/${encodeURIComponent(
            date
          )}`
        );

      url.searchParams.set(
        "from",
        currency
      );

      url.searchParams.set(
        "to",
        "CNY"
      );

      const response =
        await fetch(
          url.toString(),
          {
            cache: "no-store",
            headers: {
              Accept:
                "application/json",
            },
          }
        );

      const data =
        await response.json();

      if (response.ok) {
        const rate =
          Number(
            data?.rates?.CNY
          );

        if (
          Number.isFinite(rate) &&
          rate > 0
        ) {
          return {
            rate,
            date:
              typeof data?.date ===
              "string"
                ? data.date
                : date,
            source:
              "Frankfurter historical",
          };
        }
      }

      errors.push(
        `Frankfurter ${date} HTTP ${response.status}`
      );
    } catch (error) {
      errors.push(
        `Frankfurter ${date}：${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      );
    }
  }

  // ---------------------------------------------------
  // 3. 如果历史日期失败
  //    自动回退到 latest
  //
  //    这是解决周末/节假日问题的关键。
  // ---------------------------------------------------

  try {
    const url =
      new URL(
        "https://api.frankfurter.app/latest"
      );

    url.searchParams.set(
      "from",
      currency
    );

    url.searchParams.set(
      "to",
      "CNY"
    );

    const response =
      await fetch(
        url.toString(),
        {
          cache: "no-store",
          headers: {
            Accept:
              "application/json",
          },
        }
      );

    const data =
      await response.json();

    if (response.ok) {
      const rate =
        Number(
          data?.rates?.CNY
        );

      if (
        Number.isFinite(rate) &&
        rate > 0
      ) {
        return {
          rate,
          date:
            typeof data?.date ===
            "string"
              ? data.date
              : null,
          source:
            "Frankfurter latest fallback",
        };
      }
    }

    errors.push(
      `Frankfurter latest fallback HTTP ${response.status}`
    );
  } catch (error) {
    errors.push(
      `Frankfurter latest fallback：${
        error instanceof Error
          ? error.message
          : String(error)
      }`
    );
  }

  // ---------------------------------------------------
  // 全部失败
  // ---------------------------------------------------

  throw new Error(
    errors.join("；")
  );
}

// =====================================================
// GET
// =====================================================

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    // -------------------------------------------------
    // Currency
    // -------------------------------------------------

    const currencyParam =
      (
        searchParams.get(
          "currency"
        ) || "CNY"
      )
        .trim()
        .toUpperCase();

    // -------------------------------------------------
    // Date
    // -------------------------------------------------

    const date =
      searchParams
        .get("date")
        ?.trim() || "";

    // -------------------------------------------------
    // Currency validation
    // -------------------------------------------------

    if (
      !isValidCurrency(
        currencyParam
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `不支持的币种：${currencyParam}`,
        },
        {
          status: 400,
        }
      );
    }

    const currency =
      currencyParam;

    // -------------------------------------------------
    // Date validation
    // -------------------------------------------------

    if (
      date &&
      !isValidDate(date)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `日期格式错误：${date}`,
        },
        {
          status: 400,
        }
      );
    }

    // -------------------------------------------------
    // 不允许查询未来日期
    // -------------------------------------------------

    if (
      date &&
      isFutureDate(date)
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `不能查询未来日期：${date}`,
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // CNY
    //
    // CNY → CNY = 1
    // =================================================

    if (
      currency === "CNY"
    ) {
      return NextResponse.json({
        success: true,

        currency: "CNY",

        base: "CNY",

        quote: "CNY",

        rate: 1,

        date:
          date || null,

        source:
          "fixed",
      });
    }

    // =================================================
    // USD / HKD
    // =================================================

    const result =
      await fetchFrankfurterRate(
        currency,
        date || undefined
      );

    // =================================================
    // 防止异常汇率
    // =================================================

    if (
      !Number.isFinite(
        result.rate
      ) ||
      result.rate <= 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `${currency} → CNY 汇率无效`,
        },
        {
          status: 502,
        }
      );
    }

    // -------------------------------------------------
    // 防止外币错误返回 1
    // -------------------------------------------------

    if (
      result.rate === 1
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `${currency} → CNY 汇率异常：返回 1`,
        },
        {
          status: 502,
        }
      );
    }

    // =================================================
    // 返回
    // =================================================

    return NextResponse.json({
      success: true,

      currency,

      base: currency,

      quote: "CNY",

      rate: result.rate,

      date:
        result.date ||
        date ||
        null,

      source:
        result.source,
    });
  } catch (error) {
    console.error(
      "exchange-rate error:",
      error
    );

    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : "汇率服务异常",
      },
      {
        status: 502,
      }
    );
  }
}