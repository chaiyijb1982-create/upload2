// =====================================================
// app/api/credit-card/route.ts
//
// 信用卡 API
//
// 提供：
// 1. 信用卡列表
// 2. 信用卡预估账单
// 3. 信用卡固定分期
// 4. 信用卡总预估支出
// 5. 预估还需要自己拿
// 6. 信用卡实际账单
// 7. 实际还需要自己拿
//
// monthly-savings-estimate
// 使用：
// estimate_need_myself
//
// =====================================================

import {
  NextResponse,
} from "next/server";

import {
  getCreditCards,
  getCreditCardFundingSummary,
} from "@/lib/credit-card";


// =====================================================
// GET
// =====================================================

export async function GET() {

  try {

    // ===================================================
    // 获取信用卡列表
    // ===================================================

    const cards =
      await getCreditCards();


    // ===================================================
    // 获取信用卡资金安排汇总
    // ===================================================

    const fundingSummary =
      await getCreditCardFundingSummary();


    // ===================================================
    // 返回
    // ===================================================

    return NextResponse.json({

      success:
        true,


      // -------------------------------------------------
      // 信用卡列表
      // -------------------------------------------------

      cards,


      // -------------------------------------------------
      // 信用卡消费预估
      // -------------------------------------------------

      estimate_bill_total:
        fundingSummary
          .estimate_bill_total,


      // -------------------------------------------------
      // ⭐ 固定信用卡分期
      // -------------------------------------------------

      installment_total:
        fundingSummary
          .installment_total,


      // -------------------------------------------------
      // ⭐ 信用卡总预估支出
      //
      // 消费预估
      // +
      // 固定分期
      // -------------------------------------------------

      estimate_total:
        fundingSummary
          .estimate_total,


      // -------------------------------------------------
      // 总预估资金
      // -------------------------------------------------

      estimate_funding_total:
        fundingSummary
          .estimate_funding_total,


      // -------------------------------------------------
      // ⭐ 预估还需要自己拿
      //
      // monthly-savings-estimate
      // 应该使用这个字段
      // -------------------------------------------------

      estimate_need_myself:
        fundingSummary
          .estimate_need_myself,


      // -------------------------------------------------
      // 实际账单
      // -------------------------------------------------

      actual_bill_total:
        fundingSummary
          .actual_bill_total,


      // -------------------------------------------------
      // 实际资金
      // -------------------------------------------------

      actual_funding_total:
        fundingSummary
          .actual_funding_total,


      // -------------------------------------------------
      // 实际还需要自己拿
      // -------------------------------------------------

      actual_need_myself:
        fundingSummary
          .actual_need_myself,


      // -------------------------------------------------
      // 旧代码兼容
      // -------------------------------------------------

      estimate:
        fundingSummary
          .estimate_need_myself,

    });

  } catch (error) {

    console.error(
      "GET /api/credit-card error:",
      error
    );


    return NextResponse.json(

      {

        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "读取信用卡数据失败",

      },

      {

        status:
          500,

      }

    );

  }

}