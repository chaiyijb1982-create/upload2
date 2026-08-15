// lib/loan.ts

import { supabase } from "@/lib/supabase";


// =====================================================
// 获取全部贷款
// =====================================================

export async function getLoans() {

  const {
    data,
    error,
  } = await supabase
    .from("loans")
    .select(`
      *,
      financial_institution:financial_institutions (
        id,
        name,
        type
      )
    `)
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {

    console.error(
      "获取贷款失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    return [];
  }

  return data || [];
}


// =====================================================
// 获取全部金融机构
// =====================================================

export async function getFinancialInstitutions() {

  const {
    data,
    error,
  } = await supabase
    .from("financial_institutions")
    .select("*")
    .order(
      "type",
      {
        ascending: true,
      }
    )
    .order(
      "name",
      {
        ascending: true,
      }
    );

  if (error) {

    console.error(
      "获取金融机构失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    return [];
  }

  return data || [];
}


// =====================================================
// 新增金融机构
// =====================================================

export async function addFinancialInstitution(
  name: string,
  type: "银行" | "保险"
) {

  const cleanName =
    String(name || "").trim();

  if (!cleanName) {
    throw new Error(
      "请输入金融机构名称"
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("financial_institutions")
    .insert({
      name: cleanName,
      type,
    })
    .select()
    .single();

  if (error) {

    console.error(
      "新增金融机构失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;
  }

  return data;
}


// =====================================================
// 修改金融机构
// =====================================================

export async function updateFinancialInstitution(
  id: string,
  name: string,
  type: "银行" | "保险"
) {

  const cleanName =
    String(name || "").trim();

  if (!cleanName) {
    throw new Error(
      "请输入金融机构名称"
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("financial_institutions")
    .update({
      name: cleanName,
      type,
      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      id
    )
    .select()
    .single();

  if (error) {

    console.error(
      "修改金融机构失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;
  }

  return data;
}



// =====================================================
// 删除金融机构
//
// 规则：
// 1. 如果还有贷款关联 → 禁止删除
// 2. 没有关联贷款 → 允许删除
// =====================================================

export async function deleteFinancialInstitution(
  id: string
) {

  // ---------------------------------------------------
  // 先检查是否还有贷款使用这个金融机构
  // ---------------------------------------------------

  const {
    data: loans,
    error: loanError,
  } = await supabase
    .from("loans")
    .select("id, name")
    .eq(
      "financial_institution_id",
      id
    );

  if (loanError) {

    console.error(
      "检查金融机构关联贷款失败:",
      JSON.stringify(
        loanError,
        null,
        2
      )
    );

    throw loanError;
  }


  // ---------------------------------------------------
  // 如果还有关联贷款，不允许删除
  // ---------------------------------------------------

  if (
    loans &&
    loans.length > 0
  ) {

    throw new Error(
      `该金融机构还有 ${loans.length} 笔贷款正在使用，不能删除。请先修改或删除相关贷款。`
    );

  }


  // ---------------------------------------------------
  // 没有关联贷款 → 真正删除
  // ---------------------------------------------------

  const {
    error,
  } = await supabase
    .from("financial_institutions")
    .delete()
    .eq(
      "id",
      id
    );

  if (error) {

    console.error(
      "删除金融机构失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;
  }

  return true;
}


// =====================================================
// 新增贷款
// =====================================================

export async function addLoan(
  loan: any
) {

  const {
    data,
    error,
  } = await supabase
    .from("loans")
    .insert({

      name:
        loan.name || "",

      institution:
        loan.institution || "",

      type:
        loan.type || "其他",

      loan_mode:
        loan.loan_mode || "fixed",

      owner:
        loan.owner || "家庭",

      original_amount:
        Number(
          loan.original_amount || 0
        ),

      remaining_amount:
        Number(
          loan.remaining_amount || 0
        ),

      credit_limit:
        Number(
          loan.credit_limit || 0
        ),

      interest_rate:
        Number(
          loan.interest_rate || 0
        ),

      monthly_payment:
        Number(
          loan.monthly_payment || 0
        ),

      housing_fund_monthly:
        loan.type === "房贷"
          ? Number(
              loan.housing_fund_monthly || 0
            )
          : 0,

      financial_institution_id:
        loan.financial_institution_id ||
        null,

      start_date:
        loan.start_date || null,

      end_date:
        loan.end_date || null,

      renewable:
        Boolean(
          loan.renewable
        ),

      renew_period_months:
        Number(
          loan.renew_period_months || 0
        ),

      include_financial_freedom:
        Boolean(
          loan.include_financial_freedom
        ),

      note:
        loan.note || "",

      created_at:
        new Date().toISOString(),

      updated_at:
        new Date().toISOString(),

    })
    .select(`
      *,
      financial_institution:financial_institutions (
        id,
        name,
        type
      )
    `);

  if (error) {

    console.error(
      "新增贷款失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;
  }

  return data?.[0];
}


// =====================================================
// 修改贷款
// =====================================================

export async function updateLoan(
  id: string,
  loan: any
) {

  const updateData = {

    name:
      loan.name || "",

    institution:
    loan.institution || "",

    type:
      loan.type || "其他",

    loan_mode:
      loan.loan_mode || "fixed",

    owner:
      loan.owner || "家庭",

    original_amount:
      Number(
        loan.original_amount || 0
      ),

    remaining_amount:
      Number(
        loan.remaining_amount || 0
      ),

    credit_limit:
      Number(
        loan.credit_limit || 0
      ),

    interest_rate:
      Number(
        loan.interest_rate || 0
      ),

    monthly_payment:
      Number(
        loan.monthly_payment || 0
      ),

    housing_fund_monthly:
      loan.type === "房贷"
        ? Number(
            loan.housing_fund_monthly || 0
          )
        : 0,

    financial_institution_id:
      loan.financial_institution_id ||
      null,

    start_date:
      loan.start_date || null,

    end_date:
      loan.end_date || null,

    renewable:
      Boolean(
        loan.renewable
      ),

    renew_period_months:
      Number(
        loan.renew_period_months || 0
      ),

    include_financial_freedom:
      Boolean(
        loan.include_financial_freedom
      ),

    note:
      loan.note || "",

    updated_at:
      new Date().toISOString(),

  };


  const {
    data,
    error,
  } = await supabase
    .from("loans")
    .update(
      updateData
    )
    .eq(
      "id",
      id
    )
    .select(`
      *,
      financial_institution:financial_institutions (
        id,
        name,
        type
      )
    `);

  if (error) {

    console.error(
      "修改贷款失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;
  }

  return data?.[0];
}


// =====================================================
// 删除贷款
// =====================================================

export async function deleteLoan(
  id: string
) {

  const {
    error,
  } = await supabase
    .from("loans")
    .delete()
    .eq(
      "id",
      id
    );

  if (error) {

    console.error(
      "删除贷款失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );

    throw error;
  }

  return true;
}


// =====================================================
// 当前家庭总负债
// =====================================================

export async function getTotalLoanBalance() {

  const loans =
    await getLoans();

  return loans.reduce(
    (
      sum: number,
      loan: any
    ) =>
      sum +
      Number(
        loan.remaining_amount || 0
      ),
    0
  );
}


// =====================================================
// Financial Freedom 专用
// =====================================================

export async function getFinancialFreedomLoans() {

  const loans =
    await getLoans();

  return loans.filter(
    (loan: any) =>
      loan.include_financial_freedom === true
  );
}


// =====================================================
// Financial Freedom 年度贷款支出
// =====================================================

export async function getFinancialFreedomLoanPayment(
  year: number
) {

  const loans =
    await getFinancialFreedomLoans();

  let total = 0;

  loans.forEach(
    (loan: any) => {

      const startYear =
        loan.start_date
          ? new Date(
              loan.start_date
            ).getFullYear()
          : 0;

      const endYear =
        loan.end_date
          ? new Date(
              loan.end_date
            ).getFullYear()
          : 9999;

      if (
        year < startYear ||
        year > endYear
      ) {
        return;
      }

      if (
        loan.loan_mode === "fixed"
      ) {

        total +=
          Number(
            loan.monthly_payment || 0
          ) *
          12;

      }

    }
  );

  return total;
}


// =====================================================
// 计算保险贷款累计利息
// =====================================================

export function calculateInsuranceLoanInterest(
  loan: any
) {

  if (
    loan.type !== "保险贷款"
  ) {
    return 0;
  }

  if (
    !loan.start_date
  ) {
    return 0;
  }

  const start =
    new Date(
      loan.start_date
    );

  const today =
    new Date();

  const days =
    Math.max(
      0,
      Math.floor(
        (
          today.getTime() -
          start.getTime()
        ) /
        (
          1000 *
          60 *
          60 *
          24
        )
      )
    );

  return (
    Number(
      loan.remaining_amount || 0
    ) *
    (
      Number(
        loan.interest_rate || 0
      ) /
      100
    ) *
    days /
    365
  );
}


// =====================================================
// 计算保险贷款当前应还
// =====================================================

export function calculateInsuranceLoanPayable(
  loan: any
) {

  return (
    Number(
      loan.remaining_amount || 0
    ) +
    calculateInsuranceLoanInterest(
      loan
    )
  );
}


// =====================================================
// 某一年保险贷款利息
// =====================================================

export async function getAnnualInsuranceLoanInterest(
  year: number
) {

  const loans =
    await getLoans();

  let total = 0;

  loans.forEach(
    (loan: any) => {

      if (
        loan.type !== "保险贷款"
      ) {
        return;
      }

      if (
        !loan.include_financial_freedom
      ) {
        return;
      }

      const start =
        loan.start_date
          ? new Date(
              loan.start_date
            )
          : null;

      if (!start) {
        return;
      }

      const startYear =
        start.getFullYear();

      if (
        year < startYear
      ) {
        return;
      }

      let endDate =
        new Date(
          year,
          11,
          31
        );

      if (
        year ===
        new Date().getFullYear()
      ) {
        endDate =
          new Date();
      }

      const days =
        Math.floor(
          (
            endDate.getTime() -
            start.getTime()
          ) /
          (
            1000 *
            60 *
            60 *
            24
          )
        );

      const interest =
        Number(
          loan.remaining_amount || 0
        ) *
        (
          Number(
            loan.interest_rate || 0
          ) /
          100
        ) *
        days /
        365;

      total +=
        interest;

    }
  );

  return total;
}


// =====================================================
// 天天向上年度贷款压力
// =====================================================

export async function getAnnualLoanPressure(
  year: number
) {

  const loans =
    await getLoans();

  let total = 0;

  loans.forEach(
    (loan: any) => {

      const startYear =
        loan.start_date
          ? new Date(
              loan.start_date
            ).getFullYear()
          : 0;

      const endYear =
        loan.end_date
          ? new Date(
              loan.end_date
            ).getFullYear()
          : 9999;

      if (
        year < startYear ||
        year > endYear
      ) {
        return;
      }

      if (
        loan.include_financial_freedom !== true
      ) {
        return;
      }

      if (
        loan.loan_mode === "fixed"
      ) {

        total +=
          Number(
            loan.monthly_payment || 0
          ) *
          12;

      }

      if (
        loan.type === "保险贷款"
      ) {

        total +=
          calculateInsuranceLoanInterest(
            loan
          );

      }

    }
  );

  return total;
}


// =====================================================
// 循环贷款列表
// =====================================================

export async function getRevolvingLoans() {

  const loans =
    await getLoans();

  return loans.filter(
    (loan: any) =>
      loan.loan_mode === "revolving" ||
      loan.loan_mode === "term_revolving"
  );
}


// =====================================================
// 贷款到期提醒
// =====================================================

export async function getLoanExpiryReminder() {

  const loans =
    await getLoans();

  const today =
    new Date();

  const result: any[] = [];

  loans.forEach(
    (loan: any) => {

      if (!loan.end_date) {
        return;
      }

      const end =
        new Date(
          loan.end_date
        );

      const days =
        (
          end.getTime() -
          today.getTime()
        ) /
        (
          1000 *
          60 *
          60 *
          24
        );

      if (
        days <= 90 &&
        days >= 0
      ) {

        result.push({
          ...loan,
          daysLeft:
            Math.ceil(days),
        });

      }

    }
  );

  return result;
}


// =====================================================
// 按贷款类型统计
// =====================================================

export async function getLoanSummaryByType() {

  const loans =
    await getLoans();

  const result: any = {};

  loans.forEach(
    (loan: any) => {

      const type =
        loan.type || "其他";

      if (
        !result[type]
      ) {
        result[type] = 0;
      }

      result[type] +=
        Number(
          loan.remaining_amount || 0
        );

    }
  );

  return result;
}


// =====================================================
// 获取贷款现金流摘要
// =====================================================

export async function getLoanCashflowSummary(
  year: number
) {

  const fixed =
    await getFinancialFreedomLoanPayment(
      year
    );

  const insuranceInterest =
    await getAnnualInsuranceLoanInterest(
      year
    );

  return {

    fixed_payment:
      fixed,

    insurance_interest:
      insuranceInterest,

    total:
      fixed +
      insuranceInterest,

  };
}


// =====================================================
// Financial Freedom 某一年剩余贷款余额
// =====================================================

export async function getFinancialFreedomLoanBalance(
  year: number
) {

  const loans =
    await getFinancialFreedomLoans();

  let totalBalance = 0;

  const currentYear =
    new Date().getFullYear();

  loans.forEach(
    (loan: any) => {

      const currentBalance =
        Number(
          loan.remaining_amount || 0
        );

      if (
        !Number.isFinite(
          currentBalance
        ) ||
        currentBalance <= 0
      ) {
        return;
      }

      if (
        loan.type === "保险贷款"
      ) {

        totalBalance +=
          currentBalance;

        return;
      }

      const startYear =
        loan.start_date
          ? new Date(
              loan.start_date
            ).getFullYear()
          : currentYear;

      const endYear =
        loan.end_date
          ? new Date(
              loan.end_date
            ).getFullYear()
          : 9999;

      if (
        year < currentYear ||
        year > endYear ||
        year < startYear
      ) {
        return;
      }

      if (
        loan.loan_mode === "fixed"
      ) {

        const monthlyPayment =
          Number(
            loan.monthly_payment || 0
          );

        if (
          monthlyPayment <= 0
        ) {

          totalBalance +=
            currentBalance;

          return;
        }

        const yearsForward =
          Math.max(
            0,
            year - currentYear
          );

        const estimatedBalance =
          Math.max(
            0,
            currentBalance -
            monthlyPayment *
            12 *
            yearsForward
          );

        totalBalance +=
          estimatedBalance;

        return;
      }

      totalBalance +=
        currentBalance;

    }
  );

  return totalBalance;
}