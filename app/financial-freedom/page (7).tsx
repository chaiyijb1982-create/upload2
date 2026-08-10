"use client";


import {
  useEffect,
  useState
} from "react";


import TopBar from "@/components/TopBar";


import {
  getLatestAsset
} from "@/lib/asset";


import {
  getInsuranceSummary,
  getInsuranceCashValueHistory
} from "@/lib/insurance";


import {
  getAnnualLoanPressure,
  getFinancialFreedomLoanPayment,
  getFinancialFreedomLoans
} from "@/lib/loan";


import {
  supabase
} from "@/lib/supabase";




// =====================================================
// 参数
// =====================================================


const START_YEAR = 2027;


const END_YEAR = 2042;


const RETIREMENT_AGE = 60;




// 备用资产

const START_ASSET = 1600000;




// 年收入

const ANNUAL_INCOME = 1100000;





// 投资收益率

const RETURN_RATE = 0.05;







// =====================================================
// 生活费用
// =====================================================


const BASE_EXPENSE:any={


2027:370000,

2028:370000,

2029:370000,

2030:370000,

2031:370000,


2032:320000,

2033:320000,

2034:320000,

2035:320000,

2036:320000,

2037:320000,

2038:320000,

2039:320000,

2040:320000,

2041:320000,

2042:320000


};







// =====================================================
// 年金缴费
// =====================================================


const ANNUITY:any={


2027:724000,


2028:614000,

2029:614000,

2030:614000,

2031:614000,

2032:614000,


2033:351000,


2034:259000,

2035:259000,

2036:259000,

2037:259000,


2038:129000,


2039:39000,

2040:39000,

2041:39000,

2042:39000


};


export default function FinancialFreedomPage(){



// =====================================================
// 当前家庭资产
// =====================================================


const [

currentFamilyAsset,

setCurrentFamilyAsset

] = useState(0);




// Dashboard Total Wealth

const [

dashboardTotalWealth,

setDashboardTotalWealth

] = useState(0);




// 固收资产

const [

fixedIncomeTotal,

setFixedIncomeTotal

] = useState(0);




// Financial Freedom贷款

const [

financialFreedomLoan,

setFinancialFreedomLoan

] = useState(0);









// =====================================================
// 保险
// =====================================================


const [

insurance,

setInsurance

] = useState<any>(null);





const [

insuranceHistory,

setInsuranceHistory

] = useState<any[]>([]);









// =====================================================
// 贷款年度压力
// =====================================================


const [

loanPressure,

setLoanPressure

] = useState<any>({});









// =====================================================
// 年度预测结果
// =====================================================


const [

rows,

setRows

] = useState<any[]>([]);








// =====================================================
// Loading
// =====================================================


const [

loading,

setLoading

] = useState(true);











// =====================================================
// 数据加载
// =====================================================


useEffect(()=>{


async function load(){



try{







// =====================================================
// 1. 获取 Dashboard 原始资产
// =====================================================


const latest =

await getLatestAsset();





const originalAsset =


Number(

latest?.total_asset

||

START_ASSET

);











// =====================================================
// 2. 获取 Dashboard 固收资产
// =====================================================



const {

data:fixedIncomeData

}

=

await supabase

.from(

"fixed_income_assets"

)

.select(

"amount"

);







const fixedIncomeSum =


(

Array.isArray(fixedIncomeData)

?

fixedIncomeData

:

[]

)

.reduce(

(

sum:number,

item:any

)=>{


return (

sum

+

Number(

item.amount || 0

)

);



},

0

);











// =====================================================
// 3. Dashboard真实 Total Wealth
// =====================================================



const totalWealth =


originalAsset

+

fixedIncomeSum;







setDashboardTotalWealth(

totalWealth

);





setFixedIncomeTotal(

fixedIncomeSum

);











// =====================================================
// 4. 获取 Financial Freedom贷款
// =====================================================



const ffLoans =

await getFinancialFreedomLoans();








const loanBalance =


(

Array.isArray(ffLoans)

?

ffLoans

:

[]

)

.reduce(

(

sum:number,

loan:any

)=>{



return (

sum

+

Number(

loan.remaining_amount

||

loan.balance

||

loan.amount

||

0

)

);



},

0

);









setFinancialFreedomLoan(

loanBalance

);











// =====================================================
// 5. 当前家庭净资产
// =====================================================



const netAsset =


totalWealth

-

loanBalance;







setCurrentFamilyAsset(

netAsset

);








// =====================================================
// 6. 保险
// =====================================================



const ins =

await getInsuranceSummary();





setInsurance(ins);







const cashHistory =

await getInsuranceCashValueHistory();





setInsuranceHistory(

cashHistory || []

);











// =====================================================
// 7. 贷款年度模型
// =====================================================



const loans:any={};






for(

let year=START_YEAR;

year<=END_YEAR;

year++

){



loans[year]={


payment:

await getFinancialFreedomLoanPayment(

year

),




pressure:

await getAnnualLoanPressure(

year

)



};



}







setLoanPressure(

loans

);


// =====================================================
// 8. 年度资产预测
// =====================================================


// 注意：
// 这里必须使用刚刚计算出来的 netAsset
// 不能再使用 state 里的 currentFamilyAsset
//
// 原因：setCurrentFamilyAsset() 是异步的
// 如果直接读取 currentFamilyAsset，第一次计算会拿到旧值。


let currentAsset = netAsset;



const result:any[] = [];





for(

let year = START_YEAR;

year <= END_YEAR;

year++

){



// ===================================================
// 生活费
// ===================================================


const expense =

Number(

BASE_EXPENSE[year] || 0

);





// ===================================================
// 年金缴费
// ===================================================


const pension =

Number(

ANNUITY[year] || 0

);





// ===================================================
// Financial Freedom贷款年度压力
// ===================================================


const loan =

Number(

loans[year]?.pressure || 0

);





// ===================================================
// 年度现金流
//
// 年收入
// - 生活费
// - 年金
// - 贷款压力
// ===================================================


const cashFlow =

ANNUAL_INCOME

-

expense

-

pension

-

loan;





// ===================================================
// 投资收益
// =====================================================
//
// 当前年初资产 × 5%
//
// 注意：
// 贷款已经从当前家庭资产中扣除，
// 所以这里是在“净资产”基础上计算收益。
// =====================================================


const investmentReturn =

currentAsset

*

RETURN_RATE;





// ===================================================
// 年末资产
// =====================================================


currentAsset =

currentAsset

+

investmentReturn

+

cashFlow;





// ===================================================
// 财务自由目标
//
// 生活费 × 25
// =====================================================


const freedomTarget =

expense

*

25;





// ===================================================
// 财务自由目标差额
//
// 如果预计资产已经超过目标
// 则差额为 0
// =====================================================


const freedomGap =

Math.max(

0,

freedomTarget

-

currentAsset

);





// ===================================================
// 保存年度数据
// =====================================================


result.push({

year,

asset:

currentAsset,

income:

ANNUAL_INCOME,

expense,

annuity:

pension,

loan,

investmentReturn,

cashFlow,

freedomTarget,

freedomGap,

});



}






// =====================================================
// 保存年度结果
// =====================================================


setRows(

result

);





}

catch(error){



console.error(

"Financial Freedom loading error:",

error

);



}

finally{



setLoading(false);



}



}



load();



},[]);


// =====================================================
// 金额格式
// =====================================================

function money(
  num: number
) {

  return (
    "¥ " +
    Number(num || 0).toLocaleString(
      "zh-CN",
      {
        maximumFractionDigits: 0
      }
    )
  );

}





// =====================================================
// Loading
// =====================================================

if (loading) {

  return (
    <>

      <TopBar
        title="Financial Freedom"
      />


      <div
        className="
          p-10
          text-gray-500
        "
      >
        加载中...
      </div>

    </>
  );

}





// =====================================================
// 2042 最终数据
// =====================================================

const current =
  rows[
    rows.length - 1
  ] || {};





// =====================================================
// 2042 财务自由目标
// =====================================================

const freedomTarget =
  Number(
    current.freedomTarget || 0
  );





// =====================================================
// 2042 预计资产
// =====================================================

const projectedAsset =
  Number(
    current.asset || 0
  );





// =====================================================
// 2042 财务自由差额
// =====================================================
//
// 目标 - 2042预计资产
//
// 如果预计资产已经超过目标
// 则差额为 0
// =====================================================

const freedomGap =
  Math.max(
    0,
    freedomTarget -
    projectedAsset
  );





// =====================================================
// 保险数据
// =====================================================
//
// 这里先兼容目前 insurance.ts
// 可能存在的字段名称。
// =====================================================

const totalUnpaidPremium =
  Number(
    insurance?.unpaid_premium ||
    insurance?.remaining_premium ||
    insurance?.total_unpaid_premium ||
    0
  );





// =====================================================
// 儿子现金价值
// =====================================================
//
// 如果目前 insurance.ts 尚未返回
// son_cash_value，这里先为 0。
// 后面可以直接接入真实值。
// =====================================================

const sonCashValue =
  Number(
    insurance?.son_cash_value ||
    0
  );





// =====================================================
// 天天向上1
// =====================================================
//
// 财务自由差额
// +
// 未来还要交的总保费
// =====================================================

const tiantianUp1 =

  freedomGap +

  totalUnpaidPremium;





// =====================================================
// 天天向上2
// =====================================================
//
// 财务自由差额
// +
// 夫妻未来总保费
// -
// 儿子今年现金价值
// =====================================================

const tiantianUp2 =

  freedomGap +

  totalUnpaidPremium -

  sonCashValue;





// =====================================================
// 页面开始
// =====================================================

return (

  <>

    <TopBar
      title="Financial Freedom"
    />



    <main
      className="
        max-w-[1400px]
        mx-auto
        p-8
        space-y-8
      "
    >


      {/* =================================================
          页面标题
          ================================================= */}

      <h1
        className="
          text-3xl
          font-bold
        "
      >
        🚀 Financial Freedom
      </h1>





      {/* =================================================
          顶部核心指标
          ================================================= */}

      <section
        className="
          grid
          grid-cols-1
          md:grid-cols-2
          xl:grid-cols-4
          gap-6
        "
      >


        {/* =============================================
            1. 当前家庭资产
            ============================================= */}

        <div
          className="
            bg-white
            border
            rounded-2xl
            p-6
          "
        >

          <div
            className="
              text-gray-500
            "
          >
            当前家庭资产
          </div>


          <div
            className="
              text-3xl
              font-bold
              mt-3
            "
          >
            {money(
              currentFamilyAsset
            )}
          </div>


          <div
            className="
              text-xs
              text-gray-400
              mt-2
            "
          >
            Dashboard Total Wealth
            − Financial Freedom贷款
          </div>

        </div>





        {/* =============================================
            2. 2042 财务自由差额
            ============================================= */}

        <div
          className="
            bg-white
            border
            rounded-2xl
            p-6
          "
        >

          <div
            className="
              text-gray-500
            "
          >
            2042 财务自由差额
          </div>


          <div
            className="
              text-3xl
              font-bold
              mt-3
            "
          >
            {money(
              freedomGap
            )}
          </div>


          <div
            className="
              text-xs
              text-gray-400
              mt-2
            "
          >
            2042目标 − 2042预计资产
          </div>

        </div>





        {/* =============================================
            3. 天天向上1
            ============================================= */}

        <div
          className="
            bg-white
            border
            rounded-2xl
            p-6
          "
        >

          <div
            className="
              text-gray-500
            "
          >
            🚀 天天向上1
          </div>


          <div
            className="
              text-3xl
              font-bold
              mt-3
            "
          >
            {money(
              tiantianUp1
            )}
          </div>


          <div
            className="
              text-xs
              text-gray-400
              mt-2
            "
          >
            财务自由差额 + 未来总保费
          </div>

        </div>





        {/* =============================================
            4. 天天向上2
            ============================================= */}

        <div
          className="
            bg-white
            border
            rounded-2xl
            p-6
          "
        >

          <div
            className="
              text-gray-500
            "
          >
            🚀 天天向上2
          </div>


          <div
            className="
              text-3xl
              font-bold
              mt-3
            "
          >
            {money(
              tiantianUp2
            )}
          </div>


          <div
            className="
              text-xs
              text-gray-400
              mt-2
            "
          >
            财务自由差额 + 夫妻保费 − 儿子现金价值
          </div>

        </div>


      </section>

            {/* =================================================
          年度现金流预测
          ================================================= */}

      <section
        className="
          bg-white
          border
          rounded-2xl
          p-6
          overflow-auto
        "
      >

        <h2
          className="
            text-xl
            font-bold
            mb-5
          "
        >
          📊 年度现金流预测
        </h2>


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
              "
            >

              <th className="p-3 text-left">
                年份
              </th>

              <th className="p-3 text-right">
                资产
              </th>

              <th className="p-3 text-right">
                收入
              </th>

              <th className="p-3 text-right">
                生活费
              </th>

              <th className="p-3 text-right">
                年金
              </th>

              <th className="p-3 text-right">
                贷款压力
              </th>

              <th className="p-3 text-right">
                投资收益
              </th>

              <th className="p-3 text-right">
                现金流
              </th>

            </tr>

          </thead>


          <tbody>

            {
              rows.map(
                (row: any) => (

                  <tr
                    key={row.year}
                    className="
                      border-b
                      hover:bg-gray-50
                    "
                  >

                    <td
                      className="
                        p-3
                      "
                    >
                      {row.year}
                    </td>


                    <td
                      className="
                        p-3
                        text-right
                        font-bold
                      "
                    >
                      {
                        money(
                          row.asset
                        )
                      }
                    </td>


                    <td
                      className="
                        p-3
                        text-right
                      "
                    >
                      {
                        money(
                          row.income
                        )
                      }
                    </td>


                    <td
                      className="
                        p-3
                        text-right
                      "
                    >
                      {
                        money(
                          row.expense
                        )
                      }
                    </td>


                    <td
                      className="
                        p-3
                        text-right
                      "
                    >
                      {
                        money(
                          row.annuity
                        )
                      }
                    </td>


                    <td
                      className="
                        p-3
                        text-right
                      "
                    >

                      {
                        row.loan > 0
                          ? money(
                              row.loan
                            )
                          : "-"
                      }

                    </td>


                    <td
                      className="
                        p-3
                        text-right
                      "
                    >
                      {
                        money(
                          row.investmentReturn
                        )
                      }
                    </td>


                    <td
                      className="
                        p-3
                        text-right
                      "
                    >
                      {
                        money(
                          row.cashFlow
                        )
                      }
                    </td>

                  </tr>

                )
              )
            }

          </tbody>

        </table>

      </section>





      {/* =================================================
          贷款说明
          ================================================= */}

      <section
        className="
          bg-white
          border
          rounded-2xl
          p-6
        "
      >

        <h2
          className="
            text-xl
            font-bold
            mb-4
          "
        >
          💳 Financial Freedom 已关联贷款
        </h2>


        <p
          className="
            text-gray-500
          "
        >
          勾选「计入 Financial Freedom」的贷款，
          会自动从当前家庭资产中扣除，
          并进入年度现金流计算。
        </p>


        <div
          className="
            mt-5
            grid
            grid-cols-1
            md:grid-cols-2
            gap-3
          "
        >

          <div
            className="
              rounded-xl
              bg-gray-50
              p-4
            "
          >
            🏠 房贷：
            按月供 × 12 计算
          </div>


          <div
            className="
              rounded-xl
              bg-gray-50
              p-4
            "
          >
            💳 信用卡分期：
            按月供 × 12 计算
          </div>


          <div
            className="
              rounded-xl
              bg-gray-50
              p-4
            "
          >
            🛡️ 保险贷款：
            按开始日期计算累计利息
          </div>


          <div
            className="
              rounded-xl
              bg-gray-50
              p-4
            "
          >
            🏦 银行信用贷：
            后续增加利息模型
          </div>

        </div>

      </section>





      {/* =================================================
          资产构成说明
          ================================================= */}

      <section
        className="
          bg-white
          border
          rounded-2xl
          p-6
        "
      >

        <h2
          className="
            text-xl
            font-bold
            mb-5
          "
        >
          💰 当前家庭资产构成
        </h2>


        <div
          className="
            grid
            grid-cols-1
            md:grid-cols-3
            gap-4
          "
        >

          <div
            className="
              rounded-xl
              bg-blue-50
              p-5
            "
          >

            <div
              className="
                text-sm
                text-gray-500
              "
            >
              Dashboard Total Wealth
            </div>


            <div
              className="
                text-2xl
                font-bold
                mt-2
              "
            >
              {
                money(
                  dashboardTotalWealth
                )
              }
            </div>

          </div>


          <div
            className="
              rounded-xl
              bg-red-50
              p-5
            "
          >

            <div
              className="
                text-sm
                text-gray-500
              "
            >
              Financial Freedom贷款
            </div>


            <div
              className="
                text-2xl
                font-bold
                mt-2
              "
            >
              -
              {
                money(
                  financialFreedomLoan
                )
              }
            </div>

          </div>


          <div
            className="
              rounded-xl
              bg-green-50
              p-5
            "
          >

            <div
              className="
                text-sm
                text-gray-500
              "
            >
              当前家庭净资产
            </div>


            <div
              className="
                text-2xl
                font-bold
                mt-2
              "
            >
              {
                money(
                  currentFamilyAsset
                )
              }
            </div>

          </div>

        </div>

      </section>





      {/* =================================================
          退休信息
          ================================================= */}

      <section
        className="
          grid
          grid-cols-1
          md:grid-cols-2
          gap-6
        "
      >

        {/* =============================================
            财务自由目标
            ============================================= */}

        <div
          className="
            bg-white
            border
            rounded-2xl
            p-6
          "
        >

          <h3
            className="
              font-bold
              text-xl
            "
          >
            🎯 财务自由目标
          </h3>


          <div
            className="
              text-3xl
              font-bold
              mt-4
            "
          >
            {
              money(
                freedomTarget
              )
            }
          </div>


          <p
            className="
              text-sm
              text-gray-500
              mt-3
            "
          >
            按当前年度生活费 × 25 计算
          </p>

        </div>





        {/* =============================================
            2042预计资产
            ============================================= */}

        <div
          className="
            bg-white
            border
            rounded-2xl
            p-6
          "
        >

          <h3
            className="
              font-bold
              text-xl
            "
          >
            🚀 2042预计资产
          </h3>


          <div
            className="
              text-3xl
              font-bold
              mt-4
            "
          >
            {
              money(
                projectedAsset
              )
            }
          </div>


          <p
            className="
              text-sm
              text-gray-500
              mt-3
            "
          >
            从当前家庭净资产开始，
            按 5% 年投资收益率进行预测
          </p>

        </div>

      </section>





      {/* =================================================
          退休年龄
          ================================================= */}

      <section
        className="
          bg-white
          border
          rounded-2xl
          p-6
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

          <div>

            <h3
              className="
                font-bold
                text-xl
              "
            >
              🎂 退休计划
            </h3>


            <p
              className="
                text-gray-500
                mt-2
              "
            >
              目标退休年份：2042
            </p>

          </div>


          <div
            className="
              text-4xl
              font-bold
            "
          >
            {
              RETIREMENT_AGE
            }
            <span
              className="
                text-xl
                ml-1
              "
            >
              岁
            </span>
          </div>

        </div>

      </section>





      {/* =================================================
          页面结束
          ================================================= */}

    </main>

  </>

);

}

