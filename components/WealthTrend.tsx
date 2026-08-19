"use client";

import { useMemo, useState } from "react";

type HistoryItem = {
  id?: number;
  snapshot_date: string;
  cn_asset?: number | string | null;
  hk_asset?: number | string | null;
  total_asset?: number | string | null;
};

type Props = {
  history: HistoryItem[];
};

type Range = 14 | 30;

function toNumber(value: unknown): number {
  const number = Number(value ?? 0);

  return Number.isFinite(number) ? number : 0;
}

function formatMoney(value: number) {
  return `¥ ${Math.round(value).toLocaleString("zh-CN")}`;
}

function formatDate(value: string) {
  const parts = value.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function formatChange(value: number) {
  if (value === 0) {
    return "—";
  }

  const sign = value > 0 ? "+" : "-";

  return `${sign}¥ ${Math.abs(Math.round(value)).toLocaleString("zh-CN")}`;
}

export default function WealthTrend({
  history,
}: Props) {

  const [range, setRange] = useState<Range>(14);

  const rows = useMemo(() => {

    const sorted = [...(Array.isArray(history) ? history : [])]
      .filter((item) => item?.snapshot_date)
      .sort((a, b) => {
        return (
          new Date(a.snapshot_date).getTime() -
          new Date(b.snapshot_date).getTime()
        );
      });

    /*
     * 只显示最近 14 / 30 条记录。
     *
     * 注意：
     * 这里按照“历史快照条数”计算，而不是按照自然日计算。
     * 因为周末、节假日可能没有资产快照。
     */
    const latest = sorted.slice(-range);

    /*
     * 表格从最新日期开始显示。
     */
    const descending = [...latest].reverse();

    return descending.map((item, index) => {

      const totalAsset = toNumber(item.total_asset);
      const cnAsset = toNumber(item.cn_asset);
      const hkAsset = toNumber(item.hk_asset);

      /*
       * 找上一条历史记录。
       *
       * 因为 descending 是倒序：
       * index + 1 就是上一交易日。
       */
      const previous = latest[latest.length - 2 - index];

      const previousTotal = previous
        ? toNumber(previous.total_asset)
        : null;

      const change =
        previousTotal !== null
          ? totalAsset - previousTotal
          : null;

      return {
        ...item,
        totalAsset,
        cnAsset,
        hkAsset,
        change,
        isLatest: index === 0,
      };
    });

  }, [history, range]);


  return (
    <section
      className="
        bg-white
        rounded-2xl
        shadow
        overflow-hidden
      "
    >

      {/* =====================================================
          Header
          ===================================================== */}

      <div
        className="
          px-8
          py-6
          border-b
          border-gray-100
          flex
          items-center
          justify-between
          gap-4
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
            📈 Wealth Trend
          </h2>

          <p
            className="
              mt-1
              text-sm
              text-gray-500
            "
          >
            历史财富记录
          </p>

        </div>


        {/* =================================================
            Range Switch
            ================================================= */}

        <div
          className="
            flex
            items-center
            rounded-lg
            bg-gray-100
            p-1
          "
        >

          <button
            type="button"
            onClick={() => setRange(14)}
            className={`
              px-4
              py-2
              rounded-md
              text-sm
              font-medium
              transition
              ${
                range === 14
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }
            `}
          >
            2周
          </button>


          <button
            type="button"
            onClick={() => setRange(30)}
            className={`
              px-4
              py-2
              rounded-md
              text-sm
              font-medium
              transition
              ${
                range === 30
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-900"
              }
            `}
          >
            1个月
          </button>

        </div>

      </div>


      {/* =====================================================
          Empty
          ===================================================== */}

      {rows.length === 0 ? (

        <div
          className="
            px-8
            py-12
            text-center
            text-gray-500
          "
        >
          暂无历史资产数据
        </div>

      ) : (

        <div className="overflow-x-auto">

          <table className="w-full">

            <thead>

              <tr
                className="
                  bg-gray-50
                  border-b
                  border-gray-100
                "
              >

                <th
                  className="
                    px-8
                    py-4
                    text-left
                    text-xs
                    font-semibold
                    text-gray-500
                  "
                >
                  日期
                </th>


                <th
                  className="
                    px-6
                    py-4
                    text-right
                    text-xs
                    font-semibold
                    text-gray-500
                  "
                >
                  大陆资产
                </th>


                <th
                  className="
                    px-6
                    py-4
                    text-right
                    text-xs
                    font-semibold
                    text-gray-500
                  "
                >
                  香港资产
                </th>


                <th
                  className="
                    px-6
                    py-4
                    text-right
                    text-xs
                    font-semibold
                    text-gray-500
                  "
                >
                  总资产
                </th>


                <th
                  className="
                    px-8
                    py-4
                    text-right
                    text-xs
                    font-semibold
                    text-gray-500
                  "
                >
                  较上一日
                </th>

              </tr>

            </thead>


            <tbody>

              {rows.map((row) => (

                <tr
                  key={`${row.snapshot_date}-${row.id ?? "history"}`}
                  className={`
                    border-b
                    border-gray-100
                    transition
                    ${
                      row.isLatest
                        ? "bg-blue-50/50"
                        : "hover:bg-gray-50"
                    }
                  `}
                >

                  {/* 日期 */}

                  <td
                    className="
                      px-8
                      py-5
                      whitespace-nowrap
                    "
                  >

                    <div
                      className="
                        flex
                        items-center
                        gap-3
                      "
                    >

                      {row.isLatest && (
                        <span
                          className="
                            inline-flex
                            items-center
                            rounded-full
                            bg-blue-100
                            px-2
                            py-1
                            text-[10px]
                            font-semibold
                            text-blue-700
                          "
                        >
                          最新
                        </span>
                      )}

                      <span
                        className="
                          text-sm
                          font-medium
                          text-gray-900
                        "
                      >
                        {formatDate(
                          row.snapshot_date
                        )}
                      </span>

                    </div>

                  </td>


                  {/* 大陆 */}

                  <td
                    className="
                      px-6
                      py-5
                      text-right
                      whitespace-nowrap
                      text-sm
                      text-gray-700
                    "
                  >
                    {formatMoney(row.cnAsset)}
                  </td>


                  {/* 香港 */}

                  <td
                    className="
                      px-6
                      py-5
                      text-right
                      whitespace-nowrap
                      text-sm
                      text-gray-700
                    "
                  >
                    {formatMoney(row.hkAsset)}
                  </td>


                  {/* 总资产 */}

                  <td
                    className="
                      px-6
                      py-5
                      text-right
                      whitespace-nowrap
                    "
                  >

                    <span
                      className={`
                        text-sm
                        font-bold
                        ${
                          row.isLatest
                            ? "text-blue-700"
                            : "text-gray-900"
                        }
                      `}
                    >
                      {formatMoney(row.totalAsset)}
                    </span>

                  </td>


                  {/* 较上一日 */}

                  <td
                    className="
                      px-8
                      py-5
                      text-right
                      whitespace-nowrap
                    "
                  >

                    {row.change === null ? (

                      <span
                        className="
                          text-sm
                          text-gray-400
                        "
                      >
                        —
                      </span>

                    ) : (

                      <span
                        className={`
                          text-sm
                          font-medium
                          ${
                            row.change > 0
                              ? "text-green-600"
                              : row.change < 0
                                ? "text-red-600"
                                : "text-gray-400"
                          }
                        `}
                      >
                        {formatChange(
                          row.change
                        )}
                      </span>

                    )}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}


      {/* =====================================================
          Footer
          ===================================================== */}

      <div
        className="
          px-8
          py-4
          border-t
          border-gray-100
          text-xs
          text-gray-400
        "
      >

        显示最近 {range} 条资产历史记录

      </div>

    </section>
  );
}