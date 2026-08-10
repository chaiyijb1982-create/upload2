"use client";

interface Props {
  asset: any;
  allocation: any;
  holdings: any[];
}


export default function AIAdvisor({
  asset,
  allocation,
  holdings,
}: Props) {

  const total =
    Number(
      asset?.total_asset || 0
    );


  const totalProfit =
    Number(
      asset?.total_profit || 0
    );


  const holdingsCount =
    Array.isArray(holdings)
      ? holdings.length
      : 0;


  const cn =
    Number(
      asset?.cn_asset || 0
    );


  const hk =
    Number(
      asset?.hk_asset || 0
    );


  const cnPercent =
    total > 0
      ? (cn / total) * 100
      : 0;


  const hkPercent =
    total > 0
      ? (hk / total) * 100
      : 0;


  const suggestions: string[] = [];


  /* =========================================
     总资产
  ========================================= */

  if (total > 0) {

    suggestions.push(
      `当前家庭总资产约 ¥${total.toLocaleString("zh-CN")}。`
    );

  }


  /* =========================================
     收益
  ========================================= */

  if (totalProfit > 0) {

    suggestions.push(
      `当前累计收益为 ¥${totalProfit.toLocaleString("zh-CN")}，整体资产处于盈利状态。`
    );

  } else if (totalProfit < 0) {

    suggestions.push(
      `当前累计收益为 ¥${totalProfit.toLocaleString("zh-CN")}，建议继续关注资产配置，不要因为短期波动频繁操作。`
    );

  }


  /* =========================================
     Mainland / HK
  ========================================= */

  if (cnPercent > 70) {

    suggestions.push(
      `大陆资产目前约占 ${cnPercent.toFixed(1)}%，区域集中度较高，可以逐步通过香港账户增加全球资产配置。`
    );

  }


  if (hkPercent > 30) {

    suggestions.push(
      `香港资产目前约占 ${hkPercent.toFixed(1)}%，全球 ETF 配置已经具备一定规模。`
    );

  }


  /* =========================================
     Holdings
  ========================================= */

  if (holdingsCount > 0) {

    suggestions.push(
      `当前系统记录 ${holdingsCount} 项持仓，建议继续保持 ETF 为核心，避免频繁交易。`
    );

  }


  /* =========================================
     默认建议
  ========================================= */

  if (
    suggestions.length === 0
  ) {

    suggestions.push(
      "当前数据不足，暂时无法生成详细资产建议。"
    );

  }


  return (

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

      {/* Header */}

      <div
        className="
          flex
          items-center
          justify-between
          gap-4
          mb-6
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
            🤖 AI Wealth Advisor
          </h2>


          <p
            className="
              text-sm
              text-gray-400
              mt-1
            "
          >
            基于当前资产数据生成的财富管理提示
          </p>

        </div>


        <div
          className="
            px-3
            py-1.5
            rounded-full
            bg-green-50
            text-green-600
            text-xs
            font-semibold
          "
        >
          AI Analysis
        </div>

      </div>


      {/* Summary */}

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-4
          mb-6
        "
      >

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
              text-gray-400
            "
          >
            Total Wealth
          </p>

          <p
            className="
              text-xl
              font-bold
              text-gray-900
              mt-2
            "
          >
            ¥
            {total.toLocaleString(
              "zh-CN"
            )}
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
              text-gray-400
            "
          >
            Mainland
          </p>

          <p
            className="
              text-xl
              font-bold
              text-gray-900
              mt-2
            "
          >
            {cnPercent.toFixed(1)}%
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
              text-gray-400
            "
          >
            Hong Kong
          </p>

          <p
            className="
              text-xl
              font-bold
              text-gray-900
              mt-2
            "
          >
            {hkPercent.toFixed(1)}%
          </p>

        </div>

      </div>


      {/* Suggestions */}

      <div className="space-y-3">

        {
          suggestions.map(
            (
              text,
              index
            ) => (

              <div
                key={index}
                className="
                  flex
                  gap-4
                  rounded-xl
                  bg-gray-50
                  p-4
                "
              >

                <div
                  className="
                    w-7
                    h-7
                    shrink-0
                    rounded-full
                    bg-blue-100
                    text-blue-600
                    flex
                    items-center
                    justify-center
                    text-sm
                    font-bold
                  "
                >
                  {index + 1}
                </div>


                <p
                  className="
                    text-sm
                    leading-6
                    text-gray-600
                  "
                >
                  {text}
                </p>

              </div>

            )
          )
        }

      </div>


      <div
        className="
          mt-6
          pt-5
          border-t
          border-gray-100
          text-xs
          text-gray-400
        "
      >
        AI Advisor 仅基于当前系统数据提供参考，不构成投资建议。
      </div>

    </div>

  );
}