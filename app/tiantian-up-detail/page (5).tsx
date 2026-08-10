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
  getFinancialFreedomLoans,
} from "@/lib/loan";


// =====================================================
// 财务自由目标
// =====================================================

const START_YEAR = 2027;
const END_YEAR = 2042;

const expenseForecast = [
  370000,
  370000,
  370000,
  370000,
  370000,

  320000,
  320000,
  320000,
  320000,
  320000,
  320000,
  320000,
  320000,
  320000,
  320000,
];


// =====================================================
// 数字
// =====================================================

function toNumber(value: any): number {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}


// =====================================================
// 金额
// =====================================================

function money(value: number) {

  const n = toNumber(value);

  if (n >= 100000000) {

    return (
      "¥" +
      (n / 100000000).toFixed(2) +
      " 亿"
    );

  }

  if (n >= 10000) {

    return (
      "¥" +
      (n / 10000).toFixed(1) +
      " 万"
    );

  }

  return (
    "¥" +
    Math.round(n).toLocaleString("zh-CN")
  );

}


// =====================================================
// 百分比
// =====================================================

function percent(value: number) {

  return (
    toNumber(value).toFixed(1) +
    "%"
  );

}


// =====================================================
// 页面
// =====================================================

export default function TiantianUpDetailPage() {

  // ===================================================
  // 当前 Dashboard Total Wealth
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
  // 当前家庭资产
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
  // Loading
  // ===================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  // =====================================================
  // 财务自由目标
  // =====================================================

  const freedomTarget = useMemo(
    () => {

      return expenseForecast.reduce(
        (
          sum,
          value
        ) => {

          return sum + value;

        },
        0
      );

    },
    []
  );


  // =====================================================
  // 加载
  // =====================================================

  useEffect(() => {

    async function load() {

      try {

        setLoading(true);


        // =================================================
        // 1. Dashboard Total Wealth
        //
        // 这里明确使用：
        //
        // asset_history.total_asset
        //
        // 不直接使用 getTotalWealthWithFixedIncome()
        // 避免 Detail 页和 Tiantian Up 页口径发生变化。
        // =================================================

        const dashboardAsset =
          await getDashboardTotalWealth();


        const totalWealth =
          toNumber(
            dashboardAsset
          );


        // =================================================
        // 2. 当前固收
        //
        // Dashboard Total Wealth
        // +
        // fixed_income_assets
        //
        // 才是天天向上的家庭总资产口径。
        // =================================================

        const fixedIncomeAmount =
          await getFixedIncomeTotal();


        // =================================================
        // 3. Financial Freedom 贷款
        //
        // 只统计：
        //
        // include_in_financial_freedom = true
        //
        // =================================================

        const ffLoans =
          await getFinancialFreedomLoans();


        const loanBalance =
          (
            Array.isArray(ffLoans)
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
        //
        // ★★★ 最重要 ★★★
        //
        // Dashboard Total Wealth
        // +
        // 固收资产
        // -
        // Financial Freedom 贷款
        //
        // 这才与 /tiantian-up 保持一致。
        // =================================================

        const householdAsset =
          totalWealth +
          fixedIncomeAmount -
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


        setInsuranceProjection(
          Array.isArray(projection)
            ? projection
            : []
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
          "Current Household Asset:",
          householdAsset
        );

        console.log(
          "Freedom Target:",
          freedomTarget
        );

        console.log(
          "Expected Freedom Gap:",
          Math.max(
            freedomTarget -
            householdAsset,
            0
          )
        );

        console.log(
          "Insurance:",
          insuranceData
        );

        console.log(
          "Insurance Projection:",
          projection
        );

        console.log(
          "========================================"
        );

      }
      catch (error) {

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
    freedomTarget,
  ]);


  // =====================================================
  // 财务自由差额
  // =====================================================

  const freedomGap =
    Math.max(
      freedomTarget -
      currentAsset,
      0
    );


  // =====================================================
  // 全部未缴保费
  // =====================================================

  const unpaidPremium =
    toNumber(
      insurance?.unpaidPremium
    );


  // =====================================================
  // 夫妻未缴保费
  // =====================================================

  const coupleUnpaidPremium =
    toNumber(
      insurance?.coupleUnpaidPremium
    );


  // =====================================================
  // 儿子现金价值
  // =====================================================

  const sonCashValue =
    toNumber(
      insurance?.sonCashValue
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
  // 财务自由差额
  // +
  // 全部未缴保费
  // =====================================================

  const tiantian1 =
    freedomGap +
    unpaidPremium;


  // =====================================================
  // 天天向上2
  //
  // 财务自由差额
  // +
  // 夫妻未缴保费
  // -
  // 儿子现金价值
  // =====================================================

  const tiantian2 =
    freedomGap +
    coupleMinusSon;


  // =====================================================
  // 年度详情
  //
  // 这里不改变当前 Tiantian Up 的核心口径。
  // =====================================================

  const yearlyRows =
    useMemo(
      () => {

        const rows: any[] = [];


        for (
          let year = START_YEAR;
          year <= END_YEAR;
          year++
        ) {

          const index =
            year -
            START_YEAR;


          const expense =
            expenseForecast[
              index
            ] ?? 0;


          const projection =
            insuranceProjection.find(
              (
                item: any
              ) =>
                Number(
                  item?.year
                ) === year
            );


          const totalFuturePremium =
            toNumber(
              projection?.totalFuturePremium
            );


          const coupleFuturePremium =
            toNumber(
              projection?.coupleFuturePremium
            );


          const sonFutureCashValue =
            toNumber(
              projection?.sonCashValue
            );


          const yearTiantian1 =
            expense +
            totalFuturePremium;


          const yearTiantian2 =
            expense +
            coupleFuturePremium -
            sonFutureCashValue;


          rows.push({

            year,

            expense,

            totalFuturePremium,

            coupleFuturePremium,

            sonFutureCashValue,

            yearTiantian1,

            yearTiantian2,

          });

        }


        return rows;

      },
      [
        insuranceProjection,
      ]
    );


  // =====================================================
  // Loading
  // =====================================================

  if (loading) {

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


        {/* =========================================
            标题
            ========================================= */}

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

            财务自由目标 + 保险压力年度分析

          </p>

        </div>


        {/* =========================================
            当前核心结果
            ========================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            gap-6
          "
        >


          {/* =====================================
              天天向上1
              ===================================== */}

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

              财务自由差额 + 全部未缴保费

            </p>

          </div>


          {/* =====================================
              天天向上2
              ===================================== */}

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

              财务自由差额 + 夫妻未来保费 - 儿子现金价值

            </p>

          </div>

        </section>


        {/* =========================================
            当前资产结构
            ========================================= */}

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

              只统计 Loan 中勾选「计入 Financial Freedom」的贷款

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

              Dashboard Total Wealth + 固收 − Financial Freedom贷款

            </p>

          </div>

        </section>


        {/* =========================================
            财务自由
            ========================================= */}

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

              财务自由目标

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
                  freedomTarget
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

              2027–2041 生活费用目标

            </p>

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
                  freedomGap
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

              财务自由目标 − 当前家庭净资产

            </p>

          </div>


          {/* 未缴保费 */}

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


        {/* =========================================
            保险
            ========================================= */}

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

              夫妻保费 - 儿子现金价值

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


        {/* =========================================
            计算公式
            ========================================= */}

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
              +
              固收资产
              −
              Financial Freedom 贷款

            </p>


            <p>

              <b>
                财务自由差额
              </b>
              =
              max(
              财务自由目标 − 当前家庭净资产,
              0
              )

            </p>


            <p>

              <b>
                天天向上1
              </b>
              =
              财务自由差额
              +
              全部未缴保费

            </p>


            <p>

              <b>
                天天向上2
              </b>
              =
              财务自由差额
              +
              夫妻未缴保费
              −
              儿子现金价值

            </p>

          </div>

        </section>


        {/* =========================================
            年度详情
            ========================================= */}

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

              📊 2027–2042 天天向上年度预测

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-1
              "
            >

              根据保险年度计划计算未来保费压力

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
                      px-5
                      py-4
                      text-left
                    "
                  >
                    年份
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                    "
                  >
                    生活费用
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                    "
                  >
                    全部未来保费
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                    "
                  >
                    夫妻未来保费
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                    "
                  >
                    儿子现金价值
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                    "
                  >
                    天天向上1
                  </th>

                  <th
                    className="
                      px-5
                      py-4
                      text-right
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

                        <td
                          className="
                            px-5
                            py-4
                            font-semibold
                          "
                        >

                          {row.year}

                        </td>


                        <td
                          className="
                            px-5
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


                        <td
                          className="
                            px-5
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


                        <td
                          className="
                            px-5
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


                        <td
                          className="
                            px-5
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


                        <td
                          className="
                            px-5
                            py-4
                            text-right
                            font-semibold
                            text-blue-700
                          "
                        >

                          {
                            money(
                              row.yearTiantian1
                            )
                          }

                        </td>


                        <td
                          className="
                            px-5
                            py-4
                            text-right
                            font-semibold
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


      </main>

    </>

  );

}