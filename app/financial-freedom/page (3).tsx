"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getLatestAsset,
} from "@/lib/asset";

import {
  getInsuranceSummary,
} from "@/lib/insurance";


// =====================================================
// 类型
// =====================================================

type ExpenseItem = {

  year: number;

  expense: number;

};


// =====================================================
// 2027 - 2041 年生活开销
//
// 2027 - 2031：37 万 / 年
// 2032 - 2041：32 万 / 年
//
// 财务自由目标只计算生活开销
//
// 不包含：
// 年金缴费
// 房贷
// 社保
// 投资收益
// =====================================================

const expenseForecast: ExpenseItem[] = [

  {
    year: 2027,
    expense: 370000,
  },

  {
    year: 2028,
    expense: 370000,
  },

  {
    year: 2029,
    expense: 370000,
  },

  {
    year: 2030,
    expense: 370000,
  },

  {
    year: 2031,
    expense: 370000,
  },

  {
    year: 2032,
    expense: 320000,
  },

  {
    year: 2033,
    expense: 320000,
  },

  {
    year: 2034,
    expense: 320000,
  },

  {
    year: 2035,
    expense: 320000,
  },

  {
    year: 2036,
    expense: 320000,
  },

  {
    year: 2037,
    expense: 320000,
  },

  {
    year: 2038,
    expense: 320000,
  },

  {
    year: 2039,
    expense: 320000,
  },

  {
    year: 2040,
    expense: 320000,
  },

  {
    year: 2041,
    expense: 320000,
  },

];


// =====================================================
// 金额
// =====================================================

function money(
  value: number
): string {

  const n =
    Number(value) || 0;


  if (
    n >= 100000000
  ) {

    return (
      "¥" +
      (
        n /
        100000000
      ).toFixed(2) +
      " 亿"
    );

  }


  if (
    n >= 10000
  ) {

    return (
      "¥" +
      (
        n /
        10000
      ).toFixed(1) +
      " 万"
    );

  }


  return (
    "¥" +
    Math.round(
      n
    ).toLocaleString(
      "zh-CN"
    )
  );

}


// =====================================================
// 页面
// =====================================================

export default function FinancialFreedomPage() {

  // ===================================================
  // Dashboard Total Wealth
  // ===================================================

  const [
    asset,
    setAsset,
  ] = useState<any>(null);


  // ===================================================
  // Insurance Summary
  // ===================================================

  const [
    insuranceSummary,
    setInsuranceSummary,
  ] = useState<any>(null);


  // ===================================================
  // Loading
  // ===================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  // ===================================================
  // Error
  // ===================================================

  const [
    error,
    setError,
  ] = useState("");


  // ===================================================
  // 加载数据
  //
  // 这里同时读取：
  //
  // 1. Dashboard Total Wealth
  // 2. Insurance 当前现金价值
  //
  // 注意：
  //
  // Dashboard Total Wealth 已经包含 Fixed Income
  //
  // 所以这里绝对不能：
  //
  // total_asset + fixed_income
  //
  // 否则会重复计算固收。
  // ===================================================

  useEffect(
    () => {

      async function load() {

        try {

          setLoading(true);

          setError("");


          const [
            latestAsset,
            summary,
          ] = await Promise.all([

            getLatestAsset(),

            getInsuranceSummary(),

          ]);


          console.log(
            "===================================="
          );

          console.log(
            "Financial Freedom"
          );

          console.log(
            "Dashboard Total Wealth:",
            latestAsset?.total_asset
          );

          console.log(
            "Insurance Summary:",
            summary
          );

          console.log(
            "Insurance Cash Value:",
            summary?.cashValue
          );

          console.log(
            "===================================="
          );


          if (!latestAsset) {

            setError(
              "无法读取 Dashboard Total Wealth"
            );

            return;

          }


          setAsset(
            latestAsset
          );


          setInsuranceSummary(
            summary
          );

        } catch (
          err
        ) {

          console.error(
            "Financial Freedom loading error:",
            err
          );


          setError(
            "读取财务自由数据失败，请检查 Supabase"
          );

        } finally {

          setLoading(false);

        }

      }


      load();

    },
    []
  );


  // ===================================================
  // 财务自由目标
  //
  // 2027 - 2041
  // 所有生活开销直接累加
  // ===================================================

  const financialFreedomTarget =
    useMemo(
      () => {

        return expenseForecast.reduce(
          (
            sum,
            item
          ) => {

            return (
              sum +
              item.expense
            );

          },
          0
        );

      },
      []
    );


  // ===================================================
  // 当前资产
  //
  // ★ 唯一来源：
  //
  // Dashboard Total Wealth
  //
  // asset.total_asset
  //
  // 这里不再读取：
  //
  // fixed_income_assets
  //
  // 因为 Dashboard Total Wealth
  // 已经包含固收。
  // ===================================================

  const currentAsset =
    Number(
      asset?.total_asset
    ) || 0;


  // ===================================================
  // 保险当前现金价值
  //
  // 来源：
  //
  // getInsuranceSummary()
  //
  // summary.cashValue
  //
  // 注意：
  //
  // 这个数字只是展示保险资产，
  // 不再加到 currentAsset。
  //
  // 因为 currentAsset 是 Dashboard Total Wealth。
  // ===================================================

  const insuranceCashValue =
    Number(
      insuranceSummary?.cashValue
    ) || 0;


  // ===================================================
  // 保险保单数量
  // ===================================================

  const insuranceCount =
    Number(
      insuranceSummary?.count
    ) || 0;


  // ===================================================
  // 保险累计已缴
  // ===================================================

  const insurancePaidPremium =
    Number(
      insuranceSummary?.paidPremium
    ) || 0;


  // ===================================================
  // 保险总保费
  // ===================================================

  const insurancePremiumTotal =
    Number(
      insuranceSummary?.premiumTotal
    ) || 0;


  // ===================================================
  // 保险未缴
  // ===================================================

  const insuranceUnpaidPremium =
    Number(
      insuranceSummary?.unpaidPremium
    ) || 0;


  // ===================================================
  // 财务自由进度
  // ===================================================

  const progress =
    financialFreedomTarget > 0
      ?
        Math.min(
          (
            currentAsset /
            financialFreedomTarget
          ) *
          100,
          100
        )
      :
        0;


  // ===================================================
  // 剩余目标
  // ===================================================

  const remaining =
    Math.max(
      financialFreedomTarget -
      currentAsset,
      0
    );


  // ===================================================
  // Loading
  // ===================================================

  if (
    loading
  ) {

    return (

      <>

        <TopBar
          title="Financial Freedom"
        />


        <main
          className="
            p-10
            max-w-[1400px]
            mx-auto
          "
        >

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-100
              p-8
              text-gray-500
            "
          >

            正在读取财务自由数据...

          </div>

        </main>

      </>

    );

  }


  // ===================================================
  // Error
  // ===================================================

  if (
    error
  ) {

    return (

      <>

        <TopBar
          title="Financial Freedom"
        />


        <main
          className="
            p-10
            max-w-[1400px]
            mx-auto
          "
        >

          <div
            className="
              bg-red-50
              border
              border-red-100
              rounded-2xl
              p-6
              text-red-700
            "
          >

            {error}

          </div>

        </main>

      </>

    );

  }


  // ===================================================
  // 页面
  // ===================================================

  return (

    <>

      <TopBar
        title="Financial Freedom"
      />


      <main
        className="
          p-8
          max-w-[1400px]
          mx-auto
          space-y-8
        "
      >

        {/* =================================================
            Header
            ================================================= */}

        <div>

          <h1
            className="
              text-3xl
              font-bold
              text-gray-900
            "
          >

            💎 Financial Freedom

          </h1>


          <p
            className="
              mt-2
              text-gray-500
            "
          >

            财务自由进度与未来生活开销规划

          </p>

        </div>


        {/* =================================================
            Current / Target
            ================================================= */}

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            gap-6
          "
        >

          {/* =================================================
              当前资产
              ================================================= */}

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-100
              shadow-sm
              p-7
            "
          >

            <p
              className="
                text-sm
                text-gray-500
              "
            >

              当前资产

            </p>


            <p
              className="
                text-4xl
                font-bold
                text-gray-900
                mt-3
              "
            >

              {money(
                currentAsset
              )}

            </p>


            <p
              className="
                text-sm
                text-gray-400
                mt-3
              "
            >

              Dashboard Total Wealth

            </p>

          </div>


          {/* =================================================
              财务自由目标
              ================================================= */}

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-100
              shadow-sm
              p-7
            "
          >

            <p
              className="
                text-sm
                text-gray-500
              "
            >

              财务自由目标

            </p>


            <p
              className="
                text-4xl
                font-bold
                text-blue-700
                mt-3
              "
            >

              {money(
                financialFreedomTarget
              )}

            </p>


            <p
              className="
                text-sm
                text-gray-400
                mt-3
              "
            >

              2027–2041 年生活开销累计

            </p>

          </div>

        </section>


        {/* =================================================
            Progress
            ================================================= */}

        <section
          className="
            bg-white
            rounded-2xl
            border
            border-gray-100
            shadow-sm
            p-7
          "
        >

          <div
            className="
              flex
              items-end
              justify-between
              gap-4
              mb-4
            "
          >

            <div>

              <p
                className="
                  text-sm
                  text-gray-500
                "
              >

                财务自由进度

              </p>


              <p
                className="
                  text-3xl
                  font-bold
                  text-gray-900
                  mt-1
                "
              >

                {progress.toFixed(1)}%

              </p>

            </div>


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

                距离目标

              </p>


              <p
                className="
                  text-lg
                  font-bold
                  text-gray-700
                  mt-1
                "
              >

                {money(
                  remaining
                )}

              </p>

            </div>

          </div>


          {/* Progress Bar */}

          <div
            className="
              w-full
              h-5
              bg-gray-100
              rounded-full
              overflow-hidden
            "
          >

            <div
              className="
                h-full
                bg-blue-600
                rounded-full
                transition-all
                duration-700
              "
              style={{
                width:
                  `${progress}%`,
              }}
            />

          </div>


          <div
            className="
              flex
              justify-between
              mt-3
              text-xs
              text-gray-400
            "
          >

            <span>

              ¥0

            </span>


            <span>

              {money(
                financialFreedomTarget
              )}

            </span>

          </div>

        </section>


        {/* =================================================
            Insurance
            ================================================= */}

        <section
          className="
            bg-white
            rounded-2xl
            border
            border-gray-100
            shadow-sm
            p-7
          "
        >

          <div
            className="
              flex
              flex-col
              md:flex-row
              md:items-center
              md:justify-between
              gap-4
              mb-6
            "
          >

            <div>

              <h2
                className="
                  text-xl
                  font-bold
                  text-gray-900
                "
              >

                🛡️ 保险资产

              </h2>


              <p
                className="
                  text-sm
                  text-gray-400
                  mt-2
                "
              >

                当前保险保单现金价值，不计入万能险固收重复统计

              </p>

            </div>


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

                当前现金价值

              </p>


              <p
                className="
                  text-3xl
                  font-bold
                  text-green-700
                  mt-1
                "
              >

                {money(
                  insuranceCashValue
                )}

              </p>

            </div>

          </div>


          {/* =================================================
              Insurance Cards
              ================================================= */}

          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              lg:grid-cols-4
              gap-4
            "
          >

            {/* 保单数量 */}

            <div
              className="
                rounded-xl
                bg-gray-50
                border
                border-gray-100
                p-5
              "
            >

              <p
                className="
                  text-xs
                  text-gray-400
                "
              >

                保单数量

              </p>


              <p
                className="
                  text-2xl
                  font-bold
                  text-gray-900
                  mt-2
                "
              >

                {insuranceCount}

                <span
                  className="
                    text-sm
                    font-normal
                    text-gray-400
                    ml-1
                  "
                >

                  项

                </span>

              </p>

            </div>


            {/* 当前现金价值 */}

            <div
              className="
                rounded-xl
                bg-green-50
                border
                border-green-100
                p-5
              "
            >

              <p
                className="
                  text-xs
                  text-gray-500
                "
              >

                当前现金价值

              </p>


              <p
                className="
                  text-2xl
                  font-bold
                  text-green-700
                  mt-2
                "
              >

                {money(
                  insuranceCashValue
                )}

              </p>

            </div>


            {/* 已缴保费 */}

            <div
              className="
                rounded-xl
                bg-blue-50
                border
                border-blue-100
                p-5
              "
            >

              <p
                className="
                  text-xs
                  text-gray-500
                "
              >

                累计已缴保费

              </p>


              <p
                className="
                  text-2xl
                  font-bold
                  text-blue-700
                  mt-2
                "
              >

                {money(
                  insurancePaidPremium
                )}

              </p>

            </div>


            {/* 未缴 */}

            <div
              className="
                rounded-xl
                bg-orange-50
                border
                border-orange-100
                p-5
              "
            >

              <p
                className="
                  text-xs
                  text-gray-500
                "
              >

                剩余未缴

              </p>


              <p
                className="
                  text-2xl
                  font-bold
                  text-orange-700
                  mt-2
                "
              >

                {money(
                  insuranceUnpaidPremium
                )}

              </p>

            </div>

          </div>


          {/* =================================================
              Insurance Detail
              ================================================= */}

          <div
            className="
              mt-5
              grid
              grid-cols-1
              md:grid-cols-2
              gap-4
            "
          >

            <div
              className="
                rounded-xl
                border
                border-gray-100
                p-5
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                "
              >

                <span
                  className="
                    text-sm
                    text-gray-500
                  "
                >

                  总保费

                </span>


                <span
                  className="
                    font-bold
                    text-gray-900
                  "
                >

                  {money(
                    insurancePremiumTotal
                  )}

                </span>

              </div>

            </div>


            <div
              className="
                rounded-xl
                border
                border-gray-100
                p-5
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                "
              >

                <span
                  className="
                    text-sm
                    text-gray-500
                  "
                >

                  保费完成率

                </span>


                <span
                  className="
                    font-bold
                    text-blue-700
                  "
                >

                  {
                    Number(
                      insuranceSummary?.premiumProgress
                    || 0
                    ).toFixed(1)
                  }%

                </span>

              </div>

            </div>

          </div>


          {/* =================================================
              说明
              ================================================= */}

          <div
            className="
              mt-5
              rounded-xl
              bg-blue-50
              border
              border-blue-100
              p-5
              text-sm
              text-blue-800
              leading-7
            "
          >

            <p>

              <b>
                资产统计规则：
              </b>

            </p>


            <p>

              • 当前资产直接读取 Dashboard Total Wealth。

            </p>


            <p>

              • Dashboard Total Wealth 已经包含 Fixed Income 固收资产。

            </p>


            <p>

              • Insurance 这里只展示保险现金价值，不再把保险现金价值再次加入当前资产。

            </p>


            <p>

              • 万能险按照你的设定继续放在 Fixed Income 页面管理，不与这里重复统计。

            </p>

          </div>

        </section>


        {/* =================================================
            Annual Expenses
            ================================================= */}

        <section
          className="
            bg-white
            rounded-2xl
            border
            border-gray-100
            shadow-sm
            p-7
          "
        >

          <div
            className="
              mb-6
            "
          >

            <h2
              className="
                text-xl
                font-bold
                text-gray-900
              "
            >

              📅 每年生活开销预估

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-2
              "
            >

              2027–2041 年预计生活开销

            </p>

          </div>


          <div
            className="
              space-y-3
            "
          >

            {
              expenseForecast.map(
                item => (

                  <div
                    key={
                      item.year
                    }
                    className="
                      flex
                      items-center
                      justify-between
                      px-5
                      py-4
                      rounded-xl
                      bg-gray-50
                      border
                      border-gray-100
                    "
                  >

                    <span
                      className="
                        font-semibold
                        text-gray-700
                      "
                    >

                      {item.year}

                    </span>


                    <span
                      className="
                        font-semibold
                        text-gray-900
                      "
                    >

                      {money(
                        item.expense
                      )}

                    </span>

                  </div>

                )
              )
            }


            {/* =================================================
                合计
                ================================================= */}

            <div
              className="
                mt-5
                flex
                items-center
                justify-between
                px-5
                py-5
                rounded-xl
                bg-blue-50
                border
                border-blue-100
              "
            >

              <span
                className="
                  font-bold
                  text-blue-900
                "
              >

                2027–2041 合计

              </span>


              <span
                className="
                  text-2xl
                  font-bold
                  text-blue-700
                "
              >

                {money(
                  financialFreedomTarget
                )}

              </span>

            </div>

          </div>

        </section>


      </main>

    </>

  );

}

