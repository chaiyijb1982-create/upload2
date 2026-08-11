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
        // Dashboard 基础数据
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
        // Holdings
        //
        // 只计算 active
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
        // Total Profit
        //
        // 所有 active Holdings 的 profit 汇总
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
        // Total Cost
        //
        // 所有 active Holdings 的 cost 汇总
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
        // Total Return
        //
        // Profit / Cost
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
        //
        // 与 asset_history 的逻辑保持一致：
        //
        // CN / CHINA → 大陆
        // 其他 → 香港 / 海外
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
        // Mainland Return
        // =================================================

        const cnRate =
          cnCost > 0

            ? (
                cnProfit /
                cnCost
              ) * 100

            : 0;


        // =================================================
        // Overseas / HK Holdings
        //
        // 保持与你现在 asset_history
        // hk_asset 的定义一致
        //
        // 非 CN 全部归入这里
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
        // HK Return
        // =================================================

        const hkRate =
          hkCost > 0

            ? (
                hkProfit /
                hkCost
              ) * 100

            : 0;


        // =================================================
        // 原始 Total Wealth
        //
        // 来自 asset_history
        //
        // 这里不改变原有逻辑
        // =================================================

        const originalTotalWealth =
          numberValue(
            latestAsset?.total_asset
          );


        // =================================================
        // 最终 Total Wealth
        //
        // Holdings / Asset History
        // +
        // 固收资产
        // =================================================

        const totalWealth =
          originalTotalWealth +
          fixedIncomeSum;


        // =================================================
        // Dashboard Asset
        //
        // 把真正计算出来的：
        //
        // total_profit
        // total_rate
        // cn_profit
        // cn_rate
        // hk_profit
        // hk_rate
        //
        // 全部传给 AssetSummary
        // =================================================

        const dashboardAsset = {

          ...latestAsset,

          // -----------------------------
          // Wealth
          // -----------------------------

          total_asset:
            totalWealth,

          total_wealth:
            totalWealth,

          original_total_asset:
            originalTotalWealth,

          fixed_income:
            fixedIncomeSum,

          fixed_income_total:
            fixedIncomeSum,


          // -----------------------------
          // Profit
          // -----------------------------

          total_profit:
            totalProfit,

          total_cost:
            totalCost,

          total_rate:
            totalRate,


          // -----------------------------
          // Mainland
          // -----------------------------

          cn_profit:
            cnProfit,

          cn_cost:
            cnCost,

          cn_rate:
            cnRate,


          // -----------------------------
          // Hong Kong / Overseas
          // -----------------------------

          hk_profit:
            hkProfit,

          hk_cost:
            hkCost,

          hk_rate:
            hkRate,

        };


        // =================================================
        // Debug
        // =================================================

        console.log(
          "========================================"
        );

        console.log(
          "Dashboard Asset:",
          latestAsset
        );

        console.log(
          "Active Holdings:",
          activeHoldings
        );

        console.log(
          "Total Cost:",
          totalCost
        );

        console.log(
          "Total Profit:",
          totalProfit
        );

        console.log(
          "Total Return:",
          totalRate
        );

        console.log(
          "Mainland Profit:",
          cnProfit
        );

        console.log(
          "Mainland Return:",
          cnRate
        );

        console.log(
          "HK / Overseas Profit:",
          hkProfit
        );

        console.log(
          "HK / Overseas Return:",
          hkRate
        );

        console.log(
          "Fixed Income:",
          fixedIncomeSum
        );

        console.log(
          "Total Wealth:",
          totalWealth
        );

        console.log(
          "Dashboard Asset Final:",
          dashboardAsset
        );

        console.log(
          "========================================"
        );


        // =================================================
        // 保存数据
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

  const originalTotalWealth =
    Number(
      asset?.original_total_asset ?? 0
    );


  const totalWealth =
    Number(
      asset?.total_asset ?? 0
    );


  // =====================================================
  // Dashboard
  // =====================================================

  return (

    <>

      {/* =================================================
          TopBar
      ================================================= */}

      <TopBar
        title="Dashboard"
        lastUpdate={
          asset.snapshot_date
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
            1. Total Wealth
            ================================================= */}

        <AssetSummary
          asset={
            asset
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

            {/* ==========================================
                资产定位
            ========================================== */}

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


            {/* ==========================================
                Total Wealth
            ========================================== */}

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
                纳入 Total Wealth
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


            {/* ==========================================
                Insurance
            ========================================== */}

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
                Original Total Wealth:
              </b>

              {" "}

              ¥
              {Math.round(
                originalTotalWealth
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
                Total Wealth:
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