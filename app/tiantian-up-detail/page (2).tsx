"use client";


import {
  useEffect,
  useState,
} from "react";


import TopBar from "@/components/TopBar";


import {
  getTotalWealthWithFixedIncome,
} from "@/lib/asset";


import {
  getInsuranceYearProjection,
  getInsuranceSummary,
} from "@/lib/insurance";



// =====================================
// 参数
// =====================================


// 初始财务自由目标
const FREEDOM_TARGET = 10000000;


// 收益率

const RETURN_RATE = 0.05;


// 年收入

const ANNUAL_INCOME = 1100000;



// =====================================
// 年生活费用
// =====================================

function getAnnualExpense(
  year:number
){

  return (

    year <= 2031

    ?

    370000

    :

    320000

  );

}



// =====================================
// 年金缴费
// =====================================

function getAnnualPensionPayment(
  year:number
){


  const map:any={


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

    2042:39000,


  };


  return (

    map[year]
    ||
    0

  );


}



// =====================================
// 金额格式
// =====================================


function money(
 value:number
){


 const num =
 Number(value)||0;



 if(num>=100000000){

   return (

    "¥"+
    (
      num/100000000
    )
    .toFixed(2)
    +
    "亿"

   );

 }



 if(num>=10000){

   return (

    "¥"+
    (
      num/10000
    )
    .toFixed(1)
    +
    "万"

   );

 }


 return (

  "¥"+
  num.toLocaleString()

 );

}




export default function TiantianUpPage(){


  const [
    currentAsset,
    setCurrentAsset
  ] = useState(0);



  const [
    insurance,
    setInsurance
  ] = useState<any>(null);



  const [
    insuranceYears,
    setInsuranceYears
  ] = useState<any[]>([]);



  const [
    loading,
    setLoading
  ] = useState(true);



  useEffect(()=>{


    async function load(){


      const [
        asset,
        insuranceData,
        yearData

      ] = await Promise.all([


        getTotalWealthWithFixedIncome(),


        getInsuranceSummary(),


        getInsuranceYearProjection()


      ]);



      setCurrentAsset(
        Number(asset)||0
      );



      setInsurance(
        insuranceData
      );



      setInsuranceYears(
        yearData
      );



      setLoading(false);


    }



    load();


  },[]);


// =====================================
// 天天向上年度模拟
// =====================================


const yearlyTiantian:any[] = [];


let asset =
  Number(currentAsset || 0);



insuranceYears.forEach(
(item:any)=>{


  const year =
    item.year;



  // ===========================
  // 年初资产
  // ===========================

  const beginAsset =
    asset;



  // ===========================
  // 新增投资
  // ===========================


  const expense =
    getAnnualExpense(
      year
    );



  const pension =
    getAnnualPensionPayment(
      year
    );



  const newInvestment =

    ANNUAL_INCOME

    -

    expense

    -

    pension;



  // ===========================
  // 投资收益
  // 年初资产复利
  // ===========================


  const investmentReturn =

    beginAsset

    *

    RETURN_RATE;



  // ===========================
  // 年末资产
  // ===========================


  const totalAsset =

    beginAsset

    +

    newInvestment

    +

    investmentReturn;



  // 更新本金

  asset =
    totalAsset;



  // ===========================
  // 财务自由差额
  // ===========================


  const freedomGap =


    Math.max(

      FREEDOM_TARGET

      -

      totalAsset,

      0

    );



  // ===========================
  // 天天向上1
  //
  // 财务自由差额
  // +
  // 全部未来保险保费
  //
  // ===========================


  const tiantian1 =


    freedomGap

    +

    Number(

      item.totalFuturePremium

      ||

      0

    );




  // ===========================
  // 天天向上2
  //
  // 财务自由差额
  // +
  // 夫妻未来保费
  // -
  // 儿子现金价值
  //
  // ===========================


  const tiantian2 =


    freedomGap

    +

    Number(

      item.coupleFuturePremium

      ||

      0

    )

    -

    Number(

      item.sonCashValue

      ||

      0

    );




  yearlyTiantian.push({


    year,


    beginAsset,


    newInvestment,


    investmentReturn,


    totalAsset,


    tiantian1,


    tiantian2,



  });



});



// =====================================
// 当前天天向上
// =====================================


const currentFreedomGap =


  Math.max(

    FREEDOM_TARGET

    -

    currentAsset,

    0

  );




const currentTiantian1 =


  currentFreedomGap

  +

  Number(

    insurance?.unpaidPremium

    ||

    0

  );




const currentTiantian2 =


  currentFreedomGap

  +

  Number(

    insurance?.coupleUnpaidPremium

    ||

    0

  )

  -

  Number(

    insurance?.sonCashValue

    ||

    0

  );





if(loading){


 return (

  <>

   <TopBar
    title="天天向上"
   />


   <main className="p-8">

    加载中...

   </main>


  </>

 );


}

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
"
>

资产复利 + 保险压力年度模拟

</p>




{/* =========================
当前天天向上
========================= */}


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
p-7
"
>


<p
className="
text-gray-500
"
>

天天向上1

</p>


<h2
className="
text-4xl
font-bold
text-blue-700
mt-3
"
>

{
money(
 currentTiantian1
)
}

</h2>


<p
className="
text-sm
text-gray-400
mt-3
"
>

财务自由差额
+
全部未来保险保费

</p>


</div>





<div
className="
bg-white
border
rounded-2xl
p-7
"
>


<p
className="
text-gray-500
"
>

天天向上2

</p>


<h2
className="
text-4xl
font-bold
text-green-700
mt-3
"
>

{
money(
 currentTiantian2
)
}

</h2>


<p
className="
text-sm
text-gray-400
mt-3
"
>

财务自由差额
+
夫妻未来保费
-
儿子现金价值

</p>


</div>


</section>





{/* =========================
年度模拟
========================= */}


<section
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
mb-6
"
>

📅 天天向上年度模拟

</h2>




<div
className="
overflow-x-auto
"
>


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
text-gray-500
"
>


<th
className="
text-left
p-3
"
>
年份
</th>


<th
className="
text-right
p-3
"
>
年初资产
</th>


<th
className="
text-right
p-3
"
>
新增投资
</th>


<th
className="
text-right
p-3
"
>
投资收益
</th>


<th
className="
text-right
p-3
"
>
总资产
</th>


<th
className="
text-right
p-3
"
>
天天向上1
</th>


<th
className="
text-right
p-3
"
>
天天向上2
</th>


</tr>


</thead>




<tbody>


{

yearlyTiantian.map(

(item:any)=>(


<tr
key={
item.year
}
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

{
item.year
}

</td>



<td
className="
text-right
p-3
"
>

{
money(
item.beginAsset
)
}

</td>



<td
className="
text-right
p-3
"
>

{
money(
item.newInvestment
)
}

</td>




<td
className="
text-right
p-3
"
>

{
money(
item.investmentReturn
)
}

</td>




<td
className="
text-right
p-3
font-bold
"
>

{
money(
item.totalAsset
)
}

</td>




<td
className="
text-right
p-3
text-blue-700
font-bold
"
>

{
money(
item.tiantian1
)
}

</td>



<td
className="
text-right
p-3
text-green-700
font-bold
"
>

{
money(
item.tiantian2
)
}

</td>



</tr>


)

)


}


</tbody>


</table>


</div>



</section>






{/* =========================
保险数据
========================= */}



<section
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
mb-5
"
>

🛡️ 保险数据

</h2>




<div
className="
grid
grid-cols-1
md:grid-cols-3
gap-6
"
>


<div>

<p
className="
text-gray-500
"
>
全部未缴保费
</p>


<b
className="
text-xl
"
>

{
money(
insurance?.unpaidPremium || 0
)
}

</b>


</div>





<div>


<p
className="
text-gray-500
"
>
夫妻未缴保费
</p>


<b
className="
text-xl
"
>

{
money(
insurance?.coupleUnpaidPremium || 0
)
}

</b>


</div>





<div>


<p
className="
text-gray-500
"
>
儿子现金价值
</p>


<b
className="
text-xl
"
>

{
money(
insurance?.sonCashValue || 0
)
}

</b>


</div>


</div>


</section>





</main>


</>

);

}