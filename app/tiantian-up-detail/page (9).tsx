"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getLatestAsset,
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

import {
  supabase,
} from "@/lib/supabase";


// =====================================================
// 参数
// =====================================================

const START_YEAR = 2027;

const END_YEAR = 2041;

const FREEDOM_END_YEAR = 2041;

const RETURN_RATE = 0.05;

const ANNUAL_INCOME = 1100000;

const START_ASSET = 1600000;


// =====================================================
// 生活费用
// =====================================================
//
// 2027 - 2031：37万
// 2032 - 2041：32万
//
// 财务自由目标：
// 从当年开始到 2041 年所有剩余生活费。
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
// 数字安全转换
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
// 财务自由目标
// =====================================================
//
// 2027
// = 2027~2041 所有生活费
//
// 2028
// = 2028~2041 所有生活费
//
// ...
//
// 2041
// = 2041 年生活费
// =====================================================

function getFinancialFreedomTarget(
  startYear: number
): number {

  let target = 0;


  for (
    let year = startYear;
    year <= FREEDOM_END_YEAR;
    year++
  ) {

    target +=
      Number(
        BASE_EXPENSE[year] || 0
      );

  }


  return target;

}


// =====================================================
// 金额格式
// =====================================================

function money(
  value: number
): string {

  const n =
    toNumber(value);


  if (
    n >= 100000000
  ) {

    return (
      "¥" +
      (
        n /
        100000000
      ).toFixed(2) +
      " 亿"
    );

  }


  if (
    n >= 10000
  ) {

    return (
      "¥" +
      (
        n /
        10000
      ).toFixed(1) +
      " 万"
    );

  }


  return (
    "¥" +
    Math.round(n)
      .toLocaleString(
        "zh-CN"
      )
  );

}


// =====================================================
// 页面
// =====================================================

export default function TiantianUpDetailPage() {


  // ===================================================
  // 当前资产
  // ===================================================

  const [
    currentAsset,
    setCurrentAsset,
  ] = useState(0);


  // ===================================================
  // Dashboard Total Wealth
  // ===================================================

  const [
    dashboardTotalWealth,
    setDashboardTotalWealth,
  ] = useState(0);


  // ===================================================
  // 固收
  // ===================================================

  const [
    fixedIncome,
    setFixedIncome,
  ] = useState(0);


  // ===================================================
  // Financial Freedom Loan
  // ===================================================

  const [
    financialFreedomLoan,
    setFinancialFreedomLoan,
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
    loanPressure,
    setLoanPressure,
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
      () =>
        getFinancialFreedomTarget(
          START_YEAR
        ),
      []
    );


  // =====================================================
  // 当前财务自由差额
  // =====================================================

  const currentFreedomGap =
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
      insurance?.total_unpaid_premium ??
      0
    );


  // =====================================================
  // 夫妻未缴保费
  // =====================================================

  const coupleUnpaidPremium =
    toNumber(
      insurance?.coupleUnpaidPremium ??
      insurance?.couple_unpaid_premium ??
      0
    );


  // =====================================================
  // 儿子现金价值
  // =====================================================

  const sonCashValue =
    toNumber(
      insurance?.sonCashValue ??
      insurance?.son_cash_value ??
      0
    );


  // =====================================================
  // 当前夫妻保费 - 儿子现金价值
  // =====================================================

  const coupleMinusSon =
    coupleUnpaidPremium -
    sonCashValue;


  // =====================================================
  // 当前天天向上1
  //
  // 当前财务自由差额
  // +
  // 全部未来未缴保费
  // =====================================================

  const tiantian1 =
    currentFreedomGap +
    unpaidPremium;


  // =====================================================
  // 当前天天向上2
  //
  // 当前财务自由差额
  // +
  // 夫妻未来未缴保费
  // -
  // 儿子现金价值
  // =====================================================

  const tiantian2 =
    currentFreedomGap +
    coupleUnpaidPremium -
    sonCashValue;


  // =====================================================
  // 加载数据
  // =====================================================

  useEffect(() => {


    async function load() {


      try {

        setLoading(true);


        // =================================================
        // 1. 获取最新 Dashboard 资产
        // =================================================

        const latest =
          await getLatestAsset();


        const originalAsset =
          Number(
            latest?.total_asset
          ) ||
          START_ASSET;


        // =================================================
        // 2. 获取固收资产
        // =================================================

        const {
          data: fixedIncomeData,
          error: fixedIncomeError,
        } =
          await supabase
            .from(
              "fixed_income_assets"
            )
            .select(
              "amount"
            );


        if (
          fixedIncomeError
        ) {

          console.error(
            "Tiantian Detail fixed income error:",
            fixedIncomeError
          );

        }


        // =================================================
        // 3. 固收合计
        // =================================================

        const fixedIncomeSum =
          (
            Array.isArray(
              fixedIncomeData
            )
              ? fixedIncomeData
              : []
          ).reduce(
            (
              sum: number,
              item: any
            ) => {

              const amount =
                Number(
                  item?.amount ?? 0
                );


              return (
                sum +
                (
                  Number.isFinite(
                    amount
                  )
                    ? amount
                    : 0
                )
              );

            },
            0
          );


        // =================================================
        // 4. Dashboard Total Wealth
        //
        // 和原版本保持一致：
        //
        // asset_history.total_asset
        // +
        // fixed_income_assets
        //
        // 固收只加一次。
        // =================================================

        const totalWealth =
          originalAsset +
          fixedIncomeSum;


        // =================================================
        // 5. Financial Freedom Loans
        //
        // 只读取：
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
        // 6. 当前家庭净资产
        //
        // Dashboard Total Wealth
        // -
        // Financial Freedom Loan
        // =================================================

        const netAsset =
          totalWealth -
          loanBalance;


        setDashboardTotalWealth(
          totalWealth
        );


        setFixedIncome(
          fixedIncomeSum
        );


        setFinancialFreedomLoan(
          loanBalance
        );


        setCurrentAsset(
          netAsset
        );


        // =================================================
        // 7. 保险
        // =================================================

        const insuranceData =
          await getInsuranceSummary();


        setInsurance(
          insuranceData
        );


        // =================================================
        // 8. 年度保险预测
        //
        // ★★★ 关键修复 ★★★
        //
        // 不使用刚 setState 的 insuranceProjection。
        //
        // 直接使用当前函数刚刚获取到的
        // safeProjection。
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
        // 9. 年度贷款模型
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


          const payment =
            await getFinancialFreedomLoanPayment(
              year
            );


          const pressure =
            await getAnnualLoanPressure(
              year
            );


          loans[year] = {

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


        setLoanPressure(
          loans
        );


        // =================================================
        // 10. 年度资产预测
        // =================================================

        let simulationAsset =
          netAsset;


        const result: any[] = [];


        for (
          let year = START_YEAR;
          year <= END_YEAR;
          year++
        ) {


          // ===============================================
          // 年初资产
          // ===============================================

          const beginAsset =
            simulationAsset;


          // ===============================================
          // 年收入
          // ===============================================

          const income =
            ANNUAL_INCOME;


          // ===============================================
          // 生活费用
          // ===============================================

          const expense =
            Number(
              BASE_EXPENSE[year] ||
              0
            );


          // ===============================================
          // 年金
          // ===============================================

          const pension =
            Number(
              ANNUITY[year] ||
              0
            );


          // ===============================================
          // Financial Freedom 贷款压力
          // ===============================================

          const loan =
            Number(
              loans[year]?.pressure ||
              0
            );


          // ===============================================
          // 年度现金流
          //
          // 年收入
          // -
          // 生活费
          // -
          // 年金
          // -
          // 贷款压力
          // ===============================================

          const cashFlow =
            income
            -
            expense
            -
            pension
            -
            loan;


          // ===============================================
          // 投资收益
          //
          // 年初资产 × 5%
          // ===============================================

          const investmentReturn =
            beginAsset *
            RETURN_RATE;


          // ===============================================
          // 年末资产
          // ===============================================

          const totalAsset =
            beginAsset
            +
            investmentReturn
            +
            cashFlow;


          // ===============================================
          // 更新下一年年初资产
          // ===============================================

          simulationAsset =
            totalAsset;


          // ===============================================
          // 当年剩余财务自由目标
          // ===============================================

          const freedomTarget =
            getFinancialFreedomTarget(
              year
            );


          // ===============================================
          // 财务自由差额(年末)
          // ===============================================

          const freedomGap =
            Math.max(
              0,
              freedomTarget -
              totalAsset
            );


          // ===============================================
          // 剩余年份
          // ===============================================

          const remainingYears =
            END_YEAR -
            year +
            1;


          // ===============================================
          // ★★★ 对应年度保险数据 ★★★
          //
          // 注意：
          // 这里必须使用 safeProjection
          //
          // 不能使用 insuranceProjection
          // 因为 setInsuranceProjection()
          // 不会立即更新 state。
          // ===============================================

          const insuranceYear =
            safeProjection.find(
              (
                item: any
              ) =>
                Number(
                  item?.year
                ) === year
            );


          // ===============================================
          // 全部未来保费
          // ===============================================

          const totalFuturePremium =
            toNumber(
              insuranceYear?.totalFuturePremium
            );


          // ===============================================
          // 夫妻未来保费
          // ===============================================

          const coupleFuturePremium =
            toNumber(
              insuranceYear?.coupleFuturePremium
            );


          // ===============================================
          // 儿子现金价值
          // ===============================================

          const sonFutureCashValue =
            toNumber(
              insuranceYear?.sonCashValue
            );


          // ===============================================
          // 天天向上1
          //
          // 财务自由差额(年末)
          // +
          // 全部未来保费
          // ===============================================

          const yearTiantian1 =
            freedomGap +
            totalFuturePremium;


          // ===============================================
          // 天天向上2
          //
          // 财务自由差额(年末)
          // +
          // 夫妻未来保费
          // -
          // 儿子现金价值
          // ===============================================

          const yearTiantian2 =
            freedomGap +
            coupleFuturePremium -
            sonFutureCashValue;


          // ===============================================
          // 保存
          // ===============================================

          result.push({

            year,

            remainingYears,

            beginAsset,

            income,

            expense,

            pension,

            loan,

            investmentReturn,

            cashFlow,

            totalAsset,

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
          "Original Asset:",
          originalAsset
        );

        console.log(
          "Fixed Income:",
          fixedIncomeSum
        );

        console.log(
          "Dashboard Total Wealth:",
          totalWealth
        );

        console.log(
          "Financial Freedom Loan:",
          loanBalance
        );

        console.log(
          "Current Net Asset:",
          netAsset
        );

        console.log(
          "Current Freedom Target:",
          getFinancialFreedomTarget(
            START_YEAR
          )
        );

        console.log(
          "Current Freedom Gap:",
          Math.max(
            0,
            getFinancialFreedomTarget(
              START_YEAR
            ) -
            netAsset
          )
        );

        console.log(
          "Insurance Projection:",
          safeProjection
        );

        console.log(
          "Annual Freedom Rows:",
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

  }, []);


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

          正在加载财富数据...

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
          max-w-none
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
              text-gray-900
            "
          >

            🚀 天天向上详情

          </h1>


          <p
            className="
              mt-2
              text-gray-500
            "
          >

            2027–2041 财务自由、资产增长与保险压力年度分析

          </p>

        </div>


        {/* =================================================
            当前核心指标
            ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            gap-6
          "
        >


          {/* 天天向上1 */}

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


          {/* 天天向上2 */}

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
              shadow-sm
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

              asset_history.total_asset + 固收

            </p>

          </div>


          {/* 固收 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-6
              shadow-sm
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
              shadow-sm
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

              仅统计勾选「计入 Financial Freedom」的贷款

            </p>

          </div>


          {/* 净资产 */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-6
              shadow-sm
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


          {/* 财务自由目标 */}

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

              2027–2041 全部剩余生活费用

            </p>

          </div>


          {/* 当前差额 */}

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
                money(
                  currentFreedomGap
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
              shadow-sm
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
              shadow-sm
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
              shadow-sm
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
              shadow-sm
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

            📐 计算规则

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

              = Dashboard Total Wealth − Financial Freedom贷款

            </p>


            <p>

              <b>
                Dashboard Total Wealth
              </b>

              = asset_history.total_asset + 固收资产

            </p>


            <p>

              <b>
                年末预计资产
              </b>

              = 年初资产 + 年初资产 × 5% + 年度现金流

            </p>


            <p>

              <b>
                年度现金流
              </b>

              = 年收入 − 生活费 − 年金 − Financial Freedom贷款压力

            </p>


            <p>

              <b>
                当年财务自由目标
              </b>

              = 从当年开始到 2041 年全部剩余生活费

            </p>


            <p>

              <b>
                财务自由差额(年末)
              </b>

              = max(
              当年财务自由目标 − 年末预计资产,
              0
              )

            </p>


            <p>

              <b>
                天天向上1
              </b>

              = 财务自由差额(年末) + 全部未来保费

            </p>


            <p>

              <b>
                天天向上2
              </b>

              = 财务自由差额(年末) + 夫妻未来保费 − 儿子现金价值

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
            shadow-sm
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

              年末资产、财务自由差额与未来保险压力统一计算

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
                      whitespace-nowrap
                    "
                  >
                    年份
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >
                    年初资产
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >
                    生活费
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >
                    年金
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >
                    待还贷款
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >
                    投资收益
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      font-bold
                      whitespace-nowrap
                    "
                  >
                    年末资产
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >
                    财务自由目标(年末)
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      font-bold
                      whitespace-nowrap
                    "
                  >
                    财务自由差额(年末)
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >
                    全部未来保费(年末)
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >
                    夫妻未来保费(年末)
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >
                    儿子现金价值(年末)
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      font-bold
                      text-blue-700
                      whitespace-nowrap
                    "
                  >
                    天天向上1(年末)
                  </th>


                  <th
                    className="
                      px-4
                      py-4
                      text-right
                      font-bold
                      text-green-700
                      whitespace-nowrap
                    "
                  >
                    天天向上2(年末)
                  </th>


                </tr>

              </thead>


              <tbody>

                {
                  yearlyRows.map(
                    (
                      row: any
                    ) => {

                      const gap =
                        toNumber(
                          row.freedomGap
                        );


                      return (

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
                              whitespace-nowrap
                            "
                          >

                            {row.year}

                          </td>


                          {/* 年初资产 */}

                          <td
                            className="
                              px-4
                              py-4
                              text-right
                              whitespace-nowrap
                            "
                          >

                            {
                              money(
                                row.beginAsset
                              )
                            }

                          </td>


                          {/* 生活费 */}

                          <td
                            className="
                              px-4
                              py-4
                              text-right
                              whitespace-nowrap
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
                              whitespace-nowrap
                            "
                          >

                            {
                              money(
                                row.pension
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
                              whitespace-nowrap
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
                              whitespace-nowrap
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
                              font-bold
                              text-blue-700
                              whitespace-nowrap
                            "
                          >

                            {
                              money(
                                row.totalAsset
                              )
                            }

                          </td>


                          {/* 财务自由目标 */}

                          <td
                            className="
                              px-4
                              py-4
                              text-right
                              whitespace-nowrap
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
                            className={`
                              px-4
                              py-4
                              text-right
                              font-bold
                              whitespace-nowrap
                              ${
                                gap > 0
                                  ? "text-orange-600"
                                  : "text-green-600"
                              }
                            `}
                          >

                            {
                              gap > 0
                                ? money(
                                    gap
                                  )
                                : "已达成"
                            }

                          </td>


                          {/* =====================================
                              全部未来保费
                              ===================================== */}

                          <td
                            className="
                              px-4
                              py-4
                              text-right
                              whitespace-nowrap
                            "
                          >

                            {
                              money(
                                row.totalFuturePremium
                              )
                            }

                          </td>


                          {/* =====================================
                              夫妻未来保费
                              ===================================== */}

                          <td
                            className="
                              px-4
                              py-4
                              text-right
                              whitespace-nowrap
                            "
                          >

                            {
                              money(
                                row.coupleFuturePremium
                              )
                            }

                          </td>


                          {/* =====================================
                              儿子现金价值
                              ===================================== */}

                          <td
                            className="
                              px-4
                              py-4
                              text-right
                              whitespace-nowrap
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
                              whitespace-nowrap
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
                              whitespace-nowrap
                            "
                          >

                            {
                              money(
                                row.yearTiantian2
                              )
                            }

                          </td>


                        </tr>

                      );

                    }
                  )
                }

              </tbody>

            </table>

          </div>


          {/* =================================================
              说明
              ================================================= */}

          <div
            className="
              m-6
              rounded-xl
              bg-indigo-50
              border
              border-indigo-100
              p-5
              text-sm
              text-indigo-800
              leading-7
            "
          >

            <p>

              <b>
                📐 财务自由目标：
              </b>

              每一年都重新计算「从该年开始到 2041 年剩余生活费」。

            </p>


            <p>

              例如：

              2027 =
              2027–2041 全部生活费；

              2028 =
              2028–2041 全部生活费；

              2041 =
              2041 年生活费。

            </p>


            <p>

              <b>
                财务自由差额(年末)
              </b>

              使用年末预计资产计算，而不是使用当前资产。

            </p>


            <p>

              <b>
                年末资产
              </b>

              会进入下一年的年初资产继续按照 5% 复利。

            </p>


            <p>

              <b>
                保险年度数据
              </b>

              直接使用 getInsuranceYearProjection() 返回的年度数据，
              按年份匹配全部未来保费、夫妻未来保费和儿子现金价值。

            </p>

          </div>


        </section>


      </main>

    </>

  );

}
