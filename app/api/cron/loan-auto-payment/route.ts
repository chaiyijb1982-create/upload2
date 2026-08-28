// =====================================================
// app/api/cron/loan-auto-payment/route.ts
//
// 贷款自动还款（每天运行一次）
//
// 规则：
// 1. 房贷：每月 20 日
// 2. 信用卡分期：
//    loans.institution ↔ credit_cards.bank_name
//    唯一匹配 active 信用卡
//    读取 payment_day
// 3. 保险贷款 / 银行信用贷 / 其他 → 跳过
// 4. 今天等于还款日才执行
// 5. last_auto_payment_date 防止同周期重复
// 6. 首次上线：只初始化日期，不扣本金
// 7. auto_reduce_principal === true 才自动递减本金
// 8. auto_reduce_principal === false 不递减本金
// =====================================================

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  calculateRemainingPeriods,
} from "@/lib/loan-calculations";

export const runtime = "nodejs";

export const dynamic = "force-dynamic";

// =====================================================
// 类型
// =====================================================

type LoanRow = {
  id: string;
  name: string | null;
  type: string | null;
  loan_mode: string | null;
  remaining_amount: number | string | null;
  monthly_payment: number | string | null;
  interest_rate: number | string | null;
  end_date: string | null;
  institution: string | null;
  last_auto_payment_date: string | null;
  auto_reduce_principal: boolean | null;
  status: string | null;
};

type CreditCardRow = {
  bank_name: string | null;
  payment_day: number | string | null;
};

// =====================================================
// Supabase Admin
// =====================================================

function getAdminSupabase() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      "SUPABASE_URL 未配置"
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 未配置"
    );
  }

  return createClient(
    url,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// =====================================================
// 文本标准化
// =====================================================

function normalizeText(
  value: unknown
): string {
  return String(
    value ?? ""
  )
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/-/g, "")
    .replace(/_/g, "")
    .replace(/银行/g, "")
    .replace(/信用卡/g, "");
}

// =====================================================
// 银行简称映射
// =====================================================

function normalizeBankName(
  value: unknown
): string {
  const name =
    normalizeText(value);

  if (!name) {
    return "";
  }

  if (name === "工行") {
    return "工商";
  }

  if (name === "建行") {
    return "建设";
  }

  if (name === "中行") {
    return "中国";
  }

  if (name === "农行") {
    return "农业";
  }

  if (name === "交行") {
    return "交通";
  }

  if (name === "招行") {
    return "招商";
  }

  if (name === "中信") {
    return "中信";
  }

  if (name === "宁波") {
    return "宁波";
  }

  return name;
}

// =====================================================
// 今天日期
// Asia/Shanghai
// =====================================================

function getShanghaiToday(): {
  year: number;
  month: number;
  day: number;
} {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone:
          "Asia/Shanghai",
      }
    ).format(
      new Date()
    );

  const [
    year,
    month,
    day,
  ] =
    parts
      .split("-")
      .map(Number);

  return {
    year,
    month,
    day,
  };
}

// =====================================================
// 构建某年某月还款周期日期
//
// paymentDay 超过当月天数
// 使用当月最后一天
// =====================================================

function buildCycleDate(
  year: number,
  month: number,
  paymentDay: number
): string {
  const lastDay =
    new Date(
      year,
      month,
      0
    ).getDate();

  const day =
    Math.min(
      paymentDay,
      lastDay
    );

  return (
    `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`
  );
}

// =====================================================
// 确定贷款还款日
// =====================================================

function resolvePaymentDay(
  loan: LoanRow,
  activeCards: CreditCardRow[]
):
  | {
      paymentDay: number;
      classification: string;
    }
  | {
      skip: true;
      reason: string;
    } {

  // ---------------------------------------------------
  // 房贷
  // ---------------------------------------------------

  if (
    loan.type === "房贷"
  ) {
    return {
      paymentDay: 20,
      classification: "房贷",
    };
  }

  // ---------------------------------------------------
  // 信用卡分期
  // ---------------------------------------------------

  if (
    loan.type === "信用卡分期"
  ) {
    const loanBank =
      normalizeBankName(
        loan.institution
      );

    if (!loanBank) {
      return {
        skip: true,
        reason:
          "信用卡分期贷款缺少 institution，无法匹配信用卡",
      };
    }

    const matched =
      activeCards.filter(
        (
          card
        ) =>
          normalizeBankName(
            card.bank_name
          ) === loanBank
      );

    if (
      matched.length === 0
    ) {
      return {
        skip: true,
        reason:
          `institution「${loan.institution}」未匹配到任何 active 信用卡`,
      };
    }

    if (
      matched.length > 1
    ) {
      return {
        skip: true,
        reason:
          `institution「${loan.institution}」匹配到 ${matched.length} 张信用卡，不唯一，跳过`,
      };
    }

    const paymentDay =
      matched[0].payment_day;

    if (
      paymentDay === null ||
      paymentDay === undefined ||
      Number(paymentDay) < 1
    ) {
      return {
        skip: true,
        reason:
          `信用卡「${matched[0].bank_name}」payment_day 为空，跳过`,
      };
    }

    return {
      paymentDay:
        Math.floor(
          Number(paymentDay)
        ),

      classification:
        "信用卡分期",
    };
  }

  // ---------------------------------------------------
  // 其他类型
  // ---------------------------------------------------

  return {
    skip: true,
    reason:
      `贷款类型「${loan.type}」不在自动还款范围`,
  };
}

// =====================================================
// 主流程
// =====================================================

export async function GET() {
  const adminSupabase =
    getAdminSupabase();

  const startedAt =
    Date.now();

  // ===================================================
  // cron_logs：running
  // ===================================================

  const {
    data: logRow,
    error: logError,
  } =
    await adminSupabase
      .from("cron_logs")
      .insert({
        job_name:
          "loan-auto-payment",

        status:
          "running",

        started_at:
          new Date().toISOString(),
      })
      .select("id")
      .single();

  if (logError) {
    console.error(
      "loan-auto-payment cron_logs insert error:",
      logError
    );

    return NextResponse.json(
      {
        success: false,
        error:
          logError.message,
      },
      {
        status: 500,
      }
    );
  }

  const logId =
    logRow?.id;

  const details: any[] =
    [];

  let updatedCount =
    0;

  let failedCount =
    0;

  let skippedCount =
    0;

  try {
    // =================================================
    // 读取贷款
    //
    // 重要：
    // Supabase 生成类型可能把复杂 select 推断成
    // GenericStringError。
    //
    // 因此这里明确转换成 LoanRow[]。
    // =================================================

    const {
      data: loansData,
      error: loansError,
    } =
      await adminSupabase
        .from("loans")
        .select(
          [
            "id",
            "name",
            "type",
            "loan_mode",
            "remaining_amount",
            "monthly_payment",
            "interest_rate",
            "end_date",
            "institution",
            "last_auto_payment_date",
            "auto_reduce_principal",
            "status",
          ].join(", ")
        )
        .eq(
          "status",
          "active"
        );

    if (loansError) {
      throw new Error(
        `读取 loans 失败：${loansError.message}`
      );
    }

    // -------------------------------------------------
    // 关键 TypeScript 修复
    //
    // Supabase 查询结果有可能被推断成
    // GenericStringError。
    //
    // 这里明确告诉 TypeScript：
    // loansData 就是 LoanRow[]。
    // -------------------------------------------------

    const loans =
      (loansData ?? []) as unknown as LoanRow[];

    // =================================================
    // 读取 active 信用卡
    // =================================================

    const {
      data: cardsData,
      error: cardsError,
    } =
      await adminSupabase
        .from("credit_cards")
        .select(
          "bank_name, payment_day"
        )
        .eq(
          "active",
          true
        );

    if (cardsError) {
      throw new Error(
        `读取 credit_cards 失败：${cardsError.message}`
      );
    }

    const activeCards =
      (cardsData ?? []) as unknown as CreditCardRow[];

    const today =
      getShanghaiToday();

    // =================================================
    // 循环贷款
    // =================================================

    for (
      const loan of loans
    ) {
      const record: any = {
        loan_id:
          loan.id,

        loan_name:
          loan.name,

        payment_day:
          null,

        classification:
          null,

        auto_reduce_principal:
          loan.auto_reduce_principal === true,

        old_remaining_amount:
          Number(
            loan.remaining_amount ||
              0
          ),

        old_remaining_periods:
          null,

        principal_reduction:
          0,

        new_remaining_amount:
          null,

        skipped:
          false,

        skip_reason:
          null,
      };

      // =================================================
      // 1. 确定还款日
      // =================================================

      const resolved =
        resolvePaymentDay(
          loan,
          activeCards
        );

      if (
        "skip" in resolved
      ) {
        record.skipped =
          true;

        record.skip_reason =
          resolved.reason;

        details.push(
          record
        );

        skippedCount++;

        continue;
      }

      const {
        paymentDay,
        classification,
      } =
        resolved;

      record.payment_day =
        paymentDay;

      record.classification =
        classification;

      // =================================================
      // 2. 今天是否还款日
      // =================================================

      const cycleDate =
        buildCycleDate(
          today.year,
          today.month,
          paymentDay
        );

      if (
        today.day !==
        Number(
          cycleDate.slice(-2)
        )
      ) {
        record.skipped =
          true;

        record.skip_reason =
          `今天 ${today.year}-${String(today.month).padStart(2, "0")}-${String(today.day).padStart(2, "0")} 不是还款日（周期 ${cycleDate}）`;

        details.push(
          record
        );

        skippedCount++;

        continue;
      }

      // =================================================
      // 3. 幂等检查
      // =================================================

      const lastAutoPaymentDate =
        loan.last_auto_payment_date
          ? String(
              loan.last_auto_payment_date
            )
          : null;

      if (
        lastAutoPaymentDate &&
        lastAutoPaymentDate >=
          cycleDate
      ) {
        record.skipped =
          true;

        record.skip_reason =
          `本周期 ${cycleDate} 已处理（last_auto_payment_date=${lastAutoPaymentDate}）`;

        details.push(
          record
        );

        skippedCount++;

        continue;
      }

      // =================================================
      // 4. 首次上线安全初始化
      //
      // NULL：
      // 只初始化日期
      // 不扣本金
      // =================================================

      if (
        !lastAutoPaymentDate
      ) {
        let initYear =
          today.year;

        let initMonth =
          today.month - 1;

        if (
          initMonth === 0
        ) {
          initMonth =
            12;

          initYear -=
            1;
        }

        const initCycleDate =
          today.day <
          paymentDay
            ? buildCycleDate(
                initYear,
                initMonth,
                paymentDay
              )
            : cycleDate;

        const {
          error:
            initError,
        } =
          await adminSupabase
            .from("loans")
            .update({
              last_auto_payment_date:
                initCycleDate,
            })
            .eq(
              "id",
              loan.id
            )
            .is(
              "last_auto_payment_date",
              null
            );

        if (
          initError
        ) {
          record.skipped =
            true;

          record.skip_reason =
            `首次初始化失败：${initError.message}`;

          failedCount++;
        } else {
          record.skipped =
            true;

          record.skip_reason =
            `首次上线初始化 last_auto_payment_date=${initCycleDate}，不扣本金，从下个周期开始自动还款`;
        }

        details.push(
          record
        );

        skippedCount++;

        continue;
      }

      // =================================================
      // 5. 自动递减本金开关
      //
      // true：
      //   正常计算并递减本金
      //
      // false：
      //   不递减本金
      //   但仍然标记本周期已处理
      // =================================================

      if (
        loan.auto_reduce_principal !==
        true
      ) {
        record.skipped =
          true;

        record.skip_reason =
          "auto_reduce_principal=false，本周期不自动递减本金";

        record.new_remaining_amount =
          record.old_remaining_amount;

        const {
          error:
            noReduceUpdateError,
        } =
          await adminSupabase
            .from("loans")
            .update({
              last_auto_payment_date:
                cycleDate,
            })
            .eq(
              "id",
              loan.id
            )
            .or(
              `last_auto_payment_date.is.null,last_auto_payment_date.lt.${cycleDate}`
            );

        if (
          noReduceUpdateError
        ) {
          record.skipped =
            true;

          record.skip_reason =
            `auto_reduce_principal=false，本金不变；更新周期日期失败：${noReduceUpdateError.message}`;

          failedCount++;
        } else {
          record.skipped =
            true;

          skippedCount++;
        }

        details.push(
          record
        );

        continue;
      }

      // =================================================
      // 6. 计算本期本金
      // =================================================

      const oldPrincipal =
        Number(
          loan.remaining_amount ||
            0
        );

      const oldPeriods =
        calculateRemainingPeriods(
          loan
        );

      record.old_remaining_periods =
        oldPeriods;

      let newPrincipal:
        number;

      if (
        oldPeriods <= 1
      ) {
        newPrincipal =
          0;
      } else {
        const principalReduction =
          oldPrincipal /
          oldPeriods;

        newPrincipal =
          Math.max(
            0,
            oldPrincipal -
              principalReduction
          );
      }

      // =================================================
      // 保留 2 位小数
      // =================================================

      newPrincipal =
        Number(
          newPrincipal.toFixed(2)
        );

      record.principal_reduction =
        Number(
          (
            oldPrincipal -
            newPrincipal
          ).toFixed(2)
        );

      record.new_remaining_amount =
        newPrincipal;

      // =================================================
      // 7. 条件更新
      //
      // 防止并发重复扣款
      // =================================================

      const {
        error: updateError,
      } =
        await adminSupabase
          .from("loans")
          .update({
            remaining_amount:
              newPrincipal,

            last_auto_payment_date:
              cycleDate,
          })
          .eq(
            "id",
            loan.id
          )
          .or(
            `last_auto_payment_date.is.null,last_auto_payment_date.lt.${cycleDate}`
          );

      if (
        updateError
      ) {
        record.skipped =
          true;

        record.skip_reason =
          `更新失败：${updateError.message}`;

        failedCount++;
      } else {
        updatedCount++;
      }

      details.push(
        record
      );
    }

    // ===================================================
    // cron_logs：success
    // ===================================================

    await adminSupabase
      .from("cron_logs")
      .update({
        status:
          "success",

        finished_at:
          new Date().toISOString(),

        duration_ms:
          Date.now() -
          startedAt,

        message:
          `处理 ${loans.length} 笔贷款：更新 ${updatedCount}，跳过 ${skippedCount}，失败 ${failedCount}`,

        updated_count:
          updatedCount,

        failed_count:
          failedCount,

        skipped_count:
          skippedCount,

        details,
      })
      .eq(
        "id",
        logId
      );

    return NextResponse.json({
      success:
        true,

      updated:
        updatedCount,

      skipped:
        skippedCount,

      failed:
        failedCount,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    console.error(
      "loan-auto-payment error:",
      error
    );

    // ===================================================
    // cron_logs：failed
    // ===================================================

    await adminSupabase
      .from("cron_logs")
      .update({
        status:
          "failed",

        finished_at:
          new Date().toISOString(),

        duration_ms:
          Date.now() -
          startedAt,

        message,

        error:
          message,

        failed_count:
          failedCount,

        skipped_count:
          skippedCount,

        details,
      })
      .eq(
        "id",
        logId
      );

    return NextResponse.json(
      {
        success:
          false,

        error:
          message,
      },
      {
        status:
          500,
      }
    );
  }
}