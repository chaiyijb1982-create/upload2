// lib/loan.ts

import { supabase } from "@/lib/supabase";




// =====================================================
// 获取全部贷款
// =====================================================

export async function getLoans(){


  const {

    data,

    error

  } = await supabase

    .from("loans")

    .select("*")

    .order(
      "created_at",
      {
        ascending:false
      }
    );



  if(error){

    console.error(
      "获取贷款失败:",
      JSON.stringify(
        error,
        null,
        2
      )
    );


    return [];

  }



  return data || [];

}







// =====================================================
// 新增贷款
// =====================================================

export async function addLoan(

loan:any

){


const {

data,

error

}=await supabase

.from("loans")

.insert({


name:
loan.name || "",



type:
loan.type || "其他",



loan_mode:
loan.loan_mode || "fixed",



owner:
loan.owner || "家庭",



original_amount:

Number(
loan.original_amount || 0
),



remaining_amount:

Number(
loan.remaining_amount || 0
),



credit_limit:

Number(
loan.credit_limit || 0
),



interest_rate:

Number(
loan.interest_rate || 0
),



monthly_payment:

Number(
loan.monthly_payment || 0
),



start_date:

loan.start_date || null,



end_date:

loan.end_date || null,



renewable:

Boolean(
loan.renewable
),



renew_period_months:

Number(
loan.renew_period_months || 0
),



include_financial_freedom:

Boolean(
loan.include_financial_freedom
),



note:

loan.note || "",



created_at:

new Date()
.toISOString(),



updated_at:

new Date()
.toISOString()


})

.select();





if(error){


console.error(

"新增贷款失败:",

JSON.stringify(
error,
null,
2
)

);


throw error;


}



return data?.[0];


}







// =====================================================
// 修改贷款
// =====================================================

export async function updateLoan(

id:string,

loan:any

){



const {

data,

error

}=await supabase

.from("loans")

.update({


...loan,



start_date:

loan.start_date || null,



end_date:

loan.end_date || null,



updated_at:

new Date()
.toISOString()


})

.eq(

"id",

id

)

.select();





if(error){


console.error(

"修改贷款失败:",

JSON.stringify(
error,
null,
2
)

);


throw error;


}



return data?.[0];


}







// =====================================================
// 删除贷款
// =====================================================

export async function deleteLoan(

id:string

){


const {

error

}=await supabase

.from("loans")

.delete()

.eq(

"id",

id

);





if(error){


console.error(

"删除贷款失败:",

JSON.stringify(
error,
null,
2
)

);


throw error;


}



return true;


}







// =====================================================
// 当前家庭总负债
// =====================================================

export async function getTotalLoanBalance(){


const loans=

await getLoans();



return loans.reduce(

(

sum:number,

loan:any

)=>

sum+

Number(
loan.remaining_amount || 0
),

0

);


}




// =====================================================
// Financial Freedom 专用
//
// 读取：
// include_financial_freedom = true
//
// 的贷款
// =====================================================

export async function getFinancialFreedomLoans(){


const loans =

await getLoans();



return loans.filter(

(loan:any)=>

loan.include_financial_freedom === true

);


}











// =====================================================
// Financial Freedom 年度贷款支出
//
// 房贷
// 信用卡分期
//
// =====================================================

export async function getFinancialFreedomLoanPayment(

year:number

){



const loans =

await getFinancialFreedomLoans();



let total = 0;





loans.forEach(

(loan:any)=>{



const startYear =

loan.start_date

?

new Date(

loan.start_date

)

.getFullYear()

:

0;





const endYear =

loan.end_date

?

new Date(

loan.end_date

)

.getFullYear()

:

9999;







if(

year < startYear

||

year > endYear

){

return;

}








// 固定还款

if(

loan.loan_mode === "fixed"

){



total +=


Number(

loan.monthly_payment || 0

)

*

12;



}




}



);





return total;


}












// =====================================================
// 计算保险贷款累计利息
//
// 本金不变
//
// 利息 = 本金 × 年利率 × 天数 / 365
//
// =====================================================

export function calculateInsuranceLoanInterest(

loan:any

){



if(

loan.type !== "保险贷款"

){

return 0;

}






if(

!loan.start_date

){

return 0;

}






const start =

new Date(

loan.start_date

);





const today =

new Date();







const days =


Math.max(

0,

Math.floor(

(

today.getTime()

-

start.getTime()

)

/

(

1000 *

60 *

60 *

24

)

)

);







const interest =



Number(

loan.remaining_amount || 0

)



*

(

Number(

loan.interest_rate || 0

)

/

100

)



*

days

/

365;







return interest;



}











// =====================================================
// 计算保险贷款当前应还
//
// 本金 + 利息
//
// =====================================================

export function calculateInsuranceLoanPayable(

loan:any

){



return (


Number(

loan.remaining_amount || 0

)


+

calculateInsuranceLoanInterest(

loan

)


);


}











// =====================================================
// 某一年保险贷款利息
//
// 给天天向上年度模型
//
// =====================================================

export async function getAnnualInsuranceLoanInterest(

year:number

){



const loans =

await getLoans();



let total = 0;





loans.forEach(

(loan:any)=>{





if(

loan.type !== "保险贷款"

){

return;

}






if(

!loan.include_financial_freedom

){

return;

}







const start =

loan.start_date

?

new Date(

loan.start_date

)

:

null;






if(!start){

return;

}







const startYear =

start.getFullYear();







if(

year < startYear

){

return;

}







let endDate =

new Date(

year,

11,

31

);








if(

year === new Date().getFullYear()

){


endDate =

new Date();


}







const days =


Math.floor(

(

endDate.getTime()

-

start.getTime()

)

/

(

1000 *

60 *

60 *

24

)

);









const interest =


Number(

loan.remaining_amount || 0

)



*

(

Number(

loan.interest_rate || 0

)

/

100

)



*

days

/

365;







total += interest;



});






return total;


}





// =====================================================
// 天天向上年度贷款压力
//
// 包含：
//
// 1. 房贷月供
// 2. 信用卡分期
// 3. 保险贷款利息
//
// =====================================================

export async function getAnnualLoanPressure(

year:number

){



const loans =

await getLoans();



let total = 0;





loans.forEach(

(loan:any)=>{



const startYear =

loan.start_date

?

new Date(

loan.start_date

)

.getFullYear()

:

0;





const endYear =

loan.end_date

?

new Date(

loan.end_date

)

.getFullYear()

:

9999;







if(

year < startYear

||

year > endYear

){

return;

}











// 只计算进入财务自由的贷款

if(

loan.include_financial_freedom !== true

){

return;

}








// =====================
// 固定月供贷款
// =====================


if(

loan.loan_mode === "fixed"

){



total +=


Number(

loan.monthly_payment || 0

)

*

12;



}









// =====================
// 保险贷款
//
// 计算利息
// =====================


if(

loan.type === "保险贷款"

){



total +=


calculateInsuranceLoanInterest(

loan

);



}



});







return total;


}











// =====================================================
// 循环贷款列表
//
// 保险贷款
// 银行信用贷
//
// =====================================================

export async function getRevolvingLoans(){



const loans =

await getLoans();





return loans.filter(

(loan:any)=>


loan.loan_mode === "revolving"


||

loan.loan_mode === "term_revolving"



);



}











// =====================================================
// 贷款到期提醒
//
// 提前90天
//
// =====================================================

export async function getLoanExpiryReminder(){



const loans =

await getLoans();




const today =

new Date();




const result:any[]=[];






loans.forEach(

(loan:any)=>{



if(

!loan.end_date

){

return;

}





const end =

new Date(

loan.end_date

);






const days =


(

end.getTime()

-

today.getTime()

)

/

(

1000 *

60 *

60 *

24

);







if(

days <= 90

&&

days >=0

){



result.push({

...loan,


daysLeft:

Math.ceil(days)


});



}



});






return result;


}











// =====================================================
// 按贷款类型统计
//
// =====================================================

export async function getLoanSummaryByType(){



const loans =

await getLoans();





const result:any={};






loans.forEach(

(loan:any)=>{



const type =

loan.type || "其他";






if(

!result[type]

){

result[type]=0;

}







result[type] +=


Number(

loan.remaining_amount || 0

);






});







return result;


}









// =====================================================
// 获取贷款现金流摘要
//
// 给 Dashboard 使用
//
// =====================================================

export async function getLoanCashflowSummary(

year:number

){



const fixed =

await getFinancialFreedomLoanPayment(

year

);




const insuranceInterest =

await getAnnualInsuranceLoanInterest(

year

);






return {


fixed_payment:

fixed,



insurance_interest:

insuranceInterest,



total:


fixed

+

insuranceInterest


};



}

// =====================================================
// Financial Freedom 某一年剩余贷款余额
//
// 用途：
// 天天向上2
//
// 公式：
// 当年财务自由差额
// + 夫妻未来剩余保费
// - 儿子当前现金价值
// + 当年 Financial Freedom 贷款余额
//
// 说明：
// 1. 只计算 include_financial_freedom = true
// 2. 固定月供贷款：按月供逐年减少余额
// 3. 保险贷款：本金按照当前模型保持不变
// 4. 不影响现有 getAnnualLoanPressure()
// =====================================================

export async function getFinancialFreedomLoanBalance(
  year: number
){

  const loans =
    await getFinancialFreedomLoans();


  let totalBalance = 0;


  const currentYear =
    new Date().getFullYear();


  loans.forEach(
    (loan: any) => {

      const currentBalance =
        Number(
          loan.remaining_amount || 0
        );


      if(
        !Number.isFinite(
          currentBalance
        )
        ||
        currentBalance <= 0
      ){

        return;

      }


      // =================================================
      // 保险贷款
      //
      // 当前系统定义：
      // 本金不变
      // 利息另外计算
      // =================================================

      if(
        loan.type === "保险贷款"
      ){

        totalBalance +=
          currentBalance;

        return;

      }


      // =================================================
      // 起始年份
      // =================================================

      const startYear =
        loan.start_date
          ? new Date(
              loan.start_date
            ).getFullYear()
          : currentYear;


      // =================================================
      // 已经到期
      // =================================================

      const endYear =
        loan.end_date
          ? new Date(
              loan.end_date
            ).getFullYear()
          : 9999;


      if(
        year < currentYear
      ){

        return;

      }


      if(
        year > endYear
      ){

        return;

      }


      // =================================================
      // 如果贷款还没有开始
      // =================================================

      if(
        year < startYear
      ){

        return;

      }


      // =================================================
      // 固定月供贷款
      //
      // 用当前 remaining_amount
      // 减去从当前年份到目标年份之间
      // 的本金偿还。
      //
      // 这里沿用你现在系统简单模型：
      //
      // 月供 × 12
      //
      // 不改变现有贷款压力逻辑。
      // =================================================

      if(
        loan.loan_mode === "fixed"
      ){

        const monthlyPayment =
          Number(
            loan.monthly_payment || 0
          );


        if(
          monthlyPayment <= 0
        ){

          totalBalance +=
            currentBalance;

          return;

        }


        const yearsForward =
          Math.max(
            0,
            year - currentYear
          );


        const estimatedBalance =
          Math.max(
            0,
            currentBalance -
            monthlyPayment *
            12 *
            yearsForward
          );


        totalBalance +=
          estimatedBalance;

        return;

      }


      // =================================================
      // 其他贷款类型
      //
      // 如果没有明确的本金还款模型，
      // 暂时使用当前余额。
      // =================================================

      totalBalance +=
        currentBalance;

    }
  );


  return totalBalance;

}