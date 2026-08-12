"use client";

import {
  useMemo,
  useState,
} from "react";


// =====================================================
// 类型
// =====================================================

type SortKey =
  | "name"
  | "previous"
  | "latest"
  | "change"
  | "changeRate";


type SortDirection =
  | "asc"
  | "desc";


type PerformanceRow = {

  code: string;

  name: string;

  market: string;

  previous: number;

  latest: number;

  change: number;

  changeRate: number;

};


// =====================================================
// Props
// =====================================================

interface Props {

  holdings: any[];

  history: any[];

}


// =====================================================
// 数字
// =====================================================

function toNumber(
  value: any
): number {

  const number =
    Number(value);

  return Number.isFinite(number)
    ? number
    : 0;

}


// =====================================================
// 金额
// =====================================================

function formatMoney(
  value: number
): string {

  return Math.round(
    value
  ).toLocaleString(
    "zh-CN"
  );

}


// =====================================================
// 涨跌金额
// =====================================================

function formatChange(
  value: number
): string {

  const rounded =
    Math.round(value);


  if (
    rounded > 0
  ) {

    return `+¥${formatMoney(
      rounded
    )}`;

  }


  if (
    rounded < 0
  ) {

    return `-¥${formatMoney(
      Math.abs(rounded)
    )}`;

  }


  return "¥0";

}


// =====================================================
// 涨跌幅
// =====================================================

function formatChangeRate(
  value: number
): string {

  if (
    value > 0
  ) {

    return `+${value.toFixed(2)}%`;

  }


  if (
    value < 0
  ) {

    return `${value.toFixed(2)}%`;

  }


  return "0.00%";

}


// =====================================================
// 日期
// =====================================================

function getDate(
  item: any
): string | null {

  if (
    !item
  ) {

    return null;

  }


  const value =
    item.snapshot_date ??
    item.date ??
    item.trade_date ??
    null;


  if (
    !value
  ) {

    return null;

  }


  return String(
    value
  );

}


// =====================================================
// Today Performance Table
// =====================================================

export default function TodayPerformanceTable({
  holdings,
  history,
}: Props) {


  const [
    sortKey,
    setSortKey,
  ] =
    useState<SortKey>(
      "change"
    );


  const [
    sortDirection,
    setSortDirection,
  ] =
    useState<SortDirection>(
      "desc"
    );


  // ===================================================
  // 找最近两个历史日期
  // ===================================================

  const dates =
    useMemo(
      () => {

        const set =
          new Set<string>();


        (
          history ?? []
        ).forEach(
          (
            item: any
          ) => {

            const date =
              getDate(item);


            if (
              date
            ) {

              set.add(
                date
              );

            }

          }
        );


        return Array.from(
          set
        ).sort(
          (
            a,
            b
          ) =>
            b.localeCompare(
              a
            )
        );

      },
      [
        history,
      ]
    );


  const latestDate =
    dates[0] ??
    null;


  const previousDate =
    dates[1] ??
    null;


  // ===================================================
  // 根据历史数据建立 map
  //
  // 注意：
  // code + platform 才是唯一标识
  // 防止不同平台相同 code 相互覆盖
  // ===================================================

  const rows =
    useMemo(
      () => {

        if (
          !latestDate ||
          !previousDate
        ) {

          return [];

        }


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


        (
          history ?? []
        ).forEach(
          (
            item: any
          ) => {

            const date =
              getDate(item);


            if (
              date !== latestDate &&
              date !== previousDate
            ) {

              return;

            }


            const code =
              String(
                item?.code ??
                ""
              )
                .trim()
                .toUpperCase();


            const platform =
              String(
                item?.platform ??
                ""
              )
                .trim()
                .toUpperCase();


            if (
              !code
            ) {

              return;

            }


            const key =
              `${code}__${platform}`;


            if (
              date === latestDate
            ) {

              latestMap.set(
                key,
                item
              );

            }


            if (
              date === previousDate
            ) {

              previousMap.set(
                key,
                item
              );

            }

          }
        );


        // =================================================
        // 当前 active holdings
        //
        // 用于确定现在应该显示哪些资产
        // =================================================

        const activeMap =
          new Map<
            string,
            any
          >();


        (
          holdings ?? []
        ).forEach(
          (
            item: any
          ) => {

            if (
              item?.active === false
            ) {

              return;

            }


            const code =
              String(
                item?.code ??
                ""
              )
                .trim()
                .toUpperCase();


            const platform =
              String(
                item?.platform ??
                ""
              )
                .trim()
                .toUpperCase();


            if (
              !code
            ) {

              return;

            }


            const key =
              `${code}__${platform}`;


            activeMap.set(
              key,
              item
            );

          }
        );


        const result:
          PerformanceRow[] = [];


        // =================================================
        // 以最新历史数据为主
        // =================================================

        latestMap.forEach(
          (
            latestItem,
            key
          ) => {

            const previousItem =
              previousMap.get(
                key
              );


            const latest =
              toNumber(
                latestItem?.amount
              );


            const previous =
              toNumber(
                previousItem?.amount
              );


            const change =
              latest -
              previous;


            const changeRate =
              previous !== 0
                ? (
                    change /
                    previous
                  ) *
                  100
                : latest !== 0
                  ? 100
                  : 0;


            const activeItem =
              activeMap.get(
                key
              );


            result.push({

              code:
                String(
                  latestItem?.code ??
                  activeItem?.code ??
                  ""
                ),

              name:
                String(
                  latestItem?.name ??
                  activeItem?.name ??
                  latestItem?.code ??
                  ""
                ),

              market:
                String(
                  latestItem?.market ??
                  activeItem?.market ??
                  ""
                )
                  .trim()
                  .toUpperCase(),

              previous,

              latest,

              change,

              changeRate,

            });

          }
        );


        return result;

      },
      [
        history,
        holdings,
        latestDate,
        previousDate,
      ]
    );


  // ===================================================
  // 排序
  // ===================================================

  const sortedRows =
    useMemo(
      () => {

        const result =
          [
            ...rows,
          ];


        result.sort(
          (
            a,
            b
          ) => {

            let comparison =
              0;


            if (
              sortKey ===
              "name"
            ) {

              comparison =
                a.name.localeCompare(
                  b.name,
                  "zh-CN"
                );

            }
            else {

              comparison =
                toNumber(
                  b[sortKey]
                ) -
                toNumber(
                  a[sortKey]
                );

            }


            return sortDirection ===
              "asc"
              ? -comparison
              : comparison;

          }
        );


        return result;

      },
      [
        rows,
        sortKey,
        sortDirection,
      ]
    );


  // ===================================================
  // 点击排序
  // ===================================================

  function handleSort(
    key: SortKey
  ) {

    if (
      sortKey === key
    ) {

      setSortDirection(
        current =>
          current === "asc"
            ? "desc"
            : "asc"
      );

      return;

    }


    setSortKey(
      key
    );


    setSortDirection(
      key === "name"
        ? "asc"
        : "desc"
    );

  }


  // ===================================================
  // 排序箭头
  // ===================================================

  function SortArrow({
    column,
  }: {
    column: SortKey;
  }) {

    if (
      sortKey !== column
    ) {

      return (

        <span
          className="
            ml-1
            text-gray-300
          "
        >
          ↕
        </span>

      );

    }


    return (

      <span
        className="
          ml-1
          text-gray-500
        "
      >
        {sortDirection ===
        "asc"
          ? "↑"
          : "↓"}
      </span>

    );

  }


  // ===================================================
  // Loading / 数据不足
  // ===================================================

  if (
    !latestDate ||
    !previousDate
  ) {

    return (

      <section
        className="
          bg-white
          rounded-2xl
          border
          border-gray-200
          shadow-sm
          overflow-hidden
        "
      >

        <div
          className="
            px-6
            py-5
            border-b
            border-gray-200
          "
        >

          <h2
            className="
              text-xl
              font-semibold
              text-gray-900
            "
          >
            今日表现
          </h2>


          <div
            className="
              mt-1
              text-sm
              text-gray-500
            "
          >
            暂无足够的历史数据进行比较
          </div>

        </div>


        <div
          className="
            px-6
            py-10
            text-center
            text-gray-400
          "
        >
          至少需要两个交易日的数据
        </div>

      </section>

    );

  }


  // ===================================================
  // 页面
  // ===================================================

  return (

    <section
      className="
        bg-white
        rounded-2xl
        border
        border-gray-200
        shadow-sm
        overflow-hidden
      "
    >

      {/* =================================================
          Header
      ================================================= */}

      <div
        className="
          px-6
          py-5
          border-b
          border-gray-200
          flex
          items-center
          justify-between
        "
      >

        <div>

          <h2
            className="
              text-xl
              font-semibold
              text-gray-900
            "
          >
            今日表现
          </h2>


          <div
            className="
              mt-1
              text-sm
              text-gray-500
            "
          >

            {latestDate}
            {" "}
            vs
            {" "}
            {previousDate}

          </div>

        </div>


        <div
          className="
            text-sm
            text-gray-400
          "
        >
          共 {sortedRows.length} 项
        </div>

      </div>


      {/* =================================================
          Table
      ================================================= */}

      {sortedRows.length === 0 ? (

        <div
          className="
            px-6
            py-10
            text-center
            text-gray-400
          "
        >
          暂无今日表现数据
        </div>

      ) : (

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
                  bg-gray-50
                  border-b
                  border-gray-200
                "
              >

                {/* # */}

                <th
                  className="
                    px-6
                    py-3
                    text-left
                    font-medium
                    text-gray-500
                    w-16
                  "
                >
                  #
                </th>


                {/* 资产 */}

                <th
                  onClick={() =>
                    handleSort(
                      "name"
                    )
                  }
                  className="
                    px-4
                    py-3
                    text-left
                    font-medium
                    text-gray-500
                    cursor-pointer
                    select-none
                    hover:text-gray-900
                  "
                >

                  资产

                  <SortArrow
                    column="name"
                  />

                </th>


                {/* 昨日 */}

                <th
                  onClick={() =>
                    handleSort(
                      "previous"
                    )
                  }
                  className="
                    px-4
                    py-3
                    text-right
                    font-medium
                    text-gray-500
                    cursor-pointer
                    select-none
                    hover:text-gray-900
                    whitespace-nowrap
                  "
                >

                  昨日

                  <SortArrow
                    column="previous"
                  />

                </th>


                {/* 今日 */}

                <th
                  onClick={() =>
                    handleSort(
                      "latest"
                    )
                  }
                  className="
                    px-4
                    py-3
                    text-right
                    font-medium
                    text-gray-500
                    cursor-pointer
                    select-none
                    hover:text-gray-900
                    whitespace-nowrap
                  "
                >

                  今日

                  <SortArrow
                    column="latest"
                  />

                </th>


                {/* 涨跌 */}

                <th
                  onClick={() =>
                    handleSort(
                      "change"
                    )
                  }
                  className="
                    px-4
                    py-3
                    text-right
                    font-medium
                    text-gray-500
                    cursor-pointer
                    select-none
                    hover:text-gray-900
                    whitespace-nowrap
                  "
                >

                  涨跌

                  <SortArrow
                    column="change"
                  />

                </th>


                {/* 涨跌幅 */}

                <th
                  onClick={() =>
                    handleSort(
                      "changeRate"
                    )
                  }
                  className="
                    px-6
                    py-3
                    text-right
                    font-medium
                    text-gray-500
                    cursor-pointer
                    select-none
                    hover:text-gray-900
                    whitespace-nowrap
                  "
                >

                  涨跌%

                  <SortArrow
                    column="changeRate"
                  />

                </th>

              </tr>

            </thead>


            <tbody>

              {sortedRows.map(
                (
                  row,
                  index
                ) => (

                  <tr
                    key={
                      `${row.code}-${row.market}-${index}`
                    }
                    className="
                      border-b
                      border-gray-100
                      last:border-b-0
                      hover:bg-gray-50
                    "
                  >

                    {/* # */}

                    <td
                      className="
                        px-6
                        py-4
                        text-gray-400
                      "
                    >
                      {index + 1}
                    </td>


                    {/* 资产 */}

                    <td
                      className="
                        px-4
                        py-4
                      "
                    >

                      <div
                        className="
                          font-medium
                          text-gray-900
                        "
                      >
                        {row.name}
                      </div>


                      <div
                        className="
                          mt-0.5
                          text-xs
                          text-gray-400
                        "
                      >
                        {row.code}
                      </div>

                    </td>


                    {/* 昨日 */}

                    <td
                      className="
                        px-4
                        py-4
                        text-right
                        text-gray-600
                        whitespace-nowrap
                      "
                    >
                      ¥{formatMoney(
                        row.previous
                      )}
                    </td>


                    {/* 今日 */}

                    <td
                      className="
                        px-4
                        py-4
                        text-right
                        font-medium
                        text-gray-900
                        whitespace-nowrap
                      "
                    >
                      ¥{formatMoney(
                        row.latest
                      )}
                    </td>


                    {/* 涨跌 */}

                    <td
                      className={`
                        px-4
                        py-4
                        text-right
                        font-semibold
                        whitespace-nowrap
                        ${
                          row.change > 0
                            ? "text-green-600"
                            : row.change < 0
                              ? "text-red-600"
                              : "text-gray-500"
                        }
                      `}
                    >
                      {formatChange(
                        row.change
                      )}
                    </td>


                    {/* 涨跌% */}

                    <td
                      className={`
                        px-6
                        py-4
                        text-right
                        font-semibold
                        whitespace-nowrap
                        ${
                          row.changeRate > 0
                            ? "text-green-600"
                            : row.changeRate < 0
                              ? "text-red-600"
                              : "text-gray-500"
                        }
                      `}
                    >
                      {formatChangeRate(
                        row.changeRate
                      )}
                    </td>

                  </tr>

                )
              )}

            </tbody>

          </table>

        </div>

      )}

    </section>

  );

}