"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getDashboardTotalWealth,
  getFixedIncomeTotal,
} from "@/lib/asset";

import {
  getInsuranceSummary,
  getInsuranceYearProjection,
} from "@/lib/insurance";

import {
  getAnnualLoanPressure,
  getFinancialFreedomLoanPayment,
  getFinancialFreedomLoans,
} from "@/lib/loan";


// =====================================================
// 参数
// =====================================================

const START_YEAR = 2027;

// ★★★ 现在统一计算到 2041 ★★★
const END_YEAR = 2041;

const FREEDOM_END_YEAR = 2041;


// =====================================================
// 年收入
// =====================================================

const ANNUAL_INCOME = 1100000;


// =====================================================
// 投资收益率
// =====================================================

const RETURN_RATE = 0.05;


// =====================================================
// 生活费用
// =====================================================
//
// 2027 - 2031：37万 / 年
// 2032 - 2041：32万 / 年
//
// ★ 财务自由目标只计算到 2041
// =====================================================

const BASE_EXPENSE: Record<
  number,
  number
> = {

  2027: 370000,
  2028: 370000,
  2029: 370000,
  2030: 370000,
  2031: 370000,

  2032: 320000,
  2033: 320000,
  2034: 320000,
  2035: 320000,
  2036: 320000,
  2037: 320000,
  2038: 320000,
  2039: 320000,
  2040: 320000,
  2041: 320000,

};


// =====================================================
// 年金缴费
// =====================================================

const ANNUITY: Record<
  number,
  number
> = {

  2027: 724000,

  2028: 614000,
  2029: 614000,
  2030: 614000,
  2031: 614000,
  2032: 614000,

  2033: 351000,

  2034: 259000,
  2035: 259000,
  2036: 259000,
  2037: 259000,

  2038: 129000,

  2039: 39000,
  2040: 39000,
  2041: 39000,

};


// =====================================================
// 数字
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


// =====================================================
// 金额
// =====================================================

function money(
  value: number
) {

  const n =
    toNumber(value);


  if (
    Math.abs(n) >= 100000000
  ) {

    return (
      "¥" +
      (
        n / 100000000
      ).toFixed(2) +
      " 亿"
    );

  }


  if (
    Math.abs(n) >= 10000
  ) {

    return (
      "¥" +
      (
        n / 10000
      ).toFixed(1) +
      " 万"
    );

  }


  return (
    "¥" +
    Math.round(
      n
    ).toLocaleString(
      "zh-CN"
    )
  );

}


// =====================================================
// 百分比
// =====================================================

function percent(
  value: number
) {

  return (
    toNumber(value)
      .toFixed(1) +
    "%"
  );

}


// =====================================================
// 财务自由目标
// =====================================================
//
// 例如：
//
// 2027 = 2027～2041 所有生活费
// 2028 = 2028～2041 所有生活费
// ...
// 2041 = 2041 年生活费
//
// ★ 不包含 2042
// =====================================================

function getFinancialFreedomTarget(
  startYear: number
) {

  let total = 0;


  for (
    let year = startYear;
    year <= FREEDOM_END_YEAR;
    year++
  ) {

    total +=
      Number(
        BASE_EXPENSE[
          year
        ] || 0
      );

  }


  return total;

}


// =====================================================
// 页面
// =====================================================

export default function TiantianUpDetailPage() {


  // ===================================================
  // Dashboard Total Wealth
  // ===================================================

  const [
    dashboardTotalWealth,
    setDashboardTotalWealth,
  ] = useState(0);


  // ===================================================
  // 当前固收
  // ===================================================

  const [
    fixedIncome,
    setFixedIncome,
  ] = useState(0);


  // ===================================================
  // Financial Freedom 贷款
  // ===================================================

  const [
    financialFreedomLoan,
    setFinancialFreedomLoan,
  ] = useState(0);


  // ===================================================
  // 当前家庭净资产
  // ===================================================

  const [
    currentAsset,
    setCurrentAsset,
  ] = useState(0);


  // ===================================================
  // 保险
  // ===================================================

  const [
    insurance,
    setInsurance,
  ] = useState<any>(null);


  // ===================================================
  // 年度保险预测
  // ===================================================

  const [
    insuranceProjection,
    setInsuranceProjection,
  ] = useState<any[]>([]);


  // ===================================================
  // 年度贷款模型
  // ===================================================

  const [
    loanModel,
    setLoanModel,
  ] = useState<
    Record<
      number,
      {
        payment: number;
        pressure: number;
      }
    >
  >({});


  // ===================================================
  // 年度预测
  // ===================================================

  const [
    yearlyRows,
    setYearlyRows,
  ] = useState<any[]>([]);


  // ===================================================
  // Loading
  // ===================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  // =====================================================
  // 当前财务自由目标
  // =====================================================

  const currentFreedomTarget =
    useMemo(
      () => {

        return getFinancialFreedomTarget(
          START_YEAR
        );

      },
      []
    );


  // =====================================================
  // 加载数据
  // =====================================================

  useEffect(() => {


    async function load() {


      try {

        setLoading(true);


        // =================================================
        // 1. Dashboard Total Wealth
        // =================================================
        //
        // 注意：
        //
        // getDashboardTotalWealth()
        //
        // 本身已经包含 fixed_income_assets。
        //
        // 所以这里绝对不能：
        //
        // Dashboard
        // +
        // 固收
        //
        // 再次相加。
        // =================================================

        const dashboardValue =
          await getDashboardTotalWealth();


        const totalWealth =
          toNumber(
            dashboardValue
          );


        // =================================================
        // 2. 固收
        //
        // 这里只用于展示。
        //
        // 不再加入 currentAsset。
        // =================================================

        const fixedIncomeAmount =
          await getFixedIncomeTotal();


        // =================================================
        // 3. Financial Freedom 贷款
        //
        // 只使用：
        //
        // include_in_financial_freedom = true
        // =================================================

        const ffLoans =
          await getFinancialFreedomLoans();


        const loanBalance =
          (
            Array.isArray(
              ffLoans
            )
              ? ffLoans
              : []
          ).reduce(
            (
              sum: number,
              loan: any
            ) => {


              const remaining =
                Number(
                  loan?.remaining_amount ??
                  loan?.remaining_balance ??
                  loan?.current_balance ??
                  loan?.balance ??
                  loan?.amount ??
                  0
                );


              return (
                sum +
                (
                  Number.isFinite(
                    remaining
                  )
                    ? remaining
                    : 0
                )
              );

            },
            0
          );


        // =================================================
        // 4. 当前家庭净资产
        // =================================================
        //
        // 与 FREEDOM PAGE 完全一致：
        //
        // Dashboard Total Wealth
        // -
        // Financial Freedom Loan
        //
        // ★ 不再重复加固收。
        // =================================================

        const householdAsset =
          totalWealth -
          loanBalance;


        setDashboardTotalWealth(
          totalWealth
        );


        setFixedIncome(
          fixedIncomeAmount
        );


        setFinancialFreedomLoan(
          loanBalance
        );


        setCurrentAsset(
          householdAsset
        );


        // =================================================
        // 5. 保险
        // =================================================

        const insuranceData =
          await getInsuranceSummary();


        setInsurance(
          insuranceData
        );


        // =================================================
        // 6. 年度保险预测
        // =================================================

        const projection =
          await getInsuranceYearProjection();


        const safeProjection =
          Array.isArray(
            projection
          )
            ? projection
            : [];


        setInsuranceProjection(
          safeProjection
        );


        // =================================================
        // 7. 年度贷款模型
        // =================================================

        const loans:
          Record<
            number,
            {
              payment: number;
              pressure: number;
            }
          > = {};


        for (
          let year = START_YEAR;
          year <= END_YEAR;
          year++
        ) {


          // =================================================
          // 年度贷款支付
          // =================================================

          const payment =
            await getFinancialFreedomLoanPayment(
              year
            );


          // =================================================
          // 年度贷款压力
          // =================================================

          const pressure =
            await getAnnualLoanPressure(
              year
            );


          loans[
            year
          ] = {

            payment:
              Number(
                payment || 0
              ),

            pressure:
              Number(
                pressure || 0
              ),

          };

        }


        setLoanModel(
          loans
        );


        // =================================================
        // 8. 年度资产预测
        // =================================================
        //
        // ★★★ 完全按照 FREEDOM PAGE ★★★
        //
        // 年初资产
        // +
        // 年初资产 × 5%
        // +
        // 年收入
        // -
        // 生活费
        // -
        // 年金
        // -
        // Financial Freedom贷款压力
        // =
        // 年末资产
        // =================================================

        let asset =
          householdAsset;


        const result:
          any[] = [];


        for (
          let year = START_YEAR;
          year <= END_YEAR;
          year++
        ) {


          // =================================================
          // 生活费用
          // =================================================

          const expense =
            Number(
              BASE_EXPENSE[
                year
              ] || 0
            );


          // =================================================
          // 年金
          // =================================================

          const annuity =
            Number(
              ANNUITY[
                year
              ] || 0
            );


          // =================================================
          // 贷款压力
          // =================================================

          const loan =
            Number(
              loans[
                year
              ]?.pressure || 0
            );


          // =================================================
          // 年度现金流
          // =================================================
          //
          // 年收入
          // -
          // 生活费
          // -
          // 年金
          // -
          // 贷款压力
          // =================================================

          const cashFlow =
            ANNUAL_INCOME
            -
            expense
            -
            annuity
            -
            loan;


          // =================================================
          // 投资收益
          // =================================================
          //
          // 年初资产 × 5%
          // =================================================

          const investmentReturn =
            asset *
            RETURN_RATE;


          // =================================================
          // 年末资产
          // =================================================

          asset =
            asset
            +
            investmentReturn
            +
            cashFlow;


          // =================================================
          // 当年剩余财务自由目标
          // =================================================

          const freedomTarget =
            getFinancialFreedomTarget(
              year
            );


          // =================================================
          // ★ 财务自由差额（年末）
          // =================================================
          //
          // 当年财务自由目标
          // -
          // 当年预计年末资产
          //
          // 最低为 0。
          // =================================================

          const freedomGap =
            Math.max(
              freedomTarget -
              asset,
              0
            );


          // =================================================
          // 剩余年份
          // =================================================

          const remainingYears =
            FREEDOM_END_YEAR -
            year +
            1;


          // =================================================
          // 保险年度数据
          // =================================================

          const insuranceYear =
            safeProjection.find(
              (
                item: any
              ) =>
                Number(
                  item?.year
                ) === year
            );


          // =================================================
          // 全部未来保费
          // =================================================

          const totalFuturePremium =
            toNumber(
              insuranceYear?.totalFuturePremium
            );


          // =================================================
          // 夫妻未来保费
          // =================================================

          const coupleFuturePremium =
            toNumber(
              insuranceYear?.coupleFuturePremium
            );


          // =================================================
          // 儿子现金价值
          // =================================================

          const sonFutureCashValue =
            toNumber(
              insuranceYear?.sonCashValue
            );


          // =================================================
          // 天天向上1
          //
          // 财务自由差额（年末）
          // +
          // 当年未来保费
          // =================================================

          const yearTiantian1 =
            freedomGap
            +
            totalFuturePremium;


          // =================================================
          // 天天向上2
          //
          // 财务自由差额（年末）
          // +
          // 夫妻未来保费
          // -
          // 儿子现金价值
          // =================================================

          const yearTiantian2 =
            freedomGap
            +
            coupleFuturePremium
            -
            sonFutureCashValue;


          // =================================================
          // 保存
          // =================================================

          result.push({

            year,

            remainingYears,

            beginningAsset:
              asset -
              investmentReturn -
              cashFlow,

            expense,

            annuity,

            loan,

            income:
              ANNUAL_INCOME,

            investmentReturn,

            cashFlow,

            asset,

            freedomTarget,

            freedomGap,

            totalFuturePremium,

            coupleFuturePremium,

            sonFutureCashValue,

            yearTiantian1,

            yearTiantian2,

          });

        }


        setYearlyRows(
          result
        );


        // =================================================
        // Debug
        // =================================================

        console.log(
          "========================================"
        );

        console.log(
          "TIANTIAN UP DETAIL"
        );

        console.log(
          "Dashboard Total Wealth:",
          totalWealth
        );

        console.log(
          "Fixed Income:",
          fixedIncomeAmount
        );

        console.log(
          "Financial Freedom Loan:",
          loanBalance
        );

        console.log(
          "Current Household Net Asset:",
          householdAsset
        );

        console.log(
          "Current Financial Freedom Target:",
          currentFreedomTarget
        );

        console.log(
          "Current Financial Freedom Gap:",
          Math.max(
            currentFreedomTarget -
            householdAsset,
            0
          )
        );

        console.log(
          "Annual Forecast:",
          result
        );

        console.log(
          "========================================"
        );


      }
      catch (
        error
      ) {

        console.error(
          "Tiantian Up Detail loading error:",
          error
        );

      }
      finally {

        setLoading(false);

      }

    }


    load();

  }, [
    currentFreedomTarget,
  ]);


  // =====================================================
  // 当前财务自由差额
  // =====================================================

  const freedomGap =
    Math.max(
      currentFreedomTarget -
      currentAsset,
      0
    );


  // =====================================================
  // 全部未缴保费
  // =====================================================

  const unpaidPremium =
    toNumber(
      insurance?.unpaidPremium ??
      insurance?.unpaid_premium ??
      insurance?.remainingPremium ??
      insurance?.remaining_premium ??
      insurance?.totalUnpaidPremium ??
      insurance?.total_unpaid_premium
    );


  // =====================================================
  // 夫妻未缴保费
  // =====================================================

  const coupleUnpaidPremium =
    toNumber(
      insurance?.coupleUnpaidPremium ??
      insurance?.couple_unpaid_premium
    );


  // =====================================================
  // 儿子现金价值
  // =====================================================

  const sonCashValue =
    toNumber(
      insurance?.sonCashValue ??
      insurance?.son_cash_value
    );


  // =====================================================
  // 夫妻保费 - 儿子现金价值
  // =====================================================

  const coupleMinusSon =
    coupleUnpaidPremium -
    sonCashValue;


  // =====================================================
  // 天天向上1
  //
  // 当前财务自由差额
  // +
  // 全部未缴保费
  // =====================================================

  const tiantian1 =
    freedomGap +
    unpaidPremium;


  // =====================================================
  // 天天向上2
  //
  // 当前财务自由差额
  // +
  // 夫妻未缴保费
  // -
  // 儿子现金价值
  // =====================================================

  const tiantian2 =
    freedomGap +
    coupleMinusSon;


  // =====================================================
  // Loading
  // =====================================================

  if (
    loading
  ) {

    return (

      <>

        <TopBar
          title="天天向上详情"
        />


        <main
          className="
            p-10
            max-w-[1400px]
            mx-auto
          "
        >

          正在加载...

        </main>

      </>

    );

  }


  // =====================================================
  // 页面
  // =====================================================

  return (

    <>

      <TopBar
        title="天天向上详情"
      />


      <main
        className="
          p-8
          max-w-[1400px]
          mx-auto
          space-y-8
        "
      >


        {/* =================================================
            标题
            ================================================= */}

        <div>

          <h1
            className="
              text-3xl
              font-bold
            "
          >

            🚀 天天向上详情

          </h1>


          <p
            className="
              text-gray-500
              mt-2
            "
          >

            按 Financial Freedom 模型预测 2027–2041 年资产、财务自由差额及保险压力

          </p>

        </div>


        {/* =================================================
            当前核心结果
            ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            gap-6
          "
        >


          {/* =================================================
              天天向上1
              ================================================= */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-7
              shadow-sm
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              天天向上1（当前）

            </p>


            <h2
              className="
                text-4xl
                font-bold
                text-blue-700
                mt-3
              "
            >

              {
                money(
                  tiantian1
                )
              }

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-2
              "
            >

              当前财务自由差额 + 全部未缴保费

            </p>

          </div>


          {/* =================================================
              天天向上2
              ================================================= */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-7
              shadow-sm
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              天天向上2（当前）

            </p>


            <h2
              className="
                text-4xl
                font-bold
                text-green-700
                mt-3
              "
            >

              {
                money(
                  tiantian2
                )
              }

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-2
              "
            >

              当前财务自由差额 + 夫妻未缴保费 − 儿子现金价值

            </p>

          </div>


        </section>


        {/* =================================================
            当前资产结构
            ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            lg:grid-cols-4
            gap-6
          "
        >


          {/* Dashboard */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-6
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              Dashboard Total Wealth

            </p>


            <h2
              className="
                text-3xl
                font-bold
                mt-3
              "
            >

              {
                money(
                  dashboardTotalWealth
                )
              }

            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              Dashboard 当前家庭总资产

            </p>

          </div>


          {/* 固收 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-6
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              固收资产

            </p>


            <h2
              className="
                text-3xl
                font-bold
                mt-3
              "
            >

              {
                money(
                  fixedIncome
                )
              }

            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              fixed_income_assets

            </p>

          </div>


          {/* Loan */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-6
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              Financial Freedom 贷款

            </p>


            <h2
              className="
                text-3xl
                font-bold
                text-red-700
                mt-3
              "
            >

              − {
                money(
                  financialFreedomLoan
                )
              }

            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              只统计勾选「计入 Financial Freedom」的贷款

            </p>

          </div>


          {/* 净资产 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-6
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              当前家庭净资产

            </p>


            <h2
              className="
                text-3xl
                font-bold
                text-blue-700
                mt-3
              "
            >

              {
                money(
                  currentAsset
                )
              }

            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              Dashboard Total Wealth − Financial Freedom贷款

            </p>

          </div>


        </section>


        {/* =================================================
            财务自由
            ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-3
            gap-6
          "
        >


          {/* 目标 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-7
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              当前财务自由目标

            </p>


            <h2
              className="
                text-3xl
                font-bold
                mt-3
              "
            >

              {
                money(
                  currentFreedomTarget
                )
              }

            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              2027–2041 剩余生活费总和

            </p>

          </div>


          {/* 当前差额 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-7
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              当前财务自由差额

            </p>


            <h2
              className="
                text-3xl
                font-bold
                text-blue-700
                mt-3
              "
            >

              {
                freedomGap > 0
                  ? money(
                      freedomGap
                    )
                  : "已达成"
              }

            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              当前财务自由目标 − 当前家庭净资产

            </p>

          </div>


          {/* 全部未缴保费 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-7
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              全部未缴保费

            </p>


            <h2
              className="
                text-3xl
                font-bold
                text-purple-700
                mt-3
              "
            >

              {
                money(
                  unpaidPremium
                )
              }

            </h2>

          </div>


        </section>


        {/* =================================================
            保险
            ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-3
            gap-6
          "
        >


          {/* 夫妻 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-7
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              夫妻未缴保费

            </p>


            <h2
              className="
                text-3xl
                font-bold
                mt-3
              "
            >

              {
                money(
                  coupleUnpaidPremium
                )
              }

            </h2>

          </div>


          {/* 儿子 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-7
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              儿子现金价值

            </p>


            <h2
              className="
                text-3xl
                font-bold
                mt-3
              "
            >

              {
                money(
                  sonCashValue
                )
              }

            </h2>

          </div>


          {/* 差额 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-7
            "
          >

            <p
              className="
                text-gray-500
              "
            >

              夫妻保费 − 儿子现金价值

            </p>


            <h2
              className="
                text-3xl
                font-bold
                text-orange-600
                mt-3
              "
            >

              {
                money(
                  coupleMinusSon
                )
              }

            </h2>

          </div>


        </section>


        {/* =================================================
            计算规则
            ================================================= */}

        <section
          className="
            bg-blue-50
            border
            border-blue-100
            rounded-2xl
            p-7
          "
        >

          <h2
            className="
              text-lg
              font-bold
              text-blue-900
            "
          >

            📐 当前计算规则

          </h2>


          <div
            className="
              mt-4
              text-sm
              text-blue-800
              leading-8
            "
          >

            <p>

              <b>
                当前家庭净资产
              </b>

              =

              Dashboard Total Wealth

              −

              Financial Freedom 贷款

            </p>


            <p>

              <b>
                当前财务自由目标
              </b>

              =

              2027–2041 所有未来生活费总和

            </p>


            <p>

              <b>
                年度年末资产
              </b>

              =

              年初资产

              +

              年初资产 × 5%

              +

              年收入

              −

              生活费

              −

              年金

              −

              Financial Freedom贷款压力

            </p>


            <p>

              <b>
                财务自由差额（年末）
              </b>

              =

              max(
              当年财务自由目标 − 当年预计年末资产,
              0
              )

            </p>


            <p>

              <b>
                天天向上1（当前）
              </b>

              =

              当前财务自由差额

              +

              全部未缴保费

            </p>


            <p>

              <b>
                天天向上2（当前）
              </b>

              =

              当前财务自由差额

              +

              夫妻未缴保费

              −

              儿子现金价值

            </p>


          </div>

        </section>


        {/* =================================================
            年度预测
            ================================================= */}

        <section
          className="
            bg-white
            border
            rounded-2xl
            overflow-hidden
          "
        >


          <div
            className="
              p-6
              border-b
            "
          >

            <h2
              className="
                text-xl
                font-bold
              "
            >

              📊 2027–2041 天天向上年度预测

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-1
              "
            >

              与 Financial Freedom 页面采用完全一致的年度资产预测逻辑

            </p>

          </div>


          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className="
                w-full
                text-sm
                min-w-[1500px]
              "
            >


              <thead
                className="
                  bg-gray-50
                  border-b
                "
              >

                <tr>


                  <th
                    className="
                      px-4
                      py-4
                      text-left
                    "
                  >
                    年份
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    年收入
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    生活费用
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    年金
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    贷款压力
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    投资收益
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    年末预计资产
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    财务自由目标
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    财务自由差额（年末）
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    全部未来保费
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    夫妻未来保费
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                    "
                  >
                    儿子现金价值
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      text-blue-700
                    "
                  >
                    天天向上1
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      text-green-700
                    "
                  >
                    天天向上2
                  </th>


                </tr>

              </thead>


              <tbody>


                {
                  yearlyRows.map(
                    (
                      row
                    ) => (

                      <tr
                        key={
                          row.year
                        }
                        className="
                          border-b
                          last:border-b-0
                          hover:bg-gray-50
                        "
                      >


                        {/* 年份 */}

                        <td
                          className="
                            px-4
                            py-4
                            font-semibold
                          "
                        >

                          {row.year}

                        </td>


                        {/* 年收入 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                          "
                        >

                          {
                            money(
                              row.income
                            )
                          }

                        </td>


                        {/* 生活费用 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                          "
                        >

                          {
                            money(
                              row.expense
                            )
                          }

                        </td>


                        {/* 年金 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                          "
                        >

                          {
                            money(
                              row.annuity
                            )
                          }

                        </td>


                        {/* 贷款压力 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            text-red-600
                          "
                        >

                          {
                            money(
                              row.loan
                            )
                          }

                        </td>


                        {/* 投资收益 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            text-purple-700
                          "
                        >

                          {
                            money(
                              row.investmentReturn
                            )
                          }

                        </td>


                        {/* 年末资产 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            font-semibold
                            text-blue-700
                          "
                        >

                          {
                            money(
                              row.asset
                            )
                          }

                        </td>


                        {/* 财务自由目标 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            font-semibold
                          "
                        >

                          {
                            money(
                              row.freedomTarget
                            )
                          }

                        </td>


                        {/* 财务自由差额 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            font-bold
                            text-orange-600
                          "
                        >

                          {
                            row.freedomGap > 0
                              ? money(
                                  row.freedomGap
                                )
                              : "已达成"
                          }

                        </td>


                        {/* 全部未来保费 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                          "
                        >

                          {
                            money(
                              row.totalFuturePremium
                            )
                          }

                        </td>


                        {/* 夫妻未来保费 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                          "
                        >

                          {
                            money(
                              row.coupleFuturePremium
                            )
                          }

                        </td>


                        {/* 儿子现金价值 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                          "
                        >

                          {
                            money(
                              row.sonFutureCashValue
                            )
                          }

                        </td>


                        {/* 天天向上1 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            font-bold
                            text-blue-700
                          "
                        >

                          {
                            money(
                              row.yearTiantian1
                            )
                          }

                        </td>


                        {/* 天天向上2 */}

                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            font-bold
                            text-green-700
                          "
                        >

                          {
                            money(
                              row.yearTiantian2
                            )
                          }

                        </td>


                      </tr>

                    )
                  )
                }


              </tbody>

            </table>

          </div>

        </section>


        {/* =================================================
            年度计算说明
            ================================================= */}

        <section
          className="
            bg-gray-50
            border
            rounded-2xl
            p-7
          "
        >

          <h2
            className="
              text-lg
              font-bold
              text-gray-900
            "
          >

            📘 年度预测说明

          </h2>


          <div
            className="
              mt-4
              text-sm
              text-gray-600
              leading-8
            "
          >

            <p>

              <b>
                2027 财务自由目标
              </b>

              =

              2027–2041 全部生活费

            </p>


            <p>

              <b>
                2028 财务自由目标
              </b>

              =

              2028–2041 全部生活费

            </p>


            <p>

              <b>
                ……
              </b>

            </p>


            <p>

              <b>
                2041 财务自由目标
              </b>

              =

              2041 年生活费

            </p>


            <p className="mt-2">

              所以随着年份增加，财务自由目标会逐年下降。

            </p>


            <p>

              同时资产按照上一年度资产滚动，并计入 5% 投资收益、年度收入、生活费、年金以及 Financial Freedom 贷款压力。

            </p>


            <p>

              最终每一年使用：

              <b>
                当年财务自由目标 − 当年预计年末资产
              </b>

              计算当年财务自由差额。

            </p>

          </div>

        </section>


      </main>

    </>

  );

}