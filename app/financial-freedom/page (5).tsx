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

getFinancialFreedomLoanPayment

} from "@/lib/loan";





// =====================================================
// 参数
// =====================================================


const START_YEAR = 2027;


const END_YEAR = 2042;


const RETIREMENT_YEAR = 2042;


const RETIREMENT_AGE = 60;





// 初始资产

const START_ASSET = 1600000;


const ANNUAL_INCOME = 1100000;


// 投资收益率

const RETURN_RATE = 0.05;





// 生活费用

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





// 年金缴费

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



const [

asset,

setAsset

]=useState(

START_ASSET

);





const [

insurance,

setInsurance

]=useState<any>(null);






const [

insuranceHistory,

setInsuranceHistory

]=useState<any[]>([]);






const [

loanPressure,

setLoanPressure

]=useState<any>({});






const [

rows,

setRows

]=useState<any[]>([]);







const [

loading,

setLoading

]=useState(true);








useEffect(()=>{


async function load(){



// ======================
// 当前资产
// ======================


const latest =

await getLatestAsset();



if(

latest?.total_asset

){


setAsset(

Number(

latest.total_asset

)

);

}







// ======================
// 保险
// ======================


const ins =

await getInsuranceSummary();



setInsurance(ins);





const cashHistory =

await getInsuranceCashValueHistory();



setInsuranceHistory(

cashHistory || []

);









// ======================
// 贷款
// ======================


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




setLoanPressure(loans);






// ======================
// 年度资产计算
// ======================


let currentAsset = asset;



const result:any[]=[];






for(

let year=START_YEAR;

year<=END_YEAR;

year++

){



const expense =

BASE_EXPENSE[year] || 0;





const pension =

ANNUITY[year] || 0;





const loan =

loanPressure[year]?.pressure || 0;






// 年度现金流

const cashFlow =


ANNUAL_INCOME

-

expense

-

pension

-

loan;








// 投资收益

const investmentReturn =


currentAsset

*

RETURN_RATE;








// 年末资产


currentAsset =


currentAsset

+

investmentReturn

+

cashFlow;








// ======================
// 退休目标
// ======================


const freedomTarget =


expense

*

25;








const freedomGap =


Math.max(

0,

freedomTarget

-

currentAsset

);








result.push({



year,



asset:


currentAsset,





income:


ANNUAL_INCOME,





expense,





annuity:


pension,





loan:



loan,






investmentReturn,






cashFlow,






freedomTarget,






freedomGap,



});




}



setRows(result);



setLoading(false);



}



load();



},[asset]);











// ======================
// 金额格式
// ======================


function money(

num:number

){


return (

"¥ "

+

Number(num || 0)

.toLocaleString(

"zh-CN",

{

maximumFractionDigits:0

}

)

);


}










if(loading){


return (

<>

<TopBar

title="Financial Freedom"

/>


<div

className="
p-10
"

>

加载中...

</div>


</>


);


}











// 当前年份

const current =

rows[

rows.length-1

] || {};





// 财务自由差额

const freedomGap =

current.freedomGap || 0;








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






<h1

className="
text-3xl
font-bold
"

>

🚀 Financial Freedom

</h1>









{/* =====================
顶部数据
===================== */}



<section

className="
grid
grid-cols-1
md:grid-cols-3
gap-6
"

>



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

{

money(asset)

}

</div>


</div>









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

2042 财务自由目标差额

</div>


<div

className="
text-3xl
font-bold
mt-3
"

>

{

money(freedomGap)

}

</div>


</div>









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

退休年龄

</div>


<div

className="
text-3xl
font-bold
mt-3
"

>

{

RETIREMENT_AGE

}

岁

</div>


</div>




</section>









{/* =====================
年度表
===================== */}


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

<th>

年份

</th>


<th>

资产

</th>


<th>

收入

</th>


<th>

生活费

</th>


<th>

年金

</th>


<th>

贷款压力

</th>


<th>

投资收益

</th>


<th>

现金流

</th>


</tr>


</thead>


<tbody>


{

rows.map(

(row:any)=>(


<tr

key={row.year}

className="
border-b
"

>


<td

className="
p-3
"

>

{

row.year

}

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

?

money(

row.loan

)

:

"-"

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









{/* =====================
贷款说明
===================== */}



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


勾选「计入 Financial Freedom」的贷款，会自动进入年度现金流计算。


</p>




<div

className="
mt-4
space-y-2
"

>


<div>

🏠 房贷：

按月供 × 12 计算

</div>


<div>

💳 信用卡分期：

按月供 × 12 计算

</div>


<div>

🛡️ 保险贷款：

按开始日期计算累计利息

</div>


<div>

🏦 银行信用贷：

后续增加利息模型

</div>



</div>


</section>









{/* =====================
退休信息
===================== */}



<section

className="
grid
grid-cols-1
md:grid-cols-2
gap-6
"

>



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

current.freedomTarget

)

}

</div>


</div>







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

current.asset

)

}

</div>



</div>





</section>








</main>


</>


);


}