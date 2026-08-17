// =====================================================
// lib/credit-card.ts
//
// 信用卡消费 / 资金安排模块
//
// 数据来源：
// 1. credit_cards
// 2. loans
// 3. credit_card_funding
//
// 功能：
// - 信用卡列表
// - 账单日
// - 还款日
// - 是否包含账单日当天
// - 信用卡分期统计
// - 本月预估账单
// - 本月实际账单
// - 信用卡总体资金安排
// - 预估账单资金安排
// - 实际账单资金安排
//
// 注意：
// 1. credit_card_funding 当前不依赖 created_at / updated_at
// 2. “还需要自己拿”全部由页面/函数实时计算，不保存数据库
// 3. monthly_estimate 可以由后续 Excel 消费导入模块自动写入
// =====================================================

import {
  supabase,
} from "@/lib/supabase";


// =====================================================
// 类型
// =====================================================

export interface CreditCard {

  id: string;

  bank_name: string;

  card_name: string;

  billing_day: number;

  payment_day: number | null;

  /**
   * 是否包含账单日当天消费
   *
   * true  :
   * 上一个账单日后一天
   * →
   * 本账单日当天
   *
   * false :
   * 上一个账单日后一天
   * →
   * 本账单日前一天
   */
  include_billing_day: boolean;

  monthly_estimate: number;

  actual_bill_amount: number;

  active?: boolean;

}


export interface CreditCardInstallment {

  id: string;

  name: string;

  institution: string;

  monthly_payment: number;

  remaining_amount: number;

  status: string;

}


export interface CreditCardFunding {

  id: string;

  lp_actual_amount: number;

  my_actual_amount: number;

  lp_estimate_amount: number;

  my_estimate_amount: number;

}


// =====================================================
// 默认 CreditCardFunding
// =====================================================

function emptyCreditCardFunding(): CreditCardFunding {

  return {

    id: "",

    lp_actual_amount: 0,

    my_actual_amount: 0,

    lp_estimate_amount: 0,

    my_estimate_amount: 0,

  };

}


// =====================================================
// 获取信用卡列表
//
// 来源：
// credit_cards
//
// 条件：
// active = true
//
// 排序：
// billing_day ASC
// =====================================================

export async function getCreditCards(): Promise<CreditCard[]> {

  const {
    data,
    error,
  } = await supabase

    .from("credit_cards")

    .select(`
      id,
      bank_name,
      card_name,
      billing_day,
      payment_day,
      include_billing_day,
      monthly_estimate,
      actual_bill_amount,
      active
    `)

    .eq(
      "active",
      true
    )

    .order(
      "billing_day",
      {
        ascending: true,
      }
    );


  if (error) {

    console.error(
      "getCreditCards error:",
      error
    );

    console.error(
      "message:",
      error.message
    );

    console.error(
      "details:",
      error.details
    );

    console.error(
      "hint:",
      error.hint
    );

    console.error(
      "code:",
      error.code
    );

    return [];

  }


  return (

    data || []

  ).map(

    (item: any) => ({

      id:
        item.id,

      bank_name:
        item.bank_name,

      card_name:
        item.card_name,

      billing_day:
        Number(
          item.billing_day || 0
        ),

      payment_day:
        item.payment_day === null ||
        item.payment_day === undefined
          ? null
          : Number(
              item.payment_day
            ),

      include_billing_day:
        item.include_billing_day !== false,

      monthly_estimate:
        Number(
          item.monthly_estimate || 0
        ),

      actual_bill_amount:
        Number(
          item.actual_bill_amount || 0
        ),

      active:
        item.active,

    })

  ) as CreditCard[];

}


// =====================================================
// 更新单张信用卡预估金额
//
// 用途：
// 后续 Excel 导入完成账单周期计算后
// 自动写入 credit_cards.monthly_estimate
//
// 不需要用户手动输入。
// =====================================================

export async function updateCreditCardEstimate(
  cardId: string,
  amount: number
): Promise<boolean> {

  if (!cardId) {

    return false;

  }


  const safeAmount =
    Math.max(
      0,
      Number(
        amount || 0
      )
    );


  const {
    error,
  } = await supabase

    .from("credit_cards")

    .update({

      monthly_estimate:
        safeAmount,

    })

    .eq(
      "id",
      cardId
    );


  if (error) {

    console.error(
      "updateCreditCardEstimate error:",
      error
    );

    console.error(
      "message:",
      error.message
    );

    console.error(
      "details:",
      error.details
    );

    console.error(
      "hint:",
      error.hint
    );

    console.error(
      "code:",
      error.code
    );

    return false;

  }


  return true;

}


// =====================================================
// 批量更新信用卡预估金额
//
// 例如：
//
// [
//   {
//     cardId: "xxx",
//     amount: 5234.56
//   },
//   {
//     cardId: "yyy",
//     amount: 3210
//   }
// ]
//
// 用途：
// Excel 导入后一次性更新所有信用卡。
// =====================================================

export async function updateCreditCardEstimates(
  estimates: {
    cardId: string;
    amount: number;
  }[]
): Promise<boolean> {

  if (
    !estimates ||
    estimates.length === 0
  ) {

    return true;

  }


  for (
    const item
    of estimates
  ) {

    const success =
      await updateCreditCardEstimate(
        item.cardId,
        item.amount
      );


    if (!success) {

      return false;

    }

  }


  return true;

}


// =====================================================
// 获取信用卡分期
//
// 来源：
// loans
//
// 条件：
// type = 信用卡分期
// status = active
// =====================================================

export async function getCreditCardInstallments(): Promise<
  CreditCardInstallment[]
> {

  const {
    data,
    error,
  } = await supabase

    .from("loans")

    .select(`
      id,
      name,
      type,
      institution,
      monthly_payment,
      remaining_amount,
      status
    `)

    .eq(
      "type",
      "信用卡分期"
    )

    .eq(
      "status",
      "active"
    );


  if (error) {

    console.error(
      "getCreditCardInstallments error:",
      error
    );

    console.error(
      "message:",
      error.message
    );

    console.error(
      "details:",
      error.details
    );

    console.error(
      "hint:",
      error.hint
    );

    console.error(
      "code:",
      error.code
    );

    return [];

  }


  console.log(
    "信用卡分期数据:",
    data
  );


  return (

    data || []

  ).map(

    (item: any) => ({

      id:
        item.id,

      name:
        item.name,

      institution:
        item.institution,

      monthly_payment:
        Number(
          item.monthly_payment || 0
        ),

      remaining_amount:
        Number(
          item.remaining_amount || 0
        ),

      status:
        item.status,

    })

  ) as CreditCardInstallment[];

}


// =====================================================
// 获取每个银行信用卡分期金额
//
// 返回：
//
// {
//   平安银行: 401.25,
//   宁波银行: 290.4
// }
// =====================================================

export async function getCreditCardInstallmentSummary(): Promise<
  Record<string, number>
> {

  const {
    data,
    error,
  } = await supabase

    .from("loans")

    .select(`
      institution,
      monthly_payment
    `)

    .eq(
      "type",
      "信用卡分期"
    )

    .eq(
      "status",
      "active"
    );


  if (error) {

    console.error(
      "getCreditCardInstallmentSummary error:",
      error
    );

    console.error(
      "message:",
      error.message
    );

    console.error(
      "details:",
      error.details
    );

    console.error(
      "hint:",
      error.hint
    );

    console.error(
      "code:",
      error.code
    );

    return {};

  }


  const summary:
    Record<string, number> = {};


  (data || []).forEach(

    (item: any) => {

      const bank =
        item.institution;


      if (!bank) {

        return;

      }


      summary[bank] =

        (
          summary[bank] || 0
        )

        +

        Number(
          item.monthly_payment || 0
        );

    }

  );


  console.log(
    "信用卡分期汇总:",
    summary
  );


  return summary;

}


// =====================================================
// 获取信用卡完整数据
//
// 页面直接使用
//
// 返回：
//
// [
//   {
//     id,
//     bank_name,
//     card_name,
//     billing_day,
//     payment_day,
//     include_billing_day,
//     monthly_estimate,
//     actual_bill_amount,
//     installment
//   }
// ]
// =====================================================

export async function getCreditCardOverview() {

  const cards =
    await getCreditCards();


  const installmentSummary =
    await getCreditCardInstallmentSummary();


  return cards.map(

    (card) => ({

      ...card,

      installment:
        Number(
          installmentSummary[
            card.bank_name
          ] || 0
        ),

    })

  );

}


// =====================================================
// 本月信用卡固定还款总额
//
// = 所有信用卡分期月供
// =====================================================

export async function getMonthlyCreditCardInstallmentTotal() {

  const summary =
    await getCreditCardInstallmentSummary();


  return Object

    .values(
      summary
    )

    .reduce(

      (
        sum,
        value
      ) =>

        sum +

        Number(
          value || 0
        ),

      0

    );

}


// =====================================================
// 获取信用卡资金安排
//
// credit_card_funding
//
// 整个信用卡系统只有一套总体资金安排。
//
// 注意：
// 当前表结构不使用：
// created_at
// updated_at
//
// 所以这里绝对不查询这两个字段。
// =====================================================

export async function getCreditCardFunding(): Promise<
  CreditCardFunding
> {

  const {
    data,
    error,
  } = await supabase

    .from("credit_card_funding")

    .select(`
      id,
      lp_actual_amount,
      my_actual_amount,
      lp_estimate_amount,
      my_estimate_amount
    `)

    .limit(1);


  if (error) {

    console.error(
      "getCreditCardFunding error:",
      error
    );

    console.error(
      "message:",
      error.message
    );

    console.error(
      "details:",
      error.details
    );

    console.error(
      "hint:",
      error.hint
    );

    console.error(
      "code:",
      error.code
    );

    return emptyCreditCardFunding();

  }


  if (
    !data ||
    data.length === 0
  ) {

    return emptyCreditCardFunding();

  }


  const item =
    data[0];


  return {

    id:
      item.id,

    lp_actual_amount:
      Number(
        item.lp_actual_amount || 0
      ),

    my_actual_amount:
      Number(
        item.my_actual_amount || 0
      ),

    lp_estimate_amount:
      Number(
        item.lp_estimate_amount || 0
      ),

    my_estimate_amount:
      Number(
        item.my_estimate_amount || 0
      ),

  };

}


// =====================================================
// 保存信用卡资金安排
//
// 设计：
// 只有一条总体记录。
//
// 已存在：
// UPDATE
//
// 不存在：
// INSERT
//
// 不保存：
// “还需要自己拿”
//
// 因为：
// 还需要自己拿 = 账单 - LP - 自己已有
//
// 页面自动保存。
// 不需要“保存资金安排”按钮。
// =====================================================

export async function saveCreditCardFunding(
  funding: {

    lp_actual_amount?: number;

    my_actual_amount?: number;

    lp_estimate_amount?: number;

    my_estimate_amount?: number;

  }
): Promise<CreditCardFunding | null> {

  try {

    // ===============================================
    // 标准化数据
    // ===============================================

    const payload = {

      lp_actual_amount:
        Number(
          funding.lp_actual_amount || 0
        ),

      my_actual_amount:
        Number(
          funding.my_actual_amount || 0
        ),

      lp_estimate_amount:
        Number(
          funding.lp_estimate_amount || 0
        ),

      my_estimate_amount:
        Number(
          funding.my_estimate_amount || 0
        ),

    };


    // ===============================================
    // 查询现有记录
    //
    // 只查询 id
    // 不查询 created_at / updated_at
    // ===============================================

    const {
      data: existingData,
      error: existingError,
    } = await supabase

      .from("credit_card_funding")

      .select(`
        id
      `)

      .limit(1);


    if (existingError) {

      console.error(
        "查询 credit_card_funding 失败:",
        existingError
      );

      console.error(
        "message:",
        existingError.message
      );

      console.error(
        "details:",
        existingError.details
      );

      console.error(
        "hint:",
        existingError.hint
      );

      console.error(
        "code:",
        existingError.code
      );

      return null;

    }


    // ===============================================
    // 已存在 → UPDATE
    // ===============================================

    if (
      existingData &&
      existingData.length > 0
    ) {

      const id =
        existingData[0].id;


      const {
        data,
        error,
      } = await supabase

        .from("credit_card_funding")

        .update(
          payload
        )

        .eq(
          "id",
          id
        )

        .select(`
          id,
          lp_actual_amount,
          my_actual_amount,
          lp_estimate_amount,
          my_estimate_amount
        `)

        .single();


      if (error) {

        console.error(
          "更新 credit_card_funding 失败:",
          error
        );

        console.error(
          "message:",
          error.message
        );

        console.error(
          "details:",
          error.details
        );

        console.error(
          "hint:",
          error.hint
        );

        console.error(
          "code:",
          error.code
        );

        return null;

      }


      return {

        id:
          data.id,

        lp_actual_amount:
          Number(
            data.lp_actual_amount || 0
          ),

        my_actual_amount:
          Number(
            data.my_actual_amount || 0
          ),

        lp_estimate_amount:
          Number(
            data.lp_estimate_amount || 0
          ),

        my_estimate_amount:
          Number(
            data.my_estimate_amount || 0
          ),

      };

    }


    // ===============================================
    // 不存在 → INSERT
    // ===============================================

    const {
      data,
      error,
    } = await supabase

      .from("credit_card_funding")

      .insert(
        payload
      )

      .select(`
        id,
        lp_actual_amount,
        my_actual_amount,
        lp_estimate_amount,
        my_estimate_amount
      `)

      .single();


    if (error) {

      console.error(
        "新增 credit_card_funding 失败:",
        error
      );

      console.error(
        "message:",
        error.message
      );

      console.error(
        "details:",
        error.details
      );

      console.error(
        "hint:",
        error.hint
      );

      console.error(
        "code:",
        error.code
      );

      return null;

    }


    return {

      id:
        data.id,

      lp_actual_amount:
        Number(
          data.lp_actual_amount || 0
        ),

      my_actual_amount:
        Number(
          data.my_actual_amount || 0
        ),

      lp_estimate_amount:
        Number(
          data.lp_estimate_amount || 0
        ),

      my_estimate_amount:
        Number(
          data.my_estimate_amount || 0
        ),

    };


  } catch (error) {

    console.error(
      "saveCreditCardFunding error:",
      error
    );

    return null;

  }

}


// =====================================================
// 删除信用卡资金安排
//
// 当前总体资金安排只有一条记录。
// =====================================================

export async function deleteCreditCardFunding(
  id: string
): Promise<boolean> {

  if (!id) {

    return false;

  }


  const {
    error,
  } = await supabase

    .from("credit_card_funding")

    .delete()

    .eq(
      "id",
      id
    );


  if (error) {

    console.error(
      "deleteCreditCardFunding error:",
      error
    );

    console.error(
      "message:",
      error.message
    );

    console.error(
      "details:",
      error.details
    );

    console.error(
      "hint:",
      error.hint
    );

    console.error(
      "code:",
      error.code
    );

    return false;

  }


  return true;

}


// =====================================================
// 获取信用卡总预估账单
//
// 所有信用卡 monthly_estimate 合计
// =====================================================

export async function getCreditCardEstimateTotal() {

  const cards =
    await getCreditCards();


  return cards.reduce(

    (
      sum,
      card
    ) =>

      sum +

      Number(
        card.monthly_estimate || 0
      ),

    0

  );

}


// =====================================================
// 获取信用卡总实际账单
//
// 所有信用卡 actual_bill_amount 合计
// =====================================================

export async function getCreditCardActualBillTotal() {

  const cards =
    await getCreditCards();


  return cards.reduce(

    (
      sum,
      card
    ) =>

      sum +

      Number(
        card.actual_bill_amount || 0
      ),

    0

  );

}


// =====================================================
// 获取信用卡资金安排汇总
//
// 返回：
//
// {
//   funding,
//
//   estimate_bill_total,
//   estimate_funding_total,
//   estimate_need_myself,
//
//   actual_bill_total,
//   actual_funding_total,
//   actual_need_myself
// }
//
// 计算：
//
// 预估还需要自己拿
// = 预估账单
// - 预估LP
// - 预估自己已有
//
// 实际还需要自己拿
// = 实际账单
// - 实际LP
// - 实际自己已有
//
// 最低显示 0
// =====================================================

export async function getCreditCardFundingSummary() {

  const cards =
    await getCreditCards();


  const funding =
    await getCreditCardFunding();


  // ===============================================
  // 总预估账单
  // ===============================================

  const estimateBillTotal =
    cards.reduce(

      (
        sum,
        card
      ) =>

        sum +

        Number(
          card.monthly_estimate || 0
        ),

      0

    );


  // ===============================================
  // 总实际账单
  // ===============================================

  const actualBillTotal =
    cards.reduce(

      (
        sum,
        card
      ) =>

        sum +

        Number(
          card.actual_bill_amount || 0
        ),

      0

    );


  // ===============================================
  // 预估资金
  // ===============================================

  const estimateFundingTotal =

    Number(
      funding.lp_estimate_amount || 0
    )

    +

    Number(
      funding.my_estimate_amount || 0
    );


  // ===============================================
  // 实际资金
  // ===============================================

  const actualFundingTotal =

    Number(
      funding.lp_actual_amount || 0
    )

    +

    Number(
      funding.my_actual_amount || 0
    );


  // ===============================================
  // 预估还需要自己拿
  // ===============================================

  const estimateNeedMyself =

    Math.max(

      0,

      estimateBillTotal -
      estimateFundingTotal

    );


  // ===============================================
  // 实际还需要自己拿
  // ===============================================

  const actualNeedMyself =

    Math.max(

      0,

      actualBillTotal -
      actualFundingTotal

    );


  return {

    funding,

    estimate_bill_total:
      estimateBillTotal,

    estimate_funding_total:
      estimateFundingTotal,

    estimate_need_myself:
      estimateNeedMyself,

    actual_bill_total:
      actualBillTotal,

    actual_funding_total:
      actualFundingTotal,

    actual_need_myself:
      actualNeedMyself,

  };

}


// =====================================================
// 根据账单日判断当前账单周期
//
// 说明：
//
// 如果今天是 8月16日
// billing_day = 10
//
// 当前账单周期：
// 7月11日 → 8月10日
//
// 如果 include_billing_day = true：
// 7月11日 ≤ 消费日期 ≤ 8月10日
//
// 如果 false：
// 7月11日 ≤ 消费日期 < 8月10日
//
// 注意：
// 这里只负责计算日期范围。
// 真正的消费数据来自后续消费流水表。
// =====================================================

export function getCreditCardBillingPeriod(
  billingDay: number,
  includeBillingDay: boolean = true,
  referenceDate: Date = new Date()
): {
  startDate: Date;
  endDate: Date;
} {

  const safeBillingDay =
    Math.max(
      1,
      Math.min(
        31,
        Number(
          billingDay || 1
        )
      )
    );


  const year =
    referenceDate.getFullYear();


  const month =
    referenceDate.getMonth();


  const currentDay =
    referenceDate.getDate();


  let endYear =
    year;

  let endMonth =
    month;


  // ===============================================
  // 本月账单日已经到达
  // ===============================================

  if (
    currentDay >=
    safeBillingDay
  ) {

    endYear =
      year;

    endMonth =
      month;

  }

  // ===============================================
  // 本月账单日还没有到
  //
  // 当前账单周期的结束日
  // 是上个月账单日
  // ===============================================

  else {

    endYear =
      month === 0
        ? year - 1
        : year;

    endMonth =
      month === 0
        ? 11
        : month - 1;

  }


  // ===============================================
  // 计算实际结束日期
  //
  // 避免：
  // 2月31日
  // 4月31日
  // ===============================================

  const daysInEndMonth =
    new Date(
      endYear,
      endMonth + 1,
      0
    ).getDate();


  const actualBillingDay =
    Math.min(
      safeBillingDay,
      daysInEndMonth
    );


  const endDate =
    new Date(
      endYear,
      endMonth,
      actualBillingDay
    );


  // ===============================================
  // 上一个账单日
  // ===============================================

  let previousYear =
    endYear;

  let previousMonth =
    endMonth - 1;


  if (
    previousMonth < 0
  ) {

    previousMonth =
      11;

    previousYear -= 1;

  }


  const daysInPreviousMonth =
    new Date(
      previousYear,
      previousMonth + 1,
      0
    ).getDate();


  const actualPreviousBillingDay =
    Math.min(
      safeBillingDay,
      daysInPreviousMonth
    );


  const previousBillingDate =
    new Date(
      previousYear,
      previousMonth,
      actualPreviousBillingDay
    );


  // ===============================================
  // 上一个账单日后一天
  // ===============================================

  const startDate =
    new Date(
      previousBillingDate
    );


  startDate.setDate(
    startDate.getDate() + 1
  );


  // ===============================================
  // 如果不包含账单日
  //
  // 日期范围的 endDate
  // 本身仍然保留账单日
  //
  // 后续过滤消费时使用：
  //
  // include = true
  // date <= endDate
  //
  // include = false
  // date < endDate
  // ===============================================

  return {

    startDate,

    endDate,

  };

}


// =====================================================
// 判断某个消费日期是否属于信用卡当前账单周期
//
// 用法：
//
// const inPeriod =
//   isDateInCreditCardBillingPeriod(
//     transactionDate,
//     card.billing_day,
//     card.include_billing_day
//   );
//
// =====================================================

export function isDateInCreditCardBillingPeriod(
  transactionDate: Date,
  billingDay: number,
  includeBillingDay: boolean = true,
  referenceDate: Date = new Date()
): boolean {

  const {
    startDate,
    endDate,
  } =
    getCreditCardBillingPeriod(
      billingDay,
      includeBillingDay,
      referenceDate
    );


  const transaction =
    new Date(
      transactionDate
    );


  // ===============================================
  // 清除时间
  // ===============================================

  transaction.setHours(
    0,
    0,
    0,
    0
  );


  startDate.setHours(
    0,
    0,
    0,
    0
  );


  endDate.setHours(
    0,
    0,
    0,
    0
  );


  // ===============================================
  // 开始日期：
  // 永远包含
  //
  // 上一个账单日后一天
  // ===============================================

  if (
    transaction <
    startDate
  ) {

    return false;

  }


  // ===============================================
  // 是否包含本账单日
  // ===============================================

  if (
    includeBillingDay
  ) {

    return (
      transaction <=
      endDate
    );

  }


  return (
    transaction <
    endDate
  );

}


// =====================================================
// 格式化账单周期
//
// 用于页面显示
//
// 例如：
// 2026-07-11 → 2026-08-10
// =====================================================

export function formatCreditCardBillingPeriod(
  billingDay: number,
  includeBillingDay: boolean = true,
  referenceDate: Date = new Date()
): string {

  const {
    startDate,
    endDate,
  } =
    getCreditCardBillingPeriod(
      billingDay,
      includeBillingDay,
      referenceDate
    );


  const formatDate =
    (date: Date) => {

      const year =
        date.getFullYear();

      const month =
        String(
          date.getMonth() + 1
        ).padStart(
          2,
          "0"
        );

      const day =
        String(
          date.getDate()
        ).padStart(
          2,
          "0"
        );


      return `${year}-${month}-${day}`;

    };


  return (

    `${formatDate(startDate)} → ` +
    `${formatDate(endDate)}`

  );

}


// =====================================================
// 自动保存信用卡资金安排
//
// 这是一个给页面调用的简化函数。
//
// 页面输入：
// LP / 自己已有
//
// 函数自动保存。
// =====================================================

export async function autoSaveCreditCardFunding(
  funding: {

    lp_actual_amount?: number;

    my_actual_amount?: number;

    lp_estimate_amount?: number;

    my_estimate_amount?: number;

  }
): Promise<boolean> {

  const result =
    await saveCreditCardFunding(
      funding
    );


  return result !== null;

}


// =====================================================
// 获取当前信用卡总月供
//
// = 信用卡分期月供
//
// 这个函数保留，避免现有页面调用报错。
// =====================================================

export async function getCreditCardMonthlyPaymentTotal() {

  return getMonthlyCreditCardInstallmentTotal();

}


// =====================================================
// 获取信用卡全部核心汇总
//
// 给 Dashboard / 家庭现金流页面使用
// =====================================================

export async function getCreditCardSummary() {

  const cards =
    await getCreditCards();


  const funding =
    await getCreditCardFunding();


  const installmentTotal =
    await getMonthlyCreditCardInstallmentTotal();


  const estimateBillTotal =
    cards.reduce(

      (
        sum,
        card
      ) =>

        sum +

        Number(
          card.monthly_estimate || 0
        ),

      0

    );


  const actualBillTotal =
    cards.reduce(

      (
        sum,
        card
      ) =>

        sum +

        Number(
          card.actual_bill_amount || 0
        ),

      0

    );


  const estimateFundingTotal =

    Number(
      funding.lp_estimate_amount || 0
    )

    +

    Number(
      funding.my_estimate_amount || 0
    );


  const actualFundingTotal =

    Number(
      funding.lp_actual_amount || 0
    )

    +

    Number(
      funding.my_actual_amount || 0
    );


  return {

    card_count:
      cards.length,

    estimate_bill_total:
      estimateBillTotal,

    actual_bill_total:
      actualBillTotal,

    installment_total:
      installmentTotal,

    estimate_funding_total:
      estimateFundingTotal,

    actual_funding_total:
      actualFundingTotal,

    estimate_need_myself:
      Math.max(
        0,
        estimateBillTotal -
        estimateFundingTotal
      ),

    actual_need_myself:
      Math.max(
        0,
        actualBillTotal -
        actualFundingTotal
      ),

  };

}