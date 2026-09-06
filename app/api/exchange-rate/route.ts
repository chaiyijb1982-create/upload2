import { NextRequest, NextResponse } from "next/server";

type Currency = "CNY" | "USD" | "HKD";

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

export async function GET(
  request: NextRequest
) {
  try {
    const { searchParams } =
      new URL(request.url);

    const currencyParam =
      (
        searchParams.get(
          "currency"
        ) || "CNY"
      ).toUpperCase();

    const date =
      searchParams
        .get("date")
        ?.trim() || "";

    // =================================================
    // Currency validation
    // =================================================

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

    // =================================================
    // CNY
    //
    // CNY → CNY 永远是 1
    // 不调用外部 API
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
          isValidDate(date)
            ? date
            : null,
      });
    }

    // =================================================
    // USD / HKD
    //
    // 直接获取：
    //
    // USD → CNY
    // HKD → CNY
    //
    // 不再通过 USD → HKD → CNY
    // =================================================

    const apiUrl =
      new URL(
        "https://api.frankfurter.dev/v2/rates"
      );

    apiUrl.searchParams.set(
      "base",
      currency
    );

    apiUrl.searchParams.set(
      "quotes",
      "CNY"
    );

    if (
      date &&
      isValidDate(date)
    ) {
      apiUrl.searchParams.set(
        "date",
        date
      );
    }

    const response =
      await fetch(
        apiUrl.toString(),
        {
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      console.error(
        "Frankfurter error:",
        data
      );

      return NextResponse.json(
        {
          success: false,
          error: `${currency} 汇率获取失败`,
          detail: data,
        },
        {
          status:
            response.status || 500,
        }
      );
    }

    // =================================================
    // Frankfurter v2 返回：
    //
    // [
    //   {
    //     date: "...",
    //     base: "USD",
    //     quote: "CNY",
    //     rate: 7.xxxx
    //   }
    // ]
    // =================================================

    const rows =
      Array.isArray(data)
        ? data
        : [];

    const row =
      rows.find(
        (item) =>
          item?.base === currency &&
          item?.quote === "CNY"
      ) || null;

    const rate =
      Number(row?.rate);

    if (
      !Number.isFinite(rate) ||
      rate <= 0
    ) {
      console.error(
        "Invalid Frankfurter rate:",
        {
          currency,
          date,
          data,
        }
      );

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

    // =================================================
    // 防止外币错误变成 1
    // =================================================

    if (rate === 1) {
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

    return NextResponse.json({
      success: true,

      currency,

      base: currency,

      quote: "CNY",

      rate,

      date:
        row?.date ||
        (isValidDate(date)
          ? date
          : null),
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
        status: 500,
      }
    );
  }
}