"use client";

interface Props {
  asset: any;
}

export default function AssetSummary({
  asset,
}: Props) {

  // =====================================================
  // Total Wealth
  // =====================================================

  const total =
    Number(
      asset?.total_asset || 0
    );


  // =====================================================
  // Profit
  //
  // 现在由 Dashboard 根据 Holdings 实际汇总
  // =====================================================

  const totalProfit =
    Number(
      asset?.total_profit || 0
    );


  const cn =
    Number(
      asset?.cn_asset || 0
    );


  const hk =
    Number(
      asset?.hk_asset || 0
    );


  const cnProfit =
    Number(
      asset?.cn_profit || 0
    );


  const hkProfit =
    Number(
      asset?.hk_profit || 0
    );


  const cnRate =
    Number(
      asset?.cn_rate || 0
    );


  const hkRate =
    Number(
      asset?.hk_rate || 0
    );


  const totalRate =
    Number(
      asset?.total_rate || 0
    );


  // =====================================================
  // Asset Percentage
  // =====================================================

  const cnPercent =
    total > 0
      ? (
          cn /
          total
        ) * 100
      : 0;


  const hkPercent =
    total > 0
      ? (
          hk /
          total
        ) * 100
      : 0;


  // =====================================================
  // Money Format
  // =====================================================

  const money = (
    value: number
  ) =>
    Math.round(
      Number(value) || 0
    ).toLocaleString(
      "zh-CN"
    );


  // =====================================================
  // Rate Format
  // =====================================================

  const rate =
    (
      value: number
    ) =>
      Number(
        value || 0
      ).toFixed(2);


  return (

    <div
      className="
        grid
        grid-cols-1
        md:grid-cols-4
        gap-6
      "
    >

      {/* =================================
          Total Wealth
      ================================= */}

      <div
        className="
          bg-white
          rounded-2xl
          shadow-sm
          border
          border-gray-100
          p-8
          md:col-span-2
        "
      >

        <p
          className="
            text-gray-500
            text-lg
          "
        >
          💰 Total Wealth（资产总览，基金 股票 固收，不含贷款）
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


        <div
          className="
            mt-6
            flex
            items-center
            gap-6
            flex-wrap
          "
        >

          {/* =============================
              Total Profit
          ============================= */}

          <div>

            <p
              className="
                text-xs
                text-gray-400
                mb-1
              "
            >
              Total Profit
            </p>


            <p
              className={`
                text-lg
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

          </div>


          {/* =============================
              Return
          ============================= */}

          <div>

            <p
              className="
                text-xs
                text-gray-400
                mb-1
              "
            >
              Return
            </p>


            <p
              className={`
                text-lg
                font-bold
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


        <p
          className="
            text-gray-400
            text-sm
            mt-6
          "
        >
          Updated:{" "}
          {asset?.snapshot_date || "-"}
        </p>

      </div>


      {/* =================================
          Mainland
      ================================= */}

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
          大陆
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
            mt-6
            space-y-3
          "
        >

          <p
            className="
              text-gray-500
            "
          >
            📊 占比：{cnPercent.toFixed(1)}%
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

            💰{" "}

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

            📈{" "}

            {cnRate >= 0
              ? "+"
              : ""}

            {rate(cnRate)}%

          </p>

        </div>

      </div>


      {/* =================================
          Hong Kong
      ================================= */}

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
          香港
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
            mt-6
            space-y-3
          "
        >

          <p
            className="
              text-gray-500
            "
          >
            📊 占比：{hkPercent.toFixed(1)}%
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

            💰{" "}

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

            📈{" "}

            {hkRate >= 0
              ? "+"
              : ""}

            {rate(hkRate)}%

          </p>

        </div>

      </div>

    </div>

  );

}