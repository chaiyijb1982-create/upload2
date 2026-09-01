import { NextResponse } from "next/server";


// =====================================================
// Exchange Rate API
//
// 返回：
// USD/CNY
// USD/HKD
//
// 数据来源：Frankfurter
// 无需 API Key
// =====================================================

export async function GET() {

  try {

    // ===================================================
    // 获取 USD → CNY
    // ===================================================

    const usdCnyResponse =
      await fetch(
        "https://api.frankfurter.dev/v2/rate/USD/CNY",
        {
          cache: "no-store",
        }
      );


    if (!usdCnyResponse.ok) {

      throw new Error(
        "USD/CNY exchange rate request failed"
      );

    }


    const usdCnyData =
      await usdCnyResponse.json();


    // ===================================================
    // 获取 USD → HKD
    // ===================================================

    const usdHkdResponse =
      await fetch(
        "https://api.frankfurter.dev/v2/rate/USD/HKD",
        {
          cache: "no-store",
        }
      );


    if (!usdHkdResponse.ok) {

      throw new Error(
        "USD/HKD exchange rate request failed"
      );

    }


    const usdHkdData =
      await usdHkdResponse.json();


    // ===================================================
    // 汇率
    // ===================================================

    const usdCny =
      Number(
        usdCnyData?.rate
      );


    const usdHkd =
      Number(
        usdHkdData?.rate
      );


    // ===================================================
    // 数据检查
    // ===================================================

    if (
      !Number.isFinite(usdCny) ||
      usdCny <= 0 ||
      !Number.isFinite(usdHkd) ||
      usdHkd <= 0
    ) {

      throw new Error(
        "Invalid exchange rate data"
      );

    }


    // ===================================================
    // CNY → HKD
    //
    // 例如：
    //
    // USD/CNY = 7.20
    // USD/HKD = 7.80
    //
    // 1 CNY =
    // 7.80 / 7.20 HKD
    //
    // 所以：
    //
    // HKD = CNY × hkdPerCny
    // ===================================================

    const hkdPerCny =
      usdHkd /
      usdCny;


    // ===================================================
    // 返回
    // ===================================================

    return NextResponse.json({

      success: true,

      usdCny,

      usdHkd,

      hkdPerCny,

      date:
        usdCnyData?.date ||
        usdHkdData?.date ||
        null,

    });

  } catch (error) {

    console.error(
      "Exchange rate API error:",
      error
    );


    return NextResponse.json(

      {
        success: false,

        message:
          "无法获取实时汇率",

      },

      {
        status: 500,
      }

    );

  }

}