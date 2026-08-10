"use client";

import { useMemo } from "react";


interface Props {
  history: any[];
}


export default function WealthTrend({
  history,
}: Props) {


  // =====================================================
  // 格式化金额
  // =====================================================

  const money = (
    value: number
  ) => {

    return Number(
      value || 0
    ).toLocaleString(
      "zh-CN",
      {
        maximumFractionDigits: 0,
      }
    );

  };


  // =====================================================
  // 读取资产金额
  // =====================================================

  const getValue = (
    item: any
  ) => {

    const value =

      item?.total_asset ??
      item?.total_wealth ??
      item?.asset ??
      item?.total ??
      item?.value ??
      0;


    const number =
      Number(value);


    return Number.isFinite(number)
      ? number
      : 0;

  };


  // =====================================================
  // 读取日期
  // =====================================================

  const getDate = (
    item: any
  ) => {

    const value =

      item?.snapshot_date ??
      item?.date ??
      item?.created_at ??
      "";


    if (!value) {

      return "";

    }


    return String(
      value
    ).slice(
      0,
      10
    );

  };


  // =====================================================
  // 整理历史数据
  // =====================================================

  const chartData = useMemo(() => {

    if (
      !Array.isArray(history)
    ) {

      return [];

    }


    const data = history

      .map(
        (
          item: any
        ) => ({

          date:
            getDate(item),

          value:
            getValue(item),

        })
      )

      .filter(
        (
          item
        ) =>
          item.date &&
          item.value > 0
      );


    // 按日期排序

    data.sort(
      (
        a,
        b
      ) =>
        a.date.localeCompare(
          b.date
        )
    );


    return data;

  }, [history]);


  // =====================================================
  // 没有数据
  // =====================================================

  if (
    chartData.length === 0
  ) {

    return (

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
              Wealth Trend
            </h2>

            <p
              className="
                text-sm
                text-gray-500
                mt-1
              "
            >
              Total wealth history
            </p>

          </div>

        </div>


        <div
          className="
            mt-8
            h-72
            flex
            items-center
            justify-center
            rounded-xl
            bg-gray-50
            text-gray-400
          "
        >

          暂无财富历史数据

        </div>

      </div>

    );

  }


  // =====================================================
  // 图表尺寸
  // =====================================================

  const width = 1000;

  const height = 360;

  const paddingLeft = 70;

  const paddingRight = 30;

  const paddingTop = 30;

  const paddingBottom = 55;


  const chartWidth =
    width -
    paddingLeft -
    paddingRight;


  const chartHeight =
    height -
    paddingTop -
    paddingBottom;


  // =====================================================
  // 最小 / 最大值
  // =====================================================

  const values =
    chartData.map(
      item =>
        item.value
    );


  const minValue =
    Math.min(
      ...values
    );


  const maxValue =
    Math.max(
      ...values
    );


  // 防止所有数据相同
  const range =
    maxValue - minValue === 0
      ? Math.max(
          maxValue * 0.1,
          1
        )
      : maxValue - minValue;


  const chartMin =
    Math.max(
      0,
      minValue - range * 0.1
    );


  const chartMax =
    maxValue +
    range * 0.1;


  const chartRange =
    chartMax -
    chartMin;


  // =====================================================
  // X 坐标
  // =====================================================

  const getX = (
    index: number
  ) => {

    if (
      chartData.length === 1
    ) {

      return (
        paddingLeft +
        chartWidth / 2
      );

    }


    return (
      paddingLeft +
      (
        index /
        (chartData.length - 1)
      ) *
      chartWidth
    );

  };


  // =====================================================
  // Y 坐标
  // =====================================================

  const getY = (
    value: number
  ) => {

    return (
      paddingTop +
      (
        1 -
        (
          value -
          chartMin
        ) /
        chartRange
      ) *
      chartHeight
    );

  };


  // =====================================================
  // SVG 折线路径
  // =====================================================

  const linePoints =
    chartData
      .map(
        (
          item,
          index
        ) => {

          return (
            `${getX(index)},${getY(item.value)}`
          );

        }
      )
      .join(" ");


  // =====================================================
  // 面积路径
  // =====================================================

  const areaPoints =

    `${paddingLeft},${height - paddingBottom} ` +

    linePoints +

    ` ${getX(chartData.length - 1)},${height - paddingBottom}`;


  // =====================================================
  // Y 轴刻度
  // =====================================================

  const gridLines =
    5;


  const yTicks =
    Array.from(
      {
        length:
          gridLines + 1
      },
      (
        _,
        index
      ) => {

        const value =
          chartMin +
          (
            chartRange *
            index /
            gridLines
          );

        return {

          value,

          y:
            getY(value),

        };

      }
    );


  // =====================================================
  // 日期显示
  // =====================================================

  const dateIndexes = useMemo(() => {

    const count =
      chartData.length;


    if (
      count <= 6
    ) {

      return chartData.map(
        (
          _,
          index
        ) => index
      );

    }


    const indexes = [
      0,
      Math.floor(
        count * 0.25
      ),
      Math.floor(
        count * 0.5
      ),
      Math.floor(
        count * 0.75
      ),
      count - 1,
    ];


    return Array.from(
      new Set(indexes)
    );

  }, [chartData]);


  // =====================================================
  // 当前数据
  // =====================================================

  const latest =
    chartData[
      chartData.length - 1
    ];


  const first =
    chartData[0];


  const change =
    latest.value -
    first.value;


  const changeRate =
    first.value !== 0
      ? (
          change /
          first.value
        ) *
        100
      : 0;


  return (

    <div
      className="
        bg-white
        rounded-2xl
        shadow
        p-8
      "
    >

      {/* =================================================
          Header
      ================================================= */}

      <div
        className="
          flex
          items-start
          justify-between
          gap-6
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
            Wealth Trend
          </h2>


          <p
            className="
              text-sm
              text-gray-500
              mt-1
            "
          >
            Total wealth history
          </p>

        </div>


        <div
          className="
            text-right
          "
        >

          <div
            className="
              text-sm
              text-gray-500
            "
          >
            Current Wealth
          </div>


          <div
            className="
              text-2xl
              font-bold
              text-gray-900
              mt-1
            "
          >
            ¥{money(latest.value)}
          </div>


          <div
            className={`
              text-sm
              font-semibold
              mt-1
              ${
                change >= 0
                  ? "text-green-600"
                  : "text-red-600"
              }
            `}
          >

            {change >= 0
              ? "+"
              : ""}

            ¥{money(change)}

            {" "}

            (
            {changeRate >= 0
              ? "+"
              : ""}

            {changeRate.toFixed(2)}
            %)

          </div>

        </div>

      </div>


      {/* =================================================
          Chart
      ================================================= */}

      <div
        className="
          mt-8
          w-full
          overflow-x-auto
        "
      >

        <div
          className="
            min-w-[760px]
          "
        >

          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="
              w-full
              h-[360px]
            "
            preserveAspectRatio="none"
          >

            {/* =================================================
                Grid
            ================================================= */}

            {
              yTicks.map(
                (
                  tick,
                  index
                ) => (

                  <g
                    key={
                      `grid-${index}`
                    }
                  >

                    <line
                      x1={paddingLeft}
                      y1={tick.y}
                      x2={
                        width -
                        paddingRight
                      }
                      y2={tick.y}
                      stroke="#e5e7eb"
                      strokeWidth="1"
                    />


                    <text
                      x={
                        paddingLeft -
                        12
                      }
                      y={
                        tick.y + 5
                      }
                      textAnchor="end"
                      fontSize="12"
                      fill="#9ca3af"
                    >
                      ¥
                      {money(
                        tick.value
                      )}
                    </text>

                  </g>

                )
              )
            }


            {/* =================================================
                Area
            ================================================= */}

            <polygon
              points={areaPoints}
              fill="#f3f4f6"
              opacity="0.7"
            />


            {/* =================================================
                Wealth Line
            ================================================= */}

            <polyline
              points={linePoints}
              fill="none"
              stroke="#111827"
              strokeWidth="4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />


            {/* =================================================
                Data Points
            ================================================= */}

            {
              chartData.map(
                (
                  item,
                  index
                ) => (

                  <circle
                    key={
                      `point-${index}`
                    }
                    cx={
                      getX(index)
                    }
                    cy={
                      getY(
                        item.value
                      )
                    }
                    r={
                      chartData.length <= 20
                        ? 4
                        : 2.5
                    }
                    fill="#ffffff"
                    stroke="#111827"
                    strokeWidth="2"
                  />

                )
              )
            }


            {/* =================================================
                X 日期
            ================================================= */}

            {
              dateIndexes.map(
                (
                  index
                ) => {

                  const item =
                    chartData[
                      index
                    ];


                  return (

                    <text
                      key={
                        `date-${index}`
                      }
                      x={
                        getX(index)
                      }
                      y={
                        height -
                        18
                      }
                      textAnchor="middle"
                      fontSize="12"
                      fill="#9ca3af"
                    >
                      {
                        item.date
                      }
                    </text>

                  );

                }
              )
            }

          </svg>

        </div>

      </div>


      {/* =================================================
          Bottom
      ================================================= */}

      <div
        className="
          mt-4
          flex
          items-center
          justify-between
          text-sm
          text-gray-400
        "
      >

        <span>
          {first.date}
        </span>


        <span>
          {chartData.length} 个历史数据点
        </span>


        <span>
          {latest.date}
        </span>

      </div>

    </div>

  );

}