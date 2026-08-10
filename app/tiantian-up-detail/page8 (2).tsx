"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getTotalWealthWithFixedIncome,
} from "@/lib/asset";

import {
  getInsuranceSummary,
  getInsuranceYearProjection,
} from "@/lib/insurance";


// =====================================================
// 参数
// =====================================================

const START_YEAR = 2027;

// ★ 财务自由只计算到 2041
const FREEDOM_END_YEAR = 2041;


// =====================================================
// 财务自由目标
//
// 2027–2031：37万
// 2032–2041：32万
// =====================================================

const BASE_EXPENSE: Record<number, number> = {

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

};


// =====================================================
// 年金缴费
// =====================================================

const ANNUITY: Record<number, number> = {

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

};


// =====================================================
// 年收入
// =====================================================

const ANNUAL_INCOME = 1100000;


// =====================================================
// 投资收益率
// =====================================================

const RETURN_RATE = 0.05;


// =====================================================
// 数字
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
// 金额
// =====================================================

function money(
  value: number
) {

  const n =
    toNumber(value);


  if (
    n >= 100000000
  ) {

    return (
      "¥" +
      (
        n /
        100000000
      ).toFixed(2) +
      " 亿"
    );

  }


  if (
    n >= 10000
  ) {

    return (
      "¥" +
      (
        n /
        10000
      ).toFixed(1) +
      " 万"
    );

  }


  return (
    "¥" +
    Math.round(n)
      .toLocaleString(
        "zh-CN"
      )
  );

}


// =====================================================
// 百分比
// =====================================================

function percent(
  value: number
) {

  return (
    toNumber(value)
      .toFixed(1) +
    "%"
  );

}


// =====================================================
// 获取字段
//
// ★★★ 重点 ★★★
//
// 保险年度数据不同版本可能存在：
//
// totalFuturePremium
// total_future_premium
// unpaidPremium
// unpaid_premium
//
// 等不同命名。
//
// 这里统一兼容。
// =====================================================

function readNumber(
  item: any,
  keys: string[]
): number {

  if (!item) {
    return 0;
  }


  for (
    const key of keys
  ) {

    const value =
      item?.[key];


    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {

      const n =
        Number(value);


      if (
        Number.isFinite(n)
      ) {

        return n;

      }

    }

  }


  return 0;

}


// =====================================================
// 保险年度数据标准化
//
// ★★★ 解决保险三列显示 0 的核心 ★★★
//
// 兼容：
//
// totalFuturePremium
// total_future_premium
// futurePremium
// future_premium
// unpaidPremium
// unpaid_premium
//
// coupleFuturePremium
// couple_future_premium
// coupleUnpaidPremium
// couple_unpaid_premium
//
// sonCashValue
// son_cash_value
// sonCashValueYear
// son_cash_value_year
//
// =====================================================

function normalizeInsuranceProjection(
  source: any
): any[] {


  let list: any[] = [];


  // =================================================
  // 1. 本身就是数组
  // =================================================

  if (
    Array.isArray(source)
  ) {

    list =
      source;

  }


  // =================================================
  // 2. 常见 object 包装
  // =================================================

  else if (
    Array.isArray(
      source?.data
    )
  ) {

    list =
      source.data;

  }


  else if (
    Array.isArray(
      source?.rows
    )
  ) {

    list =
      source.rows;

  }


  else if (
    Array.isArray(
      source?.projection
    )
  ) {

    list =
      source.projection;

  }


  else if (
    Array.isArray(
      source?.yearlyProjection
    )
  ) {

    list =
      source.yearlyProjection;

  }


  // =================================================
  // 3. 如果是按年份 object：
  //
  // {
  //   "2027": {...},
  //   "2028": {...}
  // }
  // =================================================

  else if (
    source &&
    typeof source === "object"
  ) {

    const keys =
      Object.keys(source);


    const yearKeys =
      keys.filter(
        key =>
          /^\d{4}$/.test(
            key
          )
      );


    if (
      yearKeys.length > 0
    ) {

      list =
        yearKeys.map(
          year => ({
            year:
              Number(year),

            ...(
              source[year]
            ),
          })
        );

    }

  }


  // =================================================
  // 标准化
  // =================================================

  return list
    .map(
      (
        item: any
      ) => {

        const year =
          readNumber(
            item,
            [
              "year",
              "projectionYear",
              "projection_year",
            ]
          );


        // =============================================
        // 全部未来保费
        // =============================================

        const totalFuturePremium =
          readNumber(
            item,
            [

              "totalFuturePremium",

              "total_future_premium",

              "futurePremium",

              "future_premium",

              "unpaidPremium",

              "unpaid_premium",

              "remainingPremium",

              "remaining_premium",

              "totalUnpaidPremium",

              "total_unpaid_premium",

            ]
          );


        // =============================================
        // 夫妻未来保费
        // =============================================

        const coupleFuturePremium =
          readNumber(
            item,
            [

              "coupleFuturePremium",

              "couple_future_premium",

              "coupleUnpaidPremium",

              "couple_unpaid_premium",

              "coupleRemainingPremium",

              "couple_remaining_premium",

              "coupleFuturePremiumAmount",

              "couple_future_premium_amount",

            ]
          );


        // =============================================
        // 儿子现金价值
        // =============================================

        const sonCashValue =
          readNumber(
            item,
            [

              "sonCashValue",

              "son_cash_value",

              "sonCashValueYear",

              "son_cash_value_year",

              "sonYearCashValue",

              "son_year_cash_value",

              "sonCashValueEnd",

              "son_cash_value_end",

            ]
          );


        return {

          ...item,

          year,

          totalFuturePremium,

          coupleFuturePremium,

          sonCashValue,

        };

      }
    )
    .filter(
      item =>
        item.year >=
          START_YEAR &&
        item.year <=
          FREEDOM_END_YEAR
    )
    .sort(
      (
        a,
        b
      ) =>
        a.year -
        b.year
    );

}


// =====================================================
// 页面
// =====================================================

export default function TiantianUpDetailPage() {


  // ===================================================
  // 当前家庭资产
  // ===================================================

  const [
    currentAsset,
    setCurrentAsset,
  ] = useState(0);


  // ===================================================
  // 保险 Summary
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


  // ===================================================
  // 财务自由目标
  //
  // 2027–2041
  // ===================================================

  const freedomTarget =
    useMemo(
      () => {

        let total =
          0;


        for (
          let year =
            START_YEAR;

          year <=
            FREEDOM_END_YEAR;

          year++
        ) {

          total +=
            toNumber(
              BASE_EXPENSE[
                year
              ]
            );

        }


        return total;

      },
      []
    );


  // ===================================================
  // 加载
  // ===================================================

  useEffect(
    () => {

      async function load() {

        try {

          setLoading(true);


          // ===========================================
          // 同时读取：
          //
          // 1. 当前家庭资产
          // 2. 保险 Summary
          // 3. 保险年度预测
          // ===========================================

          const [
            asset,
            insuranceData,
            projectionData,
          ] =
            await Promise.all(
              [

                getTotalWealthWithFixedIncome(),

                getInsuranceSummary(),

                getInsuranceYearProjection(),

              ]
            );


          // ===========================================
          // 当前资产
          // ===========================================

          const assetNumber =
            toNumber(
              asset
            );


          setCurrentAsset(
            assetNumber
          );


          // ===========================================
          // Insurance Summary
          // ===========================================

          setInsurance(
            insuranceData
          );


          // ===========================================
          // 年度保险数据
          // ===========================================

          const normalized =
            normalizeInsuranceProjection(
              projectionData
            );


          setInsuranceProjection(
            normalized
          );


          // ===========================================
          // Debug
          // ===========================================

          console.log(
            "========================================"
          );

          console.log(
            "TIANTIAN UP DETAIL FINAL"
          );

          console.log(
            "Current Asset:",
            assetNumber
          );

          console.log(
            "Insurance Summary:",
            insuranceData
          );

          console.log(
            "Original Insurance Projection:",
            projectionData
          );

          console.log(
            "Normalized Insurance Projection:",
            normalized
          );

          console.log(
            "Freedom Target:",
            freedomTarget
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

    },
    [
      freedomTarget,
    ]
  );


  // ===================================================
  // 当前财务自由差额
  //
  // ★ 当前目标采用 2027–2041
  // ===================================================

  const currentFreedomGap =
    Math.max(
      freedomTarget -
        currentAsset,
      0
    );


  // ===================================================
  // 当前保险数据
  // ===================================================

  const totalUnpaidPremium =
    readNumber(
      insurance,
      [

        "unpaidPremium",

        "unpaid_premium",

        "remainingPremium",

        "remaining_premium",

        "totalUnpaidPremium",

        "total_unpaid_premium",

      ]
    );


  const coupleUnpaidPremium =
    readNumber(
      insurance,
      [

        "coupleUnpaidPremium",

        "couple_unpaid_premium",

        "coupleRemainingPremium",

        "couple_remaining_premium",

      ]
    );


  const currentSonCashValue =
    readNumber(
      insurance,
      [

        "sonCashValue",

        "son_cash_value",

      ]
    );


  // ===================================================
  // 当前天天向上1
  //
  // 财务自由差额
  // +
  // 全部未来未缴保费
  // ===================================================

  const tiantian1 =
    currentFreedomGap +
    totalUnpaidPremium;


  // ===================================================
  // 当前天天向上2
  //
  // 财务自由差额
  // +
  // 夫妻未来保费
  // -
  // 儿子现金价值
  // ===================================================

  const tiantian2 =
    currentFreedomGap +
    coupleUnpaidPremium -
    currentSonCashValue;


  // ===================================================
  // 年度模拟
  //
  // ★ 完全按照天天向上 / FREEDOM 的资产模型
  //
  // 年初资产
  // +
  // 年收入
  // -
  // 生活费
  // -
  // 年金
  // +
  // 年初资产 × 5%
  // =
  // 年末资产
  // ===================================================

  const yearlyRows =
    useMemo(
      () => {

        const rows: any[] =
          [];


        let simulationAsset =
          currentAsset;


        for (
          let year =
            START_YEAR;

          year <=
            FREEDOM_END_YEAR;

          year++
        ) {


          // =========================================
          // 年初资产
          // =========================================

          const beginAsset =
            simulationAsset;


          // =========================================
          // 年收入
          // =========================================

          const income =
            ANNUAL_INCOME;


          // =========================================
          // 生活费
          // =========================================

          const expense =
            toNumber(
              BASE_EXPENSE[
                year
              ]
            );


          // =========================================
          // 年金
          // =========================================

          const pension =
            toNumber(
              ANNUITY[
                year
              ]
            );


          // =========================================
          // 新增投资
          // =========================================

          const newInvestment =
            income -
            expense -
            pension;


          // =========================================
          // 投资收益
          //
          // 年初资产 × 5%
          // =========================================

          const investmentReturn =
            beginAsset *
            RETURN_RATE;


          // =========================================
          // 年末资产
          // =========================================

          const totalAsset =
            beginAsset +
            newInvestment +
            investmentReturn;


          // =========================================
          // ★★★ 财务自由差额（年末）
          //
          // 必须使用：
          //
          // 1000万 - 年末资产
          //
          // 不包含保险
          // =========================================

          const freedomGapEnd =
            Math.max(
              10000000 -
                totalAsset,
              0
            );


          // =========================================
          // 查找该年度保险预测
          // =========================================

          const projection =
            insuranceProjection.find(
              (
                item: any
              ) =>
                Number(
                  item?.year
                ) === year
            );


          // =========================================
          // 全部未来保费
          //
          // ★ 已经标准化
          // =========================================

          const totalFuturePremium =
            toNumber(
              projection?.totalFuturePremium
            );


          // =========================================
          // 夫妻未来保费
          // =========================================

          const coupleFuturePremium =
            toNumber(
              projection?.coupleFuturePremium
            );


          // =========================================
          // 儿子现金价值
          // =========================================

          const sonCashValue =
            toNumber(
              projection?.sonCashValue
            );


          // =========================================
          // 天天向上1
          //
          // 年末财务自由差额
          // +
          // 全部未来保费
          // =========================================

          const yearTiantian1 =
            freedomGapEnd +
            totalFuturePremium;


          // =========================================
          // 天天向上2
          //
          // 年末财务自由差额
          // +
          // 夫妻未来保费
          // -
          // 儿子现金价值
          // =========================================

          const yearTiantian2 =
            freedomGapEnd +
            coupleFuturePremium -
            sonCashValue;


          // =========================================
          // 保存
          // =========================================

          rows.push({

            year,

            beginAsset,

            income,

            expense,

            pension,

            newInvestment,

            investmentReturn,

            totalAsset,

            freedomGapEnd,

            totalFuturePremium,

            coupleFuturePremium,

            sonCashValue,

            yearTiantian1,

            yearTiantian2,

          });


          // =========================================
          // 下一年
          // =========================================

          simulationAsset =
            totalAsset;

        }


        return rows;

      },
      [
        currentAsset,
        insuranceProjection,
      ]
    );


  // ===================================================
  // Loading
  // ===================================================

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

          <div
            className="
              text-gray-500
            "
          >

            正在加载财富数据...

          </div>

        </main>

      </>

    );

  }


  // ===================================================
  // 页面
  // ===================================================

  return (

    <>

      <TopBar
        title="天天向上详情"
      />


      <main
        className="
          p-8
          max-w-[1500px]
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
              text-gray-500
              mt-2
            "
          >

            2027–2041 财务自由 + 保险压力年度分析

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

              财务自由差额 + 全部未缴保费

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

              财务自由差额 + 夫妻未来保费 − 儿子现金价值

            </p>

          </div>

        </section>


        {/* =================================================
            当前状态
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


          {/* 当前资产 */}

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

              当前家庭资产

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

              与天天向上 / FREEDOM 当前资产口径一致

            </p>

          </div>


          {/* 财务自由目标 */}

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

              2027–2041

            </p>

          </div>


          {/* 当前差额 */}

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

              财务自由目标 − 当前家庭资产

            </p>

          </div>


          {/* 全部未来保费 */}

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
                  totalUnpaidPremium
                )
              }

            </h2>

          </div>

        </section>


        {/* =================================================
            保险当前数据
            ================================================= */}

        <section
          className="
            bg-white
            border
            rounded-2xl
            p-7
          "
        >

          <h2
            className="
              text-xl
              font-bold
            "
          >

            🛡️ 当前保险数据

          </h2>


          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-3
              gap-6
              mt-6
            "
          >


            {/* 全部 */}

            <div>

              <p
                className="
                  text-gray-500
                "
              >

                全部未缴保费

              </p>


              <p
                className="
                  text-2xl
                  font-bold
                  mt-2
                "
              >

                {
                  money(
                    totalUnpaidPremium
                  )
                }

              </p>

            </div>


            {/* 夫妻 */}

            <div>

              <p
                className="
                  text-gray-500
                "
              >

                夫妻未缴保费

              </p>


              <p
                className="
                  text-2xl
                  font-bold
                  mt-2
                "
              >

                {
                  money(
                    coupleUnpaidPremium
                  )
                }

              </p>

            </div>


            {/* 儿子 */}

            <div>

              <p
                className="
                  text-gray-500
                "
              >

                儿子现金价值

              </p>


              <p
                className="
                  text-2xl
                  font-bold
                  mt-2
                "
              >

                {
                  money(
                    currentSonCashValue
                  )
                }

              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            计算公式
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
                年末资产
              </b>

              ＝

              年初资产

              ＋

              年收入

              −

              生活费

              −

              年金

              ＋

              年初资产 × 5%

            </p>


            <p>

              <b>
                财务自由差额（年末）
              </b>

              ＝

              max(
              1000万 − 年末资产,
              0
              )

            </p>


            <p>

              <b>
                天天向上1
              </b>

              ＝

              财务自由差额（年末）

              ＋

              全部未来保费

            </p>


            <p>

              <b>
                天天向上2
              </b>

              ＝

              财务自由差额（年末）

              ＋

              夫妻未来保费

              −

              儿子现金价值

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
          "
        >


          {/* Header */}

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

              📊 2027–2041 天天向上年度预测

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-1
              "
            >

              年末资产、财务自由差额与保险未来压力

            </p>

          </div>


          {/* Table */}

          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className="
                w-full
                text-sm
                min-w-[1350px]
              "
            >


              <thead
                className="
                  bg-gray-50
                  border-b
                "
              >

                <tr>


                  {/* 年份 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-left
                      whitespace-nowrap
                    "
                  >

                    年份

                  </th>


                  {/* 年初资产 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >

                    年初资产

                  </th>


                  {/* 新增投资 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >

                    新增投资

                  </th>


                  {/* 投资收益 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >

                    投资收益

                  </th>


                  {/* 年末资产 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >

                    年末资产

                  </th>


                  {/* ★ 财务自由差额 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >

                    财务自由差额（年末）

                  </th>


                  {/* 全部未来保费 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >

                    全部未来保费

                  </th>


                  {/* 夫妻未来保费 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >

                    夫妻未来保费

                  </th>


                  {/* 儿子现金价值 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >

                    儿子现金价值

                  </th>


                  {/* 天天向上1 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
                    "
                  >

                    天天向上1

                  </th>


                  {/* 天天向上2 */}

                  <th
                    className="
                      px-5
                      py-4
                      text-right
                      whitespace-nowrap
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
                      row: any
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


                        {/* 年份 */}

                        <td
                          className="
                            px-5
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
                            px-5
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


                        {/* 新增投资 */}

                        <td
                          className="
                            px-5
                            py-4
                            text-right
                            whitespace-nowrap
                          "
                        >

                          {
                            money(
                              row.newInvestment
                            )
                          }

                        </td>


                        {/* 投资收益 */}

                        <td
                          className="
                            px-5
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
                            px-5
                            py-4
                            text-right
                            font-semibold
                            whitespace-nowrap
                          "
                        >

                          {
                            money(
                              row.totalAsset
                            )
                          }

                        </td>


                        {/* 财务自由差额 */}

                        <td
                          className="
                            px-5
                            py-4
                            text-right
                            font-semibold
                            text-blue-700
                            whitespace-nowrap
                          "
                        >

                          {
                            money(
                              row.freedomGapEnd
                            )
                          }

                        </td>


                        {/* 全部未来保费 */}

                        <td
                          className="
                            px-5
                            py-4
                            text-right
                            text-purple-700
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
                            px-5
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
                            px-5
                            py-4
                            text-right
                            text-green-700
                            whitespace-nowrap
                          "
                        >

                          {
                            money(
                              row.sonCashValue
                            )
                          }

                        </td>


                        {/* 天天向上1 */}

                        <td
                          className="
                            px-5
                            py-4
                            text-right
                            font-semibold
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
                            px-5
                            py-4
                            text-right
                            font-semibold
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

                    )
                  )
                }


              </tbody>

            </table>

          </div>

        </section>


        {/* =================================================
            最后一年
            ================================================= */}

        {
          yearlyRows.length > 0 && (

            <section
              className="
                bg-gray-50
                border
                rounded-2xl
                p-7
              "
            >

              <h2
                className="
                  text-lg
                  font-bold
                "
              >

                🎯 2041 财务自由最终状态

              </h2>


              {
                (() => {

                  const last =
                    yearlyRows[
                      yearlyRows.length -
                      1
                    ];


                  return (

                    <div
                      className="
                        grid
                        grid-cols-1
                        md:grid-cols-2
                        lg:grid-cols-5
                        gap-5
                        mt-5
                      "
                    >


                      <div>

                        <p
                          className="
                            text-sm
                            text-gray-500
                          "
                        >

                          2041 年末资产

                        </p>


                        <p
                          className="
                            text-2xl
                            font-bold
                            mt-2
                          "
                        >

                          {
                            money(
                              last.totalAsset
                            )
                          }

                        </p>

                      </div>


                      <div>

                        <p
                          className="
                            text-sm
                            text-gray-500
                          "
                        >

                          财务自由差额

                        </p>


                        <p
                          className="
                            text-2xl
                            font-bold
                            text-blue-700
                            mt-2
                          "
                        >

                          {
                            money(
                              last.freedomGapEnd
                            )
                          }

                        </p>

                      </div>


                      <div>

                        <p
                          className="
                            text-sm
                            text-gray-500
                          "
                        >

                          全部未来保费

                        </p>


                        <p
                          className="
                            text-2xl
                            font-bold
                            text-purple-700
                            mt-2
                          "
                        >

                          {
                            money(
                              last.totalFuturePremium
                            )
                          }

                        </p>

                      </div>


                      <div>

                        <p
                          className="
                            text-sm
                            text-gray-500
                          "
                        >

                          夫妻未来保费

                        </p>


                        <p
                          className="
                            text-2xl
                            font-bold
                            mt-2
                          "
                        >

                          {
                            money(
                              last.coupleFuturePremium
                            )
                          }

                        </p>

                      </div>


                      <div>

                        <p
                          className="
                            text-sm
                            text-gray-500
                          "
                        >

                          儿子现金价值

                        </p>


                        <p
                          className="
                            text-2xl
                            font-bold
                            text-green-700
                            mt-2
                          "
                        >

                          {
                            money(
                              last.sonCashValue
                            )
                          }

                        </p>

                      </div>


                    </div>

                  );

                })()
              }

            </section>

          )
        }


      </main>

    </>

  );

}