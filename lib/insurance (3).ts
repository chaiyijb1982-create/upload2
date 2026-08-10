import { supabase } from "./supabase";


// =====================================
// 获取保险列表
// =====================================

export async function getInsurancePolicies(){


    const {
        data,
        error
    } = await supabase
        .from("insurance_policies")
        .select("*")
        .order(
            "created_at",
            {
                ascending:true
            }
        );


    console.log(
        "insurance policies:",
        data
    );


    console.log(
        "insurance error:",
        error
    );


    return data || [];

}





// =====================================
// 获取保单 + 当前现金价值
// =====================================

export async function getInsurancePoliciesWithCashValue(){


    const policies =
        await getInsurancePolicies();



    const {
        data:history,
        error
    } = await supabase
        .from("insurance_history")
        .select(
            `
            policy_id,
            cash_value,
            date
            `
        )
        .order(
            "date",
            {
                ascending:false
            }
        );



    if(error){

        console.log(
            "history error:",
            error
        );

    }



    const latest:any={};



    history?.forEach(row=>{


        if(!latest[row.policy_id]){

            latest[row.policy_id]=row;

        }


    });



    return policies.map(policy=>{


        return {

            ...policy,

            cash_value:
                Number(
                    latest[policy.id]?.cash_value || 0
                ),


            cash_value_date:
                latest[policy.id]?.date || null


        };


    });


}







// =====================================
// 获取保险汇总
// =====================================

export async function getInsuranceSummary(){


    const {
        data:policies,
        error
    }
    =
    await supabase
    .from("insurance_policies")
    .select("*");



    if(error){


        return {

            count:0,

            premiumTotal:0,

            cashValue:0,

            annualIncome:0,

            monthlyIncome:0,

            totalPremium:0,

            totalAnnualPension:0,

            totalMonthlyPension:0,

            todayCashValue:0,

            ownerCashValue:{}

        };

    }



    let premiumTotal=0;

    let annualIncome=0;

    let monthlyIncome=0;



    policies?.forEach(item=>{


        premiumTotal +=
            Number(
                item.premium_total || 0
            );


        annualIncome +=
            Number(
                item.annual_pension || 0
            );


        monthlyIncome +=
            Number(
                item.monthly_pension || 0
            );


    });




    const {
        data:history
    }
    =
    await supabase
    .from("insurance_history")
    .select(
        `
        policy_id,
        cash_value,
        date
        `
    )
    .order(
        "date",
        {
            ascending:false
        }
    );



    const latest:any={};



    history?.forEach(row=>{


        if(!latest[row.policy_id]){

            latest[row.policy_id]=row;

        }


    });




    let todayCashValue=0;


    let ownerCashValue:any={};



    policies?.forEach(policy=>{


        const cash =
            Number(
                latest[policy.id]?.cash_value || 0
            );


        todayCashValue += cash;



        const owner =
            policy.owner || "未知";



        if(!ownerCashValue[owner]){

            ownerCashValue[owner]=0;

        }


        ownerCashValue[owner]+=cash;



    });



    return {


        count:
            policies?.length || 0,


        premiumTotal,


        cashValue:
            todayCashValue,


        annualIncome,


        monthlyIncome,



        totalPremium:
            premiumTotal,


        totalAnnualPension:
            annualIncome,


        totalMonthlyPension:
            monthlyIncome,


        todayCashValue,


        ownerCashValue



    };


}









// =====================================
// 获取现金价值历史曲线
// =====================================

export async function getInsuranceCashValueHistory(){


    const {
        data,
        error
    }
    =
    await supabase
    .from("insurance_history")
    .select(
        `
        policy_id,
        cash_value,
        date
        `
    )
    .order(
        "date",
        {
            ascending:true
        }
    );



    if(error){

        console.log(
            "cash history error:",
            error
        );

        return [];

    }



    return data || [];

}









// =====================================
// 获取今年保费计划 V6
// =====================================

export async function getInsurancePremiumPlan(){



    const year =
        new Date().getFullYear();



    const {
        data:policies,
        error
    }
    =
    await supabase
    .from("insurance_policies")
    .select("*");



    if(error){


        return {

            year,

            total:0,

            paid:0,

            unpaid:0,

            items:[]

        };

    }





    const {
        data:records
    }
    =
    await supabase
    .from("insurance_premium_records")
    .select("*");





    let total=0;

    let paid=0;



    const items:any[]=[];





    policies?.forEach(policy=>{


        const annualPremium =
            Number(
                policy.annual_premium || 0
            );



        const payYears =
            Number(
                policy.pay_years || 0
            );



        const startDate =
            policy.start_date
            ?
            new Date(policy.start_date)
            :
            null;



        if(
            !startDate ||
            annualPremium<=0
        ){

            return;

        }





        const startYear =
            startDate.getFullYear();



        const currentYearIndex =
            year - startYear + 1;




        if(
            currentYearIndex<=0 ||
            currentYearIndex>payYears
        ){

            return;

        }





        total += annualPremium;



        const currentPayment =
            records?.find(record=>{


                return (

                    record.policy_id === policy.id

                    &&

                    new Date(
                        record.payment_date
                    ).getFullYear()
                    === year

                );


            });





        if(currentPayment){


            paid += annualPremium;


        }







        const paidYears =
            records?.filter(record=>{


                return (

                    record.policy_id === policy.id

                );


            }).length || 0;





        items.push({

            id:
                policy.id,


            owner:
                policy.owner,


            product:
                policy.product,


            company:
                policy.company,



            annual_premium:
                annualPremium,


            pay_years:
                payYears,



            paid_years:
                paidYears,



            remain_years:
                Math.max(
                    payYears-paidYears,
                    0
                ),



            progress:
                payYears>0
                ?
                Math.round(
                    paidYears/payYears*100
                )
                :
                0,



            status:
                currentPayment
                ?
                "paid"
                :
                "unpaid",



            payment_date:
                currentPayment?.payment_date || null



        });



    });





    return {


        year,


        total,


        paid,


        unpaid:
            total-paid,



        items



    };

}