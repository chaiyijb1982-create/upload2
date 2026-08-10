"use client";

import { useEffect, useState } from "react";

import TopBar from "@/components/TopBar";

import {
  getLatestAsset,
  getAssetHistory,
  getHoldingsAllocation,
  getHoldings,
} from "@/lib/asset";

import { supabase } from "@/lib/supabase";

import AssetSummary from "@/components/AssetSummary";
import WealthTrend from "@/components/WealthTrend";
import AIAdvisor from "@/components/AIAdvisor";
import AssetAllocation from "@/components/AssetAllocation";
import HoldingsTable from "@/components/HoldingsTable";
import ForecastCurve from "@/components/ForecastCurve";

export default function Home() {
  const [asset, setAsset] = useState<any>(null);

  const [history, setHistory] = useState<any[]>([]);

  const [allocation, setAllocation] = useState<any>(null);

  const [holdings, setHoldings] = useState<any[]>([]);

  const [fixedIncomeTotal, setFixedIncomeTotal] = useState(0);

  const [loading, setLoading] = useState(true);

  // =====================================================
  // Load Dashboard Data
  // =====================================================

  useEffect(() => {
    async function load() {
      try {
        // =================================================
        // 原 Dashboard 数据
        // =================================================

        const [
          latestAsset,
          assetHistory,
          holdingsAllocation,
          holdingsData,
        ] = await Promise.all([
          getLatestAsset(),
          getAssetHistory(),
          getHoldingsAllocation(),
          getHoldings(),
        ]);

        // =================================================
        // 固收资产
        //
        // 来源：
        // fixed_income_assets
        //
        // 包括：
        // 万能险
        // 活期
        // 理财
        // 其他固收
        //
        // 注意：
        // 这里不会读取 insurance_policies
        // 所以不会和原来的保险系统混在一起
        // =================================================

        const {
          data: fixedIncomeData,
          error: fixedIncomeError,
        } = await supabase
          .from("fixed_income_assets")
          .select("amount");

        if (fixedIncomeError) {
          console.error(
            "Dashboard fixed income loading error:",
            fixedIncomeError
          );
        }

        // =================================================
        // 计算固收资产总额
        // =================================================

        const fixedIncomeSum = (
          Array.isArray(fixedIncomeData)
            ? fixedIncomeData
            : []
        ).reduce(
          (
            sum: number,
            item: any
          ) => {
            const amount = Number(
              item?.amount ?? 0
            );

            return (
              sum +
              (
                Number.isFinite(amount)
                  ? amount
                  : 0
              )
            );
          },
          0
        );

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
          "Dashboard Fixed Income:",
          fixedIncomeData
        );

        console.log(
          "Dashboard Fixed Income Total:",
          fixedIncomeSum
        );

        console.log(
          "Original Total Wealth:",
          Number(
            latestAsset?.total_asset ?? 0
          )
        );

        console.log(
          "New Total Wealth:",
          Number(
            latestAsset?.total_asset ?? 0
          ) +
          fixedIncomeSum
        );

        console.log(
          "========================================"
        );

        // =================================================
        // 保存原始数据
        // =================================================

        setAsset(
          latestAsset
        );

        setHistory(
          Array.isArray(assetHistory)
            ? assetHistory
            : []
        );

        setAllocation(
          holdingsAllocation
        );

        setHoldings(
          Array.isArray(holdingsData)
            ? holdingsData
            : []
        );

        setFixedIncomeTotal(
          fixedIncomeSum
        );

      } catch (error) {
        console.error(
          "Dashboard loading error:",
          error
        );
      } finally {
        setLoading(false);
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
  // 原始 Total Wealth
  // =====================================================

  const originalTotalWealth =
    Number(
      asset?.total_asset ?? 0
    );

  // =====================================================
  // ★ 最终 Total Wealth
  //
  // 原有资产
  // +
  // 固收资产
  //
  // 固收资产包括：
  // 万能险 / 活期 / 理财 / 其他固收
  //
  // 不包括原 Insurance 页面保单
  // =====================================================

  const totalWealth =
    originalTotalWealth +
    fixedIncomeTotal;

  // =====================================================
  // 给 Dashboard Components 的资产数据
  //
  // 保留原 asset 的所有字段，
  // 只把 total_asset 替换成新的 Total Wealth
  // =====================================================

  const dashboardAsset = {
    ...asset,

    total_asset:
      totalWealth,

    total_wealth:
      totalWealth,

    fixed_income:
      fixedIncomeTotal,

    fixed_income_total:
      fixedIncomeTotal,

    original_total_asset:
      originalTotalWealth,
  };

  // =====================================================
  // Dashboard
  // =====================================================

  return (
    <>
      <TopBar
        title="Dashboard"
        lastUpdate={asset.snapshot_date}
        usdCny={asset.usd_cny}
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
          asset={dashboardAsset}
        />

        {/* =================================================
            固收资产
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
            2. Wealth Trend
            ================================================= */}

        <WealthTrend
          history={history}
        />

        {/* =================================================
            3. Forecast
            ================================================= */}

        <ForecastCurve
          currentAsset={totalWealth}
        />

        {/* =================================================
            4. AI Advisor
            ================================================= */}

        <AIAdvisor
          asset={dashboardAsset}
          allocation={allocation}
          holdings={holdings}
        />

        {/* =================================================
            5. Asset Allocation
            ================================================= */}

        {
          allocation &&
          typeof allocation === "object" &&
          Object.keys(allocation).length > 0 && (
            <AssetAllocation
              allocation={allocation}
            />
          )
        }

        {/* =================================================
            6. Holdings
            ================================================= */}

        {
          holdings.length > 0 && (
            <HoldingsTable
              holdings={holdings}
            />
          )
        }

        {/* =================================================
            7. System Status
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
          </div>
        </div>

      </main>
    </>
  );
}

