"use client";

import {
useEffect,
useMemo,
useState,
} from "react";

import {
getInsurancePremiumPlan,
} from "@/lib/insurance";

import {
getLatestAsset,
} from "@/lib/asset";

// =====================================================
// Financial Freedom
// =====================================================

export default function FinancialFreedom() {

// ===================================================
// 基础参数
// ===================================================

const START_YEAR = 2027;
const FREEDOM_END_YEAR = 2041;
const RETIREMENT_YEAR = 2042;

// ===================================================
// 当前资产
//
// ★ 来自 Dashboard Total Wealth
// ===================================================

const [currentAsset, setCurrentAsset] =
useState(0);

const [assetLoading, setAssetLoading] =
useState(true);

// ===================================================
// 模拟参数
// ===================================================

const [returnRate, setReturnRate] =
useState(5);

const [expenseGrowth, setExpenseGrowth] =
useState(3);

// ===================================================
// Insurance
// ===================================================

const [insuranceData, setInsuranceData] =
useState<any>(null);

const [insuranceLoading, setInsuranceLoading] =
useState(true);

// ===================================================
// 读取 Dashboard Total Wealth
// ===================================================

useEffect(() => {


let cancelled = false;

async function loadAsset() {

  try {

    setAssetLoading(true);

    const data =
      await getLatestAsset();

    if (cancelled) {
      return;
    }

    // ---------------------------------------------
    // 兼容不同字段
    // ---------------------------------------------

    const totalWealth =
      Number(
        data?.total_wealth ??
        data?.totalWealth ??
        data?.total_asset ??
        data?.totalAsset ??
        data?.total ??
        0
      );

    if (
      Number.isFinite(totalWealth)
    ) {

      setCurrentAsset(
        totalWealth
      );

    }

  } catch (error) {

    console.error(
      "Financial Freedom: Dashboard Total Wealth 读取失败",
      error
    );

  } finally {

    if (!cancelled) {
      setAssetLoading(false);
    }

  }

}

loadAsset();

return () => {
  cancelled = true;
};


}, []);

// ===================================================
// 读取 Insurance
// ===================================================

useEffect(() => {


let cancelled = false;

async function loadInsurance() {

  try {

    setInsuranceLoading(true);

    const data =
      await getInsurancePremiumPlan();

    if (!cancelled) {

      setInsuranceData(
        data
      );

    }

  } catch (error) {

    console.error(
      "Financial Freedom: Insurance 数据读取失败",
      error
    );

  } finally {

    if (!cancelled) {
      setInsuranceLoading(false);
    }

  }

}

loadInsurance();

return () => {
  cancelled = true;
};


}, []);

// ===================================================
// 年金缴费
// ===================================================

const annualAnnuity: Record<number, number> = {


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

// ===================================================
// 基础生活支出
//
// 这里就是财务自由目标的来源
//
// 2027–2031：37万/年
// 2032–2042：32万/年
// ===================================================

const baseExpense: Record<number, number> = {


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

// ===================================================
// 年度
// ===================================================

const years = useMemo(
() => {


  return Array.from(
    {
      length:
        RETIREMENT_YEAR -
        START_YEAR +
        1,
    },
    (_, index) =>
      START_YEAR + index
  );

},
[]


);

// ===================================================
// 生活开销预测
//
// ★ 不做“较上一年增长”
//
// 直接使用 baseExpense
// ===================================================

const expenseForecast = useMemo(
() => {


  return years.map(
    (year) => {

      return {

        year,

        expense:
          baseExpense[year] || 0,

      };

    }
  );

},
[years]


);

// ===================================================
// 财务自由目标
//
// ★ 2027–2041 年生活开销全部累加
//
// 不计年金
// 不使用收益率
// 不折现
// 不增长
// ===================================================

const freedomTarget =
useMemo(
() => {


    return expenseForecast
      .filter(
        (item) =>
          item.year <=
          FREEDOM_END_YEAR
      )
      .reduce(
        (
          sum,
          item
        ) =>
          sum +
          item.expense,
        0
      );

  },
  [expenseForecast]
);


// ===================================================
// 财务自由进度
// ===================================================

const freedomProgress =
freedomTarget > 0
?
Math.min(
(
currentAsset /
freedomTarget
) *
100,
100
)
:
0;

// ===================================================
// 财富预测
//
// 仅用于下面的年度路径表
// ===================================================

const forecast = useMemo(
() => {


  let asset =
    currentAsset;

  return years.map(
    (year) => {

      // -------------------------------------------
      // 生活支出
      // -------------------------------------------

      const expense =
        baseExpense[year] || 0;

      // -------------------------------------------
      // 年金
      // -------------------------------------------

      const annuity =
        annualAnnuity[year] || 0;

      // -------------------------------------------
      // 投资收益
      // -------------------------------------------

      const profit =
        asset *
        (
          returnRate /
          100
        );

      // -------------------------------------------
      // 年末资产
      // -------------------------------------------

      asset =
        asset +
        profit -
        expense -
        annuity;

      if (
        asset < 0
      ) {

        asset = 0;

      }

      return {

        year,

        expense,

        annuity,

        profit,

        asset,

      };

    }
  );

},
[
  years,
  currentAsset,
  returnRate,
]


);

// ===================================================
// 2041 年资产
// ===================================================

const freedomForecast =
forecast.find(
(item) =>
item.year ===
FREEDOM_END_YEAR
);

const freedomEndAsset =
freedomForecast?.asset || 0;

// ===================================================
// 2042 年资产
// ===================================================

const retirementForecast =
forecast.find(
(item) =>
item.year ===
RETIREMENT_YEAR
);

// ===================================================
// 累计生活支出
// ===================================================

const totalExpense =
forecast
.filter(
(item) =>
item.year <=
FREEDOM_END_YEAR
)
.reduce(
(
sum,
item
) =>
sum +
item.expense,
0
);

// ===================================================
// 累计年金
// ===================================================

const totalAnnuity =
forecast
.filter(
(item) =>
item.year <=
FREEDOM_END_YEAR
)
.reduce(
(
sum,
item
) =>
sum +
item.annuity,
0
);

// ===================================================
// 累计收益
// ===================================================

const totalProfit =
forecast
.filter(
(item) =>
item.year <=
FREEDOM_END_YEAR
)
.reduce(
(
sum,
item
) =>
sum +
item.profit,
0
);

// ===================================================
// Insurance 数据
// ===================================================

const insuranceItems =
Array.isArray(
insuranceData?.items
)
?
insuranceData.items
:
Array.isArray(
insuranceData?.policies
)
?
insuranceData.policies
:
[];

// ===================================================
// 数字工具
// ===================================================

const getNumber =
(
value: any
): number => {


  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : 0;

};


// ===================================================
// 已缴保险
// ===================================================

const insurancePaid =
insuranceItems.reduce(
(
sum: number,
item: any
) => {


    return (
      sum +
      getNumber(
        item?.paid_amount
      )
    );

  },
  0
);


// ===================================================
// 保险总保费
// ===================================================

const insuranceTotal =
insuranceItems.reduce(
(
sum: number,
item: any
) => {


    const premiumTotal =
      getNumber(
        item?.premium_total
      );

    if (
      premiumTotal > 0
    ) {

      return (
        sum +
        premiumTotal
      );

    }

    const annual =
      getNumber(
        item?.annual_premium
      );

    const payYears =
      getNumber(
        item?.pay_years
      );

    return (
      sum +
      (
        annual *
        payYears
      )
    );

  },
  0
);


// ===================================================
// 未来待缴保险
// ===================================================

const insuranceRemaining =
Math.max(
insuranceTotal -
insurancePaid,
0
);

// ===================================================
// 已缴比例
// ===================================================

const insurancePaidRate =
insuranceTotal > 0
?
(
insurancePaid /
insuranceTotal
) *
100
:
0;

// ===================================================
// 未来保险比例
// ===================================================

const insuranceRemainingRate =
insuranceTotal > 0
?
(
insuranceRemaining /
insuranceTotal
) *
100
:
0;

// ===================================================
// 保险压力
// ===================================================

const futureCashOutflow =
totalExpense +
totalAnnuity;

const insurancePressureRate =
futureCashOutflow > 0
?
(
insuranceRemaining /
futureCashOutflow
) *
100
:
0;

const insuranceAffordable =
insuranceRemaining === 0 ||
insurancePressureRate <= 30;

// ===================================================
// 金额格式
// ===================================================

const money =
(
value: number
) => {


  const number =
    Number(value || 0);

  if (
    number >= 100000000
  ) {

    return (
      "¥" +
      (
        number /
        100000000
      ).toFixed(2) +
      " 亿"
    );

  }

  if (
    number >= 10000
  ) {

    return (
      "¥" +
      (
        number /
        10000
      ).toFixed(1) +
      " 万"
    );

  }

  return (
    "¥" +
    Math.round(
      number
    ).toLocaleString(
      "zh-CN"
    )
  );

};


// ===================================================
// 页面
// ===================================================

return (


<div
  className="
    p-8
    max-w-[1600px]
    mx-auto
  "
>

  {/* ============================================= */}
  {/* Header */}
  {/* ============================================= */}

  <div
    className="
      mb-8
    "
  >

    <h1
      className="
        text-3xl
        font-bold
        text-gray-900
      "
    >
      🎯 Financial Freedom
    </h1>

    <p
      className="
        text-gray-500
        mt-2
      "
    >
      衡量当前资产、未来现金流与保险缴费能力
    </p>

  </div>

  {/* ============================================= */}
  {/* 核心财务自由 */}
  {/* ============================================= */}

  <div
    className="
      bg-white
      rounded-2xl
      border
      border-gray-100
      shadow-sm
      p-6
      mb-8
    "
  >

    <div
      className="
        grid
        md:grid-cols-2
        gap-6
      "
    >

      {/* 当前资产 */}

      <div
        className="
          rounded-xl
          bg-gray-50
          p-6
        "
      >

        <p
          className="
            text-sm
            text-gray-500
          "
        >
          当前资产
        </p>

        <p
          className="
            text-3xl
            font-bold
            text-gray-900
            mt-2
          "
        >

          {
            assetLoading
              ?
                "读取中..."
              :
                money(
                  currentAsset
                )
          }

        </p>

      </div>

      {/* 财务自由目标 */}

      <div
        className="
          rounded-xl
          bg-blue-50
          p-6
        "
      >

        <p
          className="
            text-sm
            text-gray-500
          "
        >
          财务自由目标
        </p>

        <p
          className="
            text-3xl
            font-bold
            text-blue-700
            mt-2
          "
        >

          {money(
            freedomTarget
          )}

        </p>

      </div>

    </div>

    {/* =========================================== */}
    {/* Progress */}
    {/* =========================================== */}

    <div
      className="
        mt-7
      "
    >

      <div
        className="
          flex
          items-center
          justify-between
          mb-2
        "
      >

        <span
          className="
            text-sm
            text-gray-500
          "
        >
          财务自由进度
        </span>

        <span
          className="
            text-sm
            font-bold
            text-blue-700
          "
        >
          {freedomProgress.toFixed(1)}%
        </span>

      </div>

      <div
        className="
          h-4
          bg-gray-100
          rounded-full
          overflow-hidden
        "
      >

        <div
          className="
            h-full
            bg-blue-500
            rounded-full
            transition-all
            duration-500
          "
          style={{
            width:
              `${freedomProgress}%`,
          }}
        />

      </div>

      <div
        className="
          flex
          justify-between
          mt-2
          text-xs
          text-gray-400
        "
      >

        <span>
          当前 {money(currentAsset)}
        </span>

        <span>
          目标 {money(freedomTarget)}
        </span>

      </div>

    </div>

  </div>

  {/* ============================================= */}
  {/* 每年开销预估 */}
  {/* ============================================= */}

  <div
    className="
      bg-white
      rounded-2xl
      border
      border-gray-100
      shadow-sm
      p-6
      mb-8
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
        📅 每年开销预估
      </h2>

      <p
        className="
          text-sm
          text-gray-400
          mt-1
        "
      >
        2027–2042 年生活支出规划
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
        "
      >

        <thead>

          <tr
            className="
              border-b
              border-gray-100
              text-gray-400
            "
          >

            <th
              className="
                py-3
                text-left
              "
            >
              年份
            </th>

            <th
              className="
                py-3
                text-right
              "
            >
              预计生活开销
            </th>

            <th
              className="
                py-3
                text-right
              "
            >
              累计开销
            </th>

          </tr>

        </thead>

        <tbody>

          {
            (() => {

              let cumulative =
                0;

              return expenseForecast.map(
                (item) => {

                  cumulative +=
                    item.expense;

                  return (

                    <tr
                      key={
                        item.year
                      }
                      className="
                        border-b
                        border-gray-50
                      "
                    >

                      <td
                        className="
                          py-3
                          font-semibold
                        "
                      >
                        {item.year}
                      </td>

                      <td
                        className="
                          py-3
                          text-right
                          text-gray-700
                        "
                      >
                        {money(
                          item.expense
                        )}
                      </td>

                      <td
                        className="
                          py-3
                          text-right
                          font-semibold
                          text-blue-600
                        "
                      >
                        {
                          item.year <=
                          FREEDOM_END_YEAR
                            ?
                              money(
                                cumulative
                              )
                            :
                              "—"
                        }
                      </td>

                    </tr>

                  );

                }
              );

            })()
          }

        </tbody>

      </table>

    </div>

  </div>

  {/* ============================================= */}
  {/* Insurance */}
  {/* ============================================= */}

  <div
    className="
      bg-white
      rounded-2xl
      border
      border-gray-100
      shadow-sm
      p-6
      mb-8
    "
  >

    <div
      className="
        flex
        items-start
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
          🛡️ 保险交费
        </h2>

        <p
          className="
            text-sm
            text-gray-400
            mt-1
          "
        >
          与 Insurance 页面使用同一套保单数据
        </p>

      </div>

      <div
        className={`
          px-3
          py-1.5
          rounded-full
          text-xs
          font-semibold
          ${
            insuranceAffordable
              ?
                "bg-green-50 text-green-600"
              :
                "bg-orange-50 text-orange-600"
          }
        `}
      >

        {
          insuranceLoading
            ?
              "读取中"
            :
              insuranceAffordable
                ?
                  "可承受"
                :
                  "需要关注"
        }

      </div>

    </div>

    <div
      className="
        grid
        md:grid-cols-2
        lg:grid-cols-4
        gap-5
      "
    >

      <Metric
        title="已缴保险"
        value={
          insuranceLoading
            ?
              "读取中..."
            :
              money(
                insurancePaid
              )
        }
        green
      />

      <Metric
        title="未来待缴保险"
        value={
          insuranceLoading
            ?
              "读取中..."
            :
              money(
                insuranceRemaining
              )
        }
      />

      <Metric
        title="保险总缴费"
        value={
          insuranceLoading
            ?
              "读取中..."
            :
              money(
                insuranceTotal
              )
        }
      />

      <Metric
        title="已缴保险百分比"
        value={
          insuranceLoading
            ?
              "读取中..."
            :
              `${insurancePaidRate.toFixed(1)}%`
        }
        blue
      />

    </div>

    {/* Insurance progress */}

    <div
      className="
        mt-5
        pt-5
        border-t
        border-gray-100
      "
    >

      <div
        className="
          flex
          justify-between
          text-sm
          mb-2
        "
      >

        <span
          className="
            text-gray-500
          "
        >
          保险缴费进度
        </span>

        <span
          className="
            font-semibold
            text-gray-700
          "
        >

          {
            insuranceLoading
              ?
                "读取中..."
              :
                `${insurancePaidRate.toFixed(1)}%`
          }

        </span>

      </div>

      <div
        className="
          h-3
          bg-gray-100
          rounded-full
          overflow-hidden
        "
      >

        <div
          className="
            h-full
            bg-green-500
            rounded-full
            transition-all
          "
          style={{
            width:
              `${Math.min(
                insurancePaidRate,
                100
              )}%`,
          }}
        />

      </div>

    </div>

  </div>

  {/* ============================================= */}
  {/* Simulation */}
  {/* ============================================= */}

  <div
    className="
      bg-white
      rounded-2xl
      border
      border-gray-100
      shadow-sm
      p-6
      mb-8
    "
  >

    <div
      className="
        mb-6
      "
    >

      <h2
        className="
          text-xl
          font-bold
          text-gray-900
        "
      >
        财富路径参数
      </h2>

      <p
        className="
          text-sm
          text-gray-400
          mt-1
        "
      >
        用于下面年度资产路径模拟
      </p>

    </div>

    <div
      className="
        grid
        md:grid-cols-2
        gap-8
      "
    >

      {/* 收益率 */}

      <div>

        <div
          className="
            flex
            justify-between
            mb-2
          "
        >

          <span
            className="
              text-sm
              text-gray-500
            "
          >
            投资收益率
          </span>

          <span
            className="
              font-bold
              text-gray-900
            "
          >
            {returnRate}%
          </span>

        </div>

        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={returnRate}
          onChange={
            (e) =>
              setReturnRate(
                Number(
                  e.target.value
                )
              )
          }
          className="
            w-full
            accent-blue-500
            cursor-pointer
          "
        />

        <div
          className="
            flex
            justify-between
            text-xs
            text-gray-400
            mt-2
          "
        >

          <span>1%</span>
          <span>5%</span>
          <span>10%</span>
          <span>15%</span>
          <span>20%</span>

        </div>

      </div>

      {/* 支出 */}

      <div>

        <div
          className="
            flex
            justify-between
            mb-2
          "
        >

          <span
            className="
              text-sm
              text-gray-500
            "
          >
            生活支出增长率
          </span>

          <span
            className="
              font-bold
              text-gray-900
            "
          >
            {expenseGrowth}%
          </span>

        </div>

        <input
          type="range"
          min="0"
          max="8"
          step="1"
          value={expenseGrowth}
          onChange={
            (e) =>
              setExpenseGrowth(
                Number(
                  e.target.value
                )
              )
          }
          className="
            w-full
            accent-blue-500
            cursor-pointer
          "
        />

        <div
          className="
            flex
            justify-between
            text-xs
            text-gray-400
            mt-2
          "
        >

          <span>0%</span>
          <span>2%</span>
          <span>4%</span>
          <span>6%</span>
          <span>8%</span>

        </div>

      </div>

    </div>

  </div>

  {/* ============================================= */}
  {/* Cashflow */}
  {/* ============================================= */}

  <div
    className="
      bg-white
      rounded-2xl
      border
      border-gray-100
      shadow-sm
      p-6
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
      📊 2027–2042 财务自由路径
    </h2>

    <div
      className="
        overflow-x-auto
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
              border-gray-100
              text-gray-400
            "
          >

            <th
              className="
                py-3
                text-left
              "
            >
              年份
            </th>

            <th
              className="
                py-3
                text-right
              "
            >
              年金缴费
            </th>

            <th
              className="
                py-3
                text-right
              "
            >
              生活支出
            </th>

            <th
              className="
                py-3
                text-right
              "
            >
              投资收益
            </th>

            <th
              className="
                py-3
                text-right
              "
            >
              年末资产
            </th>

          </tr>

        </thead>

        <tbody>

          {
            forecast.map(
              (item) => (

                <tr
                  key={
                    item.year
                  }
                  className={`
                    border-b
                    border-gray-50
                    ${
                      item.year ===
                      FREEDOM_END_YEAR
                        ?
                          "bg-blue-50"
                        :
                          ""
                    }
                  `}
                >

                  <td
                    className="
                      py-3
                      font-semibold
                    "
                  >

                    {item.year}

                    {
                      item.year ===
                      FREEDOM_END_YEAR && (

                        <span
                          className="
                            ml-2
                            text-xs
                            text-blue-600
                          "
                        >
                          财务自由目标线
                        </span>

                      )
                    }

                  </td>

                  <td
                    className="
                      py-3
                      text-right
                      text-orange-600
                    "
                  >
                    -{money(
                      item.annuity
                    )}
                  </td>

                  <td
                    className="
                      py-3
                      text-right
                      text-gray-600
                    "
                  >
                    -{money(
                      item.expense
                    )}
                  </td>

                  <td
                    className="
                      py-3
                      text-right
                      text-green-600
                    "
                  >
                    +{money(
                      item.profit
                    )}
                  </td>

                  <td
                    className="
                      py-3
                      text-right
                      font-bold
                    "
                  >
                    {money(
                      item.asset
                    )}
                  </td>

                </tr>

              )
            )
          }

        </tbody>

      </table>

    </div>

  </div>

  {/* ============================================= */}
  {/* Footer */}
  {/* ============================================= */}

  <div
    className="
      mt-6
      text-xs
      text-gray-400
    "
  >

    当前资产来自 Dashboard Total Wealth
    {" · "}
    财务自由目标为 2027–2041 年生活开销累计
    {" · "}
    起始资产 {money(currentAsset)}

  </div>

</div>


);

}

// =====================================================
// Metric
// =====================================================

function Metric({
title,
value,
blue = false,
green = false,
}: {
title: string;
value: string;
blue?: boolean;
green?: boolean;
}) {

return (


<div
  className={`
    rounded-xl
    p-5
    ${
      blue
        ?
          "bg-blue-50"
        :
      green
        ?
          "bg-green-50"
        :
          "bg-gray-50"
    }
  `}
>

  <p
    className="
      text-sm
      text-gray-500
    "
  >
    {title}
  </p>

  <p
    className={`
      text-2xl
      font-bold
      mt-2
      ${
        blue
          ?
            "text-blue-700"
          :
        green
          ?
            "text-green-700"
          :
            "text-gray-900"
      }
    `}
  >
    {value}
  </p>

</div>


);

}
