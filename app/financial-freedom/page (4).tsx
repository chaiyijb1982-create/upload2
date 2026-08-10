"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getTotalWealthWithFixedIncome,
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
// 金额格式
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
  // 当前家庭总资产
  //
  // 这里使用：
  //
  // getTotalWealthWithFixedIncome()
  //
  // = asset_history.total_asset
  //   +
  //   fixed_income_assets.amount
  //
  // 注意：
  //
  // 不自己再加一次固收。
  // ===================================================

  const [
    currentAsset,
    setCurrentAsset,
  ] = useState(0);


  // ===================================================
  // 固收金额
  //
  // 用于页面展示。
  //
  // 这里只展示，不参与第二次计算。
  // ===================================================

  const [
    fixedIncome,
    setFixedIncome,
  ] = useState(0);


  // ===================================================
  // 保险 Summary
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
  // 1. 家庭总资产 + 固收
  // 2. 保险数据
  //
  // 保险单独展示。
  //
  // 不把保险现金价值再次加入 currentAsset。
  // ===================================================

  useEffect(
    () => {

      async function load() {

        try {

          setLoading(true);

          setError("");


          // =================================================
          // 资产
          //
          // 直接使用 lib/asset.ts 中：
          //
          // getTotalWealthWithFixedIncome()
          //
          // 这样避免 Financial Freedom 自己重复计算。
          // =================================================

          const [
            totalWealth,
            insurance,
          ] = await Promise.all([

            getTotalWealthWithFixedIncome(),

            getInsuranceSummary(),

          ]);


          // =================================================
          // 调试
          // =================================================

          console.log(
            "===================================="
          );

          console.log(
            "Financial Freedom"
          );

          console.log(
            "Total Wealth With Fixed Income:",
            totalWealth
          );

          console.log(
            "Insurance Summary:",
            insurance
          );

          console.log(
            "Insurance Cash Value:",
            insurance?.cashValue
          );

          console.log(
            "===================================="
          );


          // =================================================
          // 总资产
          // =================================================

          setCurrentAsset(
            Number(totalWealth) || 0
          );


          // =================================================
          // 固收
          //
          // 为了页面显示单独读取。
          //
          // 这里不能通过 currentAsset - xxx 反推。
          // =================================================

          const {
            getFixedIncomeTotal,
          } = await import(
            "@/lib/asset"
          );


          const fixedIncomeTotal =
            await getFixedIncomeTotal();


          setFixedIncome(
            Number(
              fixedIncomeTotal
            ) || 0
          );


          // =================================================
          // 保险
          // =================================================

          setInsuranceSummary(
            insurance
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
  // 保险当前现金价值
  //
  // ★ 只展示
  //
  // ★ 不加入 currentAsset
  //
  // 防止保险重复统计。
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

              Dashboard Total Wealth + 固收资产

            </p>


            {/* =================================================
                固收
                ================================================= */}

            <div
              className="
                mt-4
                pt-4
                border-t
                border-gray-100
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

                  固收资产

                </span>


                <span
                  className="
                    text-lg
                    font-bold
                    text-blue-700
                  "
                >

                  + {money(
                    fixedIncome
                  )}

                </span>

              </div>

            </div>


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

                当前保险保单现金价值独立展示，不重复计入当前资产

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

            {/* 总保费 */}

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


            {/* 保费完成率 */}

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
              资产统计规则
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

              • 当前资产 = Dashboard Total Wealth + 固收资产。

            </p>


            <p>

              • 固收通过 fixed_income_assets 单独读取并加入一次。

            </p>


            <p>

              • 保险现金价值单独展示，不重复加入当前资产。

            </p>


            <p>

              • 保险保单、累计已缴、剩余未缴、总保费和完成率全部保留。

            </p>


            <p>

              • 万能险按照现有系统规则继续在保险资产中展示。

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