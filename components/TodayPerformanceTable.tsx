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

  latest: any[];

  previous: any[];

  latestDate: string | null;

  previousDate: string | null;

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
// 单个市场表格
// =====================================================

function MarketTable({

  rows,

  market,

}: {

  rows: PerformanceRow[];

  market: "CN" | "HK";

}) {

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

        {
          sortDirection ===
          "asc"
            ? "↑"
            : "↓"
        }

      </span>

    );

  }

  // ===================================================
  // 空数据
  // ===================================================

  if (
    sortedRows.length === 0
  ) {

    return (

      <div
        className="
          px-6
          py-8
          text-center
          text-gray-400
        "
      >
        暂无数据
      </div>

    );

  }

  // ===================================================
  // 表格
  // ===================================================

  return (

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

                <td
                  className="
                    px-6
                    py-4
                    text-gray-400
                  "
                >
                  {index + 1}
                </td>

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

                <td
                  className="
                    px-4
                    py-4
                    text-right
                    text-gray-600
                    whitespace-nowrap
                  "
                >

                  ¥
                  {formatMoney(
                    row.previous
                  )}

                </td>

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

                  ¥
                  {formatMoney(
                    row.latest
                  )}

                </td>

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

  );

}

// =====================================================
// 市场折叠区
// =====================================================

function MarketSection({

  title,

  count,

  rows,

  market,

  defaultOpen = true,

}: {

  title: string;

  count: number;

  rows: PerformanceRow[];

  market: "CN" | "HK";

  defaultOpen?: boolean;

}) {

  const [
    open,
    setOpen,
  ] =
    useState(
      defaultOpen
    );

  return (

    <div
      className="
        border-b
        border-gray-200
        last:border-b-0
      "
    >

      {/* =================================================
          市场标题
      ================================================= */}

      <button
        type="button"
        onClick={() =>
          setOpen(
            current =>
              !current
          )
        }
        className="
          w-full
          px-6
          py-4
          flex
          items-center
          justify-between
          bg-white
          hover:bg-gray-50
          transition
          select-none
        "
      >

        <div
          className="
            flex
            items-center
            gap-3
          "
        >

          <span
            className="
              text-lg
            "
          >
            {market === "CN"
              ? "🇨🇳"
              : "🇭🇰"}
          </span>

          <span
            className="
              font-semibold
              text-gray-900
            "
          >
            {title}
          </span>

          <span
            className="
              px-2
              py-0.5
              rounded-full
              bg-gray-100
              text-xs
              text-gray-500
            "
          >
            {count} 项
          </span>

        </div>

        <span
          className="
            text-gray-400
            text-lg
          "
        >
          {open
            ? "⌃"
            : "⌄"}
        </span>

      </button>

      {/* =================================================
          内容
      ================================================= */}

      {open && (

        <MarketTable
          rows={rows}
          market={market}
        />

      )}

    </div>

  );

}

// =====================================================
// Today Performance Table
// =====================================================

export default function TodayPerformanceTable({

  holdings,

  latest,

  previous,

  latestDate,

  previousDate,

}: Props) {

  // ===================================================
  // 建立今日 / 昨日 Map
  // ===================================================

  const rows =
    useMemo(
      () => {

        const latestRows =
          Array.isArray(latest)
            ? latest
            : [];

        const previousRows =
          Array.isArray(previous)
            ? previous
            : [];

        const holdingRows =
          Array.isArray(holdings)
            ? holdings
            : [];

        if (
          latestRows.length === 0 ||
          previousRows.length === 0
        ) {

          return [];

        }

        // ---------------------------------------------
        // holdings map
        // ---------------------------------------------

        const holdingsMap =
          new Map<
            string,
            any
          >();

        holdingRows.forEach(
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

            const market =
              String(
                item?.market ??
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
              `${code}__${market}`;

            holdingsMap.set(
              key,
              item
            );

          }
        );

        // ---------------------------------------------
        // 今日 map
        // ---------------------------------------------

        const latestMap =
          new Map<
            string,
            any
          >();

        latestRows.forEach(
          (
            item: any
          ) => {

            const code =
              String(
                item?.code ??
                ""
              )
                .trim()
                .toUpperCase();

            const market =
              String(
                item?.market ??
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
              `${code}__${market}`;

            latestMap.set(
              key,
              item
            );

          }
        );

        // ---------------------------------------------
        // 昨日 map
        // ---------------------------------------------

        const previousMap =
          new Map<
            string,
            any
          >();

        previousRows.forEach(
          (
            item: any
          ) => {

            const code =
              String(
                item?.code ??
                ""
              )
                .trim()
                .toUpperCase();

            const market =
              String(
                item?.market ??
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
              `${code}__${market}`;

            previousMap.set(
              key,
              item
            );

          }
        );

        // ---------------------------------------------
        // 计算
        // ---------------------------------------------

        const result:
          PerformanceRow[] = [];

        latestMap.forEach(
          (
            latestItem,
            key
          ) => {

            const previousItem =
              previousMap.get(
                key
              );

            if (
              !previousItem
            ) {

              return;

            }

            const activeItem =
              holdingsMap.get(
                key
              );

            const latestAmount =
              toNumber(
                latestItem?.amount
              );

            const previousAmount =
              toNumber(
                previousItem?.amount
              );

            const change =
              latestAmount -
              previousAmount;

            const changeRate =
              previousAmount !== 0
                ? (
                    change /
                    previousAmount
                  ) *
                  100
                : latestAmount !== 0
                  ? 100
                  : 0;

            result.push({

              code:
                String(
                  latestItem?.code ??
                  previousItem?.code ??
                  activeItem?.code ??
                  ""
                ),

              name:
                String(
                  latestItem?.name ??
                  previousItem?.name ??
                  activeItem?.name ??
                  latestItem?.code ??
                  ""
                ),

              market:
                String(
                  latestItem?.market ??
                  previousItem?.market ??
                  activeItem?.market ??
                  ""
                )
                  .trim()
                  .toUpperCase(),

              previous:
                previousAmount,

              latest:
                latestAmount,

              change,

              changeRate,

            });

          }
        );

        return result;

      },
      [
        latest,
        previous,
        holdings,
      ]
    );

  // ===================================================
  // 分市场
  // ===================================================

  const cnRows =
    useMemo(
      () =>
        rows.filter(
          row =>
            row.market ===
            "CN"
        ),
      [
        rows,
      ]
    );

  const hkRows =
    useMemo(
      () =>
        rows.filter(
          row =>
            row.market ===
            "HK"
        ),
      [
        rows,
      ]
    );

  // ===================================================
  // 数据不足
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
          共 {rows.length} 项
        </div>

      </div>

      {/* =================================================
          大陆
      ================================================= */}

      <MarketSection
        title="大陆"
        count={cnRows.length}
        rows={cnRows}
        market="CN"
        defaultOpen={true}
      />

      {/* =================================================
          香港
      ================================================= */}

      <MarketSection
        title="香港"
        count={hkRows.length}
        rows={hkRows}
        market="HK"
        defaultOpen={true}
      />

    </section>

  );

}