"use client";

import {
  useEffect,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getLatestAsset,
  getAssetHistory,
  getHoldingsAllocation,
  getHoldings,
  getHoldingsPlatformAllocation,
  getLatestHoldingsHistoryUpdatedAt,
} from "@/lib/asset";

import {
  supabase,
} from "@/lib/supabase";

import AssetSummary from "@/components/AssetSummary";
import WealthTrend from "@/components/WealthTrend";
import AIAdvisor from "@/components/AIAdvisor";
import AssetAllocation from "@/components/AssetAllocation";
import HoldingsTable from "@/components/HoldingsTable";
import ForecastCurve from "@/components/ForecastCurve";
import PlatformAllocation from "@/components/PlatformAllocation";


export default function Home() {

  // =====================================================
  // Asset
  // =====================================================

  const [asset, setAsset] =
    useState<any>(null);
 
  const [latestUpdatedAt, setLatestUpdatedAt] =
  useState<string | null>(null);

  // =====================================================
  // History
  // =====================================================

  const [history, setHistory] =
    useState<any[]>([]);


  // =====================================================
  // Allocation
  // =====================================================

  const [allocation, setAllocation] =
    useState<any>(null);


  // =====================================================
  // Holdings
  // =====================================================

  const [holdings, setHoldings] =
    useState<any[]>([]);


  // =====================================================
  // Platform Allocation
  // =====================================================

  const [
    platformAllocation,
    setPlatformAllocation,
  ] =
    useState<any[]>([]);


  // =====================================================
  // Fixed Income
  // =====================================================

  const [
    fixedIncomeTotal,
    setFixedIncomeTotal,
  ] =
    useState(0);


  // =====================================================
  // Loading
  // =====================================================

  const [
    loading,
    setLoading,
  ] =
    useState(true);


  // =====================================================
  // Load Dashboard Data
  // =====================================================

  useEffect(() => {

    async function load() {

      try {

        // =================================================
        // 基础数据
        // =================================================

        const [
          latestAsset,
          assetHistory,
          holdingsAllocation,
          holdingsData,
          platformData,
        ] =
          await Promise.all([

            getLatestAsset(),

            getAssetHistory(),

            getHoldingsAllocation(),

            getHoldings(),

            getHoldingsPlatformAllocation(),

          ]);

        const latestUpdatedAt =
               await getLatestHoldingsHistoryUpdatedAt();

            setLatestUpdatedAt(
              latestUpdatedAt
            );
        // =================================================
        // 固收资产
        // =================================================

        const {
          data:
            fixedIncomeData,
          error:
            fixedIncomeError,
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
            "Dashboard fixed income loading error:",
            fixedIncomeError
          );

        }


        // =================================================
        // 固收总额
        // =================================================

        const fixedIncomeSum = (

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
        // 工具函数
        // =================================================

        const numberValue = (
          value: any
        ): number => {

          const n =
            Number(
              value ?? 0
            );

          return Number.isFinite(
            n
          )
            ? n
            : 0;

        };


        // =================================================
        // Active Holdings
        // =================================================

        const activeHoldings = (

          Array.isArray(
            holdingsData
          )
            ? holdingsData
            : []

        ).filter(

          (
            item: any
          ) =>
            item?.active !== false

        );


        // =================================================
        // Total Cost
        // =================================================

        const totalCost =
          activeHoldings.reduce(

            (
              sum: number,
              item: any
            ) => {

              return (
                sum +
                numberValue(
                  item?.cost
                )
              );

            },

            0

          );


        // =================================================
        // Total Profit
        // =================================================

        const totalProfit =
          activeHoldings.reduce(

            (
              sum: number,
              item: any
            ) => {

              return (
                sum +
                numberValue(
                  item?.profit
                )
              );

            },

            0

          );


        // =================================================
        // Total Return
        // =================================================

        const totalRate =
          totalCost > 0

            ? (
                totalProfit /
                totalCost
              ) * 100

            : 0;


        // =================================================
        // Mainland Holdings
        // =================================================

        const mainlandHoldings =
          activeHoldings.filter(

            (
              item: any
            ) => {

              const market =
                String(
                  item?.market ?? ""
                )
                  .trim()
                  .toUpperCase();

              return (
                market === "CN" ||
                market === "CHINA"
              );

            }

          );


        // =================================================
        // Mainland Asset
        // =================================================

        const cnAsset =
          mainlandHoldings.reduce(

            (
              sum: number,
              item: any
            ) => {

              return (
                sum +
                numberValue(
                  item?.amount
                )
              );

            },

            0

          );


        // =================================================
        // Mainland Cost
        // =================================================

        const cnCost =
          mainlandHoldings.reduce(

            (
              sum: number,
              item: any
            ) => {

              return (
                sum +
                numberValue(
                  item?.cost
                )
              );

            },

            0

          );


        // =================================================
        // Mainland Profit
        // =================================================

        const cnProfit =
          mainlandHoldings.reduce(

            (
              sum: number,
              item: any
            ) => {

              return (
                sum +
                numberValue(
                  item?.profit
                )
              );

            },

            0

          );


        // =================================================
        // Mainland Rate
        // =================================================

        const cnRate =
          cnCost > 0

            ? (
                cnProfit /
                cnCost
              ) * 100

            : 0;


        // =================================================
        // HK / Overseas Holdings
        // =================================================

        const overseasHoldings =
          activeHoldings.filter(

            (
              item: any
            ) => {

              const market =
                String(
                  item?.market ?? ""
                )
                  .trim()
                  .toUpperCase();

              return !(
                market === "CN" ||
                market === "CHINA"
              );

            }

          );


        // =================================================
        // HK Asset
        // =================================================

        const hkAsset =
          overseasHoldings.reduce(

            (
              sum: number,
              item: any
            ) => {

              return (
                sum +
                numberValue(
                  item?.amount
                )
              );

            },

            0

          );


        // =================================================
        // HK Cost
        // =================================================

        const hkCost =
          overseasHoldings.reduce(

            (
              sum: number,
              item: any
            ) => {

              return (
                sum +
                numberValue(
                  item?.cost
                )
              );

            },

            0

          );


        // =================================================
        // HK Profit
        // =================================================

        const hkProfit =
          overseasHoldings.reduce(

            (
              sum: number,
              item: any
            ) => {

              return (
                sum +
                numberValue(
                  item?.profit
                )
              );

            },

            0

          );


        // =================================================
        // HK Rate
        // =================================================

        const hkRate =
          hkCost > 0

            ? (
                hkProfit /
                hkCost
              ) * 100

            : 0;


        // =================================================
        // Investment Total
        // =================================================

        const investmentTotal =
          cnAsset +
          hkAsset;


        // =================================================
        // 原始投资资产
        // =================================================

        const originalTotalWealth =
          numberValue(
            latestAsset?.total_asset
          );


        // =================================================
        // TOTAL WEALTH
        //
        // 投资资产 + 固收资产
        // =================================================

        const totalWealth =
          investmentTotal +
          fixedIncomeSum;


        // =================================================
        // 历史数据排序
        // =================================================

        const sortedHistory =
          (
            Array.isArray(
              assetHistory
            )
              ? assetHistory
              : []
          )
            .filter(
              (
                item: any
              ) =>
                item?.snapshot_date
            )
            .sort(
              (
                a: any,
                b: any
              ) =>
                new Date(
                  a.snapshot_date
                ).getTime() -
                new Date(
                  b.snapshot_date
                ).getTime()
            );


        // =================================================
        // 本地日期解析
        // 避免 UTC 导致日期错一天
        // =================================================

        const parseLocalDate = (
          value: string
        ) => {

          const parts =
            String(
              value
            ).split("-");

          return new Date(

            Number(
              parts[0]
            ),

            Number(
              parts[1]
            ) - 1,

            Number(
              parts[2]
            )

          );

        };


        // =================================================
        // 找目标日期之前最近一条数据
        //
        // 周末 / 节假日 / 缺数据
        // 自动向前寻找最近交易日
        //
        // 如果历史不足：
        // 使用数据库最早记录
        // =================================================

        const findPreviousHistory = (
          targetDate: Date
        ) => {

          const targetTime =
            targetDate.getTime();

          let result =
            null;

          for (
            const item of sortedHistory
          ) {

            const itemDate =
              parseLocalDate(
                item.snapshot_date ?? ""
              );

            if (
              itemDate.getTime() <=
              targetTime
            ) {

              result =
                item;

            } else {

              break;

            }

          }


          // -----------------------------------------------
          // 历史不足
          // -----------------------------------------------

          return (
            result ??
            sortedHistory[0] ??
            null
          );

        };


        // =================================================
        // 当前 Snapshot
        // =================================================

        const currentSnapshot =
          latestAsset ??
          sortedHistory[
            sortedHistory.length - 1
          ] ??
          null;


        const currentDate =
          currentSnapshot?.snapshot_date

            ? parseLocalDate(
                currentSnapshot.snapshot_date
              )

            : new Date();


        // =================================================
        // 历史投资资产
        //
        // asset_history.total_asset
        // = 历史投资资产
        // =================================================

        const getHistoryInvestment =
          (
            item: any
          ) => {

            return numberValue(
              item?.total_asset
            );

          };


        // =================================================
        // 历史大陆投资资产
        // =================================================

        const getHistoryCN =
          (
            item: any
          ) => {

            // 优先使用历史 cn_asset
            if (
              item?.cn_asset !==
              undefined &&
              item?.cn_asset !==
              null
            ) {

              return numberValue(
                item?.cn_asset
              );

            }


            // 如果历史没有 cn_asset，
            // 使用 total_asset 作为兜底
            return 0;

          };


        // =================================================
        // 历史香港投资资产
        // =================================================

        const getHistoryHK =
          (
            item: any
          ) => {

            if (
              item?.hk_asset !==
              undefined &&
              item?.hk_asset !==
              null
            ) {

              return numberValue(
                item?.hk_asset
              );

            }

            return 0;

          };


        // =================================================
        // 历史 TOTAL WEALTH
        //
        // 关键：
        //
        // 历史 Total Wealth
        // =
        // 历史投资资产
        // +
        // 当前固收资产
        //
        // 避免因为固收没有历史 snapshot，
        // 导致 TOTAL WEALTH 出现虚假大幅变化。
        // =================================================

        const getHistoryTotalWealth =
          (
            item: any
          ) => {

            return (
              getHistoryInvestment(
                item
              ) +
              fixedIncomeSum
            );

          };


        // =================================================
        // 日期目标
        // =================================================

        const yesterdayDate =
          new Date(
            currentDate
          );

        yesterdayDate.setDate(
          yesterdayDate.getDate() - 1
        );


        const lastWeekDate =
          new Date(
            currentDate
          );

        lastWeekDate.setDate(
          lastWeekDate.getDate() - 7
        );


        const lastMonthDate =
          new Date(
            currentDate
          );

        lastMonthDate.setMonth(
          lastMonthDate.getMonth() - 1
        );


        const lastYearDate =
          new Date(
            currentDate
          );

        lastYearDate.setFullYear(
          lastYearDate.getFullYear() - 1
        );


        // =================================================
        // 历史记录
        // =================================================

        const yesterdayHistory =
          findPreviousHistory(
            yesterdayDate
          );


        const lastWeekHistory =
          findPreviousHistory(
            lastWeekDate
          );


        const lastMonthHistory =
          findPreviousHistory(
            lastMonthDate
          );


        const lastYearHistory =
          findPreviousHistory(
            lastYearDate
          );


        // =================================================
        // YTD
        //
        // 今年不再显示在 AssetSummary，
        // 但保留数据给后续系统使用。
        // =================================================

        const yearStartDate =
          new Date(
            currentDate.getFullYear(),
            0,
            1
          );


        const ytdBase =
          findPreviousHistory(
            yearStartDate
          );


        // =================================================
        // 通用比较函数
        // =================================================

        const makeComparison =
          (
            currentValue: number,
            previousValue: number,
            previous: any
          ) => {

            if (
              !previous
            ) {

              return {

                available:
                  false,

                snapshot_date:
                  null,

                previous:
                  null,

                change:
                  null,

                change_rate:
                  null,

              };

            }


            const change =
              currentValue -
              previousValue;


            const changeRate =
              previousValue !== 0

                ? (
                    change /
                    previousValue
                  ) * 100

                : 0;


            return {

              available:
                true,

              snapshot_date:
                previous.snapshot_date,

              previous:
                previousValue,

              change,

              change_rate:
                changeRate,

            };

          };


        // =================================================
        // TOTAL WEALTH 比较
        // =================================================

        const totalWealthYesterday =
          yesterdayHistory
            ? getHistoryTotalWealth(
                yesterdayHistory
              )
            : totalWealth;


        const totalWealthLastWeek =
          lastWeekHistory
            ? getHistoryTotalWealth(
                lastWeekHistory
              )
            : totalWealth;


        const totalWealthLastMonth =
          lastMonthHistory
            ? getHistoryTotalWealth(
                lastMonthHistory
              )
            : totalWealth;


        const totalWealthLastYear =
          lastYearHistory
            ? getHistoryTotalWealth(
                lastYearHistory
              )
            : totalWealth;


        // =================================================
        // 投资总资产比较
        // =================================================

        const investmentYesterday =
          yesterdayHistory
            ? getHistoryInvestment(
                yesterdayHistory
              )
            : investmentTotal;


        const investmentLastWeek =
          lastWeekHistory
            ? getHistoryInvestment(
                lastWeekHistory
              )
            : investmentTotal;


        const investmentLastMonth =
          lastMonthHistory
            ? getHistoryInvestment(
                lastMonthHistory
              )
            : investmentTotal;


        const investmentLastYear =
          lastYearHistory
            ? getHistoryInvestment(
                lastYearHistory
              )
            : investmentTotal;


        // =================================================
        // 大陆投资资产比较
        // =================================================

        const cnYesterday =
          yesterdayHistory
            ? getHistoryCN(
                yesterdayHistory
              )
            : cnAsset;


        const cnLastWeek =
          lastWeekHistory
            ? getHistoryCN(
                lastWeekHistory
              )
            : cnAsset;


        const cnLastMonth =
          lastMonthHistory
            ? getHistoryCN(
                lastMonthHistory
              )
            : cnAsset;


        const cnLastYear =
          lastYearHistory
            ? getHistoryCN(
                lastYearHistory
              )
            : cnAsset;


        // =================================================
        // 香港投资资产比较
        // =================================================

        const hkYesterday =
          yesterdayHistory
            ? getHistoryHK(
                yesterdayHistory
              )
            : hkAsset;


        const hkLastWeek =
          lastWeekHistory
            ? getHistoryHK(
                lastWeekHistory
              )
            : hkAsset;


        const hkLastMonth =
          lastMonthHistory
            ? getHistoryHK(
                lastMonthHistory
              )
            : hkAsset;


        const hkLastYear =
          lastYearHistory
            ? getHistoryHK(
                lastYearHistory
              )
            : hkAsset;


        // =================================================
        // 四组完整比较数据
        // =================================================

        const totalWealthComparisons = {

          yesterday:
            makeComparison(
              totalWealth,
              totalWealthYesterday,
              yesterdayHistory
            ),

          last_week:
            makeComparison(
              totalWealth,
              totalWealthLastWeek,
              lastWeekHistory
            ),

          last_month:
            makeComparison(
              totalWealth,
              totalWealthLastMonth,
              lastMonthHistory
            ),

          last_year:
            makeComparison(
              totalWealth,
              totalWealthLastYear,
              lastYearHistory
            ),

        };


        const investmentComparisons = {

          yesterday:
            makeComparison(
              investmentTotal,
              investmentYesterday,
              yesterdayHistory
            ),

          last_week:
            makeComparison(
              investmentTotal,
              investmentLastWeek,
              lastWeekHistory
            ),

          last_month:
            makeComparison(
              investmentTotal,
              investmentLastMonth,
              lastMonthHistory
            ),

          last_year:
            makeComparison(
              investmentTotal,
              investmentLastYear,
              lastYearHistory
            ),

        };


        const cnComparisons = {

          yesterday:
            makeComparison(
              cnAsset,
              cnYesterday,
              yesterdayHistory
            ),

          last_week:
            makeComparison(
              cnAsset,
              cnLastWeek,
              lastWeekHistory
            ),

          last_month:
            makeComparison(
              cnAsset,
              cnLastMonth,
              lastMonthHistory
            ),

          last_year:
            makeComparison(
              cnAsset,
              cnLastYear,
              lastYearHistory
            ),

        };


        const hkComparisons = {

          yesterday:
            makeComparison(
              hkAsset,
              hkYesterday,
              yesterdayHistory
            ),

          last_week:
            makeComparison(
              hkAsset,
              hkLastWeek,
              lastWeekHistory
            ),

          last_month:
            makeComparison(
              hkAsset,
              hkLastMonth,
              lastMonthHistory
            ),

          last_year:
            makeComparison(
              hkAsset,
              hkLastYear,
              lastYearHistory
            ),

        };


        // =================================================
        // YTD 数据
        // 保留，但 AssetSummary 不显示
        // =================================================

        const ytdTotalWealth =
          ytdBase
            ? getHistoryTotalWealth(
                ytdBase
              )
            : totalWealth;


        const ytdComparison =
          makeComparison(
            totalWealth,
            ytdTotalWealth,
            ytdBase
          );


        // =================================================
        // Dashboard Asset
        // =================================================

        const dashboardAsset = {

          ...latestAsset,


          // =================================================
          // TOTAL WEALTH
          // =================================================

          total_asset:
            totalWealth,

          total_wealth:
            totalWealth,


          original_total_asset:
            originalTotalWealth,


          // =================================================
          // Investment Assets
          // =================================================

          investment_total:
            investmentTotal,

          investment_total_asset:
            investmentTotal,


          cn_asset:
            cnAsset,

          hk_asset:
            hkAsset,


          // =================================================
          // Fixed Income
          // =================================================

          fixed_income:
            fixedIncomeSum,

          fixed_income_total:
            fixedIncomeSum,


          // =================================================
          // Profit
          // =================================================

          total_profit:
            totalProfit,

          total_cost:
            totalCost,

          total_rate:
            totalRate,


          // =================================================
          // Mainland Profit
          // =================================================

          cn_profit:
            cnProfit,

          cn_cost:
            cnCost,

          cn_rate:
            cnRate,


          // =================================================
          // HK Profit
          // =================================================

          hk_profit:
            hkProfit,

          hk_cost:
            hkCost,

          hk_rate:
            hkRate,


          // =================================================
          // 四组比较
          // =================================================

          comparisons: {

            total_wealth:
              totalWealthComparisons,

            investment:
              investmentComparisons,

            mainland:
              cnComparisons,

            hong_kong:
              hkComparisons,

            // 保留今年数据，但 UI 不显示
            ytd:
              ytdComparison,

          },

        };


        // =================================================
        // Debug
        // =================================================

        console.log(
          "========================================"
        );

        console.log(
          "Investment Total:",
          investmentTotal
        );

        console.log(
          "Mainland Investment:",
          cnAsset
        );

        console.log(
          "HK Investment:",
          hkAsset
        );

        console.log(
          "Fixed Income:",
          fixedIncomeSum
        );

        console.log(
          "TOTAL WEALTH:",
          totalWealth
        );

        console.log(
          "TOTAL WEALTH Comparisons:",
          totalWealthComparisons
        );

        console.log(
          "Investment Comparisons:",
          investmentComparisons
        );

        console.log(
          "Mainland Comparisons:",
          cnComparisons
        );

        console.log(
          "HK Comparisons:",
          hkComparisons
        );

        console.log(
          "========================================"
        );


        // =================================================
        // 保存
        // =================================================

        setAsset(
          dashboardAsset
        );


        setHistory(
          Array.isArray(
            assetHistory
          )
            ? assetHistory
            : []
        );


        setAllocation(
          holdingsAllocation
        );


        setHoldings(
          Array.isArray(
            holdingsData
          )
            ? holdingsData
            : []
        );


        setPlatformAllocation(
          Array.isArray(
            platformData
          )
            ? platformData
            : []
        );


        setFixedIncomeTotal(
          fixedIncomeSum
        );


      } catch (
        error
      ) {

        console.error(
          "Dashboard loading error:",
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
  // Loading
  // =====================================================

  if (
    loading ||
    !asset
  ) {

    return (

      <>

        <TopBar
          title="Dashboard"
        />


        <div
          className="
            p-10
            text-gray-500
          "
        >
          Loading AI Wealth OS...
        </div>

      </>

    );

  }


  // =====================================================
  // Total Wealth
  // =====================================================

  const totalWealth =
    Number(
      asset?.total_asset ?? 0
    );


  // =====================================================
  // Dashboard
  // =====================================================

  return (

    <>

      <TopBar
        title="Dashboard"
        dataDate={
        asset.snapshot_date
        }
        lastUpdate={
        asset.created_at
        }
        usdCny={
        asset.usd_cny
        }
    />


      <main
        className="
          p-10
          space-y-10
        "
      >

        {/* =================================================
            1. Asset Summary
            ================================================= */}

        <AssetSummary
          asset={
            asset
          }
           updatedAt={
             latestUpdatedAt
          }
        />


        {/* =================================================
            2. 固收资产
            ================================================= */}

        <div
          className="
            bg-white
            rounded-2xl
            shadow
            p-8
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

              <h2
                className="
                  text-2xl
                  font-bold
                  text-gray-900
                "
              >
                🏦 固收资产
              </h2>


              <p
                className="
                  mt-2
                  text-sm
                  text-gray-500
                "
              >
                万能险、活期、理财及其他固定收益资产
              </p>

            </div>


            <div
              className="
                text-right
              "
            >

              <p
                className="
                  text-sm
                  text-gray-500
                "
              >
                固收资产合计
              </p>


              <p
                className="
                  mt-1
                  text-3xl
                  font-bold
                  text-gray-900
                "
              >

                ¥
                {Math.round(
                  fixedIncomeTotal
                ).toLocaleString(
                  "zh-CN"
                )}

              </p>

            </div>

          </div>


          <div
            className="
              mt-6
              grid
              grid-cols-1
              md:grid-cols-3
              gap-4
            "
          >

            <div
              className="
                rounded-xl
                bg-blue-50
                p-5
              "
            >

              <p
                className="
                  text-sm
                  text-gray-500
                "
              >
                资产定位
              </p>


              <p
                className="
                  mt-2
                  font-semibold
                  text-blue-700
                "
              >
                固定收益资产
              </p>

            </div>


            <div
              className="
                rounded-xl
                bg-green-50
                p-5
              "
            >

              <p
                className="
                  text-sm
                  text-gray-500
                "
              >
                纳入 TOTAL WEALTH
              </p>


              <p
                className="
                  mt-2
                  font-semibold
                  text-green-700
                "
              >
                ✓ 已纳入
              </p>

            </div>


            <div
              className="
                rounded-xl
                bg-gray-50
                p-5
              "
            >

              <p
                className="
                  text-sm
                  text-gray-500
                "
              >
                原保险系统
              </p>


              <p
                className="
                  mt-2
                  font-semibold
                  text-gray-700
                "
              >
                独立管理
              </p>

            </div>

          </div>

        </div>


        {/* =================================================
            3. Wealth Trend
            ================================================= */}

        <WealthTrend
          history={
            history
          }
        />


        {/* =================================================
            4. Forecast
            ================================================= */}

        <ForecastCurve
          currentAsset={
            totalWealth
          }
        />


        {/* =================================================
            5. AI Advisor
            ================================================= */}

        <AIAdvisor
          asset={
            asset
          }
          allocation={
            allocation
          }
          holdings={
            holdings
          }
        />


        {/* =================================================
            6. Asset Allocation
            ================================================= */}

        {
          allocation &&
          typeof allocation ===
            "object" &&
          Object.keys(
            allocation
          ).length > 0 && (

            <AssetAllocation
              allocation={
                allocation
              }
            />

          )
        }


        {/* =================================================
            7. Platform Allocation
            ================================================= */}

        {
          platformAllocation.length > 0 && (

            <PlatformAllocation
              data={
                platformAllocation
              }
            />

          )
        }


        {/* =================================================
            8. Holdings
            ================================================= */}

        {
          holdings.length > 0 && (

            <HoldingsTable
              holdings={
                holdings
              }
            />

          )
        }


        {/* =================================================
            9. System Status
            ================================================= */}

        <div
          className="
            bg-white
            rounded-2xl
            shadow
            p-8
          "
        >

          <h2
            className="
              text-2xl
              font-bold
              text-gray-900
            "
          >
            ⚙️ System Status
          </h2>


          <div
            className="
              mt-5
              space-y-2
              text-gray-600
            "
          >

            <p>
              <b>
                Data Source:
              </b>
              {" "}
              Supabase
            </p>


            <p>
              <b>
                Pipeline:
              </b>
              {" "}
              Excel → Python → Supabase
            </p>


            <p>
              <b>
                Snapshot:
              </b>
              {" "}
              {asset.snapshot_date}
            </p>


            <p>
              <b>
                Investment Total:
              </b>
              {" "}
              ¥
              {Math.round(
                Number(
                  asset.investment_total ?? 0
                )
              ).toLocaleString(
                "zh-CN"
              )}
            </p>


            <p>
              <b>
                Fixed Income:
              </b>
              {" "}
              ¥
              {Math.round(
                fixedIncomeTotal
              ).toLocaleString(
                "zh-CN"
              )}
            </p>


            <p>
              <b>
                TOTAL WEALTH:
              </b>
              {" "}
              ¥
              {Math.round(
                totalWealth
              ).toLocaleString(
                "zh-CN"
              )}
            </p>


            <p>
              <b>
                Total Cost:
              </b>
              {" "}
              ¥
              {Math.round(
                Number(
                  asset.total_cost ?? 0
                )
              ).toLocaleString(
                "zh-CN"
              )}
            </p>


            <p>
              <b>
                Total Profit:
              </b>
              {" "}

              {Number(
                asset.total_profit ?? 0
              ) >= 0
                ? "+"
                : ""}

              ¥
              {Math.round(
                Number(
                  asset.total_profit ?? 0
                )
              ).toLocaleString(
                "zh-CN"
              )}

            </p>

          </div>

        </div>

      </main>

    </>

  );

}