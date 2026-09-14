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

const CURRENT_YEAR = new Date().getFullYear();

const START_YEAR = Math.max(CURRENT_YEAR, 2026);

const END_YEAR = 2042;

const FREEDOM_END_YEAR = 2042;

const RETURN_RATE = 0.05;

const ANNUAL_INCOME = 1100000;

const START_ASSET = 1600000;


// =====================================================
// 生活费用
// =====================================================
//
// 默认回退生活费：2027 - 2031：37万
// 默认回退生活费：2032 - 2042：32万
//
// 财务自由目标：
// 从当年开始到 2042 年所有剩余生活费。
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
  2042: 320000,

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
  2042: 39000,

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
// = 2027~2042 所有生活费
//
// 2028
// = 2028~2041 所有生活费
//
// ...
//
// 2041
// = 2041 年生活费
// =====================================================

type ForecastInput = {
  expense: number;
  growthRate: number;
  hkInvestment: number;
  remainingCash: number;
};

type ForecastInputs = Record<number, ForecastInput>;


const DEFAULT_FORECAST_INPUTS: ForecastInputs = {
  2026: { expense: 0, growthRate: 5, hkInvestment: 0, remainingCash: 0 },
  2027: { expense: 37, growthRate: 5, hkInvestment: 6, remainingCash: -5.4 },
  2028: { expense: 37, growthRate: 5, hkInvestment: 6, remainingCash: 5.6 },
  2029: { expense: 37, growthRate: 5, hkInvestment: 6, remainingCash: 5.6 },
  2030: { expense: 37, growthRate: 5, hkInvestment: 6, remainingCash: 5.6 },
  2031: { expense: 37, growthRate: 5, hkInvestment: 6, remainingCash: 5.6 },
  2032: { expense: 32, growthRate: 5, hkInvestment: 6, remainingCash: 10.6 },
  2033: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 30.9 },
  2034: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 40.1 },
  2035: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 40.1 },
  2036: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 40.1 },
  2037: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 40.1 },
  2038: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 53.1 },
  2039: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 62.1 },
  2040: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 62.1 },
  2041: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 62.1 },
  2042: { expense: 32, growthRate: 5, hkInvestment: 12, remainingCash: 62.1 },
};

function getDefaultForecastInputs(): ForecastInputs {
  const result: ForecastInputs = {};
  for (let year = 2026; year <= FREEDOM_END_YEAR; year++) {
    result[year] = {
      ...(DEFAULT_FORECAST_INPUTS[year] ?? {
        expense: Number(BASE_EXPENSE[year] ?? 0) / 10000,
        growthRate: 5,
        hkInvestment: 0,
        remainingCash: 0,
      }),
    };
  }
  return result;
}

// Financial Freedom 的 forecast_inputs 永远以“万元”保存。
// Tiantian 页面内部金额全部以“元”计算，因此只在这里统一转换。
function getForecastExpenseYuan(
  year: number,
  forecastInputs: ForecastInputs
): number {
  const expenseWan = Number(
    forecastInputs[year]?.expense ??
    Number(BASE_EXPENSE[year] ?? 0) / 10000
  );

  return Number.isFinite(expenseWan)
    ? expenseWan * 10000
    : 0;
}


function getFinancialFreedomTarget(
  startYear: number,
  forecastInputs: ForecastInputs
): number {
  let target = 0;

  for (let year = startYear; year <= FREEDOM_END_YEAR; year++) {
    target += getForecastExpenseYuan(year, forecastInputs);
  }

  return target;
}

// =====================================================
// 金额格式
// =====================================================

// =====================================================
// 金额格式
// =====================================================

function money(
  value: number
): string {

  const n =
    toNumber(value);


  // ===================================================
  // 负数处理
  //
  // 例如：
  // -413000
  // → -¥41.3 万
  //
  // -123000000
  // → -¥1.23 亿
  // ===================================================

  const negative =
    n < 0;

  const abs =
    Math.abs(n);


  // ===================================================
  // 亿
  // ===================================================

  if (
    abs >= 100000000
  ) {

    return (
      (negative ? "-" : "") +
      "¥" +
      (
        abs /
        100000000
      ).toFixed(2) +
      " 亿"
    );

  }


  // ===================================================
  // 万
  // ===================================================

  if (
    abs >= 10000
  ) {

    return (
      (negative ? "-" : "") +
      "¥" +
      (
        abs /
        10000
      ).toFixed(1) +
      " 万"
    );

  }


  // ===================================================
  // 普通金额
  // ===================================================

  return (
    (negative ? "-" : "") +
    "¥" +
    Math.round(abs)
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


  // ===================================================
  // Financial Freedom 年度输入
  // 与 /financial-freedom 共用 Supabase 中的 forecast_inputs
  // ===================================================

  const [
    forecastInputs,
    setForecastInputs,
  ] = useState<ForecastInputs>(
    () => getDefaultForecastInputs()
  );


  // =====================================================
  // 当前财务自由目标
  // =====================================================

  const currentFreedomTarget =
    useMemo(
      () =>
        getFinancialFreedomTarget(
          START_YEAR,
          forecastInputs
        ),
      [forecastInputs]
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
        // 0. 读取 Financial Freedom 年度输入
        //
        // /financial-freedom 会把可编辑年度数据保存到：
        // financial_freedom_history.forecast_inputs
        //
        // Tiantian Up Detail 不再维护第二套生活费数据，
        // 财务自由目标直接使用这里的同一份数据。
        // =================================================

        const {
          data: forecastHistory,
          error: forecastHistoryError,
        } = await supabase
          .from("financial_freedom_history")
          .select("forecast_inputs, snapshot_date, created_at")
          .not("forecast_inputs", "is", null)
          .order("created_at", { ascending: false })
          .order("snapshot_date", { ascending: false })
          .limit(1);

        if (forecastHistoryError) {
          console.error(
            "Tiantian Detail forecast inputs error:",
            forecastHistoryError
          );
        }

        let savedForecastInputs =
          forecastHistory?.[0]?.forecast_inputs;

        // 同一浏览器内，如果 Financial Freedom 刚刚修改过，优先读取本地最新编辑值。
        // 这样即使 Supabase 网络保存稍有延迟，两个页面也会立即保持一致。
        try {
          const localValue = window.localStorage.getItem(
            "financial_freedom_forecast_inputs_v1"
          );
          if (localValue) {
            const parsed = JSON.parse(localValue);
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              savedForecastInputs = parsed;
            }
          }
        } catch (localStorageError) {
          console.warn(
            "Tiantian local forecast inputs read failed:",
            localStorageError
          );
        }

        // 先建立完整默认值，再覆盖保存的值。
        // 这样即使数据库只保存部分年份，也不会让未保存年份变成 0。
        const resolvedForecastInputs =
          getDefaultForecastInputs();

        if (
          savedForecastInputs &&
          typeof savedForecastInputs === "object"
        ) {
          Object.entries(
            savedForecastInputs as Record<string, any>
          ).forEach(([year, value]) => {
            const yearNumber = Number(year);

            if (
              !Number.isFinite(yearNumber) ||
              !value ||
              typeof value !== "object"
            ) {
              return;
            }

            const fallback =
              resolvedForecastInputs[yearNumber] ?? {
                expense: 0,
                growthRate: 5,
                hkInvestment: 0,
                remainingCash: 0,
              };

            resolvedForecastInputs[yearNumber] = {
              expense: Number.isFinite(Number(value.expense))
                ? Number(value.expense)
                : fallback.expense,
              growthRate: Number.isFinite(Number(value.growthRate))
                ? Number(value.growthRate)
                : fallback.growthRate,
              hkInvestment: Number.isFinite(Number(value.hkInvestment))
                ? Number(value.hkInvestment)
                : fallback.hkInvestment,
              remainingCash: Number.isFinite(Number(value.remainingCash))
                ? Number(value.remainingCash)
                : fallback.remainingCash,
            };
          });
        }

        setForecastInputs(resolvedForecastInputs);


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
        // include_financial_freedom = true
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
        //
        // ★ 与 /financial-freedom 使用完全相同的资产模型 ★
        //
        // 年末资产 = 年初资产 × (1 + growthRate)
        //          + (香港投资 + 当年剩余现金) × 10000
        //
        // 注意：生活费、年金、贷款不会再次从资产中扣除。
        // Financial Freedom 页面本身也不是这样计算年末资产的。
        // =================================================

        const activeForecastInputs = resolvedForecastInputs;
        let simulationAsset = netAsset;
        const result: any[] = [];

        for (let year = START_YEAR; year <= END_YEAR; year++) {
          const input =
            activeForecastInputs[year] ??
            getDefaultForecastInputs()[year];

          const expenseWan = toNumber(input?.expense);
          const growthRate = toNumber(input?.growthRate);
          const hkInvestment = toNumber(input?.hkInvestment);
          const remainingCash = toNumber(input?.remainingCash);
          const newAsset = hkInvestment + remainingCash;

          const isCurrentBaseYear =
            year === CURRENT_YEAR &&
            year === START_YEAR;

          const beginAsset = simulationAsset;
          const investmentReturn = isCurrentBaseYear
            ? 0
            : beginAsset * growthRate / 100;

          const totalAsset = isCurrentBaseYear
            ? beginAsset
            : beginAsset + investmentReturn + newAsset * 10000;

          simulationAsset = totalAsset;

          const expense = expenseWan * 10000;
          const freedomTarget =
            getFinancialFreedomTarget(year, activeForecastInputs);
          const rawFreedomGap = freedomTarget - totalAsset;
          const freedomGap = Math.max(0, rawFreedomGap);

          const remainingYears = END_YEAR - year + 1;

          const insuranceYear = safeProjection.find(
            (item: any) => Number(item?.year) === year
          );

          const totalFuturePremium = toNumber(
            insuranceYear?.totalFuturePremium
          );
          const coupleFuturePremium = toNumber(
            insuranceYear?.coupleFuturePremium
          );
          const sonFutureCashValue = toNumber(
            insuranceYear?.sonCashValue
          );

          const yearTiantian1 =
            rawFreedomGap + totalFuturePremium;
          const yearTiantian2 =
            rawFreedomGap + coupleFuturePremium - sonFutureCashValue;

          result.push({
            year,
            remainingYears,
            beginAsset,
            income: 0,
            expense,
            pension: Number(ANNUITY[year] || 0),
            loan: Number(loans[year]?.pressure || 0),
            investmentReturn,
            cashFlow: newAsset * 10000,
            growthRate,
            hkInvestment,
            remainingCash,
            newAsset,
            totalAsset,
            freedomTarget,
            freedomGap,
            rawFreedomGap,
            totalFuturePremium,
            coupleFuturePremium,
            sonFutureCashValue,
            yearTiantian1,
            yearTiantian2,
          });
        }

        setYearlyRows(result);

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
          currentFreedomTarget
        );

        console.log(
          "Current Freedom Gap:",
          Math.max(
            0,
            currentFreedomTarget -
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

            {START_YEAR}–{END_YEAR} 财务自由、资产增长与保险压力年度分析

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

              2027–2042 全部剩余生活费用

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

              = 从当年开始到 2042 年全部剩余生活费

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

              📊 2027–2042 天天向上年度预测

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-1
              "
            >

              年末资产、财务自由目标与 Financial Freedom 使用同一套预测模型

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


                          {/* 全部未来保费 */}

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


                          {/* 夫妻未来保费 */}

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


                          {/* 儿子现金价值 */}

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

              每一年都重新计算「从该年开始到 2042 年剩余生活费」。

            </p>


            <p>

              例如：

              2027 =
              {START_YEAR}–{END_YEAR} 全部生活费；

              2028 =
              2028–2041 全部生活费；

              2042 =
              2042 年生活费。

            </p>


            <p>

              <b>
                财务自由差额(年末)
              </b>

              使用年末预计资产计算，而不是使用当前资产。
              达成财务自由后，页面显示「已达成」。

            </p>


            <p>

              <b>
                天天向上1 / 天天向上2
              </b>

              即使财务自由已经达成，
              仍然继续使用「财务自由目标 − 年末资产」的真实差额。
              因此超过财务自由目标的资产会以负数继续抵减未来保费压力。

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