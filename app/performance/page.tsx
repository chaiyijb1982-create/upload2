"use client";

import {
useEffect,
useMemo,
useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
getLatestAsset,
getHoldingsHistoryComparison,
getPerformanceHistory,
} from "@/lib/asset";

// =====================================================
// 类型
// =====================================================

type PerformancePoint = {

date: string;

profit: number;

profitRate: number;

};

type ComparisonData = {

latestDate: string | null;

previousDate: string | null;

latest: any[];

previous: any[];

};

type Period =
| "daily"
| "weekly"
| "monthly"
| "yearly";

// =====================================================
// 工具
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
// 判断 market
//
// 严格按照 holdings.market
//
// CN / CHINA
// → 大陆
//
// HK / HONGKONG
// US / USA
// LU / LUXEMBOURG
// → 香港
// =====================================================

function normalizeMarket(
value: any
): string {

return String(
value ?? ""
)
.trim()
.toUpperCase();

}

function isMainlandMarket(
value: any
): boolean {

const market =
normalizeMarket(
value
);

return (
market === "CN" ||
market === "CHINA"
);

}

function isHongKongMarket(
value: any
): boolean {

const market =
normalizeMarket(
value
);

return (
market === "HK" ||
market === "HONGKONG" ||
market === "US" ||
market === "USA" ||
market === "LU" ||
market === "LUXEMBOURG"
);

}

// =====================================================
// Currency
// =====================================================

function formatMoney(
value: number
): string {

const amount =
Math.round(
value
);

if (
amount < 0
) {

 
return (
  "-¥" +
  Math.abs(
    amount
  ).toLocaleString(
    "zh-CN"
  )
);
 

}

return (
"¥" +
amount.toLocaleString(
"zh-CN"
)
);

}

function formatRate(
value: number
): string {

const n =
toNumber(
value
);

const sign =
n > 0
? "+"
: "";

return (
sign +
n.toFixed(2) +
"%"
);

}

// =====================================================
// 今日表现计算
// =====================================================

function calculateTodayPerformance(
latest: any[],
previous: any[]
) {

const latestMap =
new Map<
string,
any
>();

const previousMap =
new Map<
string,
any
>();

latest.forEach(
row => {

 
  const key =
    String(
      row?.code ??
      ""
    )
      .trim()
      .toUpperCase();


  if (
    key
  ) {

    latestMap.set(
      key,
      row
    );

  }

}


);

previous.forEach(
row => {


  const key =
    String(
      row?.code ??
      ""
    )
      .trim()
      .toUpperCase();


  if (
    key
  ) {

    previousMap.set(
      key,
      row
    );

  }

}


);

let mainlandLatest =
0;

let mainlandPrevious =
0;

let hkLatest =
0;

let hkPrevious =
0;

// ===================================================
// 使用所有出现过的 code
// ===================================================

const codes =
new Set<string>([
...latestMap.keys(),
...previousMap.keys(),
]);

codes.forEach(
code => {


  const current =
    latestMap.get(
      code
    );


  const previousRow =
    previousMap.get(
      code
    );


  const market =
    current?.market ??
    previousRow?.market;


  const currentAmount =
    toNumber(
      current?.amount
    );


  const previousAmount =
    toNumber(
      previousRow?.amount
    );


  if (
    isMainlandMarket(
      market
    )
  ) {

    mainlandLatest +=
      currentAmount;

    mainlandPrevious +=
      previousAmount;

  }
  else if (
    isHongKongMarket(
      market
    )
  ) {

    hkLatest +=
      currentAmount;

    hkPrevious +=
      previousAmount;

  }

}


);

const mainlandProfit =
mainlandLatest -
mainlandPrevious;

const hkProfit =
hkLatest -
hkPrevious;

const totalProfit =
mainlandProfit +
hkProfit;

const mainlandRate =
mainlandPrevious > 0
? (
mainlandProfit /
mainlandPrevious
) *
100
: 0;

const hkRate =
hkPrevious > 0
? (
hkProfit /
hkPrevious
) *
100
: 0;

const totalPrevious =
mainlandPrevious +
hkPrevious;

const totalRate =
totalPrevious > 0
? (
totalProfit /
totalPrevious
) *
100
: 0;

return {


mainland: {

  profit:
    mainlandProfit,

  rate:
    mainlandRate,

},

hk: {

  profit:
    hkProfit,

  rate:
    hkRate,

},

total: {

  profit:
    totalProfit,

  rate:
    totalRate,

},


};

}

// =====================================================
// 今日表现卡片
// =====================================================

function TodayBlock({
title,
profit,
rate,
}: {
title: string;

profit: number;

rate: number;

}) {

return (

 
<div
  className="
    rounded-2xl
    border
    bg-white
    p-6
    shadow-sm
  "
>

  <div
    className="
      text-lg
      font-semibold
      mb-5
    "
  >

    {title}

  </div>


  <div
    className="
      grid
      grid-cols-2
      gap-6
    "
  >

    <div>

      <div
        className="
          text-sm
          text-gray-500
          mb-1
        "
      >

        收益额

      </div>


      <div
        className="
          text-2xl
          font-semibold
        "
      >

        {
          formatMoney(
            profit
          )
        }

      </div>

    </div>


    <div>

      <div
        className="
          text-sm
          text-gray-500
          mb-1
        "
      >

        收益率

      </div>


      <div
        className="
          text-2xl
          font-semibold
        "
      >

        {
          formatRate(
            rate
          )
        }

      </div>

    </div>

  </div>

</div>
 

);

}

// =====================================================
// 历史表格
//
// 默认显示数量：
//
// daily   → 30 条
// weekly  → 12 条
// monthly → 12 条
// yearly  → 5 条
//
// 这里前端只负责限制显示数量。
// getPerformanceHistory() 仍然可以返回完整历史数据。
// =====================================================

function HistoryTable({
title,
points,
period,
}: {
title: string;

points: PerformancePoint[];

period: Period;

}) {

const displayLimit =
period === "daily"
? 30
: period === "weekly"
? 12
: period === "monthly"
? 12
: 5;

const displayPoints =
points
.slice(
0,
displayLimit
);

return (

 
<section>

  <div
    className="
      text-lg
      font-semibold
      mb-4
    "
  >

    {title}

  </div>


  <div
    className="
      overflow-hidden
      rounded-2xl
      border
      bg-white
      shadow-sm
    "
  >

    <table
      className="
        w-full
        text-sm
      "
    >

      <thead>

        <tr
          className="
            border-b
            bg-gray-50
          "
        >

          <th
            className="
              px-5
              py-3
              text-left
              font-medium
              text-gray-500
            "
          >

            日期

          </th>


          <th
            className="
              px-5
              py-3
              text-right
              font-medium
              text-gray-500
            "
          >

            收益额

          </th>


          <th
            className="
              px-5
              py-3
              text-right
              font-medium
              text-gray-500
            "
          >

            收益率

          </th>

        </tr>

      </thead>


      <tbody>

        {
          displayPoints.length === 0
            ? (

              <tr>

                <td
                  colSpan={3}
                  className="
                    px-5
                    py-8
                    text-center
                    text-gray-400
                  "
                >

                  暂无历史数据

                </td>

              </tr>

            )
            : (

              displayPoints.map(
                point => (

                  <tr
                    key={
                      point.date
                    }
                    className="
                      border-b
                      last:border-b-0
                    "
                  >

                    <td
                      className="
                        px-5
                        py-3
                      "
                    >

                      {
                        point.date
                      }

                    </td>


                    <td
                      className="
                        px-5
                        py-3
                        text-right
                        font-medium
                      "
                    >

                      {
                        formatMoney(
                          point.profit
                        )
                      }

                    </td>


                    <td
                      className="
                        px-5
                        py-3
                        text-right
                        font-medium
                      "
                    >

                      {
                        formatRate(
                          point.profitRate
                        )
                      }

                    </td>

                  </tr>

                )
              )

            )
        }

      </tbody>

    </table>

  </div>


  {
    points.length > displayLimit && (

      <div
        className="
          mt-2
          text-xs
          text-gray-400
          text-right
        "
      >

        显示最近 {
          displayLimit
        } 条

      </div>

    )
  }

</section>
 

);

}

// =====================================================
// 历史区块
// =====================================================

function HistorySection({
title,
history,
}: {
title: string;

history: {
daily: PerformancePoint[];

 
weekly: PerformancePoint[];

monthly: PerformancePoint[];

yearly: PerformancePoint[];
 

};

}) {

// ===================================================
// 默认：周
// ===================================================

const [
period,
setPeriod,
] =
useState<Period>(
"weekly"
);

const points =
Array.isArray(
history?.[period]
)
? history[period]
: [];

return (

 
<section>

  <div
    className="
      flex
      items-center
      justify-between
      mb-4
    "
  >

    <h2
      className="
        text-xl
        font-semibold
      "
    >

      {title}

    </h2>


    <div
      className="
        inline-flex
        rounded-lg
        border
        bg-white
        p-1
      "
    >

      {[
        {
          key:
            "daily" as Period,

          label:
            "日",
        },

        {
          key:
            "weekly" as Period,

          label:
            "周",
        },

        {
          key:
            "monthly" as Period,

          label:
            "月",
        },

        {
          key:
            "yearly" as Period,

          label:
            "年",
        },

      ].map(
        item => (

          <button
            key={
              item.key
            }
            type="button"
            onClick={() =>
              setPeriod(
                item.key
              )
            }
            className={`
              rounded-md
              px-4
              py-1.5
              text-sm
              transition

              ${
                period ===
                item.key
                  ? `
                    bg-black
                    text-white
                  `
                  : `
                    text-gray-600
                    hover:bg-gray-100
                  `
              }
            `}
          >

            {
              item.label
            }

          </button>

        )
      )}

    </div>

  </div>


  <HistoryTable
    title=""
    points={
      points
    }
    period={
      period
    }
  />

</section>
 

);

}

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
comparison,
setComparison,
] =
useState<ComparisonData>({
latestDate:
null,

 
  previousDate:
    null,

  latest:
    [],

  previous:
    [],
});
 

const [
performanceHistory,
setPerformanceHistory,
] =
useState<any>(null);

const [
loading,
setLoading,
] =
useState(true);

// ===================================================
// Load
// ===================================================

useEffect(
() => {

 
  async function load() {

    try {

      const [
        latest,
        comparisonData,
        historyData,
      ] =
        await Promise.all([

          getLatestAsset(),

          getHoldingsHistoryComparison(),

          getPerformanceHistory(),

        ]);


      setAsset(
        latest
      );


      setComparison(
        comparisonData
      );


      setPerformanceHistory(
        historyData
      );

    }
    catch (
      error
    ) {

      console.error(
        "Performance load error:",
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

},
[]
 

);

// ===================================================
// 今日表现
// ===================================================

const today =
useMemo(
() => {

 
    return calculateTodayPerformance(

      comparison.latest,

      comparison.previous

    );

  },
  [
    comparison.latest,
    comparison.previous,
  ]
);
 

// ===================================================
// Loading
// ===================================================

if (
loading ||
!asset ||
!performanceHistory
) {

 
return (

  <>

    <TopBar
      title="Performance"
    />


    <main
      className="
        p-10
      "
    >

      Loading...

    </main>

  </>

);
 

}

// ===================================================
// Render
// ===================================================

return (

 
<>

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
      space-y-12
    "
  >

    {/* =================================================
        今日表现
    ================================================= */}

    <section>

      <h1
        className="
          text-2xl
          font-semibold
          mb-6
        "
      >

        今日表现

      </h1>


      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-6
        "
      >

        <TodayBlock
          title="大陆"
          profit={
            today.mainland.profit
          }
          rate={
            today.mainland.rate
          }
        />


        <TodayBlock
          title="香港"
          profit={
            today.hk.profit
          }
          rate={
            today.hk.rate
          }
        />


        <TodayBlock
          title="合计"
          profit={
            today.total.profit
          }
          rate={
            today.total.rate
          }
        />

      </div>

    </section>


    {/* =================================================
        历史收益
    ================================================= */}

    <section>

      <h1
        className="
          text-2xl
          font-semibold
          mb-8
        "
      >

        历史收益

      </h1>


      <div
        className="
          space-y-10
        "
      >

        <HistorySection
          title="大陆资产"
          history={
            performanceHistory.mainland
          }
        />


        <HistorySection
          title="香港资产"
          history={
            performanceHistory.hk
          }
        />


        <HistorySection
          title="合计"
          history={
            performanceHistory.total
          }
        />

      </div>

    </section>


    {/* =================================================
        每个基金 / 股票今日表现
    //
    // 放在整个页面最下面
    //
    // 严格按照 market：
    // CN → 大陆
    // HK / US / LU → 香港
    // ================================================= */}

    <section>

      <h1
        className="
          text-2xl
          font-semibold
          mb-8
        "
      >

        今日各资产表现

      </h1>


      {/* =================================================
          大陆
      ================================================= */}

      <div
        className="
          space-y-4
          mb-10
        "
      >

        <h2
          className="
            text-xl
            font-semibold
          "
        >

          大陆

        </h2>


        <div
          className="
            overflow-hidden
            rounded-2xl
            border
            bg-white
            shadow-sm
          "
        >

          <table
            className="
              w-full
              text-sm
            "
          >

            <thead>

              <tr
                className="
                  border-b
                  bg-gray-50
                "
              >

                <th
                  className="
                    px-5
                    py-3
                    text-left
                    font-medium
                    text-gray-500
                  "
                >

                  名称

                </th>


                <th
                  className="
                    px-5
                    py-3
                    text-left
                    font-medium
                    text-gray-500
                  "
                >

                  代码

                </th>


                <th
                  className="
                    px-5
                    py-3
                    text-right
                    font-medium
                    text-gray-500
                  "
                >

                  今日收益

                </th>


                <th
                  className="
                    px-5
                    py-3
                    text-right
                    font-medium
                    text-gray-500
                  "
                >

                  今日涨跌

                </th>

              </tr>

            </thead>


            <tbody>

              {
                comparison.latest
                  .filter(
                    row =>
                      isMainlandMarket(
                        row?.market
                      )
                  )
                  .map(
                    row => {

                      const code =
                        String(
                          row?.code ??
                          ""
                        )
                          .trim()
                          .toUpperCase();


                      const previousRow =
                        comparison.previous.find(
                          item =>
                            String(
                              item?.code ??
                              ""
                            )
                              .trim()
                              .toUpperCase() ===
                            code
                        );


                      const currentAmount =
                        toNumber(
                          row?.amount
                        );


                      const previousAmount =
                        toNumber(
                          previousRow?.amount
                        );


                      const profit =
                        currentAmount -
                        previousAmount;


                      const rate =
                        previousAmount > 0
                          ? (
                              profit /
                              previousAmount
                            ) *
                            100
                          : 0;


                      return (

                        <tr
                          key={
                            code
                          }
                          className="
                            border-b
                            last:border-b-0
                          "
                        >

                          <td
                            className="
                              px-5
                              py-3
                              font-medium
                            "
                          >

                            {
                              row?.name ??
                              "-"
                            }

                          </td>


                          <td
                            className="
                              px-5
                              py-3
                              text-gray-500
                            "
                          >

                            {
                              code
                            }

                          </td>


                          <td
                            className="
                              px-5
                              py-3
                              text-right
                              font-medium
                            "
                          >

                            {
                              formatMoney(
                                profit
                              )
                            }

                          </td>


                          <td
                            className="
                              px-5
                              py-3
                              text-right
                              font-medium
                            "
                          >

                            {
                              formatRate(
                                rate
                              )
                            }

                          </td>

                        </tr>

                      );

                    }
                  )
              }


              {
                comparison.latest.filter(
                  row =>
                    isMainlandMarket(
                      row?.market
                    )
                ).length === 0 && (

                  <tr>

                    <td
                      colSpan={4}
                      className="
                        px-5
                        py-8
                        text-center
                        text-gray-400
                      "
                    >

                      暂无大陆资产

                    </td>

                  </tr>

                )
              }

            </tbody>

          </table>

        </div>

      </div>


      {/* =================================================
          香港
      ================================================= */}

      <div
        className="
          space-y-4
        "
      >

        <h2
          className="
            text-xl
            font-semibold
          "
        >

          香港

        </h2>


        <div
          className="
            overflow-hidden
            rounded-2xl
            border
            bg-white
            shadow-sm
          "
        >

          <table
            className="
              w-full
              text-sm
            "
          >

            <thead>

              <tr
                className="
                  border-b
                  bg-gray-50
                "
              >

                <th
                  className="
                    px-5
                    py-3
                    text-left
                    font-medium
                    text-gray-500
                  "
                >

                  名称

                </th>


                <th
                  className="
                    px-5
                    py-3
                    text-left
                    font-medium
                    text-gray-500
                  "
                >

                  代码

                </th>


                <th
                  className="
                    px-5
                    py-3
                    text-right
                    font-medium
                    text-gray-500
                  "
                >

                  今日收益

                </th>


                <th
                  className="
                    px-5
                    py-3
                    text-right
                    font-medium
                    text-gray-500
                  "
                >

                  今日涨跌

                </th>

              </tr>

            </thead>


            <tbody>

              {
                comparison.latest
                  .filter(
                    row =>
                      isHongKongMarket(
                        row?.market
                      )
                  )
                  .map(
                    row => {

                      const code =
                        String(
                          row?.code ??
                          ""
                        )
                          .trim()
                          .toUpperCase();


                      const previousRow =
                        comparison.previous.find(
                          item =>
                            String(
                              item?.code ??
                              ""
                            )
                              .trim()
                              .toUpperCase() ===
                            code
                        );


                      const currentAmount =
                        toNumber(
                          row?.amount
                        );


                      const previousAmount =
                        toNumber(
                          previousRow?.amount
                        );


                      const profit =
                        currentAmount -
                        previousAmount;


                      const rate =
                        previousAmount > 0
                          ? (
                              profit /
                              previousAmount
                            ) *
                            100
                          : 0;


                      return (

                        <tr
                          key={
                            code
                          }
                          className="
                            border-b
                            last:border-b-0
                          "
                        >

                          <td
                            className="
                              px-5
                              py-3
                              font-medium
                            "
                          >

                            {
                              row?.name ??
                              "-"
                            }

                          </td>


                          <td
                            className="
                              px-5
                              py-3
                              text-gray-500
                            "
                          >

                            {
                              code
                            }

                          </td>


                          <td
                            className="
                              px-5
                              py-3
                              text-right
                              font-medium
                            "
                          >

                            {
                              formatMoney(
                                profit
                              )
                            }

                          </td>


                          <td
                            className="
                              px-5
                              py-3
                              text-right
                              font-medium
                            "
                          >

                            {
                              formatRate(
                                rate
                              )
                            }

                          </td>

                        </tr>

                      );

                    }
                  )
              }


              {
                comparison.latest.filter(
                  row =>
                    isHongKongMarket(
                      row?.market
                    )
                ).length === 0 && (

                  <tr>

                    <td
                      colSpan={4}
                      className="
                        px-5
                        py-8
                        text-center
                        text-gray-400
                      "
                    >

                      暂无香港资产

                    </td>

                  </tr>

                )
              }

            </tbody>

          </table>

        </div>

      </div>

    </section>

  </main>

</>


);

}
