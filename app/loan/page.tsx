"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getLoans,
  addLoan,
  updateLoan,
  deleteLoan,
} from "@/lib/loan";

// =====================================================
// 类型
// =====================================================

type SortKey =
  | "name"
  | "type"
  | "loan_mode"
  | "remaining_amount"
  | "interest_rate"
  | "interest"
  | "monthly_payment"
  | "housing_fund_monthly"
  | "actual_monthly_payment"
  | "remaining_total"
  | "remaining_periods"
  | "final_payment_date"
  | "financial_freedom";

type SortDirection = "asc" | "desc";

type LoanGroupState = Record<string, boolean>;


// =====================================================
// 输入组件
// =====================================================

function InputBox({
  title,
  tip,
  value,
  setValue,
}: any) {
  return (
    <div className="mb-4">
      <label className="font-medium">
        {title}
      </label>

      <p className="text-xs text-gray-400">
        {tip}
      </p>

      <input
        className="
          border
          p-3
          rounded
          w-full
          mt-1
        "
        type="number"
        value={value ?? ""}
        onChange={(e) =>
          setValue(
            Number(e.target.value)
          )
        }
      />
    </div>
  );
}


// =====================================================
// 金额格式
// =====================================================

function money(value: number) {
  const n = Number(value) || 0;

  if (n >= 100000000) {
    return (
      "¥" +
      (n / 100000000).toFixed(2) +
      "亿"
    );
  }

  if (n >= 10000) {
    return (
      "¥" +
      (n / 10000).toFixed(1) +
      "万"
    );
  }

  return (
    "¥" +
    n.toLocaleString()
  );
}


// =====================================================
// 数字格式
// =====================================================

function numberFormat(value: number) {
  return Number(value || 0).toLocaleString(
    "zh-CN",
    {
      maximumFractionDigits: 2,
    }
  );
}


// =====================================================
// 贷款类型名称
// =====================================================

function loanModeName(mode: string) {
  if (mode === "fixed") {
    return "固定还款";
  }

  if (mode === "revolving") {
    return "循环额度";
  }

  if (mode === "term_revolving") {
    return "期限循环";
  }

  return "-";
}


// =====================================================
// 累计利息
// 保险贷款使用
// =====================================================

function calculateLoanInterest(
  loan: any
) {
  if (
    loan.type !== "保险贷款"
  ) {
    return 0;
  }

  if (!loan.start_date) {
    return 0;
  }

  const start =
    new Date(
      loan.start_date
    );

  const now =
    new Date();

  const days =
    Math.max(
      0,
      Math.floor(
        (
          now.getTime() -
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

  const interest =
    Number(
      loan.remaining_amount || 0
    ) *
    (
      Number(
        loan.interest_rate || 0
      ) / 100
    ) *
    days /
    365;

  return interest;
}


// =====================================================
// 剩余期数
// =====================================================

function calculateRemainingPeriods(
  loan: any
) {
  const now =
    new Date();

  // ---------------------------------------------------
  // 已有最后还款日期
  // ---------------------------------------------------

  if (loan.end_date) {
    const end =
      new Date(
        `${loan.end_date}T23:59:59`
      );

    if (
      end.getTime() <=
      now.getTime()
    ) {
      return 0;
    }

    const yearDiff =
      end.getFullYear() -
      now.getFullYear();

    const monthDiff =
      end.getMonth() -
      now.getMonth();

    const months =
      yearDiff * 12 +
      monthDiff;

    return Math.max(
      0,
      months +
        (
          end.getDate() >=
          now.getDate()
            ? 1
            : 0
        )
    );
  }

  // ---------------------------------------------------
  // 根据本金、利率、月供反推
  // ---------------------------------------------------

  const balance =
    Number(
      loan.remaining_amount || 0
    );

  const payment =
    Number(
      loan.monthly_payment || 0
    );

  if (
    balance <= 0 ||
    payment <= 0
  ) {
    return 0;
  }

  const annualRate =
    Number(
      loan.interest_rate || 0
    );

  const monthlyRate =
    annualRate /
    100 /
    12;

  // 无利息
  if (
    monthlyRate <= 0
  ) {
    return Math.ceil(
      balance /
      payment
    );
  }

  // 月供不足以覆盖利息
  if (
    payment <=
    balance *
    monthlyRate
  ) {
    return 0;
  }

  const periods =
    -Math.log(
      1 -
        (
          balance *
          monthlyRate /
          payment
        )
    ) /
    Math.log(
      1 +
        monthlyRate
    );

  if (
    !Number.isFinite(
      periods
    )
  ) {
    return 0;
  }

  return Math.ceil(
    periods
  );
}


// =====================================================
// 剩余应还
// =====================================================

function calculateRemainingTotal(
  loan: any
) {
  const periods =
    calculateRemainingPeriods(
      loan
    );

  const payment =
    Number(
      loan.monthly_payment || 0
    );

  if (
    loan.loan_mode === "fixed" &&
    payment > 0
  ) {
    return (
      payment *
      periods
    );
  }

  return Number(
    loan.remaining_amount || 0
  );
}


// =====================================================
// 最后还款日期
// =====================================================

function calculateFinalPaymentDate(
  loan: any
) {
  if (loan.end_date) {
    return loan.end_date;
  }

  const periods =
    calculateRemainingPeriods(
      loan
    );

  if (
    periods <= 0
  ) {
    return "-";
  }

  const date =
    new Date();

  date.setMonth(
    date.getMonth() +
      periods
  );

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

  return (
    `${year}-${month}-${day}`
  );
}


// =====================================================
// 公积金月冲
//
// 只有房贷使用
// =====================================================

function getHousingFundMonthly(
  loan: any
) {
  if (
    loan.type !== "房贷"
  ) {
    return 0;
  }

  return Number(
    loan.housing_fund_monthly ||
      0
  );
}


// =====================================================
// 自己实际还贷
//
// 房贷：月供 - 公积金月冲
// 其他：月供
// =====================================================

function getActualMonthlyPayment(
  loan: any
) {
  const monthly =
    Number(
      loan.monthly_payment || 0
    );

  if (
    loan.type !== "房贷"
  ) {
    return monthly;
  }

  const housingFund =
    getHousingFundMonthly(
      loan
    );

  return Math.max(
    0,
    monthly -
      housingFund
  );
}


// =====================================================
// 创建新贷款
// =====================================================

function createEmptyLoan() {
  return {
    name: "",

    type: "房贷",

    loan_mode: "fixed",

    owner: "家庭",

    original_amount: 0,

    remaining_amount: 0,

    credit_limit: 0,

    interest_rate: 0,

    monthly_payment: 0,

    // 新增
    housing_fund_monthly: 0,

    start_date: "",

    end_date: "",

    renewable: false,

    renew_period_months: 6,

    include_financial_freedom:
      false,

    note: "",
  };
}


// =====================================================
// 年度还款计划
// =====================================================

type YearPlan = {
  year: number;

  totalPayment: number;

  housingFund: number;

  actualPayment: number;

  loans: {
    name: string;

    type: string;

    payment: number;

    housingFund: number;

    actualPayment: number;
  }[];
};


// =====================================================
// 计算年度计划
//
// 固定贷款：
// 从当前月份开始，到最后还款月份
//
// 如果没有 end_date：
// 使用剩余期数反推
//
// 对没有月供但有结束日期的贷款：
// 到期时按本金余额计入
// =====================================================

function calculateYearPlans(
  loans: any[]
) {
  const plans =
    new Map<
      number,
      YearPlan
    >();

  const currentDate =
    new Date();

  const currentYear =
    currentDate.getFullYear();

  for (
    const loan of loans
  ) {
    const periods =
      calculateRemainingPeriods(
        loan
      );

    const monthlyPayment =
      Number(
        loan.monthly_payment ||
          0
      );

    const housingFund =
      getHousingFundMonthly(
        loan
      );

    const actualMonthly =
      getActualMonthlyPayment(
        loan
      );

    // -------------------------------------------------
    // 固定月供贷款
    // -------------------------------------------------

    if (
      monthlyPayment > 0 &&
      periods > 0
    ) {
      let date =
        new Date(
          currentDate
        );

      for (
        let i = 0;
        i < periods;
        i++
      ) {
        const year =
          date.getFullYear();

        if (
          !plans.has(year)
        ) {
          plans.set(
            year,
            {
              year,

              totalPayment: 0,

              housingFund: 0,

              actualPayment: 0,

              loans: [],
            }
          );
        }

        const plan =
          plans.get(year)!;

        plan.totalPayment +=
          monthlyPayment;

        plan.housingFund +=
          housingFund;

        plan.actualPayment +=
          actualMonthly;

        let detail =
          plan.loans.find(
            x =>
              x.name ===
              loan.name
          );

        if (!detail) {
          detail = {
            name:
              loan.name,

            type:
              loan.type,

            payment: 0,

            housingFund: 0,

            actualPayment: 0,
          };

          plan.loans.push(
            detail
          );
        }

        detail.payment +=
          monthlyPayment;

        detail.housingFund +=
          housingFund;

        detail.actualPayment +=
          actualMonthly;

        date.setMonth(
          date.getMonth() + 1
        );
      }

      continue;
    }

    // -------------------------------------------------
    // 没有月供但有本金
    //
    // 例如部分循环贷款：
    // 到期时按本金余额计算
    // -------------------------------------------------

    const balance =
      Number(
        loan.remaining_amount ||
          0
      );

    if (
      balance > 0 &&
      loan.end_date
    ) {
      const end =
        new Date(
          `${loan.end_date}T23:59:59`
        );

      const year =
        end.getFullYear();

      if (
        year >= currentYear
      ) {
        if (
          !plans.has(year)
        ) {
          plans.set(
            year,
            {
              year,

              totalPayment: 0,

              housingFund: 0,

              actualPayment: 0,

              loans: [],
            }
          );
        }

        const plan =
          plans.get(year)!;

        plan.totalPayment +=
          balance;

        plan.actualPayment +=
          balance;

        let detail =
          plan.loans.find(
            x =>
              x.name ===
              loan.name
          );

        if (!detail) {
          detail = {
            name:
              loan.name,

            type:
              loan.type,

            payment: 0,

            housingFund: 0,

            actualPayment: 0,
          };

          plan.loans.push(
            detail
          );
        }

        detail.payment +=
          balance;

        detail.actualPayment +=
          balance;
      }
    }
  }

  return Array.from(
    plans.values()
  ).sort(
    (a, b) =>
      a.year - b.year
  );
}


// =====================================================
// 页面
// =====================================================

export default function LoanPage() {

  const [
    loans,
    setLoans,
  ] =
    useState<any[]>([]);

  const [
    editing,
    setEditing,
  ] =
    useState<any>(null);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  // ---------------------------------------------------
  // 折叠状态
  // ---------------------------------------------------

  const [
    detailExpanded,
    setDetailExpanded,
  ] =
    useState(true);

  const [
    typeStatsExpanded,
    setTypeStatsExpanded,
  ] =
    useState(true);

  const [
    yearPlanExpanded,
    setYearPlanExpanded,
  ] =
    useState(true);

  const [
    expandedGroups,
    setExpandedGroups,
  ] =
    useState<LoanGroupState>(
      {}
    );

  // ---------------------------------------------------
  // 排序
  // ---------------------------------------------------

  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      "remaining_amount"
    );

  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      "desc"
    );


  // ===================================================
  // 加载
  // ===================================================

  async function load() {

    const data =
      await getLoans();

    setLoans(
      data || []
    );

    setLoading(false);
  }


  useEffect(() => {
    load();
  }, []);


  // ===================================================
  // 总负债
  // ===================================================

  const totalBalance =
    loans.reduce(
      (
        sum: number,
        item: any
      ) =>
        sum +
        Number(
          item.remaining_amount ||
            0
        ),
      0
    );


  // ===================================================
  // 总月供
  // ===================================================

  const monthlyPayment =
    loans.reduce(
      (
        sum: number,
        item: any
      ) =>
        sum +
        Number(
          item.monthly_payment ||
            0
        ),
      0
    );


  // ===================================================
  // 总公积金月冲
  // ===================================================

  const totalHousingFund =
    loans.reduce(
      (
        sum: number,
        item: any
      ) =>
        sum +
        getHousingFundMonthly(
          item
        ),
      0
    );


  // ===================================================
  // 总自己实际月还贷
  // ===================================================

  const totalActualMonthly =
    loans.reduce(
      (
        sum: number,
        item: any
      ) =>
        sum +
        getActualMonthlyPayment(
          item
        ),
      0
    );


  // ===================================================
  // 类型统计
  // ===================================================

  const typeStats =
    useMemo(() => {

      const map =
        new Map<
          string,
          {
            type: string;

            count: number;

            balance: number;

            monthlyPayment: number;

            housingFund: number;

            actualPayment: number;

            remainingTotal: number;
          }
        >();

      for (
        const loan of loans
      ) {

        const type =
          loan.type ||
          "其他";

        if (
          !map.has(type)
        ) {
          map.set(
            type,
            {
              type,

              count: 0,

              balance: 0,

              monthlyPayment: 0,

              housingFund: 0,

              actualPayment: 0,

              remainingTotal: 0,
            }
          );
        }

        const item =
          map.get(type)!;

        item.count += 1;

        item.balance +=
          Number(
            loan.remaining_amount ||
              0
          );

        item.monthlyPayment +=
          Number(
            loan.monthly_payment ||
              0
          );

        item.housingFund +=
          getHousingFundMonthly(
            loan
          );

        item.actualPayment +=
          getActualMonthlyPayment(
            loan
          );

        item.remainingTotal +=
          calculateRemainingTotal(
            loan
          );
      }

      return Array.from(
        map.values()
      );

    }, [loans]);


  // ===================================================
  // 默认打开所有类型
  // ===================================================

  useEffect(() => {

    const state: LoanGroupState =
      {};

    for (
      const item of typeStats
    ) {
      state[item.type] =
        true;
    }

    setExpandedGroups(
      state
    );

  }, [typeStats.length]);


  // ===================================================
  // 排序
  // ===================================================

  function handleSort(
    key: SortKey
  ) {

    if (
      sortKey === key
    ) {

      setSortDirection(
        prev =>
          prev === "asc"
            ? "desc"
            : "asc"
      );

    } else {

      setSortKey(key);

      setSortDirection(
        "desc"
      );
    }
  }


  function getSortValue(
    loan: any,
    key: SortKey
  ): any {

    switch (key) {

      case "name":
        return (
          loan.name || ""
        );

      case "type":
        return (
          loan.type || ""
        );

      case "loan_mode":
        return (
          loanModeName(
            loan.loan_mode
          )
        );

      case "remaining_amount":
        return Number(
          loan.remaining_amount ||
            0
        );

      case "interest_rate":
        return Number(
          loan.interest_rate ||
            0
        );

      case "interest":
        return calculateLoanInterest(
          loan
        );

      case "monthly_payment":
        return Number(
          loan.monthly_payment ||
            0
        );

      case "housing_fund_monthly":
        return getHousingFundMonthly(
          loan
        );

      case "actual_monthly_payment":
        return getActualMonthlyPayment(
          loan
        );

      case "remaining_total":
        return calculateRemainingTotal(
          loan
        );

      case "remaining_periods":
        return calculateRemainingPeriods(
          loan
        );

      case "final_payment_date":
        return calculateFinalPaymentDate(
          loan
        );

      case "financial_freedom":
        return loan.include_financial_freedom
          ? 1
          : 0;

      default:
        return 0;
    }
  }


  function sortLoans(
    list: any[]
  ) {

    return [
      ...list,
    ].sort(
      (a, b) => {

        const av =
          getSortValue(
            a,
            sortKey
          );

        const bv =
          getSortValue(
            b,
            sortKey
          );

        let result = 0;

        if (
          typeof av ===
          "number" &&
          typeof bv ===
          "number"
        ) {
          result =
            av - bv;
        } else {
          result =
            String(av)
              .localeCompare(
                String(bv),
                "zh-CN"
              );
        }

        return sortDirection ===
          "asc"
          ? result
          : -result;
      }
    );
  }


  // ===================================================
  // 排序箭头
  // ===================================================

  function sortIcon(
    key: SortKey
  ) {

    if (
      sortKey !== key
    ) {
      return (
        <span className="text-gray-300 ml-1">
          ↕
        </span>
      );
    }

    return (
      <span className="text-blue-600 ml-1">
        {
          sortDirection ===
          "asc"
            ? "↑"
            : "↓"
        }
      </span>
    );
  }


  // ===================================================
  // 新增
  // ===================================================

  function createNew() {

    setEditing(
      createEmptyLoan()
    );
  }


  // ===================================================
  // 保存
  // ===================================================

  async function save() {

    if (
      !editing.name
    ) {
      alert(
        "请输入贷款名称"
      );

      return;
    }

    // 房贷之外不保存公积金月冲
    const data = {
      ...editing,

      housing_fund_monthly:
        editing.type ===
        "房贷"
          ? Number(
              editing.housing_fund_monthly ||
                0
            )
          : 0,
    };

    if (
      editing.id
    ) {

      await updateLoan(
        editing.id,
        data
      );

    } else {

      await addLoan(
        data
      );
    }

    setEditing(null);

    load();
  }


  // ===================================================
  // 删除
  // ===================================================

  async function remove(
    id: string
  ) {

    if (
      confirm(
        "确定删除?"
      )
    ) {

      await deleteLoan(
        id
      );

      load();
    }
  }


  // ===================================================
  // 年度计划
  // ===================================================

  const yearPlans =
    useMemo(
      () =>
        calculateYearPlans(
          loans
        ),
      [loans]
    );


  // ===================================================
  // 渲染
  // ===================================================

  return (
    <>
      <TopBar
        title="贷款管理"
      />

      <main
        className="
          p-8
          max-w-[1600px]
          mx-auto
          space-y-8
        "
      >

        {/* ===========================================
            标题
        =========================================== */}

        <div>

          <h1
            className="
              text-3xl
              font-bold
            "
          >
            💳 家庭贷款管理
          </h1>

          <p
            className="
              text-gray-500
              mt-2
            "
          >
            管理房贷、信用卡分期、保险贷款、银行信用贷
          </p>

        </div>


        {/* ===========================================
            汇总卡片
        =========================================== */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-5
            gap-4
          "
        >

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-5
            "
          >
            <div className="text-gray-500">
              当前家庭总负债
            </div>

            <div
              className="
                text-2xl
                font-bold
                mt-2
              "
            >
              {money(
                totalBalance
              )}
            </div>
          </div>


          <div
            className="
              bg-white
              border
              rounded-2xl
              p-5
            "
          >
            <div className="text-gray-500">
              贷款总月供
            </div>

            <div
              className="
                text-2xl
                font-bold
                mt-2
              "
            >
              {money(
                monthlyPayment
              )}
            </div>
          </div>


          <div
            className="
              bg-white
              border
              rounded-2xl
              p-5
            "
          >
            <div className="text-gray-500">
              公积金月冲
            </div>

            <div
              className="
                text-2xl
                font-bold
                mt-2
                text-green-600
              "
            >
              {money(
                totalHousingFund
              )}
            </div>
          </div>


          <div
            className="
              bg-white
              border
              rounded-2xl
              p-5
            "
          >
            <div className="text-gray-500">
              自己实际月还贷
            </div>

            <div
              className="
                text-2xl
                font-bold
                mt-2
                text-blue-600
              "
            >
              {money(
                totalActualMonthly
              )}
            </div>
          </div>


          <div
            className="
              bg-white
              border
              rounded-2xl
              p-5
              cursor-pointer
              hover:bg-gray-50
            "
            onClick={
              createNew
            }
          >
            <div className="text-gray-500">
              新增贷款
            </div>

            <div
              className="
                text-3xl
                font-bold
                text-blue-600
                mt-2
              "
            >
              ＋
            </div>
          </div>

        </section>


        {/* ===========================================
            贷款明细
        =========================================== */}

        <section
          className="
            bg-white
            border
            rounded-2xl
            overflow-hidden
          "
        >

          <button
            className="
              w-full
              px-6
              py-5
              flex
              items-center
              justify-between
              text-left
              hover:bg-gray-50
            "
            onClick={() =>
              setDetailExpanded(
                !detailExpanded
              )
            }
          >

            <div>

              <h2
                className="
                  text-xl
                  font-bold
                "
              >
                📋 贷款明细
              </h2>

              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                共 {loans.length} 笔贷款 · 点击列标题可以排序
              </p>

            </div>

            <span className="text-xl">
              {
                detailExpanded
                  ? "⌃"
                  : "⌄"
              }
            </span>

          </button>


          {detailExpanded && (

            <div
              className="
                border-t
                overflow-x-auto
              "
            >

              {loading ? (

                <div className="p-6">
                  加载中...
                </div>

              ) : loans.length === 0 ? (

                <div
                  className="
                    p-10
                    text-center
                    text-gray-400
                  "
                >
                  暂无贷款
                </div>

              ) : (

                <div>

                  {/* =================================
                      按类型分组
                  ================================= */}

                  {typeStats.map(
                    (
                      stat
                    ) => {

                      const groupLoans =
                        sortLoans(
                          loans.filter(
                            loan =>
                              (
                                loan.type ||
                                "其他"
                              ) ===
                              stat.type
                          )
                        );

                      const expanded =
                        expandedGroups[
                          stat.type
                        ] !== false;

                      return (

                        <div
                          key={
                            stat.type
                          }
                          className="
                            border-b
                            last:border-b-0
                          "
                        >

                          {/* =============================
                              类型标题 + 类型统计
                          ============================= */}

                          <button
                            className="
                              w-full
                              px-6
                              py-4
                              bg-gray-50
                              hover:bg-gray-100
                              text-left
                            "
                            onClick={() =>
                              setExpandedGroups(
                                prev => ({
                                  ...prev,
                                  [stat.type]:
                                    !expanded,
                                })
                              )
                            }
                          >

                            <div
                              className="
                                flex
                                items-center
                                justify-between
                                gap-6
                              "
                            >

                              <div
                                className="
                                  flex
                                  items-center
                                  gap-3
                                  min-w-[180px]
                                "
                              >

                                <span className="text-lg">
                                  {
                                    expanded
                                      ? "⌃"
                                      : "⌄"
                                  }
                                </span>

                                <span
                                  className="
                                    font-bold
                                    text-lg
                                  "
                                >
                                  {stat.type}
                                </span>

                                <span
                                  className="
                                    text-xs
                                    text-gray-400
                                  "
                                >
                                  {stat.count} 笔
                                </span>

                              </div>


                              <div
                                className="
                                  flex
                                  flex-wrap
                                  justify-end
                                  gap-x-8
                                  gap-y-2
                                  text-sm
                                "
                              >

                                <div>
                                  <span className="text-gray-400">
                                    本金余额
                                  </span>

                                  <span className="font-semibold ml-2">
                                    {money(
                                      stat.balance
                                    )}
                                  </span>
                                </div>


                                <div>
                                  <span className="text-gray-400">
                                    月供
                                  </span>

                                  <span className="font-semibold ml-2">
                                    {money(
                                      stat.monthlyPayment
                                    )}
                                  </span>
                                </div>


                                {stat.housingFund >
                                  0 && (

                                  <div>
                                    <span className="text-gray-400">
                                      公积金月冲
                                    </span>

                                    <span
                                      className="
                                        font-semibold
                                        ml-2
                                        text-green-600
                                      "
                                    >
                                      {money(
                                        stat.housingFund
                                      )}
                                    </span>
                                  </div>

                                )}


                                <div>
                                  <span className="text-gray-400">
                                    自己实际还贷
                                  </span>

                                  <span
                                    className="
                                      font-semibold
                                      ml-2
                                      text-blue-600
                                    "
                                  >
                                    {money(
                                      stat.actualPayment
                                    )}
                                  </span>
                                </div>


                                <div>
                                  <span className="text-gray-400">
                                    剩余应还
                                  </span>

                                  <span className="font-semibold ml-2">
                                    {money(
                                      stat.remainingTotal
                                    )}
                                  </span>
                                </div>

                              </div>

                            </div>

                          </button>


                          {/* =============================
                              类型贷款表
                          ============================= */}

                          {expanded && (

                            <div className="overflow-x-auto">

                              <table
                                className="
                                  w-full
                                  text-sm
                                  min-w-[1500px]
                                "
                              >

                                <thead>

                                  <tr
                                    className="
                                      border-b
                                      text-gray-500
                                    "
                                  >

                                    <th
                                      className="
                                        p-3
                                        text-left
                                        cursor-pointer
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "name"
                                        )
                                      }
                                    >
                                      名称
                                      {sortIcon(
                                        "name"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-left
                                        cursor-pointer
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "type"
                                        )
                                      }
                                    >
                                      类型
                                      {sortIcon(
                                        "type"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-left
                                        cursor-pointer
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "loan_mode"
                                        )
                                      }
                                    >
                                      模式
                                      {sortIcon(
                                        "loan_mode"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-right
                                        cursor-pointer
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "remaining_amount"
                                        )
                                      }
                                    >
                                      本金余额
                                      {sortIcon(
                                        "remaining_amount"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-right
                                        cursor-pointer
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "interest_rate"
                                        )
                                      }
                                    >
                                      利率
                                      {sortIcon(
                                        "interest_rate"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-right
                                        cursor-pointer
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "interest"
                                        )
                                      }
                                    >
                                      累计利息
                                      {sortIcon(
                                        "interest"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-right
                                        cursor-pointer
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "monthly_payment"
                                        )
                                      }
                                    >
                                      月供
                                      {sortIcon(
                                        "monthly_payment"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-right
                                        cursor-pointer
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "housing_fund_monthly"
                                        )
                                      }
                                    >
                                      公积金月冲
                                      {sortIcon(
                                        "housing_fund_monthly"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-right
                                        cursor-pointer
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "actual_monthly_payment"
                                        )
                                      }
                                    >
                                      自己实际还贷
                                      {sortIcon(
                                        "actual_monthly_payment"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-right
                                        cursor-pointer
                                        whitespace-nowrap
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "remaining_total"
                                        )
                                      }
                                    >
                                      剩余应还
                                      {sortIcon(
                                        "remaining_total"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-right
                                        cursor-pointer
                                        whitespace-nowrap
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "remaining_periods"
                                        )
                                      }
                                    >
                                      剩余期数
                                      {sortIcon(
                                        "remaining_periods"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-center
                                        cursor-pointer
                                        whitespace-nowrap
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "final_payment_date"
                                        )
                                      }
                                    >
                                      最后还款日期
                                      {sortIcon(
                                        "final_payment_date"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-center
                                        cursor-pointer
                                        whitespace-nowrap
                                      "
                                      onClick={() =>
                                        handleSort(
                                          "financial_freedom"
                                        )
                                      }
                                    >
                                      Financial Freedom
                                      {sortIcon(
                                        "financial_freedom"
                                      )}
                                    </th>


                                    <th
                                      className="
                                        p-3
                                        text-center
                                      "
                                    >
                                      操作
                                    </th>

                                  </tr>

                                </thead>


                                <tbody>

                                  {groupLoans.map(
                                    (
                                      item: any
                                    ) => (

                                      <tr
                                        key={
                                          item.id
                                        }
                                        className="
                                          border-b
                                          last:border-b-0
                                          hover:bg-gray-50
                                        "
                                      >

                                        <td
                                          className="
                                            p-3
                                          "
                                        >
                                          {item.name}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                          "
                                        >
                                          {item.type}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                          "
                                        >
                                          {loanModeName(
                                            item.loan_mode
                                          )}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-right
                                            font-medium
                                          "
                                        >
                                          {money(
                                            item.remaining_amount
                                          )}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-right
                                          "
                                        >
                                          {
                                            item.interest_rate
                                          }
                                          %
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-right
                                          "
                                        >
                                          {item.type ===
                                          "保险贷款"
                                            ? money(
                                                calculateLoanInterest(
                                                  item
                                                )
                                              )
                                            : "-"}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-right
                                          "
                                        >
                                          {money(
                                            item.monthly_payment
                                          )}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-right
                                            text-green-600
                                          "
                                        >
                                          {item.type ===
                                          "房贷"
                                            ? money(
                                                getHousingFundMonthly(
                                                  item
                                                )
                                              )
                                            : "-"}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-right
                                            font-semibold
                                            text-blue-600
                                          "
                                        >
                                          {money(
                                            getActualMonthlyPayment(
                                              item
                                            )
                                          )}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-right
                                            font-medium
                                          "
                                        >
                                          {money(
                                            calculateRemainingTotal(
                                              item
                                            )
                                          )}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-right
                                            font-medium
                                          "
                                        >
                                          {calculateRemainingPeriods(
                                            item
                                          ) > 0
                                            ? `${calculateRemainingPeriods(
                                                item
                                              )} 期`
                                            : "-"}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-center
                                            whitespace-nowrap
                                          "
                                        >
                                          {calculateFinalPaymentDate(
                                            item
                                          )}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-center
                                          "
                                        >
                                          {item.include_financial_freedom
                                            ? "✅"
                                            : "❌"}
                                        </td>


                                        <td
                                          className="
                                            p-3
                                            text-center
                                            whitespace-nowrap
                                          "
                                        >

                                          <button
                                            className="
                                              text-blue-600
                                              mr-4
                                              hover:underline
                                            "
                                            onClick={() =>
                                              setEditing(
                                                {
                                                  ...item,
                                                  housing_fund_monthly:
                                                    Number(
                                                      item.housing_fund_monthly ||
                                                        0
                                                    ),
                                                }
                                              )
                                            }
                                          >
                                            编辑
                                          </button>


                                          <button
                                            className="
                                              text-red-600
                                              hover:underline
                                            "
                                            onClick={() =>
                                              remove(
                                                item.id
                                              )
                                            }
                                          >
                                            删除
                                          </button>

                                        </td>

                                      </tr>

                                    )
                                  )}

                                </tbody>

                              </table>

                            </div>

                          )}

                        </div>

                      );
                    }
                  )}

                </div>

              )}

            </div>

          )}

        </section>


        {/* ===========================================
            按贷款类型统计
        =========================================== */}

        <section
          className="
            bg-white
            border
            rounded-2xl
            overflow-hidden
          "
        >

          <button
            className="
              w-full
              px-6
              py-5
              flex
              items-center
              justify-between
              hover:bg-gray-50
            "
            onClick={() =>
              setTypeStatsExpanded(
                !typeStatsExpanded
              )
            }
          >

            <div className="text-left">

              <h2
                className="
                  text-xl
                  font-bold
                "
              >
                📊 按贷款类型统计
              </h2>

              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                按房贷、信用卡分期、保险贷款、银行信用贷等分类汇总
              </p>

            </div>

            <span className="text-xl">
              {
                typeStatsExpanded
                  ? "⌃"
                  : "⌄"
              }
            </span>

          </button>


          {typeStatsExpanded && (

            <div
              className="
                border-t
                overflow-x-auto
              "
            >

              <table
                className="
                  w-full
                  text-sm
                  min-w-[900px]
                "
              >

                <thead>

                  <tr
                    className="
                      border-b
                      text-gray-500
                    "
                  >

                    <th className="p-4 text-left">
                      贷款类型
                    </th>

                    <th className="p-4 text-right">
                      笔数
                    </th>

                    <th className="p-4 text-right">
                      本金余额
                    </th>

                    <th className="p-4 text-right">
                      月供
                    </th>

                    <th className="p-4 text-right">
                      公积金月冲
                    </th>

                    <th className="p-4 text-right">
                      自己实际还贷
                    </th>

                    <th className="p-4 text-right">
                      剩余应还
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {typeStats.map(
                    stat => (

                      <tr
                        key={
                          stat.type
                        }
                        className="
                          border-b
                          last:border-b-0
                        "
                      >

                        <td className="p-4 font-medium">
                          {stat.type}
                        </td>

                        <td className="p-4 text-right">
                          {stat.count}
                        </td>

                        <td className="p-4 text-right">
                          {money(
                            stat.balance
                          )}
                        </td>

                        <td className="p-4 text-right">
                          {money(
                            stat.monthlyPayment
                          )}
                        </td>

                        <td
                          className="
                            p-4
                            text-right
                            text-green-600
                          "
                        >
                          {money(
                            stat.housingFund
                          )}
                        </td>

                        <td
                          className="
                            p-4
                            text-right
                            font-semibold
                            text-blue-600
                          "
                        >
                          {money(
                            stat.actualPayment
                          )}
                        </td>

                        <td className="p-4 text-right">
                          {money(
                            stat.remainingTotal
                          )}
                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* ===========================================
            每年贷款还款计划
        =========================================== */}

        <section
          className="
            bg-white
            border
            rounded-2xl
            overflow-hidden
          "
        >

          <button
            className="
              w-full
              px-6
              py-5
              flex
              items-center
              justify-between
              hover:bg-gray-50
            "
            onClick={() =>
              setYearPlanExpanded(
                !yearPlanExpanded
              )
            }
          >

            <div className="text-left">

              <h2
                className="
                  text-xl
                  font-bold
                "
              >
                📅 每年贷款还款计划
              </h2>

              <p
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >
                公积金冲抵不计入家庭实际现金支出
              </p>

            </div>

            <span className="text-xl">
              {
                yearPlanExpanded
                  ? "⌃"
                  : "⌄"
              }
            </span>

          </button>


          {yearPlanExpanded && (

            <div
              className="
                border-t
                p-6
                space-y-4
              "
            >

              {yearPlans.length ===
              0 ? (

                <div
                  className="
                    py-8
                    text-center
                    text-gray-400
                  "
                >
                  暂无可计算的还款计划
                </div>

              ) : (

                yearPlans.map(
                  plan => (

                    <div
                      key={
                        plan.year
                      }
                      className="
                        border
                        rounded-xl
                        overflow-hidden
                      "
                    >

                      {/* 年份汇总 */}

                      <div
                        className="
                          bg-gray-50
                          px-5
                          py-4
                        "
                      >

                        <div
                          className="
                            flex
                            flex-wrap
                            items-center
                            justify-between
                            gap-4
                          "
                        >

                          <div
                            className="
                              text-lg
                              font-bold
                            "
                          >
                            {plan.year} 年
                          </div>


                          <div
                            className="
                              flex
                              flex-wrap
                              gap-x-8
                              gap-y-2
                              text-sm
                            "
                          >

                            <div>
                              <span className="text-gray-400">
                                贷款总还款
                              </span>

                              <span
                                className="
                                  ml-2
                                  font-semibold
                                "
                              >
                                {money(
                                  plan.totalPayment
                                )}
                              </span>
                            </div>


                            <div>
                              <span className="text-gray-400">
                                公积金月冲
                              </span>

                              <span
                                className="
                                  ml-2
                                  font-semibold
                                  text-green-600
                                "
                              >
                                {money(
                                  plan.housingFund
                                )}
                              </span>
                            </div>


                            <div>
                              <span className="text-gray-400">
                                自己实际现金还贷
                              </span>

                              <span
                                className="
                                  ml-2
                                  font-bold
                                  text-blue-600
                                "
                              >
                                {money(
                                  plan.actualPayment
                                )}
                              </span>
                            </div>

                          </div>

                        </div>

                      </div>


                      {/* 年度明细 */}

                      <div
                        className="
                          overflow-x-auto
                        "
                      >

                        <table
                          className="
                            w-full
                            text-sm
                            min-w-[700px]
                          "
                        >

                          <thead>

                            <tr
                              className="
                                border-b
                                text-gray-500
                              "
                            >

                              <th className="p-3 text-left">
                                贷款
                              </th>

                              <th className="p-3 text-left">
                                类型
                              </th>

                              <th className="p-3 text-right">
                                贷款还款
                              </th>

                              <th className="p-3 text-right">
                                公积金冲抵
                              </th>

                              <th className="p-3 text-right">
                                自己实际还贷
                              </th>

                            </tr>

                          </thead>


                          <tbody>

                            {plan.loans.map(
                              loan => (

                                <tr
                                  key={
                                    `${plan.year}-${loan.name}`
                                  }
                                  className="
                                    border-b
                                    last:border-b-0
                                  "
                                >

                                  <td className="p-3">
                                    {loan.name}
                                  </td>

                                  <td className="p-3">
                                    {loan.type}
                                  </td>

                                  <td className="p-3 text-right">
                                    {money(
                                      loan.payment
                                    )}
                                  </td>

                                  <td
                                    className="
                                      p-3
                                      text-right
                                      text-green-600
                                    "
                                  >
                                    {money(
                                      loan.housingFund
                                    )}
                                  </td>

                                  <td
                                    className="
                                      p-3
                                      text-right
                                      font-semibold
                                      text-blue-600
                                    "
                                  >
                                    {money(
                                      loan.actualPayment
                                    )}
                                  </td>

                                </tr>

                              )
                            )}

                          </tbody>

                        </table>

                      </div>

                    </div>

                  )
                )

              )}

            </div>

          )}

        </section>

      </main>


      {/* =============================================
          新增 / 编辑窗口
      ============================================= */}

      {editing && (

        <div
          className="
            fixed
            inset-0
            bg-black/30
            flex
            items-center
            justify-center
            z-50
            p-4
          "
        >

          <div
            className="
              bg-white
              rounded-2xl
              p-8
              w-[650px]
              max-w-full
              max-h-[90vh]
              overflow-y-auto
            "
          >

            <h2
              className="
                text-2xl
                font-bold
                mb-6
              "
            >
              {
                editing.id
                  ? "编辑贷款"
                  : "新增贷款"
              }
            </h2>


            {/* =======================================
                名称
            ======================================= */}

            <label>

              <span className="font-medium">
                贷款名称
              </span>

              <p
                className="
                  text-xs
                  text-gray-400
                  mb-1
                "
              >
                例如：上海房贷 / 平安保险贷款 / 招商银行信用贷
              </p>

              <input
                className="
                  border
                  p-3
                  rounded
                  w-full
                  mb-5
                "
                value={
                  editing.name ||
                  ""
                }
                onChange={e =>
                  setEditing({
                    ...editing,
                    name:
                      e.target.value,
                  })
                }
              />

            </label>


            {/* =======================================
                类型
            ======================================= */}

            <label>

              <span className="font-medium">
                贷款类型
              </span>

              <select
                className="
                  border
                  p-3
                  rounded
                  w-full
                  mb-5
                  mt-1
                "
                value={
                  editing.type
                }
                onChange={e => {

                  const type =
                    e.target.value;

                  let mode =
                    "fixed";

                  if (
                    type ===
                    "保险贷款"
                  ) {
                    mode =
                      "term_revolving";
                  }

                  if (
                    type ===
                    "银行信用贷"
                  ) {
                    mode =
                      "revolving";
                  }

                  setEditing({
                    ...editing,

                    type,

                    loan_mode:
                      mode,

                    // 非房贷清零
                    housing_fund_monthly:
                      type ===
                      "房贷"
                        ? Number(
                            editing.housing_fund_monthly ||
                              0
                          )
                        : 0,
                  });

                }}
              >

                <option>
                  房贷
                </option>

                <option>
                  信用卡分期
                </option>

                <option>
                  保险贷款
                </option>

                <option>
                  银行信用贷
                </option>

                <option>
                  其他
                </option>

              </select>

            </label>


            {/* =======================================
                房贷 / 信用卡
            ======================================= */}

            {(
              editing.type ===
                "房贷" ||
              editing.type ===
                "信用卡分期"
            ) && (

              <>

                <h3
                  className="
                    font-bold
                    mb-3
                  "
                >
                  🏠 固定还款贷款
                </h3>


                <InputBox
                  title="初始贷款金额"
                  tip="最开始借的钱，例如3000000"
                  value={
                    editing.original_amount
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        original_amount:
                          v,
                      })
                  }
                />


                <InputBox
                  title="当前本金余额"
                  tip="现在还欠多少钱本金"
                  value={
                    editing.remaining_amount
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        remaining_amount:
                          v,
                      })
                  }
                />


                <InputBox
                  title="年利率 (%)"
                  tip="例如3.1"
                  value={
                    editing.interest_rate
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        interest_rate:
                          v,
                      })
                  }
                />


                <InputBox
                  title="每月还款"
                  tip="例如17000，这是银行实际每月扣款金额"
                  value={
                    editing.monthly_payment
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        monthly_payment:
                          v,
                      })
                  }
                />


                {/* =================================
                    房贷专属
                ================================= */}

                {editing.type ===
                  "房贷" && (

                  <>

                    <InputBox
                      title="公司公积金月冲金额"
                      tip="例如14000，每月由公积金冲抵的房贷金额"
                      value={
                        editing.housing_fund_monthly
                      }
                      setValue={
                        (v: any) =>
                          setEditing({
                            ...editing,
                            housing_fund_monthly:
                              v,
                          })
                      }
                    />


                    <div
                      className="
                        bg-blue-50
                        border
                        border-blue-100
                        rounded-xl
                        p-4
                        mb-5
                      "
                    >

                      <div
                        className="
                          text-sm
                          text-gray-500
                        "
                      >
                        当前预计家庭实际现金还贷
                      </div>

                      <div
                        className="
                          text-2xl
                          font-bold
                          text-blue-600
                          mt-1
                        "
                      >
                        {money(
                          Math.max(
                            0,
                            Number(
                              editing.monthly_payment ||
                                0
                            ) -
                              Number(
                                editing.housing_fund_monthly ||
                                  0
                              )
                          )
                        )}
                        <span
                          className="
                            text-sm
                            font-normal
                            text-gray-400
                            ml-2
                          "
                        >
                          / 月
                        </span>
                      </div>

                      <p
                        className="
                          text-xs
                          text-gray-400
                          mt-2
                        "
                      >
                        月供 − 公积金月冲 = 自己实际还贷
                      </p>

                    </div>

                  </>
                )}

              </>

            )}


            {/* =======================================
                保险贷款
            ======================================= */}

            {editing.type ===
              "保险贷款" && (

              <>

                <h3
                  className="
                    font-bold
                    mb-3
                  "
                >
                  🛡️ 保险贷款
                </h3>


                <InputBox
                  title="当前本金余额"
                  tip="从保单现金价值借出的金额，例如500000"
                  value={
                    editing.remaining_amount
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        remaining_amount:
                          v,
                      })
                  }
                />


                <InputBox
                  title="贷款利率 (%)"
                  tip="例如5"
                  value={
                    editing.interest_rate
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        interest_rate:
                          v,
                      })
                  }
                />


                <InputBox
                  title="期限(月)"
                  tip="例如6个月填写6"
                  value={
                    editing.renew_period_months
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        renew_period_months:
                          v,
                      })
                  }
                />


                <label
                  className="
                    flex
                    gap-2
                    items-center
                    mb-5
                  "
                >

                  <input
                    type="checkbox"
                    checked={
                      !!editing.renewable
                    }
                    onChange={e =>
                      setEditing({
                        ...editing,
                        renewable:
                          e.target.checked,
                      })
                    }
                  />

                  到期可以续贷

                </label>

              </>

            )}


            {/* =======================================
                银行信用贷
            ======================================= */}

            {editing.type ===
              "银行信用贷" && (

              <>

                <h3
                  className="
                    font-bold
                    mb-3
                  "
                >
                  🏦 银行信用贷
                </h3>


                <InputBox
                  title="授信额度"
                  tip="银行批准最大金额，例如1000000"
                  value={
                    editing.credit_limit
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        credit_limit:
                          v,
                      })
                  }
                />


                <InputBox
                  title="当前本金余额"
                  tip="已经借出的本金金额"
                  value={
                    editing.remaining_amount
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        remaining_amount:
                          v,
                      })
                  }
                />


                <InputBox
                  title="年利率 (%)"
                  tip="例如4.5"
                  value={
                    editing.interest_rate
                  }
                  setValue={
                    (v: any) =>
                      setEditing({
                        ...editing,
                        interest_rate:
                          v,
                      })
                  }
                />

              </>

            )}


            {/* =======================================
                时间
            ======================================= */}

            <h3
              className="
                font-bold
                mb-3
              "
            >
              📅 时间
            </h3>


            <label
              className="
                block
                text-sm
                font-medium
                mb-2
              "
            >
              开始日期
            </label>

            <input
              className="
                border
                p-3
                rounded
                w-full
                mb-4
              "
              type="date"
              value={
                editing.start_date ||
                ""
              }
              onChange={e =>
                setEditing({
                  ...editing,
                  start_date:
                    e.target.value,
                })
              }
            />


            <label
              className="
                block
                text-sm
                font-medium
                mb-2
              "
            >
              最后还款日期（可选）
            </label>


            <p
              className="
                text-xs
                text-gray-400
                mb-2
              "
            >
              留空时，固定还款贷款会根据本金余额、利率和月供自动计算。
            </p>


            <input
              className="
                border
                p-3
                rounded
                w-full
                mb-5
              "
              type="date"
              value={
                editing.end_date ||
                ""
              }
              onChange={e =>
                setEditing({
                  ...editing,
                  end_date:
                    e.target.value,
                })
              }
            />


            {/* =======================================
                Financial Freedom
            ======================================= */}

            <label
              className="
                flex
                gap-2
                items-center
                mb-5
              "
            >

              <input
                type="checkbox"
                checked={
                  !!editing.include_financial_freedom
                }
                onChange={e =>
                  setEditing({
                    ...editing,
                    include_financial_freedom:
                      e.target.checked,
                  })
                }
              />

              是否计入 Financial Freedom

            </label>


            {/* =======================================
                备注
            ======================================= */}

            <textarea
              className="
                border
                p-3
                rounded
                w-full
                mb-5
              "
              placeholder="
                备注：
                例如房贷由公积金覆盖
                保险贷款用于资金周转
              "
              value={
                editing.note ||
                ""
              }
              onChange={e =>
                setEditing({
                  ...editing,
                  note:
                    e.target.value,
                })
              }
            />


            {/* =======================================
                按钮
            ======================================= */}

            <div
              className="
                flex
                justify-end
                gap-4
              "
            >

              <button
                className="
                  px-5
                  py-2
                  bg-gray-200
                  rounded
                  hover:bg-gray-300
                "
                onClick={() =>
                  setEditing(null)
                }
              >
                取消
              </button>


              <button
                className="
                  px-5
                  py-2
                  bg-blue-600
                  text-white
                  rounded
                  hover:bg-blue-700
                "
                onClick={
                  save
                }
              >
                保存
              </button>

            </div>

          </div>

        </div>

      )}

    </>
  );
}