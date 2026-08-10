"use client";


import {
  useEffect,
  useState
} from "react";


import TopBar from "@/components/TopBar";


import {
  getLatestAsset
} from "@/lib/asset";


import {
  getInsuranceSummary,
  getInsuranceCashValueHistory
} from "@/lib/insurance";


import {
  getAnnualLoanPressure,
  getFinancialFreedomLoanPayment,
  getFinancialFreedomLoans
} from "@/lib/loan";


import {
  supabase
} from "@/lib/supabase";




// =====================================================
// 参数
// =====================================================

const START_YEAR = 2027;

const END_YEAR = 2042;

const RETIREMENT_AGE = 60;


// =====================================================
// 备用资产
// =====================================================
//
// 只有在 Dashboard 没有读取到资产时才使用。
// 正常情况下不会使用这里的金额。
// =====================================================

const START_ASSET = 1600000;


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
// 2032 - 2042：32万 / 年
//
// 注意：
// 财务自由目标使用 2027 - 2041
// 的生活费累计。
// =====================================================

const BASE_EXPENSE: any = {

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

  2042: 320000

};


// =====================================================
// ★ 财务自由目标
// =====================================================
//
// 原 Financial Freedom PAGE 的定义：
//
// 2027 - 2031
// 37万 × 5
// = 185万
//
// 2032 - 2041
// 32万 × 10
// = 320万
//
// 合计：
// 185万 + 320万
// = 505万
//
// 注意：
// 2042 年不计入这里。
// 因为这是你原 PAGE 的财务自由目标定义。
// =====================================================

const FINANCIAL_FREEDOM_TARGET =

  Object.keys(BASE_EXPENSE)
    .filter(
      (year) =>
        Number(year) >= START_YEAR &&
        Number(year) < END_YEAR
    )
    .reduce(
      (
        sum: number,
        year: string
      ) => {

        return (
          sum +
          Number(
            BASE_EXPENSE[year] || 0
          )
        );

      },
      0
    );


// =====================================================
// 年金缴费
// =====================================================

const ANNUITY: any = {

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

  2042: 39000

};


// =====================================================
// 页面
// =====================================================

export default function FinancialFreedomPage() {


  // ===================================================
  // 当前家庭资产
  // ===================================================

  const [
    currentFamilyAsset,
    setCurrentFamilyAsset,
  ] = useState(0);


  // ===================================================
  // Dashboard Total Wealth
  // ===================================================

  const [
    dashboardTotalWealth,
    setDashboardTotalWealth,
  ] = useState(0);


  // ===================================================
  // 固收资产
  // ===================================================

  const [
    fixedIncomeTotal,
    setFixedIncomeTotal,
  ] = useState(0);


  // ===================================================
  // Financial Freedom贷款
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


  const [
    insuranceHistory,
    setInsuranceHistory,
  ] = useState<any[]>([]);


  // ===================================================
  // 贷款年度压力
  // ===================================================

  const [
    loanPressure,
    setLoanPressure,
  ] = useState<any>({});


  // ===================================================
  // 年度预测结果
  // ===================================================

  const [
    rows,
    setRows,
  ] = useState<any[]>([]);


  // ===================================================
  // Loading
  // ===================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  // ===================================================
  // 数据加载
  // ===================================================

  useEffect(() => {

    async function load() {

      try {

        setLoading(true);


        // =================================================
        // 1. 获取 Dashboard 原始资产
        // =================================================

        const latest =
          await getLatestAsset();


        const originalAsset =

          Number(
            latest?.total_asset
          ) ||
          START_ASSET;


        // =================================================
        // 2. 获取 Dashboard 固收资产
        // =================================================

        const {
          data: fixedIncomeData
        } =

          await supabase
            .from(
              "fixed_income_assets"
            )
            .select(
              "amount"
            );


        const fixedIncomeSum =

          (
            Array.isArray(
              fixedIncomeData
            )
              ? fixedIncomeData
              : []
          )
            .reduce(
              (
                sum: number,
                item: any
              ) => {

                const amount =
                  Number(
                    item?.amount || 0
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
        // 3. Dashboard Total Wealth
        // =================================================
        //
        // Dashboard 本身的逻辑：
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


        setDashboardTotalWealth(
          totalWealth
        );


        setFixedIncomeTotal(
          fixedIncomeSum
        );


        // =================================================
        // 4. 获取 Financial Freedom 贷款
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
          )
            .reduce(
              (
                sum: number,
                loan: any
              ) => {

                return (

                  sum +

                  Number(
                    loan?.remaining_amount ||
                    loan?.balance ||
                    loan?.amount ||
                    0
                  )

                );

              },
              0
            );


        setFinancialFreedomLoan(
          loanBalance
        );


        // =================================================
        // 5. 当前家庭净资产
        // =================================================
        //
        // ★ 核心公式
        //
        // Dashboard Total Wealth
        // -
        // Financial Freedom贷款
        //
        // 注意：
        // 这里不再额外增加固收。
        // 因为 Dashboard Total Wealth
        // 已经包含 fixed_income_assets。
        // =================================================

        const netAsset =

          totalWealth -

          loanBalance;


        setCurrentFamilyAsset(
          netAsset
        );


        // =================================================
        // 6. 获取保险
        // =================================================

        const ins =
          await getInsuranceSummary();


        setInsurance(
          ins
        );


        const cashHistory =
          await getInsuranceCashValueHistory();


        setInsuranceHistory(
          cashHistory || []
        );


        // =================================================
        // 7. 贷款年度模型
        // =================================================

        const loans: any = {};


        for (
          let year = START_YEAR;
          year <= END_YEAR;
          year++
        ) {

          loans[year] = {

            payment:
              await getFinancialFreedomLoanPayment(
                year
              ),

            pressure:
              await getAnnualLoanPressure(
                year
              )

          };

        }


        setLoanPressure(
          loans
        );


        // =================================================
        // 第1部分结束
        // =================================================

      }

      catch (
        error
      ) {

        console.error(
          "Financial Freedom loading error:",
          error
        );

      }

    }


    load();

  }, []);

  // =====================================================
  // 数据加载
  // =====================================================

  useEffect(() => {

    async function load() {

      try {

        // =================================================
        // 1. 获取 Dashboard 最新资产
        // =================================================

        const latest =
          await getLatestAsset();


        // =================================================
        // Dashboard 原始 Total Asset
        //
        // 注意：
        // Dashboard 页面现在的逻辑是：
        //
        // asset_history.total_asset
        // +
        // fixed_income_assets.amount
        //
        // 所以这里的 latest.total_asset
        // 只是 asset_history 原始值。
        // =================================================

        const originalAsset =
          Number(
            latest?.total_asset ?? 0
          );


        // =================================================
        // 2. 获取固收资产
        //
        // Dashboard 已经把这里加入 Total Wealth。
        //
        // Financial Freedom 这里也只加入一次。
        // =================================================

        const {
          data: fixedIncomeData,
          error: fixedIncomeError,
        } =
          await supabase
            .from("fixed_income_assets")
            .select("amount");


        if (fixedIncomeError) {

          console.error(
            "Financial Freedom fixed income loading error:",
            fixedIncomeError
          );

        }


        // =================================================
        // 固收合计
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
        // 3. 正确计算 Dashboard Total Wealth
        //
        // 原始资产
        // +
        // 固收
        //
        // 固收只加一次。
        // =================================================

        const totalWealth =
          originalAsset +
          fixedIncomeSum;


        // =================================================
        // 保存 Dashboard 数据
        // =================================================

        setDashboardTotalWealth(
          totalWealth
        );


        setFixedIncomeTotal(
          fixedIncomeSum
        );


        // =================================================
        // 4. 获取 Financial Freedom 贷款
        // =================================================

        const ffLoans =
          await getFinancialFreedomLoans();


        // =================================================
        // Financial Freedom 贷款余额
        //
        // 当前家庭净资产计算时：
        //
        // Total Wealth
        // -
        // Financial Freedom Loan
        // =================================================

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


        setFinancialFreedomLoan(
          loanBalance
        );


        // =================================================
        // 5. 当前家庭净资产
        //
        // ★ 核心公式
        //
        // 当前家庭净资产
        // =
        // Dashboard Total Wealth
        // -
        // Financial Freedom 贷款
        //
        // 注意：
        // Dashboard Total Wealth 已经包含固收，
        // 所以这里绝对不能再：
        //
        // totalWealth + fixedIncomeSum
        //
        // 否则固收会重复计算。
        // =================================================

        const netAsset =
          totalWealth -
          loanBalance;


        setCurrentFamilyAsset(
          netAsset
        );


        // =================================================
        // Debug
        // =================================================

        console.log(
          "========================================"
        );

        console.log(
          "Financial Freedom Asset Calculation"
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
          "Current Family Net Asset:",
          netAsset
        );

        console.log(
          "========================================"
        );


        // =================================================
        // 6. 获取保险数据
        // =================================================

        const ins =
          await getInsuranceSummary();


        setInsurance(
          ins
        );


        // =================================================
        // 7. 获取保险现金价值历史
        // =================================================

        const cashHistory =
          await getInsuranceCashValueHistory();


        setInsuranceHistory(
          Array.isArray(
            cashHistory
          )
            ? cashHistory
            : []
        );


        // =================================================
        // 8. 贷款年度模型
        // =================================================

        const loans: any = {};


        for (
          let year = START_YEAR;
          year <= END_YEAR;
          year++
        ) {

          // =================================================
          // 年度贷款月供/支付
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
        // 9. 年度资产预测
        // =================================================
        //
        // ★ 非常重要
        //
        // 这里直接使用刚刚计算好的 netAsset。
        //
        // 不使用 currentFamilyAsset state，
        // 因为 setState 是异步的。
        // =================================================

        let currentAsset =
          netAsset;


        const result: any[] = [];


        // =================================================
        // 2027 → 2042
        // =================================================

        for (
          let year = START_YEAR;
          year <= END_YEAR;
          year++
        ) {

          // =================================================
          // 生活费
          // =================================================

          const expense =
            Number(
              BASE_EXPENSE[year] || 0
            );


          // =================================================
          // 年金缴费
          // =================================================

          const pension =
            Number(
              ANNUITY[year] || 0
            );


          // =================================================
          // Financial Freedom 贷款年度压力
          // =================================================

          const loan =
            Number(
              loans[year]?.pressure || 0
            );


          // =================================================
          // 年度现金流
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
            pension
            -
            loan;


          // =================================================
          // 投资收益
          //
          // 年初净资产 × 5%
          // =================================================

          const investmentReturn =
            currentAsset *
            RETURN_RATE;


          // =================================================
          // 年末资产
          // =================================================

          currentAsset =
            currentAsset
            +
            investmentReturn
            +
            cashFlow;


          // =================================================
          // 财务自由目标
          //
          // 这里仍然按照：
          //
          // 当年生活费 × 25
          //
          // =================================================

          const freedomTarget =
            expense *
            25;


          // =================================================
          // 财务自由目标差额
          //
          // ★ 注意
          //
          // 这里计算的是：
          //
          // 当年目标
          // -
          // 当年预计资产
          //
          // 如果资产已经超过目标，
          // 差额才显示 0。
          // =================================================

          const freedomGap =
            Math.max(
              0,
              freedomTarget
              -
              currentAsset
            );


          // =================================================
          // 保存年度结果
          // =================================================

          result.push({

            year,

            asset:
              currentAsset,

            income:
              ANNUAL_INCOME,

            expense,

            annuity:
              pension,

            loan,

            investmentReturn,

            cashFlow,

            freedomTarget,

            freedomGap,

          });

        }


        // =================================================
        // 10. 保存年度预测
        // =================================================

        setRows(
          result
        );


        // =================================================
        // Debug：检查 2042
        // =================================================

        const finalRow =
          result[
            result.length - 1
          ];


        console.log(
          "========================================"
        );

        console.log(
          "Financial Freedom 2042"
        );

        console.log(
          "2042 Projected Asset:",
          finalRow?.asset
        );

        console.log(
          "2042 Freedom Target:",
          finalRow?.freedomTarget
        );

        console.log(
          "2042 Freedom Gap:",
          finalRow?.freedomGap
        );

        console.log(
          "========================================"
        );

      } catch (
        error
      ) {

        console.error(
          "Financial Freedom loading error:",
          error
        );

      } finally {

        setLoading(
          false
        );

      }

    }


    load();

  }, []);

    // =====================================================
  // 金额格式
  // =====================================================

  function money(
    num: number
  ) {

    const value =
      Number(num || 0);


    return (
      "¥ " +
      value.toLocaleString(
        "zh-CN",
        {
          maximumFractionDigits: 0
        }
      )
    );

  }


  // =====================================================
  // Loading
  // =====================================================

  if (
    loading
  ) {

    return (

      <>

        <TopBar
          title="Financial Freedom"
        />


        <div
          className="
            p-10
            text-gray-500
          "
        >

          加载中...

        </div>

      </>

    );

  }


  // =====================================================
  // 2042 最终数据
  // =====================================================

  const current =
    rows[
      rows.length - 1
    ] || {};


  // =====================================================
  // 2042 财务自由目标
  // =====================================================

  const freedomTarget =
    Number(
      current?.freedomTarget || 0
    );


  // =====================================================
  // 2042 预计资产
  // =====================================================

  const projectedAsset =
    Number(
      current?.asset || 0
    );


  // =====================================================
  // ★ 2042 财务自由差额
  // =====================================================
  //
  // 直接使用年度预测中已经计算好的：
  //
  // current.freedomGap
  //
  // 计算逻辑：
  //
  // 2042 财务自由目标
  // -
  // 2042 预计资产
  //
  // 如果预计资产 >= 目标
  // 则为 0。
  //
  // 这样可以确保顶部显示和年度预测
  // 使用完全相同的计算结果。
  // =====================================================

  const freedomGap =
    Number(
      current?.freedomGap || 0
    );


  // =====================================================
  // 保险数据
  // =====================================================
  //
  // 兼容 insurance.ts 当前可能存在的字段。
  // =====================================================

  const totalUnpaidPremium =
    Number(
      insurance?.unpaidPremium ??
      insurance?.unpaid_premium ??
      insurance?.remainingPremium ??
      insurance?.remaining_premium ??
      insurance?.totalUnpaidPremium ??
      insurance?.total_unpaid_premium ??
      0
    );


  // =====================================================
  // 保险总保费
  // =====================================================

  const totalPremium =
    Number(
      insurance?.premiumTotal ??
      insurance?.premium_total ??
      insurance?.totalPremium ??
      insurance?.total_premium ??
      0
    );


  // =====================================================
  // 保险已缴保费
  // =====================================================

  const paidPremium =
    Number(
      insurance?.paidPremium ??
      insurance?.paid_premium ??
      0
    );


  // =====================================================
  // 当前保险现金价值
  // =====================================================

  const insuranceCashValue =
    Number(
      insurance?.cashValue ??
      insurance?.cash_value ??
      0
    );


  // =====================================================
  // 儿子现金价值
  // =====================================================
  //
  // 如果当前 insurance.ts 已经返回：
  //
  // sonCashValue
  //
  // 则直接使用。
  //
  // 同时兼容：
  //
  // son_cash_value
  // =====================================================

  const sonCashValue =
    Number(
      insurance?.sonCashValue ??
      insurance?.son_cash_value ??
      0
    );


  // =====================================================
  // 保险保单数量
  // =====================================================

  const insuranceCount =
    Number(
      insurance?.count ??
      insurance?.policyCount ??
      insurance?.policy_count ??
      0
    );


  // =====================================================
  // =====================================================
  // ★ 天天向上 1
  // =====================================================
  //
  // 定义：
  //
  // 财务自由差额
  // +
  // 未来还要交的总保费
  //
  // =====================================================

  const tiantianUp1 =
    freedomGap
    +
    totalUnpaidPremium;


  // =====================================================
  // =====================================================
  // ★ 天天向上 2
  // =====================================================
  //
  // 定义：
  //
  // 财务自由差额
  // +
  // 夫妻未来总保费
  // -
  // 儿子今年现金价值
  //
  // =====================================================

  const tiantianUp2 =
    freedomGap
    +
    totalUnpaidPremium
    -
    sonCashValue;


  // =====================================================
  // 页面开始
  // =====================================================

  return (

    <>

      <TopBar
        title="Financial Freedom"
      />


      <main
        className="
          max-w-[1400px]
          mx-auto
          p-8
          space-y-8
        "
      >


        {/* =================================================
            页面标题
            ================================================= */}

        <div>

          <h1
            className="
              text-3xl
              font-bold
              text-gray-900
            "
          >

            🚀 Financial Freedom

          </h1>


          <p
            className="
              mt-2
              text-gray-500
            "
          >

            财务自由进度、家庭净资产与 2042 年退休规划

          </p>

        </div>


        {/* =================================================
            顶部核心指标
            ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            xl:grid-cols-4
            gap-6
          "
        >


          {/* =============================================
              1. 当前家庭资产
              ============================================= */}

          <div
            className="
              bg-white
              border
              border-gray-100
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <div
              className="
                text-gray-500
                text-sm
              "
            >

              当前家庭净资产

            </div>


            <div
              className="
                text-3xl
                font-bold
                mt-3
                text-gray-900
              "
            >

              {
                money(
                  currentFamilyAsset
                )
              }

            </div>


            <div
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              Dashboard Total Wealth − Financial Freedom贷款

            </div>

          </div>


          {/* =============================================
              2. 2042 财务自由差额
              ============================================= */}

          <div
            className="
              bg-white
              border
              border-gray-100
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <div
              className="
                text-gray-500
                text-sm
              "
            >

              2042 财务自由差额

            </div>


            <div
              className="
                text-3xl
                font-bold
                mt-3
                text-blue-700
              "
            >

              {
                money(
                  freedomGap
                )
              }

            </div>


            <div
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              2042 财务自由目标 − 2042 预计资产

            </div>

          </div>


          {/* =============================================
              3. 天天向上1
              ============================================= */}

          <div
            className="
              bg-white
              border
              border-gray-100
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <div
              className="
                text-gray-500
                text-sm
              "
            >

              🚀 天天向上1

            </div>


            <div
              className="
                text-3xl
                font-bold
                mt-3
                text-purple-700
              "
            >

              {
                money(
                  tiantianUp1
                )
              }

            </div>


            <div
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              财务自由差额 + 未来总保费

            </div>

          </div>


          {/* =============================================
              4. 天天向上2
              ============================================= */}

          <div
            className="
              bg-white
              border
              border-gray-100
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <div
              className="
                text-gray-500
                text-sm
              "
            >

              🚀 天天向上2

            </div>


            <div
              className="
                text-3xl
                font-bold
                mt-3
                text-green-700
              "
            >

              {
                money(
                  tiantianUp2
                )
              }

            </div>


            <div
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              财务自由差额 + 夫妻保费 − 儿子现金价值

            </div>

          </div>


        </section>


        {/* =================================================
            当前资产计算说明
            ================================================= */}

        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-2xl
            p-6
            shadow-sm
          "
        >

          <h2
            className="
              text-lg
              font-bold
              text-gray-900
            "
          >

            💰 当前家庭资产计算

          </h2>


          <div
            className="
              mt-5
              grid
              grid-cols-1
              md:grid-cols-3
              gap-4
            "
          >


            {/* Dashboard Total Wealth */}

            <div
              className="
                rounded-xl
                bg-blue-50
                p-5
              "
            >

              <div
                className="
                  text-sm
                  text-gray-500
                "
              >

                Dashboard Total Wealth

              </div>


              <div
                className="
                  text-2xl
                  font-bold
                  mt-2
                  text-blue-800
                "
              >

                {
                  money(
                    dashboardTotalWealth
                  )
                }

              </div>

            </div>


            {/* 固收 */}

            <div
              className="
                rounded-xl
                bg-indigo-50
                p-5
              "
            >

              <div
                className="
                  text-sm
                  text-gray-500
                "
              >

                其中固收资产

              </div>


              <div
                className="
                  text-2xl
                  font-bold
                  mt-2
                  text-indigo-800
                "
              >

                {
                  money(
                    fixedIncomeTotal
                  )
                }

              </div>


              <div
                className="
                  text-xs
                  text-gray-400
                  mt-2
                "
              >

                已包含在 Dashboard Total Wealth

              </div>

            </div>


            {/* 贷款 */}

            <div
              className="
                rounded-xl
                bg-red-50
                p-5
              "
            >

              <div
                className="
                  text-sm
                  text-gray-500
                "
              >

                Financial Freedom贷款

              </div>


              <div
                className="
                  text-2xl
                  font-bold
                  mt-2
                  text-red-700
                "
              >

                − {
                  money(
                    financialFreedomLoan
                  )
                }

              </div>

            </div>

          </div>


          {/* 最终净资产 */}

          <div
            className="
              mt-5
              rounded-xl
              bg-green-50
              border
              border-green-100
              p-5
            "
          >

            <div
              className="
                flex
                flex-col
                md:flex-row
                md:items-center
                md:justify-between
                gap-3
              "
            >

              <div>

                <div
                  className="
                    text-sm
                    text-gray-500
                  "
                >

                  当前家庭净资产

                </div>


                <div
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >

                  Total Wealth − Financial Freedom贷款

                </div>

              </div>


              <div
                className="
                  text-3xl
                  font-bold
                  text-green-700
                "
              >

                {
                  money(
                    currentFamilyAsset
                  )
                }

              </div>

            </div>

          </div>

        </section>

                {/* =================================================
            年度现金流预测
            ================================================= */}

        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-2xl
            p-6
            shadow-sm
            overflow-auto
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              gap-4
              mb-5
            "
          >

            <div>

              <h2
                className="
                  text-xl
                  font-bold
                  text-gray-900
                "
              >

                📊 年度现金流预测

              </h2>


              <p
                className="
                  text-sm
                  text-gray-400
                  mt-2
                "
              >

                2027–2042 年家庭资产变化预测

              </p>

            </div>

          </div>


          <table
            className="
              w-full
              text-sm
              min-w-[1100px]
            "
          >

            <thead>

              <tr
                className="
                  border-b
                  border-gray-200
                  text-gray-500
                "
              >

                <th
                  className="
                    p-3
                    text-left
                    font-medium
                  "
                >
                  年份
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  年末资产
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  年收入
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  生活费
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  年金
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  贷款压力
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  投资收益
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  年度现金流
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  财务自由目标
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  财务自由差额
                </th>

              </tr>

            </thead>


            <tbody>

              {
                rows.map(
                  (
                    row: any
                  ) => {

                    const rowFreedomGap =
                      Number(
                        row?.freedomGap || 0
                      );


                    return (

                      <tr
                        key={
                          row.year
                        }
                        className="
                          border-b
                          border-gray-100
                          hover:bg-gray-50
                        "
                      >

                        {/* 年份 */}

                        <td
                          className="
                            p-3
                            font-semibold
                            text-gray-700
                          "
                        >

                          {row.year}

                        </td>


                        {/* 年末资产 */}

                        <td
                          className="
                            p-3
                            text-right
                            font-bold
                            text-gray-900
                          "
                        >

                          {
                            money(
                              row.asset
                            )
                          }

                        </td>


                        {/* 年收入 */}

                        <td
                          className="
                            p-3
                            text-right
                          "
                        >

                          {
                            money(
                              row.income
                            )
                          }

                        </td>


                        {/* 生活费 */}

                        <td
                          className="
                            p-3
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
                            p-3
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
                            p-3
                            text-right
                          "
                        >

                          {
                            Number(
                              row.loan || 0
                            ) > 0
                              ? money(
                                  row.loan
                                )
                              : "-"
                          }

                        </td>


                        {/* 投资收益 */}

                        <td
                          className="
                            p-3
                            text-right
                            text-green-700
                          "
                        >

                          {
                            money(
                              row.investmentReturn
                            )
                          }

                        </td>


                        {/* 年度现金流 */}

                        <td
                          className={`
                            p-3
                            text-right
                            font-medium
                            ${
                              Number(
                                row.cashFlow || 0
                              ) >= 0
                                ? "text-green-700"
                                : "text-red-600"
                            }
                          `}
                        >

                          {
                            money(
                              row.cashFlow
                            )
                          }

                        </td>


                        {/* 财务自由目标 */}

                        <td
                          className="
                            p-3
                            text-right
                            text-blue-700
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
                            p-3
                            text-right
                            font-bold
                            ${
                              rowFreedomGap > 0
                                ? "text-orange-600"
                                : "text-green-600"
                            }
                          `}
                        >

                          {
                            rowFreedomGap > 0
                              ? money(
                                  rowFreedomGap
                                )
                              : "已达成"
                          }

                        </td>

                      </tr>

                    );

                  }
                )
              }

            </tbody>

          </table>


          {/* =================================================
              计算说明
              ================================================= */}

          <div
            className="
              mt-5
              rounded-xl
              bg-blue-50
              border
              border-blue-100
              p-5
              text-sm
              text-blue-800
              leading-7
            "
          >

            <p>

              <b>
                年度资产计算：
              </b>

            </p>


            <p>

              年末资产 = 年初资产 + 投资收益 + 年度现金流

            </p>


            <p>

              投资收益 = 年初资产 × 5%

            </p>


            <p>

              年度现金流 = 年收入 − 生活费 − 年金 − 贷款压力

            </p>


            <p>

              财务自由目标 = 当年生活费 × 25

            </p>


            <p>

              财务自由差额 = max(财务自由目标 − 年末资产, 0)

            </p>

          </div>

        </section>


        {/* =================================================
            Financial Freedom 贷款
            ================================================= */}

        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-2xl
            p-6
            shadow-sm
          "
        >

          <h2
            className="
              text-xl
              font-bold
              text-gray-900
              mb-4
            "
          >

            💳 Financial Freedom 已关联贷款

          </h2>


          <p
            className="
              text-gray-500
              leading-7
            "
          >

            勾选「计入 Financial Freedom」的贷款，
            会自动计入当前家庭净资产与未来年度现金流预测。

          </p>


          <div
            className="
              mt-5
              grid
              grid-cols-1
              md:grid-cols-2
              gap-4
            "
          >


            {/* 房贷 */}

            <div
              className="
                rounded-xl
                bg-gray-50
                border
                border-gray-100
                p-5
              "
            >

              <div
                className="
                  font-semibold
                  text-gray-800
                "
              >

                🏠 房贷

              </div>


              <div
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >

                按月供 × 12 计算年度贷款压力。

              </div>

            </div>


            {/* 信用卡分期 */}

            <div
              className="
                rounded-xl
                bg-gray-50
                border
                border-gray-100
                p-5
              "
            >

              <div
                className="
                  font-semibold
                  text-gray-800
                "
              >

                💳 信用卡分期

              </div>


              <div
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >

                按月供 × 12 计算年度贷款压力。

              </div>

            </div>


            {/* 保险贷款 */}

            <div
              className="
                rounded-xl
                bg-gray-50
                border
                border-gray-100
                p-5
              "
            >

              <div
                className="
                  font-semibold
                  text-gray-800
                "
              >

                🛡️ 保险贷款

              </div>


              <div
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >

                根据贷款开始日期计算年度压力及累计利息。

              </div>

            </div>


            {/* 银行信用贷 */}

            <div
              className="
                rounded-xl
                bg-gray-50
                border
                border-gray-100
                p-5
              "
            >

              <div
                className="
                  font-semibold
                  text-gray-800
                "
              >

                🏦 银行信用贷

              </div>


              <div
                className="
                  text-sm
                  text-gray-500
                  mt-2
                "
              >

                后续可以继续增加利息及还款模型。

              </div>

            </div>

          </div>


          {/* =================================================
              当前贷款余额
              ================================================= */}

          <div
            className="
              mt-5
              rounded-xl
              bg-red-50
              border
              border-red-100
              p-5
            "
          >

            <div
              className="
                flex
                items-center
                justify-between
                gap-4
              "
            >

              <div>

                <div
                  className="
                    text-sm
                    text-gray-500
                  "
                >

                  当前 Financial Freedom 贷款余额

                </div>


                <div
                  className="
                    text-xs
                    text-gray-400
                    mt-1
                  "
                >

                  已从当前家庭净资产中扣除

                </div>

              </div>


              <div
                className="
                  text-2xl
                  font-bold
                  text-red-700
                "
              >

                − {
                  money(
                    financialFreedomLoan
                  )
                }

              </div>

            </div>

          </div>

        </section>

                {/* =================================================
            当前家庭资产构成
            ================================================= */}

        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-2xl
            p-6
            shadow-sm
          "
        >

          <h2
            className="
              text-xl
              font-bold
              text-gray-900
              mb-5
            "
          >

            💰 当前家庭资产构成

          </h2>


          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              xl:grid-cols-4
              gap-4
            "
          >

            {/* =================================================
                Dashboard 原始资产
                ================================================= */}

            <div
              className="
                rounded-xl
                bg-gray-50
                border
                border-gray-100
                p-5
              "
            >

              <div
                className="
                  text-sm
                  text-gray-500
                "
              >

                Dashboard 原始资产

              </div>


              <div
                className="
                  text-2xl
                  font-bold
                  mt-2
                  text-gray-900
                "
              >

                {
                  money(
                    dashboardTotalWealth -
                    fixedIncomeTotal
                  )
                }

              </div>


              <div
                className="
                  text-xs
                  text-gray-400
                  mt-2
                "
              >

                asset_history.total_asset

              </div>

            </div>


            {/* =================================================
                固收资产
                ================================================= */}

            <div
              className="
                rounded-xl
                bg-blue-50
                border
                border-blue-100
                p-5
              "
            >

              <div
                className="
                  text-sm
                  text-gray-500
                "
              >

                固收资产

              </div>


              <div
                className="
                  text-2xl
                  font-bold
                  mt-2
                  text-blue-700
                "
              >

                {
                  money(
                    fixedIncomeTotal
                  )
                }

              </div>


              <div
                className="
                  text-xs
                  text-gray-400
                  mt-2
                "
              >

                fixed_income_assets

              </div>

            </div>


            {/* =================================================
                Dashboard Total Wealth
                ================================================= */}

            <div
              className="
                rounded-xl
                bg-indigo-50
                border
                border-indigo-100
                p-5
              "
            >

              <div
                className="
                  text-sm
                  text-gray-500
                "
              >

                Dashboard Total Wealth

              </div>


              <div
                className="
                  text-2xl
                  font-bold
                  mt-2
                  text-indigo-700
                "
              >

                {
                  money(
                    dashboardTotalWealth
                  )
                }

              </div>


              <div
                className="
                  text-xs
                  text-gray-400
                  mt-2
                "
              >

                原始资产 + 固收

              </div>

            </div>


            {/* =================================================
                Financial Freedom 贷款
                ================================================= */}

            <div
              className="
                rounded-xl
                bg-red-50
                border
                border-red-100
                p-5
              "
            >

              <div
                className="
                  text-sm
                  text-gray-500
                "
              >

                Financial Freedom贷款

              </div>


              <div
                className="
                  text-2xl
                  font-bold
                  mt-2
                  text-red-700
                "
              >

                − {
                  money(
                    financialFreedomLoan
                  )
                }

              </div>


              <div
                className="
                  text-xs
                  text-gray-400
                  mt-2
                "
              >

                当前负债

              </div>

            </div>

          </div>


          {/* =================================================
              当前家庭净资产
              ================================================= */}

          <div
            className="
              mt-5
              rounded-2xl
              bg-green-50
              border
              border-green-100
              p-6
            "
          >

            <div
              className="
                flex
                flex-col
                md:flex-row
                md:items-center
                md:justify-between
                gap-4
              "
            >

              <div>

                <div
                  className="
                    text-sm
                    text-gray-500
                  "
                >

                  当前家庭净资产

                </div>


                <div
                  className="
                    text-xs
                    text-gray-400
                    mt-2
                  "
                >

                  Dashboard Total Wealth − Financial Freedom贷款

                </div>

              </div>


              <div
                className="
                  text-3xl
                  font-bold
                  text-green-700
                "
              >

                {
                  money(
                    currentFamilyAsset
                  )
                }

              </div>

            </div>

          </div>


          {/* =================================================
              资产统计规则
              ================================================= */}

          <div
            className="
              mt-5
              rounded-xl
              bg-blue-50
              border
              border-blue-100
              p-5
              text-sm
              text-blue-800
              leading-7
            "
          >

            <p>

              <b>
                资产统计规则：
              </b>

            </p>


            <p>

              • Dashboard 原始资产 =
              asset_history.total_asset。

            </p>


            <p>

              • 固收资产 =
              fixed_income_assets.amount 合计。

            </p>


            <p>

              • Dashboard Total Wealth =
              Dashboard 原始资产 + 固收资产。

            </p>


            <p>

              • 当前家庭净资产 =
              Dashboard Total Wealth − Financial Freedom贷款。

            </p>


            <p>

              • 保险现金价值不重复加入当前家庭净资产。

            </p>

          </div>

        </section>


        {/* =================================================
            2042 财务自由结果
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
              2042 财务自由目标
              ================================================= */}

          <div
            className="
              bg-white
              border
              border-gray-100
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <h3
              className="
                font-bold
                text-xl
                text-gray-900
              "
            >

              🎯 2042 财务自由目标

            </h3>


            <div
              className="
                text-3xl
                font-bold
                mt-4
                text-blue-700
              "
            >

              {
                money(
                  freedomTarget
                )
              }

            </div>


            <p
              className="
                text-sm
                text-gray-500
                mt-3
              "
            >

              2042 年生活费 × 25

            </p>


            <div
              className="
                mt-4
                pt-4
                border-t
                border-gray-100
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                "
              >

                <span
                  className="
                    text-sm
                    text-gray-500
                  "
                >

                  2042 年生活费

                </span>


                <span
                  className="
                    font-bold
                    text-gray-900
                  "
                >

                  {
                    money(
                      Number(
                        current.expense || 0
                      )
                    )
                  }

                </span>

              </div>

            </div>

          </div>


          {/* =================================================
              2042 预计资产
              ================================================= */}

          <div
            className="
              bg-white
              border
              border-gray-100
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <h3
              className="
                font-bold
                text-xl
                text-gray-900
              "
            >

              🚀 2042 预计资产

            </h3>


            <div
              className="
                text-3xl
                font-bold
                mt-4
                text-green-700
              "
            >

              {
                money(
                  projectedAsset
                )
              }

            </div>


            <p
              className="
                text-sm
                text-gray-500
                mt-3
              "
            >

              从当前家庭净资产开始，
              按 5% 年投资收益率进行预测

            </p>


            <div
              className="
                mt-4
                pt-4
                border-t
                border-gray-100
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                "
              >

                <span
                  className="
                    text-sm
                    text-gray-500
                  "
                >

                  2042 财务自由差额

                </span>


                <span
                  className={`
                    font-bold
                    ${
                      freedomGap > 0
                        ? "text-orange-600"
                        : "text-green-600"
                    }
                  `}
                >

                  {
                    freedomGap > 0
                      ? money(
                          freedomGap
                        )
                      : "已达成"
                  }

                </span>

              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            退休计划
            ================================================= */}

        <section
          className="
            bg-white
            border
            border-gray-100
            rounded-2xl
            p-6
            shadow-sm
          "
        >

          <div
            className="
              flex
              flex-col
              md:flex-row
              md:items-center
              md:justify-between
              gap-6
            "
          >

            <div>

              <h3
                className="
                  font-bold
                  text-xl
                  text-gray-900
                "
              >

                🎂 退休计划

              </h3>


              <p
                className="
                  text-gray-500
                  mt-2
                "
              >

                目标退休年份：2042

              </p>


              <p
                className="
                  text-sm
                  text-gray-400
                  mt-2
                "
              >

                退休年龄：{RETIREMENT_AGE} 岁

              </p>

            </div>


            <div
              className="
                text-right
              "
            >

              <div
                className="
                  text-5xl
                  font-bold
                  text-gray-900
                "
              >

                {
                  RETIREMENT_AGE
                }

                <span
                  className="
                    text-xl
                    ml-2
                    font-medium
                  "
                >

                  岁

                </span>

              </div>

            </div>

          </div>


          {/* =================================================
              退休状态
              ================================================= */}

          <div
            className="
              mt-6
              rounded-xl
              p-5
              border
              border-gray-100
              bg-gray-50
            "
          >

            <div
              className="
                flex
                flex-col
                md:flex-row
                md:items-center
                md:justify-between
                gap-4
              "
            >

              <div>

                <div
                  className="
                    text-sm
                    text-gray-500
                  "
                >

                  2042 财务自由状态

                </div>


                <div
                  className="
                    text-lg
                    font-bold
                    mt-1
                  "
                >

                  {
                    freedomGap > 0
                      ? "距离财务自由仍有资金缺口"
                      : "🎉 已达到财务自由目标"
                  }

                </div>

              </div>


              <div
                className={`
                  text-xl
                  font-bold
                  ${
                    freedomGap > 0
                      ? "text-orange-600"
                      : "text-green-600"
                  }
                `}
              >

                {
                  freedomGap > 0
                    ? money(
                        freedomGap
                      )
                    : "目标已达成"
                }

              </div>

            </div>

          </div>

        </section>


        {/* =================================================
            页面结束
            ================================================= */}

      </main>

    </>

  );

}