import { supabase } from "@/lib/supabase";




// =====================================================
// 获取贷款列表
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

  } = await supabase


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

  } = await supabase


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

  } = await supabase


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
// 所有贷款余额
// =====================================================

export async function getTotalLoanBalance(){


  const loans =

    await getLoans();




  return loans.reduce(

    (

      sum:number,

      item:any

    )=>{


      return (

        sum +

        Number(
          item.remaining_amount || 0
        )

      );


    },

    0

  );


}









// =====================================================
// Financial Freedom 使用
//
// 只计算:
// include_financial_freedom = true
//
// 的贷款
//
// =====================================================

export async function getFinancialFreedomLoanPayment(

  year:number

){



  const loans =

    await getLoans();




  let total = 0;




  loans.forEach(

    (loan:any)=>{



      if(

        !loan.include_financial_freedom

      ){

        return;

      }






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

        year >= startYear

        &&

        year <= endYear

      ){



        // 固定月供贷款

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



    }

  );




  return total;


}









// =====================================================
// 天天向上年度贷款压力
//
// 返回所有需要现金流支出的贷款
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






      // 只有固定月供产生现金流

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
// 保险贷款 / 信用贷
//
// 当前循环贷款余额
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




      const diff =

        end.getTime()

        -

        today.getTime();





      const days =

        diff /

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



    }

  );




  return result;


}









// =====================================================
// 按类型统计贷款
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



    }

  );




  return result;


}