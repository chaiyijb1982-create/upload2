"use client";

import {
  useEffect,
  useState,
} from "react";


interface PlatformItem {
  platform: string;
  amount: number;
  count: number;
  rate: number;
}


interface Props {
  data: PlatformItem[];
}


export default function PlatformAllocation({
  data,
}: Props) {


  // =====================================================
  // 汇率 State
  // =====================================================

  const [
    exchangeRate,
    setExchangeRate
  ] = useState<number>(0);


  const [
    usdHkdRate,
    setUsdHkdRate
  ] = useState<number>(0);


  const [
    rateLoading,
    setRateLoading
  ] = useState<boolean>(true);


  const [
    rateError,
    setRateError
  ] = useState<boolean>(false);


  // =====================================================
  // 获取实时汇率
  // =====================================================

  useEffect(() => {

    let cancelled = false;


    const loadExchangeRate =
      async () => {

        try {

          setRateLoading(true);

          setRateError(false);


          const response =
            await fetch(
              "/api/exchange-rate",
              {
                cache: "no-store",
              }
            );


          if (!response.ok) {

            throw new Error(
              "Exchange rate request failed"
            );

          }


          const result =
            await response.json();


          if (
            !result?.success ||
            !Number.isFinite(
              Number(result.usdCny)
            ) ||
            !Number.isFinite(
              Number(result.usdHkd)
            )
          ) {

            throw new Error(
              "Invalid exchange rate"
            );

          }


          if (!cancelled) {

            setExchangeRate(
              Number(result.usdCny)
            );


            setUsdHkdRate(
              Number(result.usdHkd)
            );

          }

        } catch (error) {

          console.error(
            "Failed to load exchange rate:",
            error
          );


          if (!cancelled) {

            setRateError(true);

          }

        } finally {

          if (!cancelled) {

            setRateLoading(false);

          }

        }

      };


    loadExchangeRate();


    return () => {

      cancelled = true;

    };

  }, []);


  // =====================================================
  // 数据检查
  // =====================================================

  if (
    !Array.isArray(data) ||
    data.length === 0
  ) {

    return null;

  }


  // =====================================================
  // 香港判断
  //
  // 只要平台名称包含「香港」
  // 就归入香港
  //
  // 其他全部归大陆
  // =====================================================

  const isHongKongPlatform = (
    platform: string
  ) => {

    return String(
      platform || ""
    ).includes("香港");

  };


  // =====================================================
  // 总资产
  //
  // 所有占比仍然使用人民币原始金额
  // =====================================================

  const total =
    data.reduce(
      (
        sum,
        item
      ) => {

        return (
          sum +
          Number(
            item.amount || 0
          )
        );

      },
      0
    );


  // =====================================================
  // 香港平台
  // =====================================================

  const hongKongPlatforms =
    data.filter(
      (
        item
      ) =>
        isHongKongPlatform(
          item.platform
        )
    );


  // =====================================================
  // 大陆平台
  // =====================================================

  const mainlandPlatforms =
    data.filter(
      (
        item
      ) =>
        !isHongKongPlatform(
          item.platform
        )
    );


  // =====================================================
  // 香港人民币总额
  // =====================================================

  const hongKongCnyTotal =
    hongKongPlatforms.reduce(
      (
        sum,
        item
      ) => {

        return (
          sum +
          Number(
            item.amount || 0
          )
        );

      },
      0
    );


  // =====================================================
  // 大陆人民币总额
  // =====================================================

  const mainlandCnyTotal =
    mainlandPlatforms.reduce(
      (
        sum,
        item
      ) => {

        return (
          sum +
          Number(
            item.amount || 0
          )
        );

      },
      0
    );


  // =====================================================
  // 香港 USD
  //
  // CNY ÷ USD/CNY
  // =====================================================

  const hongKongUsdTotal =
    exchangeRate > 0
      ? hongKongCnyTotal /
        exchangeRate
      : 0;


  // =====================================================
  // 香港 HKD
  //
  // USD × USD/HKD
  // =====================================================

  const hongKongHkdTotal =
    exchangeRate > 0 &&
    usdHkdRate > 0
      ? (
          hongKongCnyTotal /
          exchangeRate
        ) *
        usdHkdRate
      : 0;


  // =====================================================
  // 格式化人民币
  // =====================================================

  const formatCny = (
    value: number
  ) => {

    return `¥${Math.round(
      value
    ).toLocaleString(
      "zh-CN"
    )}`;

  };


  // =====================================================
  // 格式化美元
  // =====================================================

  const formatUsd = (
    value: number
  ) => {

    return `$${Math.round(
      value
    ).toLocaleString(
      "en-US"
    )}`;

  };


  // =====================================================
  // 格式化港币
  // =====================================================

  const formatHkd = (
    value: number
  ) => {

    return `$${Math.round(
      value
    ).toLocaleString(
      "en-HK"
    )}`;

  };


  // =====================================================
  // 格式化百分比
  // =====================================================

  const formatPercent = (
    value: number
  ) => {

    return `${(
      value * 100
    ).toFixed(1)}%`;

  };


  // =====================================================
  // 平台金额
  //
  // 香港：
  // CNY → USD
  //
  // 大陆：
  // CNY
  // =====================================================

  const formatPlatformAmount = (
    item: PlatformItem
  ) => {

    const amount =
      Number(
        item.amount || 0
      );


    if (
      isHongKongPlatform(
        item.platform
      )
    ) {

      if (
        exchangeRate > 0
      ) {

        return formatUsd(
          amount /
          exchangeRate
        );

      }


      return "—";

    }


    return formatCny(
      amount
    );

  };


  // =====================================================
  // Group
  // =====================================================

  const renderGroup = (
    title: string,
    icon: string,
    platforms: PlatformItem[],
    groupCnyTotal: number,
    isHongKong: boolean
  ) => {

    if (
      platforms.length === 0
    ) {

      return null;

    }


    // ===================================================
    // 分组占比
    // ===================================================

    const groupRate =
      total > 0
        ? groupCnyTotal /
          total
        : 0;


    // ===================================================
    // 香港 / 大陆颜色
    //
    // 香港：蓝色
    // 大陆：柔和橙色
    // ===================================================

    const groupContainerClass =
      isHongKong
        ? `
            border-blue-100
            bg-gradient-to-br
            from-blue-50/70
            via-white
            to-indigo-50/50
          `
        : `
            border-amber-100
            bg-gradient-to-br
            from-amber-50/70
            via-white
            to-orange-50/50
          `;


    const headerClass =
      isHongKong
        ? `
            bg-blue-50/70
          `
        : `
            bg-amber-50/70
          `;


    const titleClass =
      isHongKong
        ? "text-blue-900"
        : "text-amber-900";


    const amountClass =
      isHongKong
        ? "text-blue-800"
        : "text-amber-800";


    const percentClass =
      isHongKong
        ? "text-blue-500"
        : "text-amber-600";


    const progressClass =
      isHongKong
        ? "bg-gradient-to-r from-blue-400 to-indigo-500"
        : "bg-gradient-to-r from-amber-400 to-orange-500";


    return (

      <div
        className={`
          rounded-2xl
          border
          overflow-hidden
          shadow-sm
          ${groupContainerClass}
        `}
      >


        {/* =================================================
            Group Header
        ================================================= */}

        <div
          className={`
            px-6
            py-5
            ${headerClass}
          `}
        >

          <div
            className="
              flex
              items-center
              justify-between
              gap-4
            "
          >


            {/* =============================================
                左侧
            ============================================= */}

            <div>

              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >

                <span
                  className="
                    text-xl
                  "
                >
                  {icon}
                </span>


                <h3
                  className={`
                    text-lg
                    font-bold
                    ${titleClass}
                  `}
                >
                  {title}
                </h3>

              </div>


              <p
                className="
                  mt-1
                  text-sm
                  text-gray-400
                "
              >
                {platforms.length} 个平台
              </p>

            </div>


            {/* =============================================
                右侧金额
            ============================================= */}

            <div
              className="
                text-right
              "
            >

              {
                isHongKong ? (

                  <>

                    {/* USD */}

                    <p
                      className="
                        text-xl
                        font-bold
                        text-blue-800
                      "
                    >

                      <span
                        className="
                          mr-2
                          text-xs
                          font-semibold
                          text-blue-500
                        "
                      >
                        USD
                      </span>

                      {rateLoading
                        ? "..."
                        : exchangeRate > 0
                          ? formatUsd(
                              hongKongUsdTotal
                            )
                          : "—"
                      }

                    </p>


                    {/* HKD */}

                    <p
                      className="
                        mt-1
                        text-lg
                        font-semibold
                        text-blue-600
                      "
                    >

                      <span
                        className="
                          mr-2
                          text-xs
                          font-semibold
                          text-blue-400
                      "
                      >
                        HK
                      </span>

                      {rateLoading
                        ? "..."
                        : usdHkdRate > 0
                          ? formatHkd(
                              hongKongHkdTotal
                            )
                          : "—"
                      }

                    </p>


                    {/* Percentage */}

                    <p
                      className="
                        mt-1
                        text-sm
                        font-medium
                        text-blue-500
                      "
                    >
                      {formatPercent(
                        groupRate
                      )}
                    </p>

                  </>

                ) : (

                  <p
                    className={`
                      text-xl
                      font-bold
                      ${amountClass}
                    `}
                  >
                    {formatCny(
                      groupCnyTotal
                    )}
                  </p>

                )
              }

            </div>

          </div>

        </div>


        {/* =================================================
            Platform List
        ================================================= */}

        <div
          className="
            p-6
            space-y-5
            bg-white/70
          "
        >

          {
            platforms.map(
              (
                item,
                index
              ) => {

                const rate =
                  Number(
                    item.rate || 0
                  );


                return (

                  <div
                    key={
                      `${item.platform}-${index}`
                    }
                  >


                    {/* =================================
                        Name / Amount
                    ================================= */}

                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        gap-4
                      "
                    >


                      <div
                        className="
                          min-w-0
                          flex-1
                        "
                      >

                        <div
                          className="
                            flex
                            items-center
                            gap-2
                          "
                        >

                          <span
                            className="
                              font-semibold
                              text-gray-800
                              truncate
                            "
                          >
                            {item.platform}
                          </span>


                          <span
                            className="
                              inline-flex
                              items-center
                              rounded-full
                              bg-gray-100
                              px-2
                              py-0.5
                              text-xs
                              text-gray-400
                              whitespace-nowrap
                            "
                          >
                            {item.count} 项
                          </span>

                        </div>

                      </div>


                      <div
                        className="
                          text-right
                          whitespace-nowrap
                        "
                      >

                        <span
                          className="
                            font-semibold
                            text-gray-800
                          "
                        >
                          {
                            formatPlatformAmount(
                              item
                            )
                          }
                        </span>


                        <span
                          className="
                            ml-3
                            text-sm
                            font-medium
                            text-gray-400
                          "
                        >
                          {formatPercent(
                            rate
                          )}
                        </span>

                      </div>

                    </div>


                    {/* =================================
                        Progress
                    ================================= */}

                    <div
                      className="
                        mt-2
                        h-2
                        bg-gray-100
                        rounded-full
                        overflow-hidden
                      "
                    >

                      <div
                        className={`
                          h-full
                          rounded-full
                          transition-all
                          duration-500
                          ${progressClass}
                        `}
                        style={{
                          width:
                            `${Math.min(
                              rate * 100,
                              100
                            )}%`,
                        }}
                      />

                    </div>

                  </div>

                );

              }
            )
          }

        </div>


        {/* =================================================
            Group Footer
        ================================================= */}

        <div
          className="
            border-t
            border-gray-100
            px-6
            py-4
            flex
            items-center
            justify-between
            text-sm
            bg-white/60
          "
        >

          <span
            className="
              text-gray-400
            "
          >
            {title}合计
          </span>


          <div
            className="
              text-right
            "
          >

            {
              isHongKong ? (

                <>

                  <span
                    className="
                      font-bold
                      text-blue-800
                    "
                  >
                    USD{" "}
                    {
                      rateLoading
                        ? "..."
                        : exchangeRate > 0
                          ? formatUsd(
                              hongKongUsdTotal
                            )
                          : "—"
                    }
                  </span>


                  <span
                    className="
                      ml-4
                      font-semibold
                      text-blue-600
                    "
                  >
                    HK{" "}
                    {
                      rateLoading
                        ? "..."
                        : usdHkdRate > 0
                          ? formatHkd(
                              hongKongHkdTotal
                            )
                          : "—"
                    }
                  </span>


                  <span
                    className="
                      ml-3
                      text-blue-500
                    "
                  >
                    {formatPercent(
                      groupRate
                    )}
                  </span>

                </>

              ) : (

                <>

                  <span
                    className={`
                      font-bold
                      ${amountClass}
                    `}
                  >
                    {formatCny(
                      groupCnyTotal
                    )}
                  </span>


                  <span
                    className={`
                      ml-3
                      ${percentClass}
                    `}
                  >
                    {formatPercent(
                      groupRate
                    )}
                  </span>

                </>

              )
            }

          </div>

        </div>

      </div>

    );

  };


  // =====================================================
  // 页面
  // =====================================================

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


      {/* =================================================
          Header
      ================================================= */}

      <div
        className="
          flex
          items-center
          justify-between
          mb-7
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
            🏦 Platform Allocation
          </h2>


          <p
            className="
              mt-1
              text-sm
              text-gray-400
            "
          >
            按资产存放地区及平台统计当前持仓
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
              text-gray-400
            "
          >
            平台数量
          </p>


          <p
            className="
              mt-1
              text-2xl
              font-bold
              text-gray-900
            "
          >
            {data.length}
          </p>

        </div>

      </div>


      {/* =================================================
          总览
      ================================================= */}

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-4
          mb-7
        "
      >


        {/* ===============================================
            Total
        =============================================== */}

        <div
          className="
            rounded-xl
            border
            border-gray-100
            bg-gradient-to-br
            from-gray-50
            via-white
            to-slate-50
            p-5
            shadow-sm
          "
        >

          <p
            className="
              text-sm
              text-gray-400
            "
          >
            Holdings 总市值
          </p>


          <p
            className="
              mt-2
              text-2xl
              font-bold
              text-gray-900
            "
          >
            {formatCny(
              total
            )}
          </p>


          <p
            className="
              mt-1
              text-xs
              text-gray-400
            "
          >
            人民币计价
          </p>

        </div>


        {/* ===============================================
            Hong Kong
        =============================================== */}

        <div
          className="
            rounded-xl
            border
            border-blue-100
            bg-gradient-to-br
            from-blue-50
            via-white
            to-indigo-50
            p-5
            shadow-sm
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
            "
          >

            <p
              className="
                text-sm
                font-medium
                text-blue-600
              "
            >
              🇭🇰 香港
            </p>


            <span
              className="
                text-xs
                rounded-full
                bg-blue-100
                px-2
                py-1
                text-blue-600
              "
            >
              USD / HKD
            </span>

          </div>


          {/* USD */}

          <p
            className="
              mt-2
              text-2xl
              font-bold
              text-blue-800
            "
          >

            <span
              className="
                mr-2
                text-xs
                font-semibold
                text-blue-500
              "
            >
              USD
            </span>

            {
              rateLoading
                ? "..."
                : exchangeRate > 0
                  ? formatUsd(
                      hongKongUsdTotal
                    )
                  : "—"
            }

          </p>


          {/* HKD */}

          <p
            className="
              mt-1
              text-lg
              font-semibold
              text-blue-600
            "
          >

            <span
              className="
                mr-2
                text-xs
                font-semibold
                text-blue-400
              "
            >
              HK
            </span>

            {
              rateLoading
                ? "..."
                : usdHkdRate > 0
                  ? formatHkd(
                      hongKongHkdTotal
                    )
                  : "—"
            }

          </p>


          <p
            className="
              mt-1
              text-sm
              text-blue-500
            "
          >
            {formatPercent(
              total > 0
                ? hongKongCnyTotal /
                  total
                : 0
            )}
          </p>

        </div>


        {/* ===============================================
            Mainland
        =============================================== */}

        <div
          className="
            rounded-xl
            border
            border-amber-100
            bg-gradient-to-br
            from-amber-50
            via-white
            to-orange-50
            p-5
            shadow-sm
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
            "
          >

            <p
              className="
                text-sm
                font-medium
                text-amber-700
              "
            >
              🇨🇳 大陆
            </p>


            <span
              className="
                text-xs
                rounded-full
                bg-amber-100
                px-2
                py-1
                text-amber-700
              "
            >
              CNY
            </span>

          </div>


          <p
            className="
              mt-2
              text-2xl
              font-bold
              text-amber-800
            "
          >
            {formatCny(
              mainlandCnyTotal
            )}
          </p>


          <p
            className="
              mt-1
              text-sm
              text-amber-600
            "
          >
            {formatPercent(
              total > 0
                ? mainlandCnyTotal /
                  total
                : 0
            )}
          </p>

        </div>

      </div>


      {/* =================================================
          香港
      ================================================= */}

      {
        renderGroup(
          "香港",
          "🇭🇰",
          hongKongPlatforms,
          hongKongCnyTotal,
          true
        )
      }


      {/* =================================================
          大陆
      ================================================= */}

      {
        mainlandPlatforms.length > 0 && (

          <div
            className="
              mt-6
            "
          >

            {
              renderGroup(
                "大陆",
                "🇨🇳",
                mainlandPlatforms,
                mainlandCnyTotal,
                false
              )
            }

          </div>

        )
      }


      {/* =================================================
          汇率说明
      ================================================= */}

      {
        hongKongPlatforms.length > 0 && (

          <div
            className="
              mt-6
              rounded-xl
              border
              border-indigo-100
              bg-gradient-to-r
              from-indigo-50
              via-blue-50
              to-slate-50
              px-5
              py-4
              text-sm
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

              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >

                <span>
                  💱
                </span>

                <span
                  className="
                    font-medium
                    text-gray-600
                  "
                >
                  当前汇率
                </span>

              </div>


              <div
                className="
                  text-right
                  font-semibold
                  text-indigo-700
                "
              >

                {
                  rateLoading
                    ? "获取中..."
                    : rateError
                      ? "汇率获取失败"
                      : (
                          <>
                            USD/CNY{" "}
                            {exchangeRate.toFixed(
                              4
                            )}
                            {" · "}
                            USD/HKD{" "}
                            {usdHkdRate.toFixed(
                              4
                            )}
                          </>
                        )
                }

              </div>

            </div>


            <p
              className="
                mt-2
                text-xs
                text-gray-400
              "
            >
              香港资产：CNY → USD → HKD；占比仍按人民币市值计算
            </p>

          </div>

        )
      }


      {/* =================================================
          Footer
      ================================================= */}

      <div
        className="
          mt-7
          pt-5
          border-t
          border-gray-100
          flex
          items-center
          justify-between
          text-sm
        "
      >

        <span
          className="
            text-gray-400
          "
        >
          Platform Total
        </span>


        <div
          className="
            text-right
          "
        >

          <span
            className="
              font-bold
              text-gray-900
            "
          >
            {formatCny(
              total
            )}
          </span>


          <span
            className="
              ml-3
              text-gray-400
            "
          >
            100.0%
          </span>

        </div>

      </div>

    </div>

  );

}