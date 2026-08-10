"use client";

import {
  useState,
} from "react";

import {
  supabase,
} from "@/lib/supabase";

interface Props {
  holdings: any[];
}

export default function HoldingsTable({
  holdings,
}: Props) {

  // =====================================================
  // Platform 本地输入状态
  // =====================================================

  const [platformValues, setPlatformValues] =
    useState<Record<string, string>>(
      {}
    );


  // =====================================================
  // Platform 保存状态
  // =====================================================

  const [savingPlatform, setSavingPlatform] =
    useState<Record<string, boolean>>(
      {}
    );


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
  // 获取 Holding 唯一 Key
  // =====================================================

  const getHoldingKey = (
    item: any,
    index: number
  ): string => {

    return String(
      item.id ||
      item.code ||
      index
    );

  };


  // =====================================================
  // 获取 Platform 当前显示值
  // =====================================================

  const getPlatformValue = (
    item: any,
    index: number
  ): string => {

    const key =
      getHoldingKey(
        item,
        index
      );


    // 如果用户已经编辑过，
    // 优先显示本地输入值

    if (
      Object.prototype.hasOwnProperty.call(
        platformValues,
        key
      )
    ) {

      return platformValues[key];

    }


    // 否则读取 Supabase 返回的 platform

    return String(
      item.platform ||
      ""
    );

  };


  // =====================================================
  // 保存 Platform
  // =====================================================

  const savePlatform = async (
    item: any,
    index: number,
    value: string
  ) => {

    const key =
      getHoldingKey(
        item,
        index
      );


    const platform =
      value.trim();


    // =================================================
    // 必须有 id
    // =================================================

    if (!item.id) {

      console.error(
        "Cannot update platform: holding id is missing",
        item
      );

      return;

    }


    // =================================================
    // 保存状态
    // =================================================

    setSavingPlatform(
      (prev) => ({
        ...prev,
        [key]: true,
      })
    );


    try {

      console.log(
        "========================================"
      );

      console.log(
        "正在保存 Platform"
      );

      console.log(
        "Holding ID:",
        item.id
      );

      console.log(
        "Code:",
        item.code
      );

      console.log(
        "Name:",
        item.name
      );

      console.log(
        "Platform:",
        platform
      );

      console.log(
        "========================================"
      );


      // =================================================
      // 写入 Supabase
      // =================================================

      const {
        data,
        error,
      } = await supabase

        .from("holdings")

        .update({
          platform:
            platform ||
            null,
        })

        .eq(
          "id",
          item.id
        )

        .select("*");


      // =================================================
      // Debug
      // =================================================

      console.log(
        "Platform 保存结果:",
        data
      );

      console.log(
        "Platform 保存错误:",
        error
      );


      // =================================================
      // Supabase 错误
      // =================================================

      if (error) {

        console.error(
          "Platform save error:",
          error
        );

        return;

      }


      // =================================================
      // 数据库没有返回记录
      //
      // 这通常意味着：
      //
      // 1. RLS
      // 2. id 不匹配
      // 3. UPDATE 没有权限
      // =================================================

      if (
        !Array.isArray(data) ||
        data.length === 0
      ) {

        console.error(
          "Platform update returned no row.",
          {
            id: item.id,
            platform,
          }
        );

        return;

      }


      // =================================================
      // 以数据库实际返回值为准
      // =================================================

      const savedPlatform =
        String(
          data[0]?.platform ||
          ""
        );


      // =================================================
      // 更新本地显示
      // =================================================

      setPlatformValues(
        (prev) => ({
          ...prev,
          [key]:
            savedPlatform,
        })
      );


      console.log(
        "Platform saved successfully:",
        savedPlatform
      );

    } catch (error) {

      console.error(
        "Platform save exception:",
        error
      );

    } finally {

      setSavingPlatform(
        (prev) => ({
          ...prev,
          [key]: false,
        })
      );

    }

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
            当前持仓、成本、盈亏与资产存放平台
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
          Table
      ================================================= */}

      <div
        className="
          overflow-x-auto
        "
      >

        <table
          className="
            w-full
            min-w-[900px]
            text-sm
          "
        >

          {/* =================================================
              Table Header
          ================================================= */}

          <thead>

            <tr
              className="
                border-b
                border-gray-100
                text-gray-400
              "
            >

              {/* =============================
                  持仓
              ============================= */}

              <th
                className="
                  text-left
                  py-4
                  pr-6
                  font-medium
                  w-[300px]
                "
              >
                持仓
              </th>


              {/* =============================
                  市值
              ============================= */}

              <th
                className="
                  text-right
                  py-4
                  px-4
                  font-medium
                  whitespace-nowrap
                "
              >
                市值
              </th>


              {/* =============================
                  成本
              ============================= */}

              <th
                className="
                  text-right
                  py-4
                  px-4
                  font-medium
                  whitespace-nowrap
                "
              >
                成本
              </th>


              {/* =============================
                  盈亏额
              ============================= */}

              <th
                className="
                  text-right
                  py-4
                  px-4
                  font-medium
                  whitespace-nowrap
                "
              >
                盈亏额
              </th>


              {/* =============================
                  盈亏率
              ============================= */}

              <th
                className="
                  text-right
                  py-4
                  px-4
                  font-medium
                  whitespace-nowrap
                "
              >
                盈亏率
              </th>


              {/* =============================
                  占比
              ============================= */}

              <th
                className="
                  text-right
                  py-4
                  pl-4
                  font-medium
                  whitespace-nowrap
                "
              >
                占比
              </th>

            </tr>

          </thead>


          {/* =================================================
              Table Body
          ================================================= */}

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


                  // =====================================
                  // CODE
                  // =====================================

                  const code =
                    item.code ||
                    "";


                  // =====================================
                  // Holding Key
                  // =====================================

                  const holdingKey =
                    getHoldingKey(
                      item,
                      index
                    );


                  // =====================================
                  // Platform
                  // =====================================

                  const platform =
                    getPlatformValue(
                      item,
                      index
                    );


                  // =====================================
                  // 保存状态
                  // =====================================

                  const isSaving =
                    Boolean(
                      savingPlatform[
                        holdingKey
                      ]
                    );


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
                          持仓
                      ============================= */}

                      <td
                        className="
                          py-5
                          pr-6
                          w-[300px]
                        "
                      >

                        {/* 名称 */}

                        <div
                          className="
                            font-semibold
                            text-gray-900
                          "
                        >
                          {name}
                        </div>


                        {/* CODE */}

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


                        {/* Platform */}

                        <div
                          className="
                            mt-1
                          "
                        >

                          <input
                            type="text"
                            value={platform}
                            placeholder="输入平台"
                            disabled={
                              isSaving
                            }
                            onChange={(
                              event
                            ) => {

                              const value =
                                event.target.value;

                              setPlatformValues(
                                (prev) => ({
                                  ...prev,
                                  [holdingKey]:
                                    value,
                                })
                              );

                            }}
                            onBlur={(
                              event
                            ) => {

                              savePlatform(
                                item,
                                index,
                                event.target.value
                              );

                            }}
                            onKeyDown={(
                              event
                            ) => {

                              if (
                                event.key ===
                                "Enter"
                              ) {

                                event.currentTarget.blur();

                              }

                            }}
                            className="
                              w-[150px]
                              h-7
                              px-2
                              text-xs
                              text-gray-600
                              bg-transparent
                              border
                              border-gray-200
                              rounded-md
                              outline-none
                              focus:border-gray-400
                              focus:ring-1
                              focus:ring-gray-200
                              placeholder:text-gray-300
                              disabled:opacity-50
                            "
                          />

                        </div>

                      </td>


                      {/* =============================
                          市值
                      ============================= */}

                      <td
                        className="
                          py-5
                          px-4
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
                          px-4
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
                          px-4
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
                          px-4
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
                          pl-4
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

              {/* Total */}

              <td
                className="
                  py-5
                  pr-6
                  font-bold
                  text-gray-900
                  w-[300px]
                "
              >
                Total
              </td>


              {/* 市值 */}

              <td
                className="
                  py-5
                  px-4
                  text-right
                  font-bold
                  text-gray-900
                "
              >

                {formatMoney(
                  totalAmount
                )}

              </td>


              {/* 成本 */}

              <td
                className="
                  py-5
                  px-4
                  text-right
                  text-gray-500
                "
              >
                —
              </td>


              {/* 盈亏 */}

              <td
                className="
                  py-5
                  px-4
                  text-right
                  text-gray-500
                "
              >
                —
              </td>


              {/* 盈亏率 */}

              <td
                className="
                  py-5
                  px-4
                  text-right
                  text-gray-500
                "
              >
                —
              </td>


              {/* 占比 */}

              <td
                className="
                  py-5
                  pl-4
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