"use client";


import {
  useEffect,
  useState,
  useMemo,
} from "react";


import TopBar from "@/components/TopBar";


import {
  getTotalWealthWithFixedIncome,
} from "@/lib/asset";


import {
  getInsuranceSummary,
} from "@/lib/insurance";


import {
  getFinancialFreedomLoans,
} from "@/lib/loan";




// =====================================================
// 财务自由目标
// =====================================================

const expenseForecast = [

  370000,
  370000,
  370000,
  370000,
  370000,

  320000,
  320000,
  320000,
  320000,
  320000,
  320000,
  320000,
  320000,
  320000,
  320000,

];




// =====================================================
// 金额格式
// =====================================================

function money(
  value: number
) {

  const n =
    Number(value) || 0;


  if (
    n >= 100000000
  ) {

    return (
      "¥" +
      (
        n / 100000000
      )
        .toFixed(2)
      +
      " 亿"
    );

  }


  if (
    n >= 10000
  ) {

    return (
      "¥" +
      (
        n / 10000
      )
        .toFixed(1)
      +
      " 万"
    );

  }


  return (
    "¥" +
    Math.round(n)
      .toLocaleString("zh-CN")
  );

}






// =====================================================
// 页面
// =====================================================

export default function TiantianUpPage() {


  // ===================================================
  // 当前家庭资产
  // ===================================================

  const [
    currentAsset,
    setCurrentAsset
  ] = useState(0);


  // ===================================================
  // Financial Freedom 贷款
  // ===================================================

  const [
    financialFreedomLoan,
    setFinancialFreedomLoan
  ] = useState(0);


  // ===================================================
  // 保险
  // ===================================================

  const [
    insurance,
    setInsurance
  ] = useState<any>(null);


  // ===================================================
  // Loading
  // ===================================================

  const [
    loading,
    setLoading
  ] = useState(true);






  // =====================================================
  // 加载数据
  // =====================================================

  useEffect(() => {


    async function load() {


      try {


        setLoading(true);


        // =================================================
        // 1. 获取家庭总资产
        // =================================================
        //
        // 与 Financial Freedom 页面保持一致：
        //
        // getTotalWealthWithFixedIncome()
        //
        // 已经包含：
        //
        // Dashboard 原始资产
        // +
        // 固收资产
        //
        // 这里不能再重复加固收。
        // =================================================

        const asset =
          await getTotalWealthWithFixedIncome();


        const totalWealth =
          Number(asset) || 0;




        // =================================================
        // 2. 获取 Financial Freedom 贷款
        // =================================================
        //
        // 这里只获取：
        //
        // include_in_financial_freedom = true
        //
        // 的贷款。
        //
        // 不会把 Loan 页面所有贷款全部扣掉。
        // =================================================

        const ffLoans =
          await getFinancialFreedomLoans();




        // =================================================
        // 3. 计算 Financial Freedom 贷款余额
        // =================================================

        const loanBalance =
          (
            Array.isArray(ffLoans)
              ? ffLoans
              : []
          )
            .reduce(
              (
                sum: number,
                loan: any
              ) => {


                const remaining =
                  Number(
                    loan?.remaining_amount ??
                    loan?.balance ??
                    loan?.amount ??
                    0
                  );


                return (
                  sum +
                  (
                    Number.isFinite(
                      remaining
                    )
                      ? remaining
                      : 0
                  )
                );

              },
              0
            );




        // =================================================
        // 4. 当前家庭净资产
        // =================================================
        //
        // 天天向上当前：
        //
        // 当前家庭资产
        // =
        // Dashboard Total Wealth
        // -
        // Financial Freedom 贷款
        //
        // 注意：
        //
        // 只扣除 Loan 页面中
        // 「计入 Financial Freedom」
        // 的贷款。
        // =================================================

        const netAsset =
          totalWealth -
          loanBalance;


        setFinancialFreedomLoan(
          loanBalance
        );


        setCurrentAsset(
          netAsset
        );




        // =================================================
        // 5. 获取保险
        // =================================================

        const insuranceData =
          await getInsuranceSummary();


        setInsurance(
          insuranceData
        );




        // =================================================
        // Debug
        // =================================================

        console.log(
          "========================================"
        );


        console.log(
          "天天向上 Asset Calculation"
        );


        console.log(
          "Dashboard Total Wealth:",
          totalWealth
        );


        console.log(
          "Financial Freedom Loans:",
          ffLoans
        );


        console.log(
          "Financial Freedom Loan Balance:",
          loanBalance
        );


        console.log(
          "Tiantian Up Current Asset:",
          netAsset
        );


        console.log(
          "========================================"
        );


      }
      catch (
        error
      ) {


        console.error(
          "Tiantian Up loading error:",
          error
        );


      }
      finally {


        setLoading(false);


      }

    }


    load();


  }, []);






  // =====================================================
  // 财务自由目标
  // =====================================================

  const freedomTarget =

    useMemo(
      () => {


        return expenseForecast.reduce(
          (
            sum,
            item
          ) =>

            sum + item,

          0
        );


      },
      []
    );






  // =====================================================
  // 财务自由差额
  // =====================================================
  //
  // 财务自由差额
  // =
  // 财务自由目标
  // -
  // 当前家庭净资产
  //
  // 当前家庭净资产已经扣除了
  // 勾选 Financial Freedom 的贷款。
  // =====================================================

  const freedomGap =

    Math.max(
      freedomTarget
      -
      currentAsset,
      0
    );






  // =====================================================
  // 夫妻保费 - 儿子现金价值
  // =====================================================

  const coupleMinusSon =

    Number(
      insurance?.coupleUnpaidPremium || 0
    )

    -

    Number(
      insurance?.sonCashValue || 0
    );






  // =====================================================
  // 天天向上1
  //
  // 财务自由差额
  // +
  // 全部未缴保费
  //
  // 注意：
  // 财务自由差额已经考虑
  // Financial Freedom 贷款。
  // =====================================================

  const tiantian1 =

    freedomGap

    +

    Number(
      insurance?.unpaidPremium || 0
    );






  // =====================================================
  // 天天向上2
  //
  // 财务自由差额
  // +
  // 夫妻保费
  // -
  // 儿子现金价值
  // =====================================================

  const tiantian2 =

    freedomGap

    +

    coupleMinusSon;






  // =====================================================
  // Loading
  // =====================================================

  if (loading) {


    return (

      <>

        <TopBar
          title="天天向上"
        />


        <main
          className="p-10"
        >

          正在加载...

        </main>

      </>

    );

  }






  // =====================================================
  // 页面
  // =====================================================

  return (

    <>

      <TopBar
        title="天天向上"
      />


      <main
        className="
          p-8
          max-w-[1400px]
          mx-auto
          space-y-8
        "
      >


        {/* =========================================
            页面标题
            ========================================= */}

        <div>

          <h1
            className="
              text-3xl
              font-bold
            "
          >

            🚀 天天向上

          </h1>


          <p
            className="
              text-gray-500
              mt-2
            "
          >

            财富自由 + 保险压力分析

          </p>

        </div>






        {/* =====================================
            第一排

            第1列 当前家庭资产
            第3列 财务自由差额
            ===================================== */}

        <section

          style={{

            display: "grid",

            gridTemplateColumns:
              "repeat(4,minmax(0,1fr))",

            gap: "24px"

          }}

        >


          {/* =====================================
              当前家庭资产
              ===================================== */}

          <div

            style={{

              gridColumn: "1"

            }}

            className="
              bg-white
              border
              rounded-2xl
              p-7
            "

          >

            <p
              className="text-gray-500"
            >

              当前家庭资产

            </p>


            <h2
              className="
                text-3xl
                font-bold
                mt-3
              "
            >

              {
                money(
                  currentAsset
                )
              }

            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              Dashboard Total Wealth − Financial Freedom贷款

            </p>

          </div>






          {/* =====================================
              财务自由差额
              ===================================== */}

          <div

            style={{

              gridColumn: "3"

            }}

            className="
              bg-white
              border
              rounded-2xl
              p-7
            "

          >

            <p
              className="text-gray-500"
            >

              财务自由差额

            </p>


            <h2
              className="
                text-3xl
                font-bold
                text-blue-700
                mt-3
              "
            >

              {
                money(
                  freedomGap
                )
              }

            </h2>


            <p
              className="
                text-xs
                text-gray-400
                mt-2
              "
            >

              财务自由目标 − 当前家庭净资产

            </p>

          </div>


        </section>






        {/* =====================================
            Financial Freedom 贷款说明
            ===================================== */}

        <section
          className="
            bg-red-50
            border
            border-red-100
            rounded-2xl
            p-6
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
            "
          >

            <div>

              <div
                className="
                  text-sm
                  text-gray-500
                "
              >

                Financial Freedom 贷款

              </div>


              <div
                className="
                  text-xs
                  text-gray-400
                  mt-1
                "
              >

                只统计 Loan 中勾选「计入 Financial Freedom」的贷款

              </div>

            </div>


            <div
              className="
                text-2xl
                font-bold
                text-red-700
              "
            >

              − {money(
                financialFreedomLoan
              )}

            </div>

          </div>

        </section>






        {/* =====================================
            第二排

            第3列 全部未缴保费
            第4列 天天向上1
            ===================================== */}

        <section

          style={{

            display: "grid",

            gridTemplateColumns:
              "repeat(4,minmax(0,1fr))",

            gap: "24px"

          }}

        >


          {/* =====================================
              全部未缴保费
              ===================================== */}

          <div

            style={{

              gridColumn: "3"

            }}

            className="
              bg-white
              border
              rounded-2xl
              p-7
            "

          >

            <p
              className="text-gray-500"
            >

              全部未缴保费

            </p>


            <h2
              className="
                text-3xl
                font-bold
                text-purple-700
                mt-3
              "
            >

              {
                money(
                  insurance?.unpaidPremium || 0
                )
              }

            </h2>

          </div>






          {/* =====================================
              天天向上1
              ===================================== */}

          <div

            style={{

              gridColumn: "4"

            }}

            className="
              bg-white
              border
              rounded-2xl
              p-7
            "

          >

            <h2
              className="
                text-xl
                font-bold
              "
            >

              🚀 天天向上1

            </h2>


            <p
              className="
                text-3xl
                font-bold
                text-blue-700
                mt-3
              "
            >

              {
                money(
                  tiantian1
                )
              }

            </p>


            <p
              className="
                text-sm
                text-gray-400
                mt-2
              "
            >

              财务自由差额 + 全部未缴保费

            </p>


          </div>


        </section>






        {/* =====================================
            第三排

            第1列 夫妻未缴保费
            第2列 儿子现金价值
            第3列 夫妻保费-儿子
            第4列 天天向上2
            ===================================== */}

        <section

          style={{

            display: "grid",

            gridTemplateColumns:
              "repeat(4,minmax(0,1fr))",

            gap: "24px"

          }}

        >


          {/* =====================================
              夫妻未缴保费
              ===================================== */}

          <div

            style={{

              gridColumn: "1"

            }}

            className="
              bg-white
              border
              rounded-2xl
              p-7
            "

          >

            <p
              className="text-gray-500"
            >

              夫妻未缴保费

            </p>


            <h2
              className="
                text-3xl
                font-bold
                mt-3
              "
            >

              {
                money(
                  insurance?.coupleUnpaidPremium || 0
                )
              }

            </h2>


          </div>






          {/* =====================================
              儿子现金价值
              ===================================== */}

          <div

            style={{

              gridColumn: "2"

            }}

            className="
              bg-white
              border
              rounded-2xl
              p-7
            "

          >

            <p
              className="text-gray-500"
            >

              儿子现金价值

            </p>


            <h2
              className="
                text-3xl
                font-bold
                mt-3
              "
            >

              {
                money(
                  insurance?.sonCashValue || 0
                )
              }

            </h2>


          </div>






          {/* =====================================
              夫妻保费 - 儿子
              ===================================== */}

          <div

            style={{

              gridColumn: "3"

            }}

            className="
              bg-white
              border
              rounded-2xl
              p-7
            "

          >

            <p
              className="text-gray-500"
            >

              夫妻保费-儿子

            </p>


            <h2
              className="
                text-3xl
                font-bold
                text-orange-600
                mt-3
              "
            >

              {
                money(
                  coupleMinusSon
                )
              }

            </h2>


          </div>






          {/* =====================================
              天天向上2
              ===================================== */}

          <div

            style={{

              gridColumn: "4"

            }}

            className="
              bg-white
              border
              rounded-2xl
              p-7
            "

          >

            <h2
              className="
                text-xl
                font-bold
              "
            >

              🚀 天天向上2

            </h2>


            <p
              className="
                text-3xl
                font-bold
                text-green-700
                mt-3
              "
            >

              {
                money(
                  tiantian2
                )
              }

            </p>


            <p
              className="
                text-sm
                text-gray-400
                mt-2
              "
            >

              财务自由差额 + 夫妻保费 - 儿子现金价值

            </p>


          </div>


        </section>






        {/* =====================================
            计算规则
            ===================================== */}

        <section
          className="
            bg-blue-50
            border
            border-blue-100
            rounded-2xl
            p-6
          "
        >

          <h2
            className="
              text-lg
              font-bold
              text-blue-900
            "
          >

            📐 天天向上计算规则

          </h2>


          <div
            className="
              mt-4
              text-sm
              text-blue-800
              leading-7
            "
          >

            <p>

              <b>
                当前家庭资产
              </b>
              =
              Dashboard Total Wealth
              −
              Financial Freedom 贷款

            </p>


            <p>

              Financial Freedom 贷款
              =
              Loan 中勾选「计入 Financial Freedom」的贷款余额合计

            </p>


            <p>

              <b>
                财务自由差额
              </b>
              =
              max(
              财务自由目标
              −
              当前家庭资产
              ,
              0
              )

            </p>


            <p>

              <b>
                天天向上1
              </b>
              =
              财务自由差额
              +
              全部未缴保费

            </p>


            <p>

              <b>
                天天向上2
              </b>
              =
              财务自由差额
              +
              夫妻未缴保费
              −
              儿子现金价值

            </p>

          </div>

        </section>


      </main>

    </>

  );

}