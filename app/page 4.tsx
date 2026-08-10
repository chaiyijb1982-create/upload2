
"use client";

import { useEffect, useState } from "react";

import TopBar from "@/components/TopBar";

import {
  getLatestAsset,
  getAssetHistory,
  getHoldingsAllocation,
  getHoldings,
} from "@/lib/asset";

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

  const [loading, setLoading] = useState(true);


  // =====================================================
  // Load Dashboard Data
  // =====================================================

  useEffect(() => {

    async function load() {

      try {

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


        console.log(
          "Dashboard Asset:",
          latestAsset
        );

        console.log(
          "Dashboard History:",
          assetHistory
        );

        console.log(
          "Dashboard Allocation:",
          holdingsAllocation
        );

        console.log(
          "Dashboard Holdings:",
          holdingsData
        );


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
          asset={asset}
        />



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
          currentAsset={asset.total_asset}
        />



        {/* =================================================
            4. AI Advisor
            ================================================= */}

        <AIAdvisor
          asset={asset}
          allocation={allocation}
          holdings={holdings}
        />



        {/* =================================================
            5. Asset Allocation

            这里非常重要：

            Dashboard 只允许出现一个
            AssetAllocation。

            不引入 AllocationCard。
            不渲染 AllocationCard。
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

            只显示一次
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

          </div>

        </div>


      </main>

    </>

  );

}
