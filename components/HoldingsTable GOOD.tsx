
"use client";

interface Props {
  holdings: any[];
}

export default function HoldingsTable({
  holdings,
}: Props) {

  // =====================================================
  // 数据检查
  // =====================================================

  if (
    !Array.isArray(holdings) ||
    holdings.length === 0
  ) {
    return null;
  }


  // =====================================================
  // 数字处理
  // =====================================================

  const getNumber = (
    ...values: any[]
  ): number => {

    for (const value of values) {

      if (
        value !== undefined &&
        value !== null &&
        value !== ""
      ) {

        const number =
          Number(value);

        if (
          Number.isFinite(number)
        ) {

          return number;

        }

      }

    }

    return 0;

  };


  // =====================================================
  // 计算总资产
  // =====================================================

  const totalAmount =
    holdings.reduce(
      (
        sum,
        item
      ) =>
        sum +
        getNumber(
          item.amount,
          item.market_value,
          item.value
        ),
      0
    );


  // =====================================================
  // 格式化金额
  // =====================================================

  const formatMoney = (
    value: number
  ) => {

    return `¥${value.toLocaleString(
      "zh-CN",
      {
        maximumFractionDigits: 0,
      }
    )}`;

  };


  // =====================================================
  // 格式化百分比
  // =====================================================

  const formatPercent = (
    value: number
  ) => {

    return `${value.toFixed(2)}%`;

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
            💼 Holdings
          </h2>

          <p
            className="
              text-sm
              text-gray-400
              mt-1
            "
          >
            当前持仓、成本与盈亏情况
          </p>

        </div>


        <div
          className="
            text-sm
            text-gray-400
          "
        >
          {holdings.length} 项持仓
        </div>

      </div>


      {/* =================================================
          Desktop Table
      ================================================= */}

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
                  text-left
                  py-4
                  font-medium
                "
              >
                持仓
              </th>


              <th
                className="
                  text-right
                  py-4
                  font-medium
                "
              >
                市值
              </th>


              <th
                className="
                  text-right
                  py-4
                  font-medium
                "
              >
                成本
              </th>


              <th
                className="
                  text-right
                  py-4
                  font-medium
                "
              >
                盈亏额
              </th>


              <th
                className="
                  text-right
                  py-4
                  font-medium
                "
              >
                盈亏率
              </th>


              <th
                className="
                  text-right
                  py-4
                  font-medium
                "
              >
                占比
              </th>

            </tr>

          </thead>


          <tbody>

            {
              holdings.map(
                (
                  item,
                  index
                ) => {


                  // =====================================
                  // 基础数据
                  // =====================================

                  const amount =
                    getNumber(
                      item.amount,
                      item.market_value,
                      item.value
                    );


                  // =====================================
                  // 成本
                  //
                  // 支持多个可能的数据库字段
                  // =====================================

                  const cost =
                    getNumber(
                      item.cost,
                      item.cost_amount,
                      item.total_cost,
                      item.invested_amount,
                      item.buy_amount,
                      item.purchase_amount
                    );


                  // =====================================
                  // 盈亏额
                  //
                  // 如果数据库已有 profit / pnl
                  // 优先使用数据库数据
                  //
                  // 否则：
                  // 市值 - 成本
                  // =====================================

                  let profit =
                    getNumber(
                      item.profit,
                      item.pnl,
                      item.total_profit,
                      item.profit_amount
                    );


                  if (
                    profit === 0 &&
                    cost > 0
                  ) {

                    profit =
                      amount -
                      cost;

                  }


                  // =====================================
                  // 盈亏率
                  // =====================================

                  let profitRate =
                    getNumber(
                      item.profit_rate,
                      item.pnl_rate,
                      item.return_rate,
                      item.roi
                    );


                  if (
                    profitRate === 0 &&
                    cost > 0
                  ) {

                    profitRate =
                      (
                        profit /
                        cost
                      ) *
                      100;

                  }


                  // =====================================
                  // 持仓占比
                  // =====================================

                  const allocation =
                    totalAmount > 0
                      ? (
                          amount /
                          totalAmount
                        ) *
                        100
                      : 0;


                  // =====================================
                  // 名称
                  // =====================================

                  const name =
                    item.name ||
                    item.product ||
                    item.code ||
                    "Unknown";


                  const code =
                    item.code ||
                    "";


                  // =====================================
                  // 盈亏颜色
                  // =====================================

                  const profitColor =
                    profit > 0
                      ? "text-green-600"
                      : profit < 0
                        ? "text-red-600"
                        : "text-gray-500";


                  return (

                    <tr
                      key={
                        item.id ||
                        item.code ||
                        index
                      }
                      className="
                        border-b
                        border-gray-50
                        last:border-0
                        hover:bg-gray-50
                        transition
                      "
                    >

                      {/* =============================
                          Holdings
                      ============================= */}

                      <td
                        className="
                          py-5
                          pr-4
                        "
                      >

                        <div
                          className="
                            font-semibold
                            text-gray-900
                          "
                        >
                          {name}
                        </div>


                        {
                          code &&
                          code !== name && (

                            <div
                              className="
                                text-xs
                                text-gray-400
                                mt-1
                              "
                            >
                              {code}
                            </div>

                          )
                        }


                        {
                          item.category && (

                            <div
                              className="
                                text-xs
                                text-gray-400
                                mt-1
                              "
                            >
                              {item.category}
                            </div>

                          )
                        }

                      </td>


                      {/* =============================
                          市值
                      ============================= */}

                      <td
                        className="
                          py-5
                          text-right
                          font-semibold
                          text-gray-900
                          whitespace-nowrap
                        "
                      >

                        {formatMoney(
                          amount
                        )}

                      </td>


                      {/* =============================
                          成本
                      ============================= */}

                      <td
                        className="
                          py-5
                          text-right
                          text-gray-600
                          whitespace-nowrap
                        "
                      >

                        {
                          cost > 0
                            ? formatMoney(
                                cost
                              )
                            : "—"
                        }

                      </td>


                      {/* =============================
                          盈亏额
                      ============================= */}

                      <td
                        className={`
                          py-5
                          text-right
                          font-semibold
                          whitespace-nowrap
                          ${profitColor}
                        `}
                      >

                        {
                          profit > 0
                            ? "+"
                            : ""
                        }

                        {formatMoney(
                          profit
                        )}

                      </td>


                      {/* =============================
                          盈亏率
                      ============================= */}

                      <td
                        className={`
                          py-5
                          text-right
                          font-semibold
                          whitespace-nowrap
                          ${profitColor}
                        `}
                      >

                        {
                          profit > 0
                            ? "+"
                            : ""
                        }

                        {formatPercent(
                          profitRate
                        )}

                      </td>


                      {/* =============================
                          占比
                      ============================= */}

                      <td
                        className="
                          py-5
                          text-right
                          text-gray-600
                          whitespace-nowrap
                        "
                      >

                        {allocation.toFixed(
                          1
                        )}%

                      </td>

                    </tr>

                  );

                }
              )
            }

          </tbody>


          {/* =================================================
              Footer
          ================================================= */}

          <tfoot>

            <tr
              className="
                border-t
                border-gray-200
              "
            >

              <td
                className="
                  py-5
                  font-bold
                  text-gray-900
                "
              >
                Total
              </td>


              <td
                className="
                  py-5
                  text-right
                  font-bold
                  text-gray-900
                "
              >

                {formatMoney(
                  totalAmount
                )}

              </td>


              <td
                className="
                  py-5
                  text-right
                  text-gray-500
                "
              >
                —
              </td>


              <td
                className="
                  py-5
                  text-right
                  text-gray-500
                "
              >
                —
              </td>


              <td
                className="
                  py-5
                  text-right
                  text-gray-500
                "
              >
                —
              </td>


              <td
                className="
                  py-5
                  text-right
                  font-bold
                  text-gray-900
                "
              >
                100.0%
              </td>

            </tr>

          </tfoot>

        </table>

      </div>

    </div>

  );

}