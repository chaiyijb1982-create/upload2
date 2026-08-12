"use client";

import {
  useEffect,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getLatestAsset,
  getAssetHistory,
  getHoldings,
  getHoldingsHistoryComparison,
} from "@/lib/asset";

import PerformanceSummary from "@/components/PerformanceSummary";
import ProfitTrend from "@/components/ProfitTrend";
import ProfitRanking from "@/components/ProfitRanking";
import TodayPerformanceTable from "@/components/TodayPerformanceTable";


// =====================================================
// Performance Page
// =====================================================

export default function Performance() {

  const [
    asset,
    setAsset,
  ] =
    useState<any>(null);


  const [
    history,
    setHistory,
  ] =
    useState<any[]>([]);


  const [
    holdings,
    setHoldings,
  ] =
    useState<any[]>([]);


  const [
    comparison,
    setComparison,
  ] =
    useState<any>(null);


  // ===================================================
  // Load
  // ===================================================

  useEffect(
    () => {

      async function load() {

        const [

          latest,

          historyData,

          holdingsData,

          comparisonData,

        ] =
          await Promise.all([

            getLatestAsset(),

            getAssetHistory(),

            getHoldings(),

            getHoldingsHistoryComparison(),

          ]);


        setAsset(
          latest
        );


        setHistory(
          historyData
        );


        setHoldings(
          holdingsData
        );


        setComparison(
          comparisonData
        );

      }


      load();

    },
    []
  );


  // ===================================================
  // Loading
  // ===================================================

  if (!asset) {

    return (

      <>

        <TopBar
          title="Performance"
        />


        <div
          className="
            p-10
          "
        >

          Loading...

        </div>

      </>

    );

  }


  // ===================================================
  // Render
  // ===================================================

  return (

    <>

      {/* =================================================
          TopBar
      ================================================= */}

      <TopBar
        title="Performance"
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
            Performance Summary
        ================================================= */}

        <PerformanceSummary
          asset={
            asset
          }
        />


        {/* =================================================
            今日资产表现
           
            唯一的今日涨跌表格
           
            数据来源：
            holdings_history
           
            自动比较：
            最近交易日
            vs
            前一个交易日
        ================================================= */}

        <TodayPerformanceTable
          comparison={
            comparison
          }
        />


        {/* =================================================
            Profit Trend
        ================================================= */}

        <ProfitTrend
          history={
            history
          }
        />


        {/* =================================================
            Profit Ranking
        ================================================= */}

        <ProfitRanking
          holdings={
            holdings
          }
        />

      </main>

    </>

  );

}