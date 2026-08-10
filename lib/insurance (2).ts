import { supabase } from "./supabase";



// =====================================
// 获取保险列表
// =====================================

export async function getInsurancePolicies(){


const {
data,
error
}=await supabase

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
// 获取保险列表 + 当前现金价值
// 取 <= 今天最近日期
// =====================================

export async function getInsurancePoliciesWithCashValue(){



const {
data:policies,
error
}=await supabase

.from("insurance_policies")

.select("*")

.order(
"created_at",
{
ascending:true
}
);



if(error){

return [];

}




const {
data:history
}=await supabase

.from("insurance_history")

.select(
`
policy_id,
cash_value,
date
`
);





const today = new Date();

today.setHours(
23,
59,
59,
999
);





const latest:any={};





history?.forEach(row=>{


const rowDate =
new Date(row.date);



if(rowDate > today){

return;

}



const value =
Number(row.cash_value || 0);



if(value<=0){

return;

}





if(
!latest[row.policy_id]
){

latest[row.policy_id]=row;

}
else{


const oldDate =
new Date(
latest[row.policy_id].date
);



if(rowDate > oldDate){

latest[row.policy_id]=row;

}



}


});






return policies?.map(policy=>({


...policy,


current_cash_value:

Number(
latest[policy.id]?.cash_value || 0
),



current_cash_date:

latest[policy.id]?.date || null



})) || [];

}









// =====================================
// 获取保险汇总
// =====================================

export async function getInsuranceSummary(){



const {
data:policies,
error
}=await supabase

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


premiumTotal += Number(
item.premium_total || 0
);



annualIncome += Number(
item.annual_pension || 0
);



monthlyIncome += Number(
item.monthly_pension || 0
);



});





const {
data:history
}=await supabase

.from("insurance_history")

.select(
`
policy_id,
cash_value,
date
`
);





const today = new Date();

today.setHours(
23,
59,
59,
999
);




const latest:any={};



history?.forEach(row=>{


const rowDate =
new Date(row.date);



if(rowDate > today){

return;

}



const value =
Number(row.cash_value || 0);



if(value<=0){

return;

}




if(
!latest[row.policy_id]
){

latest[row.policy_id]=row;

}
else{


const oldDate =
new Date(
latest[row.policy_id].date
);



if(rowDate > oldDate){

latest[row.policy_id]=row;

}



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
// 获取今年保费计划
// =====================================

export async function getInsurancePremiumPlan(){



const {
data,
error
}=await supabase

.from("insurance_policies")

.select("*")

.order(
"created_at",
{
ascending:true
}
);




const year =
new Date().getFullYear();



if(error){


return {

year,

total:0,

items:[]

};


}







const items:any[]=[];


let total=0;





data?.forEach(policy=>{


if(!policy.start_date){

return;

}




const startYear =
new Date(
policy.start_date
).getFullYear();




const annualPremium =
Number(
policy.annual_premium || 0
);



const payYears =
Number(
policy.pay_years || 0
);



const paidYear =
year -
startYear +
1;





if(
paidYear>0 &&
paidYear<=payYears &&
annualPremium>0
){



items.push({


product:
policy.product,


owner:
policy.owner,


company:
policy.company,


annual_premium:
annualPremium,


pay_years:
payYears,


paid_year:
paidYear,


start_date:
policy.start_date



});



total += annualPremium;



}



});






return {


year,


total,


items



};


}









// =====================================
// 获取保险现金价值历史趋势
// =====================================

export async function getInsuranceCashValueHistory(){



const {
data,
error
}=await supabase

.from("insurance_history")

.select(
`
date,
cash_value
`
)

.order(
"date",
{
ascending:true
}
);




if(error){

return [];

}




const map:any={};




data?.forEach(row=>{


if(!map[row.date]){

map[row.date]=0;

}



map[row.date]+=Number(
row.cash_value || 0
);



});






return Object.keys(map)

.sort()

.map(date=>({


date,


value:
map[date]


}));



}