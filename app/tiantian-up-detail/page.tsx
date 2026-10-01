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

function money(
  value: number
): string {

  const n =
    toNumber(value);

  const negative =
    n < 0;

  const abs =
    Math.abs(n);

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

  return (
    (negative ? "-" : "") +
    "¥" +
    Math.round(abs)
      .toLocaleString(
        "zh-CN"
      )
  );

}

// 正数红色、负数绿色、0 灰色
function amountColor(
  value: number
): string {

  const n =
    toNumber(value);

  if (n > 0) {
    return "text-red-600";
  }

  if (n < 0) {
    return "text-green-600";
  }

  return "text-gray-400";

}


// =====================================================
// 页面
// =====================================================

export default function TiantianUpDetailPage() {


  const [
    currentAsset,
    setCurrentAsset,
  ] = useState(0);


  const [
    dashboardTotalWealth,
    setDashboardTotalWealth,
  ] = useState(0);


  const [
    originalAssetForDisplay,
    setOriginalAssetForDisplay,
  ] = useState(0);


  const [
    fixedIncome,
    setFixedIncome,
  ] = useState(0);


  const [
    financialFreedomLoan,
    setFinancialFreedomLoan,
  ] = useState(0);


  const [
    insurance,
    setInsurance,
  ] = useState<any>(null);


  const [
    insuranceProjection,
    setInsuranceProjection,
  ] = useState<any[]>([]);


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


  const [
    yearlyRows,
    setYearlyRows,
  ] = useState<any[]>([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    forecastInputs,
    setForecastInputs,
  ] = useState<ForecastInputs>(
    () => getDefaultForecastInputs()
  );


  const currentFreedomTarget =
    useMemo(
      () =>
        getFinancialFreedomTarget(
          START_YEAR,
          forecastInputs
        ),
      [forecastInputs]
    );


  const currentFreedomGap =
    Math.max(
      currentFreedomTarget -
      currentAsset,
      0
    );


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


  const coupleUnpaidPremium =
    toNumber(
      insurance?.coupleUnpaidPremium ??
      insurance?.couple_unpaid_premium ??
      0
    );


  const sonCashValue =
    toNumber(
      insurance?.sonCashValue ??
      insurance?.son_cash_value ??
      0
    );


  const coupleMinusSon =
    coupleUnpaidPremium -
    sonCashValue;


  const tiantian1 =
    currentFreedomGap +
    unpaidPremium;


  const tiantian2 =
    currentFreedomGap +
    coupleUnpaidPremium -
    sonCashValue;


  useEffect(() => {

    async function load() {

      try {

        setLoading(true);


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


        const latest =
          await getLatestAsset();


        const originalAsset =
          Number(
            latest?.total_asset
          ) ||
          START_ASSET;


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


        const totalWealth =
          originalAsset +
          fixedIncomeSum;


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


        const netAsset =
          totalWealth -
          loanBalance;


        setDashboardTotalWealth(
          totalWealth
        );

        setOriginalAssetForDisplay(
          originalAsset
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


        const insuranceData =
          await getInsuranceSummary();

        setInsurance(
          insuranceData
        );


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
              text-2xl
              font-bold
              text-gray-900
            "
          >

            🚀 天天向上详情

          </h1>

          <p
            className="
              mt-1
              text-sm
              text-gray-500
            "
          >

            {START_YEAR}–{END_YEAR} 财务自由、资产增长与保险压力年度分析

          </p>

        </div>


        {/* =================================================
            天天向上详情 · 顶部指标总表
            ================================================= */}

        <section className="overflow-x-auto w-fit max-w-full mx-auto">

          <table
            className="
              w-auto
              border-collapse
              text-base
              tabular-nums
              border
              border-gray-300
              bg-white
            "
          >

            <thead>

              <tr className="bg-white text-gray-800">

                <th
                  className="
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-left
                    font-semibold
                    whitespace-nowrap
                  "
                >
                  分类
                </th>

                <th
                  className="
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-left
                    font-semibold
                    whitespace-nowrap
                  "
                >
                  指标
                </th>

                <th
                  className="
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-semibold
                    whitespace-nowrap
                  "
                >
                  金额
                </th>

              </tr>

            </thead>

            <tbody>

              {/* 核心结果 */}

              <tr>

                <td
                  rowSpan={2}
                  className="
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-gray-900
                    font-semibold
                    align-top
                    whitespace-nowrap
                  "
                >
                  核心结果
                </td>

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  天天向上1（当前）
                  <span className="text-gray-400">[当前财务自由差额 + 全部未缴保费]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-bold
                    whitespace-nowrap
                    ${amountColor(tiantian1)}
                  `}
                >
                  {money(tiantian1)}
                </td>

              </tr>

              <tr className="border-b-4 border-black">

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  天天向上2（当前）
                  <span className="text-gray-400">[当前财务自由差额 + 夫妻未缴保费 − 儿子现金价值]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-bold
                    whitespace-nowrap
                    ${amountColor(tiantian2)}
                  `}
                >
                  {money(tiantian2)}
                </td>

              </tr>


              {/* 当前资产结构 */}

              <tr>

                <td
                  rowSpan={3}
                  className="
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-gray-900
                    font-semibold
                    align-top
                    whitespace-nowrap
                  "
                >
                  当前资产结构
                </td>

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  total_asset
                  <span className="text-gray-400">[asset_history.total_asset]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-semibold
                    whitespace-nowrap
                    ${amountColor(originalAssetForDisplay)}
                  `}
                >
                  {money(originalAssetForDisplay)}
                </td>

              </tr>

              <tr>

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  固收资产
                  <span className="text-gray-400">[fixed_income_assets]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-semibold
                    whitespace-nowrap
                    ${amountColor(fixedIncome)}
                  `}
                >
                  {money(fixedIncome)}
                </td>

              </tr>

              <tr className="border-b-4 border-black">

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  Dashboard Total Wealth
                  <span className="text-gray-400">[asset_history.total_asset + 固收]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-semibold
                    whitespace-nowrap
                    ${amountColor(dashboardTotalWealth)}
                  `}
                >
                  {money(dashboardTotalWealth)}
                </td>

              </tr>


              {/* 当前家庭净资产 */}

              <tr>

                <td
                  rowSpan={2}
                  className="
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-gray-900
                    font-semibold
                    align-top
                    whitespace-nowrap
                  "
                >
                  当前家庭净资产
                </td>

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  Financial Freedom 贷款
                  <span className="text-gray-400">[仅统计勾选「计入 Financial Freedom」的贷款]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-semibold
                    whitespace-nowrap
                    ${amountColor(-financialFreedomLoan)}
                  `}
                >
                  − {money(financialFreedomLoan)}
                </td>

              </tr>

              <tr className="border-b-4 border-black">

                <td className="border border-gray-300 px-2 py-2 text-gray-900 font-bold whitespace-nowrap">
                  当前家庭净资产
                  <span className="text-gray-400">[Dashboard Total Wealth − Financial Freedom贷款]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-bold
                    whitespace-nowrap
                    ${amountColor(currentAsset)}
                  `}
                >
                  {money(currentAsset)}
                </td>

              </tr>


              {/* 财务自由 */}

              <tr>

                <td
                  rowSpan={2}
                  className="
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-gray-900
                    font-semibold
                    align-top
                    whitespace-nowrap
                  "
                >
                  财务自由
                </td>

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  当前财务自由目标
                  <span className="text-gray-400">[2027–2042 全部剩余生活费用]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-semibold
                    whitespace-nowrap
                    ${amountColor(currentFreedomTarget)}
                  `}
                >
                  {money(currentFreedomTarget)}
                </td>

              </tr>

              <tr className="border-b-4 border-black">

                <td className="border border-gray-300 px-2 py-2 text-gray-900 font-bold whitespace-nowrap">
                  当前财务自由差额
                  <span className="text-gray-400">[当前财务自由目标 − 当前家庭净资产]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-bold
                    whitespace-nowrap
                    ${amountColor(currentFreedomGap)}
                  `}
                >
                  {money(currentFreedomGap)}
                </td>

              </tr>


              {/* 保险 */}

              <tr>

                <td
                  rowSpan={4}
                  className="
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-gray-900
                    font-semibold
                    align-top
                    whitespace-nowrap
                  "
                >
                  保险
                </td>

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  全部未缴保费
                  <span className="text-gray-400">[家庭全部未来未缴保费合计]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-semibold
                    whitespace-nowrap
                    ${amountColor(unpaidPremium)}
                  `}
                >
                  {money(unpaidPremium)}
                </td>

              </tr>

              <tr>

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  夫妻未缴保费
                  <span className="text-gray-400">[夫妻双方未来未缴保费合计]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-semibold
                    whitespace-nowrap
                    ${amountColor(coupleUnpaidPremium)}
                  `}
                >
                  {money(coupleUnpaidPremium)}
                </td>

              </tr>

              <tr>

                <td className="border border-gray-300 px-2 py-2 text-gray-800 whitespace-nowrap">
                  儿子现金价值
                  <span className="text-gray-400">[儿子保单当前现金价值]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-semibold
                    whitespace-nowrap
                    ${amountColor(sonCashValue)}
                  `}
                >
                  {money(sonCashValue)}
                </td>

              </tr>

              <tr>

                <td className="border border-gray-300 px-2 py-2 text-gray-900 font-bold whitespace-nowrap">
                  夫妻保费 − 儿子现金价值
                  <span className="text-gray-400">[夫妻未缴保费 − 儿子现金价值]</span>
                </td>

                <td
                  className={`
                    border
                    border-gray-300
                    px-2
                    py-2
                    text-right
                    font-bold
                    whitespace-nowrap
                    ${amountColor(coupleMinusSon)}
                  `}
                >
                  {money(coupleMinusSon)}
                </td>

              </tr>

            </tbody>

          </table>

        </section>


        {/* =================================================
            计算规则
            ================================================= */}

        <section
          className="
            bg-blue-50
            border
            border-blue-100
            rounded-xl
            p-5
            w-fit
            max-w-full
            mx-auto
          "
        >

          <h2
            className="
              text-base
              font-bold
              text-blue-900
            "
          >
            📐 计算规则
          </h2>

          <div
            className="
              mt-3
              text-base
              text-blue-800
              leading-7
              whitespace-nowrap
            "
          >

            <p>
              <b>当前家庭净资产</b>
              = Dashboard Total Wealth − Financial Freedom贷款
            </p>

            <p>
              <b>Dashboard Total Wealth</b>
              = asset_history.total_asset + 固收资产
            </p>

            <p>
              <b>年末预计资产</b>
              = 年初资产 + 年初资产 × 5% + 年度现金流
            </p>

            <p>
              <b>年度现金流</b>
              = 年收入 − 生活费 − 年金 − Financial Freedom贷款压力
            </p>

            <p>
              <b>当年财务自由目标</b>
              = 从当年开始到 2042 年全部剩余生活费
            </p>

            <p>
              <b>财务自由差额(年末)</b>
              = max(当年财务自由目标 − 年末预计资产, 0)
            </p>

            <p>
              <b>天天向上1</b>
              = 财务自由差额(年末) + 全部未来保费
            </p>

            <p>
              <b>天天向上2</b>
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
            w-fit
            max-w-full
            mx-auto
          "
        >

          <div
            className="
              p-5
              border-b
            "
          >

            <h2
              className="
                text-lg
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
              w-fit
              max-w-full
            "
          >

            <table
              className="
                w-auto
                border-collapse
                text-base
                tabular-nums
              "
            >

              <thead
                className="
                  bg-white
                  text-gray-800
                  font-semibold
                  border-b
                  border-gray-200
                "
              >

                <tr>

                  {/* 基础数据 */}

                  <th className="px-2 py-2 text-left whitespace-nowrap">
                    年份
                  </th>

                  <th className="px-2 py-2 text-right whitespace-nowrap">
                    年初资产
                  </th>

                  <th className="px-2 py-2 text-right whitespace-nowrap">
                    生活费
                  </th>

                  <th className="px-2 py-2 text-right whitespace-nowrap">
                    年金
                  </th>

                  <th className="px-2 py-2 text-right whitespace-nowrap">
                    待还贷款
                  </th>

                  <th className="px-2 py-2 text-right whitespace-nowrap">
                    投资收益
                  </th>

                  {/* 年末资产 */}

                  <th
                    className="
                      px-2
                      py-2
                      text-right
                      font-bold
                      whitespace-nowrap
                      border-l
                      border-black
                    "
                  >
                    年末资产
                  </th>

                  {/* 财务自由目标/差额 */}

                  <th
                    className="
                      px-2
                      py-2
                      text-right
                      whitespace-nowrap
                      border-l
                      border-black
                    "
                  >
                    财务自由目标(年末)
                  </th>

                  <th
                    className="
                      px-2
                      py-2
                      text-right
                      font-bold
                      whitespace-nowrap
                    "
                  >
                    财务自由差额(年末)
                  </th>

                  {/* 保费与现金价值 */}

                  <th
                    className="
                      px-2
                      py-2
                      text-right
                      whitespace-nowrap
                      border-l
                      border-black
                    "
                  >
                    全部未来保费(年末)
                  </th>

                  <th className="px-2 py-2 text-right whitespace-nowrap">
                    夫妻未来保费(年末)
                  </th>

                  <th className="px-2 py-2 text-right whitespace-nowrap">
                    儿子现金价值(年末)
                  </th>

                  {/* 天天向上 */}

                  <th
                    className="
                      px-2
                      py-2
                      text-right
                      font-bold
                      bg-[#FBF3DC]
                      whitespace-nowrap
                      border-l
                      border-black
                    "
                  >
                    天天向上1(年末)
                  </th>

                  <th
                    className="
                      px-2
                      py-2
                      text-right
                      font-bold
                      bg-[#FBF3DC]
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
                            bg-white
                            border-b
                            border-gray-200
                            last:border-b-0
                            hover:bg-gray-50
                          "
                        >

                          {/* 基础数据 */}

                          <td className="px-2 py-2 font-semibold whitespace-nowrap">
                            {row.year}
                          </td>

                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {money(row.beginAsset)}
                          </td>

                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {money(row.expense)}
                          </td>

                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {money(row.pension)}
                          </td>

                          <td className="px-2 py-2 text-right text-red-600 whitespace-nowrap">
                            {money(row.loan)}
                          </td>

                          <td
                            className={`
                              px-2
                              py-2
                              text-right
                              whitespace-nowrap
                              ${
                                toNumber(row.investmentReturn) > 0
                                  ? "text-red-600"
                                  : toNumber(row.investmentReturn) < 0
                                  ? "text-green-600"
                                  : "text-gray-400"
                              }
                            `}
                          >
                            {money(row.investmentReturn)}
                          </td>

                          {/* 年末资产 */}

                          <td
                            className="
                              px-2
                              py-2
                              text-right
                              font-bold
                              text-blue-700
                              whitespace-nowrap
                              border-l
                              border-black
                            "
                          >
                            {money(row.totalAsset)}
                          </td>

                          {/* 财务自由目标/差额 */}

                          <td
                            className="
                              px-2
                              py-2
                              text-right
                              whitespace-nowrap
                              border-l
                              border-black
                            "
                          >
                            {money(row.freedomTarget)}
                          </td>

                          <td
                            className={`
                              px-2
                              py-2
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
                                ? money(gap)
                                : "已达成"
                            }
                          </td>

                          {/* 保费与现金价值 */}

                          <td
                            className="
                              px-2
                              py-2
                              text-right
                              whitespace-nowrap
                              border-l
                              border-black
                            "
                          >
                            {money(row.totalFuturePremium)}
                          </td>

                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {money(row.coupleFuturePremium)}
                          </td>

                          <td className="px-2 py-2 text-right whitespace-nowrap">
                            {money(row.sonFutureCashValue)}
                          </td>

                          {/* 天天向上 */}

                          <td
                            className="
                              px-2
                              py-2
                              text-right
                              font-bold
                              text-blue-700
                              bg-[#FBF3DC]
                              whitespace-nowrap
                              border-l
                              border-black
                            "
                          >
                            {money(row.yearTiantian1)}
                          </td>

                          <td
                            className="
                              px-2
                              py-2
                              text-right
                              font-bold
                              text-green-700
                              bg-[#FBF3DC]
                              whitespace-nowrap
                            "
                          >
                            {money(row.yearTiantian2)}
                          </td>

                        </tr>

                      );

                    }
                  )
                }

              </tbody>

            </table>

          </div>


          <div
            className="
              m-5
              rounded-xl
              bg-indigo-50
              border
              border-indigo-100
              p-4
              text-sm
              text-indigo-800
              leading-7
            "
          >

            <p>
              <b>📐 财务自由目标：</b>
              每一年都重新计算「从该年开始到 2042 年剩余生活费」。
            </p>

            <p>
              例如：2027 = {START_YEAR}–{END_YEAR} 全部生活费；
              2028 = 2028–2041 全部生活费；
              2042 = 2042 年生活费。
            </p>

            <p>
              <b>财务自由差额(年末)</b>
              使用年末预计资产计算，而不是使用当前资产。
              达成财务自由后，页面显示「已达成」。
            </p>

            <p>
              <b>天天向上1 / 天天向上2</b>
              即使财务自由已经达成，
              仍然继续使用「财务自由目标 − 年末资产」的真实差额。
              因此超过财务自由目标的资产会以负数继续抵减未来保费压力。
            </p>

            <p>
              <b>年末资产</b>
              会进入下一年的年初资产继续按照 5% 复利。
            </p>

            <p>
              <b>保险年度数据</b>
              直接使用 getInsuranceYearProjection() 返回的年度数据，
              按年份匹配全部未来保费、夫妻未来保费和儿子现金价值。
            </p>

          </div>

        </section>


      </main>

    </>

  );

}