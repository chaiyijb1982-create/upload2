"use client";

import {
  useEffect,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getLatestAsset,
} from "@/lib/asset";

import {
  getInsuranceSummary,
  getInsuranceCashValueHistory,
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

const FORECAST_BASE_YEAR = 2026;

const END_YEAR = 2042;

const FREEDOM_END_YEAR = 2042;

const RETIREMENT_AGE = 60;


// =====================================================
// 当前年份
// =====================================================
//
// 页面只显示当前年份及以后。
// 例如：
// 2026 年 → 显示 2026–2042
// 2027 年 → 自动隐藏 2026，显示 2027–2042
// =====================================================

const CURRENT_YEAR = new Date().getFullYear();


// =====================================================
// 备用资产
// =====================================================
//
// 只有 Dashboard 没有读取到资产时才使用。
// 正常情况下不会使用。
// =====================================================

const START_ASSET = 1600000;


// =====================================================
// 年收入
// =====================================================
//
// 保留原数据用于页面其他逻辑说明。
// 新的年度资产预测不再使用年收入计算新增资产。
// =====================================================

const ANNUAL_INCOME = 1100000;


// =====================================================
// 默认资产增长率
// =====================================================
//
// 每年可以在页面中单独修改。
// 单位：%
// =====================================================

const DEFAULT_GROWTH_RATE = 5;


// =====================================================
// 年度预测输入类型
// =====================================================

type ForecastInput = {
  expense: number;
  growthRate: number;
  hkInvestment: number;
  remainingCash: number;
};

type ForecastInputs = Record<number, ForecastInput>;


// =====================================================
// 每年生活费默认值
// =====================================================
//
// 单位：元。
// 页面中显示/编辑时转换为“万元”。
// =====================================================

const BASE_EXPENSE: Record<number, number> = {
  2026: 0,

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
//
// 保留原模型数据。
// 新的“每年新增资产”计算不再用年金/收入/贷款压力。
// =====================================================

const ANNUITY: Record<number, number> = {
  2026: 0,

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
// ★ 每年资产预测输入
// =====================================================
//
// 用户可编辑：
// 1. 当年生活费      单位：万元
// 2. 每年资产增长率  单位：%
// 3. 香港投资        单位：万元
// 4. 当年剩余现金    单位：万元
//
// 用户提供的年度规划：
// 2027：香港投资 6，剩余现金 -5.4
// 2028：香港投资 6，剩余现金 5.6
// 2029：香港投资 6，剩余现金 5.6
// 2030：香港投资 6，剩余现金 5.6
// 2031：香港投资 6，剩余现金 5.6
// 2032：香港投资 6，剩余现金 10.6
// 2033：香港投资 12，剩余现金 30.9
// 2034：香港投资 12，剩余现金 40.1
// 2035：香港投资 12，剩余现金 40.1
// 2036：香港投资 12，剩余现金 40.1
// 2037：香港投资 12，剩余现金 40.1
// 2038：香港投资 12，剩余现金 53.1
// 2039：香港投资 12，剩余现金 62.1
// 2040：香港投资 12，剩余现金 62.1
// 2041：香港投资 12，剩余现金 62.1
// 2042：香港投资 12，剩余现金 62.1
//
// 2026 为当前基准年，暂不自动假设新增资产，
// 当年数据可以直接在页面中填写。
// =====================================================

const DEFAULT_FORECAST_INPUTS: ForecastInputs = {
  2026: {
    expense: 0,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 0,
    remainingCash: 0,
  },

  2027: {
    expense: 37,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 6,
    remainingCash: -5.4,
  },

  2028: {
    expense: 37,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 6,
    remainingCash: 5.6,
  },

  2029: {
    expense: 37,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 6,
    remainingCash: 5.6,
  },

  2030: {
    expense: 37,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 6,
    remainingCash: 5.6,
  },

  2031: {
    expense: 37,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 6,
    remainingCash: 5.6,
  },

  2032: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 6,
    remainingCash: 10.6,
  },

  2033: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 30.9,
  },

  2034: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 40.1,
  },

  2035: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 40.1,
  },

  2036: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 40.1,
  },

  2037: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 40.1,
  },

  2038: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 53.1,
  },

  2039: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 62.1,
  },

  2040: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 62.1,
  },

  2041: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 62.1,
  },

  2042: {
    expense: 32,
    growthRate: DEFAULT_GROWTH_RATE,
    hkInvestment: 12,
    remainingCash: 62.1,
  },
};


function getDefaultForecastInput(year: number) {
  return (
    DEFAULT_FORECAST_INPUTS[year] ?? {
      expense:
        Number(BASE_EXPENSE[year] || 0) / 10000,
      growthRate:
        DEFAULT_GROWTH_RATE,
      hkInvestment: 0,
      remainingCash: 0,
    }
  );
}


function getInitialForecastInputs(): ForecastInputs {
  const result: ForecastInputs = {};

  for (
    let year = FORECAST_BASE_YEAR;
    year <= END_YEAR;
    year++
  ) {
    result[year] = {
      ...getDefaultForecastInput(year),
    };
  }

  return result;
}


function getFinancialFreedomTarget(
  year: number,
  inputs?: ForecastInputs
) {
  let target = 0;

  for (
    let y = year;
    y <= FREEDOM_END_YEAR;
    y++
  ) {
    const expense =
      inputs?.[y]?.expense ??
      getDefaultForecastInput(y).expense;

    target +=
      Number(expense || 0) * 10000;
  }

  return target;
}


// =====================================================
// 页面
// =====================================================

export default function FinancialFreedomPage() {


  // ===================================================
  // 当前家庭净资产
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
  // Financial Freedom 贷款
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
  // 贷款年度模型
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
  // ★ 年度预测输入
  // ===================================================
  //
  // 所有金额输入单位：万元。
  // 页面编辑后立即重新计算后续年份。
  // ===================================================

  const [
    forecastInputs,
    setForecastInputs,
  ] = useState<ForecastInputs>(
    getInitialForecastInputs()
  );


  // 是否已经从 Supabase 恢复过年度预测输入。
  // 未恢复前禁止自动保存，避免页面初始化时把默认值覆盖数据库。
  const [
    forecastInputsLoaded,
    setForecastInputsLoaded,
  ] = useState(false);



  // ===================================================
  // 数据加载
  // ===================================================

  useEffect(() => {

    async function load() {

      try {

        setLoading(true);


        // =================================================
        // 1. 获取 Dashboard 最新资产
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
            "Financial Freedom fixed income loading error:",
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
          )
            .reduce(
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
        // =================================================
        //
        // Dashboard Total Wealth
        // =
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
        // 5. 获取 Financial Freedom 贷款
        // =================================================
        //
        // getFinancialFreedomLoans()
        // 本身应该只返回：
        //
        // include_in_financial_freedom = true
        //
        // 的贷款。
        //
        // 因此这里绝对不能再读取全部 loans。
        // =================================================

        const ffLoans =
          await getFinancialFreedomLoans();


        // =================================================
        // 贷款余额
        // =================================================

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
        // 6. 当前家庭净资产
        // =================================================
        //
        // 当前家庭净资产
        // =
        // Dashboard Total Wealth
        // -
        // Financial Freedom 贷款
        //
        // 注意：
        //
        // fixedIncomeSum 已经包含在 totalWealth 中。
        //
        // 所以这里绝对不能再：
        //
        // totalWealth + fixedIncomeSum
        //
        // =================================================

        const netAsset =
          totalWealth -
          loanBalance;


        setCurrentFamilyAsset(
          netAsset
        );
   
        // =================================================
        // 恢复 Financial Freedom 年度预测输入
        // =================================================
        //
        // forecast_inputs 存在 financial_freedom_history 中。
        // 页面第一次打开时读取最近一次保存的版本；
        // 如果没有历史数据，则继续使用默认值。
        //
        // 注意：这里不能在恢复之前保存快照，否则会把默认值覆盖掉。
        // =================================================

        const {
          data: savedForecastHistory,
          error: savedForecastHistoryError,
        } = await supabase
          .from('financial_freedom_history')
          .select('snapshot_date, forecast_inputs')
          .not('forecast_inputs', 'is', null)
          .order('snapshot_date', { ascending: false })
          .limit(1);

        if (savedForecastHistoryError) {
          console.error(
            'Financial Freedom forecast inputs loading error:',
            savedForecastHistoryError
          );
        } else {
          const saved = savedForecastHistory?.[0]?.forecast_inputs;

          if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
            const restored = getInitialForecastInputs();

            for (let year = FORECAST_BASE_YEAR; year <= END_YEAR; year++) {
              const savedInput = (saved as Record<string, any>)[String(year)];

              if (savedInput && typeof savedInput === 'object') {
                restored[year] = {
                  ...restored[year],
                  expense: Number.isFinite(Number(savedInput.expense))
                    ? Number(savedInput.expense)
                    : restored[year].expense,
                  growthRate: Number.isFinite(Number(savedInput.growthRate))
                    ? Number(savedInput.growthRate)
                    : restored[year].growthRate,
                  hkInvestment: Number.isFinite(Number(savedInput.hkInvestment))
                    ? Number(savedInput.hkInvestment)
                    : restored[year].hkInvestment,
                  remainingCash: Number.isFinite(Number(savedInput.remainingCash))
                    ? Number(savedInput.remainingCash)
                    : restored[year].remainingCash,
                };
              }
            }

            setForecastInputs(restored);

            console.log(
              'Financial Freedom forecast inputs restored from Supabase:',
              savedForecastHistory?.[0]?.snapshot_date
            );
          }
        }

        try {
          window.localStorage.setItem(
            'financial_freedom_forecast_inputs_v1',
            JSON.stringify(
              savedForecastHistory?.[0]?.forecast_inputs ??
              getInitialForecastInputs()
            )
          );
        } catch (localStorageError) {
          console.warn(
            'Financial Freedom local forecast inputs initial save failed:',
            localStorageError
          );
        }

        setForecastInputsLoaded(true);


        // =================================================
        // Debug
        // =================================================


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
          "Current Financial Freedom Target:",
          getFinancialFreedomTarget(
            Math.max(
              FORECAST_BASE_YEAR,
              Math.min(
                CURRENT_YEAR,
                END_YEAR
              )
            ),
            forecastInputs
          )
        );

        console.log(
          "Current Financial Freedom Gap:",
          Math.max(
            0,
            getFinancialFreedomTarget(
              Math.max(
                FORECAST_BASE_YEAR,
                Math.min(
                  CURRENT_YEAR,
                  END_YEAR
                )
              ),
              forecastInputs
            ) -
            netAsset
          )
        );

        console.log(
          "========================================"
        );


        // =================================================
        // 7. 获取保险数据
        // =================================================

        const ins =
          await getInsuranceSummary();


        setInsurance(
          ins
        );


        // =================================================
        // 8. 获取保险现金价值历史
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
        // 9. 年度贷款模型
        // =================================================
        //
        // 贷款数据继续读取并保留。
        // 新的年度资产预测不再使用贷款压力计算新增资产。
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
          let year = FORECAST_BASE_YEAR;
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


      }
      catch (
        error
      ) {

        console.error(
          "Financial Freedom loading error:",
          error
        );

      }
      finally {

        setLoading(
          false
        );

      }

    }


    load();

  }, []);


  // =====================================================
  // ★ 保存年度预测输入 + 当前 Financial Freedom 快照
  // =====================================================
  //
  // 只要用户修改任意年度输入，就保存到 Supabase。
  // 页面刷新后会从 forecast_inputs 恢复。
  // =====================================================

  useEffect(() => {

    if (!forecastInputsLoaded) {
      return;
    }

    if (!currentFamilyAsset && currentFamilyAsset !== 0) {
      return;
    }

    const saveForecastInputs = async () => {

      const currentYearForTarget =
        Math.max(
          FORECAST_BASE_YEAR,
          Math.min(CURRENT_YEAR, END_YEAR)
        );

      const freedomTarget =
        getFinancialFreedomTarget(
          currentYearForTarget,
          forecastInputs
        );

      const freedomGap = Math.max(
        0,
        freedomTarget - currentFamilyAsset
      );

      const freedomRate =
        freedomTarget > 0
          ? (currentFamilyAsset / freedomTarget) * 100
          : 0;

      const today =
        new Date().toISOString().split('T')[0];

      const { error: historyError } =
        await supabase
          .from('financial_freedom_history')
          .upsert(
            {
              snapshot_date: today,
              total_asset: currentFamilyAsset,
              freedom_target: freedomTarget,
              freedom_gap: freedomGap,
              freedom_rate: freedomRate,
              forecast_inputs: forecastInputs,
            },
            {
              onConflict: 'snapshot_date',
            }
          );

      if (historyError) {
        console.error(
          'Financial Freedom history save error:',
          {
            message: historyError.message,
            details: historyError.details,
            hint: historyError.hint,
            code: historyError.code,
          }
        );
      } else {
        try {
          window.localStorage.setItem(
            'financial_freedom_forecast_inputs_v1',
            JSON.stringify(forecastInputs)
          );
        } catch (localStorageError) {
          console.warn(
            'Financial Freedom local forecast inputs save failed:',
            localStorageError
          );
        }
      }
    };

    void saveForecastInputs();

  }, [
    forecastInputs,
    forecastInputsLoaded,
    currentFamilyAsset,
  ]);


  // =====================================================
  // ★ 年度资产预测
  // =====================================================
  //
  // 当前年份以前不显示。
  // 当前年份作为预测起点：
  //
  // 当年预计资产(年末)
  // = 上一年预计资产(年末)
  //   × (1 + 每年资产增长率)
  //   + 香港投资
  //   + 当年剩余现金
  //
  // 特别处理：
  // 2026 是当前模型的基准年，直接使用当前家庭净资产，
  // 不再对当前资产重复计算一次增长。
  // =====================================================

  useEffect(() => {

    if (!currentFamilyAsset && currentFamilyAsset !== 0) {
      return;
    }

    const calculationStartYear =
      Math.max(
        FORECAST_BASE_YEAR,
        Math.min(
          CURRENT_YEAR,
          END_YEAR
        )
      );

    let previousAsset =
      currentFamilyAsset;

    const result: any[] = [];


    for (
      let year = calculationStartYear;
      year <= END_YEAR;
      year++
    ) {

      const input =
        forecastInputs[year] ??
        getDefaultForecastInput(year);

      const expense =
        Number(
          input.expense || 0
        );

      const growthRate =
        Number(
          input.growthRate || 0
        );

      const hkInvestment =
        Number(
          input.hkInvestment || 0
        );

      const remainingCash =
        Number(
          input.remainingCash || 0
        );

      const newAsset =
        hkInvestment +
        remainingCash;

      const isCurrentBaseYear =
        year === FORECAST_BASE_YEAR &&
        calculationStartYear === FORECAST_BASE_YEAR;

      const beginningAsset =
        previousAsset;

      let currentAsset: number;
      let investmentReturn: number;


      if (isCurrentBaseYear) {

        currentAsset =
          currentFamilyAsset;

        investmentReturn =
          0;

      }
      else {

        investmentReturn =
          beginningAsset *
          growthRate /
          100;

        currentAsset =
          beginningAsset
          *
          (
            1 +
            growthRate /
            100
          )
          +
          newAsset *
          10000;

      }


      previousAsset =
        currentAsset;

      const freedomTarget =
        getFinancialFreedomTarget(
          year,
          forecastInputs
        );

      const freedomGap =
        Math.max(
          0,
          freedomTarget -
          currentAsset
        );

      const remainingYears =
        END_YEAR -
        year +
        1;


      result.push({

        year,

        remainingYears,

        asset:
          currentAsset,

        income:
          ANNUAL_INCOME,

        expense:
          expense *
          10000,

        annuity:
          Number(
            ANNUITY[year] || 0
          ),

        loan:
          Number(
            loanPressure[year]?.pressure || 0
          ),

        investmentReturn,

        cashFlow:
          newAsset *
          10000,

        growthRate,

        hkInvestment,

        remainingCash,

        newAsset,

        freedomTarget,

        freedomGap,

        isBaseYear:
          isCurrentBaseYear,

      });

    }


    setRows(
      result
    );

  }, [
    currentFamilyAsset,
    forecastInputs,
    loanPressure,
  ]);


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
  // ★ 财务自由目标计算
  // =====================================================
  //
  // 从指定年份开始，
  // 一直到 2042 年，
  // 加总剩余所有年份的生活费。
  //
  // 使用页面当前可编辑的“当年生活费”。
  // =====================================================

  function getFreedomTarget(
    startYear: number
  ) {

    return getFinancialFreedomTarget(
      startYear,
      forecastInputs
    );

  }


  // =====================================================
  // ★ 当前财务自由目标
  // =====================================================

  const currentForecastStartYear =
    Math.max(
      FORECAST_BASE_YEAR,
      Math.min(
        CURRENT_YEAR,
        END_YEAR
      )
    );

  const currentFreedomTarget =
    getFreedomTarget(
      currentForecastStartYear
    );


  // =====================================================
  // ★ 当前财务自由差额
  // =====================================================

  const currentFreedomGap =
    Math.max(
      0,
      currentFreedomTarget
      -
      currentFamilyAsset
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
  // ★ 天天向上1
  // =====================================================
  //
  // 新定义：
  //
  // 当前财务自由差额
  // +
  // 未来还要交的总保费
  //
  // 注意：
  // 这里不再使用 2042 财务自由差额。
  // =====================================================

  const tiantianUp1 =
    currentFreedomGap
    +
    totalUnpaidPremium;


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
            xl:grid-cols-3
            gap-6
          "
        >


          {/* =============================================
              1. 当前家庭净资产
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
              2. 当前财务自由目标
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

              当前财务自由目标

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
                  currentFreedomTarget
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

              {currentForecastStartYear}–{END_YEAR} 剩余生活费总和

            </div>

          </div>


          {/* =============================================
              3. 当前财务自由差额
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

              当前财务自由差额

            </div>


            <div
              className={`
                text-3xl
                font-bold
                mt-3
                ${
                  currentFreedomGap > 0
                    ? "text-orange-600"
                    : "text-green-600"
                }
              `}
            >

              {
                currentFreedomGap > 0
                  ? money(
                      currentFreedomGap
                    )
                  : "已达成"
              }

            </div>


            <div
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              当前财务自由目标 − 当前家庭净资产

            </div>

          </div>


          


        </section>


        {/* =================================================
            当前财务自由计算说明
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

            🎯 当前财务自由计算

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


            {/* 当前家庭净资产 */}

            <div
              className="
                rounded-xl
                bg-green-50
                p-5
              "
            >

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
                  text-2xl
                  font-bold
                  mt-2
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


            {/* 当前财务自由目标 */}

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

                当前财务自由目标

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
                    currentFreedomTarget
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

                {currentForecastStartYear}–{END_YEAR} 所有未来生活费

              </div>

            </div>


            {/* 当前财务自由差额 */}

            <div
              className="
                rounded-xl
                bg-orange-50
                p-5
              "
            >

              <div
                className="
                  text-sm
                  text-gray-500
                "
              >

                当前财务自由差额

              </div>


              <div
                className="
                  text-2xl
                  font-bold
                  mt-2
                  text-orange-700
                "
              >

                {
                  currentFreedomGap > 0
                    ? money(
                        currentFreedomGap
                      )
                    : "已达成"
                }

              </div>


              <div
                className="
                  text-xs
                  text-gray-400
                  mt-2
                "
              >

                目标 − 当前净资产

              </div>

            </div>


          </div>


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
                当前财务自由目标：
              </b>

            </p>


            <p>

              {currentForecastStartYear}–{END_YEAR} 每年的预计生活费全部加总。

            </p>


            <p>

              当前财务自由目标 =
              2027生活费 + 2028生活费 + …… + 2041生活费

            </p>


            <p>

              当前财务自由差额 =
              max(当前财务自由目标 − 当前家庭净资产, 0)

            </p>


            <p>

              随着时间进入下一年，
              剩余生活费减少，
              所以财务自由目标也会逐年下降。

            </p>

          </div>

        </section>

                {/* =================================================
            ★ 年度资产预测
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

                📊 年度资产预测

              </h2>


              <p
                className="
                  text-sm
                  text-gray-400
                  mt-2
                "
              >

                页面只显示当前年份及以后；修改任意输入后，后续年份会自动重新计算。

              </p>

            </div>

          </div>


          <div
            className="
              mb-5
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
              <b>资产预测公式：</b>
            </p>

            <p>
              当年预计资产(年末)
              =
              去年预计资产(年末)
              ×
              (1 + 每年资产增长率)
              +
              香港投资
              +
              当年剩余现金
            </p>

            <p>
              每年新增资产
              =
              香港投资
              +
              当年剩余现金
            </p>

            <p>
              所有输入金额单位均为“万元”，资产增长率单位为“%”。
              不自动按月份比例折算。
            </p>

          </div>


          <table
            className="
              w-full
              text-sm
              min-w-[1250px]
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
                  当年生活费<br />(万元)
                </th>

                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  资产增长率<br />(%)
                </th>

                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  香港投资<br />(万元)
                </th>

                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  当年剩余现金<br />(万元)
                </th>

                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  每年新增资产<br />(万元)
                </th>

                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  当年预计资产(年末)
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

                    const input =
                      forecastInputs[
                        Number(row.year)
                      ] ??
                      getDefaultForecastInput(
                        Number(row.year)
                      );

                    const newAsset =
                      Number(
                        input.hkInvestment || 0
                      )
                      +
                      Number(
                        input.remainingCash || 0
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

                        <td
                          className="
                            p-3
                            font-semibold
                            text-gray-700
                          "
                        >

                          {row.year}

                          {
                            row.isBaseYear
                              ? (
                                <div
                                  className="
                                    text-xs
                                    text-gray-400
                                    mt-1
                                  "
                                >
                                  当前资产基准
                                </div>
                              )
                              : null
                          }

                        </td>


                        {/* 当年生活费 */}

                        <td
                          className="
                            p-2
                            text-right
                          "
                        >

                          <input
                            type="number"
                            step="0.1"
                            value={
                              input.expense
                            }
                            onChange={
                              (
                                e
                              ) => {

                                const value =
                                  Number(
                                    e.target.value
                                  );

                                setForecastInputs(
                                  (
                                    prev
                                  ) => ({
                                    ...prev,
                                    [row.year]: {
                                      ...(
                                        prev[
                                          row.year
                                        ] ??
                                        getDefaultForecastInput(
                                          row.year
                                        )
                                      ),
                                      expense:
                                        Number.isFinite(
                                          value
                                        )
                                          ? value
                                          : 0,
                                    },
                                  })
                                );

                              }
                            }
                            className="
                              w-24
                              rounded-lg
                              border
                              border-gray-200
                              px-2
                              py-2
                              text-right
                              outline-none
                              focus:border-blue-400
                            "
                          />

                        </td>


                        {/* 资产增长率 */}

                        <td
                          className="
                            p-2
                            text-right
                          "
                        >

                          <input
                            type="number"
                            step="0.1"
                            value={
                              input.growthRate
                            }
                            onChange={
                              (
                                e
                              ) => {

                                const value =
                                  Number(
                                    e.target.value
                                  );

                                setForecastInputs(
                                  (
                                    prev
                                  ) => ({
                                    ...prev,
                                    [row.year]: {
                                      ...(
                                        prev[
                                          row.year
                                        ] ??
                                        getDefaultForecastInput(
                                          row.year
                                        )
                                      ),
                                      growthRate:
                                        Number.isFinite(
                                          value
                                        )
                                          ? value
                                          : 0,
                                    },
                                  })
                                );

                              }
                            }
                            className="
                              w-20
                              rounded-lg
                              border
                              border-gray-200
                              px-2
                              py-2
                              text-right
                              outline-none
                              focus:border-blue-400
                            "
                          />

                        </td>


                        {/* 香港投资 */}

                        <td
                          className="
                            p-2
                            text-right
                          "
                        >

                          <input
                            type="number"
                            step="0.1"
                            value={
                              input.hkInvestment
                            }
                            onChange={
                              (
                                e
                              ) => {

                                const value =
                                  Number(
                                    e.target.value
                                  );

                                setForecastInputs(
                                  (
                                    prev
                                  ) => ({
                                    ...prev,
                                    [row.year]: {
                                      ...(
                                        prev[
                                          row.year
                                        ] ??
                                        getDefaultForecastInput(
                                          row.year
                                        )
                                      ),
                                      hkInvestment:
                                        Number.isFinite(
                                          value
                                        )
                                          ? value
                                          : 0,
                                    },
                                  })
                                );

                              }
                            }
                            className="
                              w-24
                              rounded-lg
                              border
                              border-gray-200
                              px-2
                              py-2
                              text-right
                              outline-none
                              focus:border-blue-400
                            "
                          />

                        </td>


                        {/* 当年剩余现金 */}

                        <td
                          className="
                            p-2
                            text-right
                          "
                        >

                          <input
                            type="number"
                            step="0.1"
                            value={
                              input.remainingCash
                            }
                            onChange={
                              (
                                e
                              ) => {

                                const value =
                                  Number(
                                    e.target.value
                                  );

                                setForecastInputs(
                                  (
                                    prev
                                  ) => ({
                                    ...prev,
                                    [row.year]: {
                                      ...(
                                        prev[
                                          row.year
                                        ] ??
                                        getDefaultForecastInput(
                                          row.year
                                        )
                                      ),
                                      remainingCash:
                                        Number.isFinite(
                                          value
                                        )
                                          ? value
                                          : 0,
                                    },
                                  })
                                );

                              }
                            }
                            className="
                              w-24
                              rounded-lg
                              border
                              border-gray-200
                              px-2
                              py-2
                              text-right
                              outline-none
                              focus:border-blue-400
                            "
                          />

                        </td>


                        {/* 每年新增资产 */}

                        <td
                          className={`
                            p-3
                            text-right
                            font-bold
                            ${
                              newAsset >= 0
                                ? "text-green-700"
                                : "text-red-600"
                            }
                          `}
                        >

                          {
                            newAsset.toLocaleString(
                              "zh-CN",
                              {
                                minimumFractionDigits: 1,
                                maximumFractionDigits: 1,
                              }
                            )
                          }

                        </td>


                        {/* 当年预计资产 */}

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


                        {/* 财务自由目标 */}

                        <td
                          className="
                            p-3
                            text-right
                            font-bold
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
                              row.freedomGap > 0
                                ? "text-orange-600"
                                : "text-green-600"
                            }
                          `}
                        >

                          {
                            row.freedomGap > 0
                              ? money(
                                  row.freedomGap
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

        </section>


        {/* =================================================
            ★ 年度财务自由目标变化
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
              mb-5
            "
          >

            <h2
              className="
                text-xl
                font-bold
                text-gray-900
              "
            >

              📉 年度财务自由目标变化

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-2
              "
            >

              随着年份推进，剩余需要覆盖的生活费逐年减少，
              因此财务自由目标也逐年下降。

            </p>

          </div>


          <table
            className="
              w-full
              text-sm
              min-w-[950px]
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
                  当年生活费
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  剩余年份
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  财务自由目标(年末)
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  当年预计资产(年末)
                </th>


                <th
                  className="
                    p-3
                    text-right
                    font-medium
                  "
                >
                  财务自由差额(年末)
                </th>

              </tr>

            </thead>


            <tbody>

              {
                rows.map(
                  (
                    row: any
                  ) => {

                    const year =
                      Number(
                        row.year
                      );


                    // =================================================
                    // 从当前年份开始，到 2042 年剩余所有生活费
                    // =================================================

                    const yearlyFreedomTarget =
                      getFreedomTarget(
                        year
                      );


                    // =================================================
                    // 当年预计资产
                    // =================================================

                    const yearlyAsset =
                      Number(
                        row.asset || 0
                      );


                    // =================================================
                    // 当年财务自由差额
                    // =================================================

                    const yearlyFreedomGap =
                      Math.max(
                        0,
                        yearlyFreedomTarget
                        -
                        yearlyAsset
                      );


                    // =================================================
                    // 剩余年份数量
                    // =================================================

                    const remainingYears =
                      END_YEAR
                      -
                      year
                      +
                      1;


                    return (

                      <tr
                        key={
                          `freedom-${year}`
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

                          {year}

                        </td>


                        {/* 当年生活费 */}

                        <td
                          className="
                            p-3
                            text-right
                            text-gray-700
                          "
                        >

                          {
                            money(
                              row.expense
                            )
                          }

                        </td>


                        {/* 剩余年份 */}

                        <td
                          className="
                            p-3
                            text-right
                            text-gray-500
                          "
                        >

                          {remainingYears} 年

                        </td>


                        {/* 财务自由目标 */}

                        <td
                          className="
                            p-3
                            text-right
                            font-bold
                            text-blue-700
                          "
                        >

                          {
                            money(
                              yearlyFreedomTarget
                            )
                          }

                        </td>


                        {/* 当年预计资产 */}

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
                              yearlyAsset
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
                              yearlyFreedomGap > 0
                                ? "text-orange-600"
                                : "text-green-600"
                            }
                          `}
                        >

                          {
                            yearlyFreedomGap > 0
                              ? money(
                                  yearlyFreedomGap
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
              财务自由目标计算说明
              ================================================= */}

          <div
            className="
              mt-5
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
                📐 财务自由目标计算方法：
              </b>

            </p>


            <p>

              每一年的财务自由目标 =
              从该年开始到 2042 年的所有剩余生活费总和。

            </p>


            <p>

              2027 财务自由目标 =
              2027 + 2028 + …… + 2042 生活费

            </p>


            <p>

              2028 财务自由目标 =
              2028 + 2029 + …… + 2042 生活费

            </p>


            <p>

              ……

            </p>


            <p>

              2042 财务自由目标 =
              2042 年生活费

            </p>


            <p>

              <b>
                财务自由差额 =
                max(财务自由目标 − 当年预计资产, 0)
              </b>

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
            当前财务自由结果
            ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-3
            gap-6
          "
        >

          {/* =================================================
              当前财务自由目标
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

              🎯 当前财务自由目标

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
                  currentFreedomTarget
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

              {currentForecastStartYear}–{END_YEAR} 剩余生活费总和

            </p>

          </div>


          {/* =================================================
              当前家庭净资产
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

              💰 当前家庭净资产

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
                  currentFamilyAsset
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

              当前家庭全部资产减去 Financial Freedom 贷款

            </p>

          </div>


          {/* =================================================
              当前财务自由差额
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

              📌 当前财务自由差额

            </h3>


            <div
              className={`
                text-3xl
                font-bold
                mt-4
                ${
                  currentFreedomGap > 0
                    ? "text-orange-600"
                    : "text-green-600"
                }
              `}
            >

              {
                currentFreedomGap > 0
                  ? money(
                      currentFreedomGap
                    )
                  : "已达成"
              }

            </div>


            <p
              className="
                text-sm
                text-gray-500
                mt-3
              "
            >

              当前财务自由目标 − 当前家庭净资产

            </p>

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

                  当前财务自由状态

                </div>


                <div
                  className="
                    text-lg
                    font-bold
                    mt-1
                  "
                >

                  {
                    currentFreedomGap > 0
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
                    currentFreedomGap > 0
                      ? "text-orange-600"
                      : "text-green-600"
                  }
                `}
              >

                {
                  currentFreedomGap > 0
                    ? money(
                        currentFreedomGap
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