"use client";

import {
  useState,
} from "react";


interface Props {

  asset: any;
  updatedAt?: string | null;
}


// =====================================================
// Comparison
// =====================================================

function ComparisonRow({
  label,
  data,
}: {
  label: string;
  data: any;
}) {

  if (
    !data?.available
  ) {

    return (

      <div
        className="
          flex
          items-center
          justify-between
          py-2
          border-b
          border-gray-100
          last:border-0
        "
      >

        <span
          className="
            text-sm
            text-gray-500
          "
        >
          {label}
        </span>


        <span
          className="
            text-sm
            text-gray-400
          "
        >
          暂无历史数据
        </span>

      </div>

    );

  }


  const change =
    Number(
      data?.change ?? 0
    );


  const changeRate =
    Number(
      data?.change_rate ?? 0
    );


  const positive =
    change >= 0;


  const money =
    Math.round(
      Math.abs(change)
    ).toLocaleString(
      "zh-CN"
    );


  return (

    <div
      className="
        flex
        items-center
        justify-between
        py-2
        border-b
        border-gray-100
        last:border-0
        gap-4
      "
    >

      <div>

        <span
          className="
            text-sm
            text-gray-600
          "
        >
          {label}
        </span>


        {
          data?.snapshot_date && (

            <span
              className="
                ml-2
                text-xs
                text-gray-400
              "
            >
              {data.snapshot_date}
            </span>

          )
        }

      </div>


      <div
        className="
          text-right
          whitespace-nowrap
        "
      >

        <span
          className={`
            text-sm
            font-semibold
            ${
              positive
                ? "text-green-600"
                : "text-red-600"
            }
          `}
        >

          {positive
            ? "+"
            : "-"}

          ¥{money}

        </span>


        <span
          className={`
            ml-2
            text-xs
            font-medium
            ${
              positive
                ? "text-green-600"
                : "text-red-600"
            }
          `}
        >

          (
          {positive
            ? "+"
            : "-"}

          {Math.abs(
            changeRate
          ).toFixed(2)}
          %)

        </span>

      </div>

    </div>

  );

}


// =====================================================
// Main Component
// =====================================================

export default function AssetSummary({
  asset,
  updatedAt,
}: Props) {

  // =====================================================
  // 更新时间格式化
  //
  // updated_at：
  // 数据库保存 UTC 时间
  //
  // 显示：
  // UTC+0
  // UTC+8 北京时间
  // =====================================================

 function formatUpdatedTime(
  value: any
) {

  if (!value) {

    return {
      utc: "-",
      beijing: "-",
    };

  }


  // =====================================================
  // holdings_history.updated_at 统一规定：
  // 数据库保存的是 UTC+0
  //
  // 数据示例：
  // 2026-08-15 01:23:34.712
  //
  // 必须明确按照 UTC 解析
  // =====================================================

  let utcValue =
    String(value).trim();


  // PostgreSQL timestamp without timezone
  // 没有 Z，需要明确补上 UTC
  if (
    !utcValue.endsWith("Z")
  ) {

    utcValue =
      utcValue.replace(
        " ",
        "T"
      ) +
      "Z";

  }


  const date =
    new Date(
      utcValue
    );


  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return {
      utc: "-",
      beijing: "-",
    };

  }


  // =====================================================
  // UTC+0
  // =====================================================

  const pad = (
    n: number
  ) =>
    String(n).padStart(
      2,
      "0"
    );


  const utc =
    `${date.getUTCFullYear()}-` +
    `${pad(date.getUTCMonth() + 1)}-` +
    `${pad(date.getUTCDate())} ` +
    `${pad(date.getUTCHours())}:` +
    `${pad(date.getUTCMinutes())}:` +
    `${pad(date.getUTCSeconds())}`;


  // =====================================================
  // UTC+8 北京时间
  // =====================================================

  const beijingDate =
    new Date(
      date.getTime() +
      8 * 60 * 60 * 1000
    );


  const beijing =
    `${beijingDate.getUTCFullYear()}-` +
    `${pad(beijingDate.getUTCMonth() + 1)}-` +
    `${pad(beijingDate.getUTCDate())} ` +
    `${pad(beijingDate.getUTCHours())}:` +
    `${pad(beijingDate.getUTCMinutes())}:` +
    `${pad(beijingDate.getUTCSeconds())}`;


  return {
    utc,
    beijing,
  };

}


  const updatedTime =
    formatUpdatedTime(
      updatedAt
    );
  // =====================================================
  // More comparisons
  // =====================================================

  const [
    showMore,
    setShowMore,
  ] =
    useState(false);


  // =====================================================
  // Total Wealth
  // =====================================================

  const total =
    Number(
      asset?.total_asset ?? 0
    );


  // =====================================================
  // Investment Total
  // =====================================================

  const investmentTotal =
    Number(
      asset?.investment_total ?? 0
    );


  // =====================================================
  // Mainland
  // =====================================================

  const cn =
    Number(
      asset?.cn_asset ?? 0
    );


  // =====================================================
  // Hong Kong
  // =====================================================

  const hk =
    Number(
      asset?.hk_asset ?? 0
    );


  // =====================================================
  // Fixed Income
  // =====================================================

  const fixedIncome =
    Number(
      asset?.fixed_income ?? 0
    );


  // =====================================================
  // Profit
  // =====================================================

  const totalProfit =
    Number(
      asset?.total_profit ?? 0
    );


  const cnProfit =
    Number(
      asset?.cn_profit ?? 0
    );


  const hkProfit =
    Number(
      asset?.hk_profit ?? 0
    );


  // =====================================================
  // Rate
  // =====================================================

  const totalRate =
    Number(
      asset?.total_rate ?? 0
    );


  const cnRate =
    Number(
      asset?.cn_rate ?? 0
    );


  const hkRate =
    Number(
      asset?.hk_rate ?? 0
    );


  // =====================================================
  // Percentage
  // =====================================================

  const investmentPercent =
    total > 0
      ? (
          investmentTotal /
          total
        ) * 100
      : 0;


  const cnPercent =
    investmentTotal > 0
      ? (
          cn /
          investmentTotal
        ) * 100
      : 0;


  const hkPercent =
    investmentTotal > 0
      ? (
          hk /
          investmentTotal
        ) * 100
      : 0;


  const fixedIncomePercent =
    total > 0
      ? (
          fixedIncome /
          total
        ) * 100
      : 0;


  // =====================================================
  // Money
  // =====================================================

  const money = (
    value: number
  ) =>
    Math.round(
      Number(
        value
      ) || 0
    ).toLocaleString(
      "zh-CN"
    );


  // =====================================================
  // Rate
  // =====================================================

  const rate = (
    value: number
  ) =>
    Number(
      value || 0
    ).toFixed(2);


  // =====================================================
  // Comparisons
  //
  // page.tsx 里面的数据结构是：
  //
  // comparisons.total_wealth
  // comparisons.investment
  // comparisons.mainland
  // comparisons.hong_kong
  //
  // 不能直接使用 comparisons.yesterday
  // =====================================================

  const comparisons =
    asset?.comparisons ?? {};


  const totalWealthComparisons =
    comparisons?.total_wealth ?? {};


  const investmentComparisons =
    comparisons?.investment ?? {};


  const mainlandComparisons =
    comparisons?.mainland ?? {};


  const hongKongComparisons =
    comparisons?.hong_kong ?? {};


  // =====================================================
  // Main
  // =====================================================

  return (

    <div
      className="
        space-y-6
      "
    >

      {/* =================================================
          第一行
          TOTAL WEALTH
          ================================================= */}

      <div
        className="
          bg-white
          rounded-2xl
          shadow-sm
          border
          border-gray-100
          p-8
        "
      >

        <div
          className="
            flex
            items-start
            justify-between
            gap-6
            flex-wrap
          "
        >

          <div>

            <p
              className="
                text-gray-500
                text-lg
                font-medium
              "
            >
              TOTAL WEALTH
            </p>


            <p
              className="
                mt-1
                text-sm
                text-gray-400
              "
            >
              股票、基金、固收资产
            </p>


            <h2
              className="
                text-5xl
                font-bold
                text-gray-900
                mt-4
                tracking-tight
              "
            >
              ¥{money(total)}
            </h2>

          </div>


          {/* ============================================
              Total Profit
              ============================================ */}

          <div
            className="
              text-right
            "
          >

            <p
              className="
                text-xs
                text-gray-400
              "
            >
              Investment Profit
            </p>


            <p
              className={`
                mt-2
                text-xl
                font-bold
                ${
                  totalProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >

              {totalProfit >= 0
                ? "+"
                : ""}

              ¥{money(totalProfit)}

            </p>


            <p
              className={`
                mt-1
                text-sm
                font-semibold
                ${
                  totalRate >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >

              {totalRate >= 0
                ? "+"
                : ""}

              {rate(totalRate)}%

            </p>

          </div>

        </div>


        {/* =================================================
            昨日
            始终显示
            ================================================= */}

        <div
          className="
            mt-8
            rounded-xl
            bg-gray-50
            p-5
          "
        >

          <ComparisonRow
            label="昨日"
            data={
              totalWealthComparisons.yesterday
            }
          />

        </div>


        {/* =================================================
            More Button
            ================================================= */}

        <button
          type="button"
          onClick={() =>
            setShowMore(
              !showMore
            )
          }
          className="
            mt-6
            text-sm
            font-medium
            text-blue-600
            hover:text-blue-800
            transition
          "
        >

          {showMore
            ? "收起更多比较 ▲"
            : "查看更多比较 ▼"}

        </button>


        {/* =================================================
            TOTAL WEALTH
            上周 / 上月 / 去年
            ================================================= */}

        {
          showMore && (

            <div
              className="
                mt-4
                rounded-xl
                border
                border-gray-100
                p-5
                bg-white
              "
            >

              <ComparisonRow
                label="今年来"
                    data={
                    comparisons.ytd
                  }
                />
              <ComparisonRow
                label="上周"
                data={
                  totalWealthComparisons.last_week
                }
              />


              <ComparisonRow
                label="上月"
                data={
                  totalWealthComparisons.last_month
                }
              />


              <ComparisonRow
                label="去年"
                data={
                  totalWealthComparisons.last_year
                }
              />

            </div>

          )
        }


        <div
  className="
    text-sm
    mt-6
    leading-6
  "
>
  <div className="grid grid-cols-[4.5rem_1fr]">
    <span>
      Data Date:
    </span>

    <span>
      {asset?.snapshot_date || "-"}
    </span>
  </div>

  <div className="grid grid-cols-[4.5rem_1fr]">
    <span>
      Updated:
    </span>

    <span>
      {updatedTime.utc}
      {"（UTC+0）"}
    </span>
  </div>

  <div className="grid grid-cols-[4.5rem_1fr]">
    <span>
    </span>

    <span>
      {updatedTime.beijing}
      {"（UTC+8 北京时间）"}
    </span>
  </div>
</div>

      </div>


      {/* =================================================
          第二行
          投资总资产 / 大陆投资资产 / 香港投资资产
          ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-6
        "
      >

        {/* =================================================
            投资总资产
            ================================================= */}

        <div
          className="
            bg-white
            rounded-2xl
            shadow-sm
            border
            border-gray-100
            p-6
          "
        >

          <p
            className="
              text-gray-500
              text-lg
            "
          >
            投资总资产
          </p>


          <h3
            className="
              text-3xl
              font-bold
              text-gray-900
              mt-4
            "
          >
            ¥{money(investmentTotal)}
          </h3>


          <div
            className="
              mt-5
              space-y-2
            "
          >

            <p
              className="
                text-sm
                text-gray-500
              "
            >
              占 TOTAL WEALTH：{" "}
              {investmentPercent.toFixed(1)}%
            </p>


            <p
              className={`
                font-semibold
                ${
                  totalProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >

              {totalProfit >= 0
                ? "+"
                : ""}

              ¥{money(totalProfit)}

            </p>


            <p
              className={`
                font-semibold
                ${
                  totalRate >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >

              {totalRate >= 0
                ? "+"
                : ""}

              {rate(totalRate)}%

            </p>


            {/* ==========================================
                昨日比较
                ========================================== */}

            <div
              className="
                pt-3
                mt-3
                border-t
                border-gray-100
              "
            >

              <ComparisonRow
                label="昨日"
                data={
                  investmentComparisons.yesterday
                }
              />

            </div>

          </div>

        </div>


        {/* =================================================
            大陆投资资产
            ================================================= */}

        <div
          className="
            bg-white
            rounded-2xl
            shadow-sm
            border
            border-gray-100
            p-6
          "
        >

          <p
            className="
              text-gray-500
              text-lg
            "
          >
            大陆投资资产
          </p>


          <h3
            className="
              text-3xl
              font-bold
              text-gray-900
              mt-4
            "
          >
            ¥{money(cn)}
          </h3>


          <div
            className="
              mt-5
              space-y-2
            "
          >

            <p
              className="
                text-sm
                text-gray-500
              "
            >
              占投资资产：{" "}
              {cnPercent.toFixed(1)}%
            </p>


            <p
              className={`
                font-semibold
                ${
                  cnProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >

              {cnProfit >= 0
                ? "+"
                : ""}

              ¥{money(cnProfit)}

            </p>


            <p
              className={`
                font-semibold
                ${
                  cnRate >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >

              {cnRate >= 0
                ? "+"
                : ""}

              {rate(cnRate)}%

            </p>


            {/* ==========================================
                昨日比较
                ========================================== */}

            <div
              className="
                pt-3
                mt-3
                border-t
                border-gray-100
              "
            >

              <ComparisonRow
                label="昨日"
                data={
                  mainlandComparisons.yesterday
                }
              />

            </div>

          </div>

        </div>


        {/* =================================================
            香港投资资产
            ================================================= */}

        <div
          className="
            bg-white
            rounded-2xl
            shadow-sm
            border
            border-gray-100
            p-6
          "
        >

          <p
            className="
              text-gray-500
              text-lg
            "
          >
            香港投资资产
          </p>


          <h3
            className="
              text-3xl
              font-bold
              text-gray-900
              mt-4
            "
          >
            ¥{money(hk)}
          </h3>


          <div
            className="
              mt-5
              space-y-2
            "
          >

            <p
              className="
                text-sm
                text-gray-500
              "
            >
              占投资资产：{" "}
              {hkPercent.toFixed(1)}%
            </p>


            <p
              className={`
                font-semibold
                ${
                  hkProfit >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >

              {hkProfit >= 0
                ? "+"
                : ""}

              ¥{money(hkProfit)}

            </p>


            <p
              className={`
                font-semibold
                ${
                  hkRate >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >

              {hkRate >= 0
                ? "+"
                : ""}

              {rate(hkRate)}%

            </p>


            {/* ==========================================
                昨日比较
                ========================================== */}

            <div
              className="
                pt-3
                mt-3
                border-t
                border-gray-100
              "
            >

              <ComparisonRow
                label="昨日"
                data={
                  hongKongComparisons.yesterday
                }
              />

            </div>

          </div>

        </div>

      </div>


      {/* =================================================
          第三行
          固收总资产
          ================================================= */}

      <div
        className="
          bg-white
          rounded-2xl
          shadow-sm
          border
          border-gray-100
          p-6
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
            gap-6
            flex-wrap
          "
        >

          <div>

            <p
              className="
                text-gray-500
                text-lg
              "
            >
              固收总资产
            </p>


            <p
              className="
                mt-1
                text-sm
                text-gray-400
              "
            >
              固收资产
            </p>

          </div>


          <div
            className="
              text-right
            "
          >

            <p
              className="
                text-3xl
                font-bold
                text-gray-900
              "
            >
              ¥{money(fixedIncome)}
            </p>


            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >
              占 TOTAL WEALTH：{" "}
              {fixedIncomePercent.toFixed(1)}%
            </p>

          </div>

        </div>

      </div>

    </div>

  );

}