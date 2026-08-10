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
  getInsuranceYearProjection,
} from "@/lib/insurance";



// =====================================================
// 生活费用预测
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
// 财务自由目标
// =====================================================

const financialFreedomTarget =

  expenseForecast.reduce(

    (
      sum,
      item
    ) =>

      sum + item,

    0

  );




// =====================================================
// 年金缴费计划
// =====================================================

function getAnnualPensionPayment(
  year:number
){


  const pensionMap:any = {


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

    pensionMap[year]

    ||

    0

  );

}




// =====================================================
// 金额格式
// =====================================================

function money(
  value:number
){


  const n =
    Number(value)||0;



  if(
    n >= 100000000
  ){

    return (

      "¥"

      +

      (
        n/100000000
      )
      .toFixed(2)

      +

      " 亿"

    );

  }



  if(
    n >= 10000
  ){

    return (

      "¥"

      +

      (
        n/10000
      )
      .toFixed(1)

      +

      " 万"

    );

  }



  return (

    "¥"

    +

    Math.round(n)
    .toLocaleString(
      "zh-CN"
    )

  );


}

// =====================================================
// 页面
// =====================================================


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

    yearlyProjection,

    setYearlyProjection

  ] = useState<any[]>([]);




  const [

    loading,

    setLoading

  ] = useState(true);





  // =====================================================
  // 加载数据
  // =====================================================


  useEffect(()=>{


    async function load(){



      try{


        const [

          asset,

          insuranceData,

          insuranceYearData

        ] =

        await Promise.all([



          getTotalWealthWithFixedIncome(),



          getInsuranceSummary(),



          getInsuranceYearProjection()



        ]);





        console.log(
          "天天向上资产:",
          asset
        );



        console.log(
          "天天向上保险:",
          insuranceData
        );



        console.log(
          "天天向上保险年度:",
          insuranceYearData
        );





        setCurrentAsset(

          Number(asset)||0

        );





        setInsurance(

          insuranceData

        );





        setYearlyProjection(

          insuranceYearData || []

        );





      }

      catch(error){


        console.error(
          "天天向上加载错误:",
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
  // 财务自由目标
  // =====================================================


  const freedomTarget =

    useMemo(()=>{


      return financialFreedomTarget;



    },[]);






  // =====================================================
  // 当前财务自由差额
  // =====================================================


  const currentFreedomGap =


    Math.max(


      10000000

      -

      currentAsset,


      0


    );






  // =====================================================
  // 天天向上1
  //
  // 财务自由差额
  // +
  // 全部未来保险保费
  //
  // =====================================================


  const tiantian1 =


    currentFreedomGap

    +

    Number(

      insurance?.unpaidPremium

      ||

      0

    );






  // =====================================================
  // 天天向上2
  //
  // 财务自由差额
  // +
  // 夫妻未来保费
  // -
  // 儿子现金价值
  //
  // =====================================================


  const tiantian2 =


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




// =====================================================
// 天天向上年度模拟
// 资产复利模型
// =====================================================


const yearlyTiantian:any[] = [];


let simulationAsset =

  Number(
    currentAsset
    ||
    0
  );





yearlyProjection.forEach(

(item:any)=>{



  const year =

    Number(
      item.year
    );





  // =========================
  // 年初资产
  // =========================


  const beginAsset =

    simulationAsset;





  // =========================
  // 收入
  // =========================


  const income =

    1100000;





  // =========================
  // 生活费用
  // =========================


  const expense =


    year <= 2031

    ?

    370000

    :

    320000;





  // =========================
  // 年金缴费
  // =========================


  const pension =


    getAnnualPensionPayment(

      year

    );





  // =========================
  // 新增投资
  //
  // 收入 - 生活费 - 年金
  //
  // =========================


  const newInvestment =


    income

    -

    expense

    -

    pension;





  // =========================
  // 投资收益
  //
  // 年初资产 5%
  //
  // =========================


  const investmentReturn =


    beginAsset

    *

    0.05;





  // =========================
  // 年末资产
  // =========================


  const totalAsset =


    beginAsset

    +

    newInvestment

    +

    investmentReturn;





  // 更新本金

  simulationAsset =

    totalAsset;





  // =========================
  // 财务自由差额
  //
  // 单独计算
  // 不包含保险
  //
  // =========================


  const freedomGap =


    Math.max(

      10000000

      -

      totalAsset,


      0

    );





  // =========================
  // 天天向上1
  //
  // 财务自由差额
  // +
  // 全部未来保险保费
  //
  // =========================


  const yearlyTiantian1 =


    freedomGap

    +

    Number(

      item.totalFuturePremium

      ||

      0

    );





  // =========================
  // 天天向上2
  //
  // 财务自由差额
  // +
  // 夫妻未来保费
  // -
  // 儿子现金价值
  //
  // =========================


  const yearlyTiantian2 =


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


    tiantian1:

      yearlyTiantian1,


    tiantian2:

      yearlyTiantian2,


  });





  console.log(

    "天天向上年度:",

    {

      year,

      beginAsset,

      newInvestment,

      investmentReturn,

      totalAsset,

      tiantian1:
        yearlyTiantian1,

      tiantian2:
        yearlyTiantian2,

    }

  );



}



);
// =====================================================
// Loading
// =====================================================


if(loading){


  return (

    <>

      <TopBar
        title="天天向上"
      />


      <main
        className="
        p-8
        "
      >

        正在加载财富数据...


      </main>


    </>

  );


}





// =====================================================
// 页面 JSX
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

财富自由压力模拟系统

</p>





{/* ============================
 当前状态
============================ */}


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
p-7
"
>

<p
className="
text-gray-500
"
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
currentFreedomGap
)
}

</h2>


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
财务自由目标
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
10000000
)
}

</h2>


</div>



</section>







{/* ============================
 天天向上指标
============================ */}



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


<h2
className="
text-xl
font-bold
"
>

🚀 天天向上 1

</h2>



<p
className="
text-4xl
font-bold
text-blue-700
mt-5
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
mt-3
"
>

财务自由差额
+
全部未来待交保费

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


<h2
className="
text-xl
font-bold
"
>

🚀 天天向上 2

</h2>



<p
className="
text-4xl
font-bold
text-green-700
mt-5
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
mt-3
"
>

财务自由差额
+
夫妻未来待交保费
-
儿子现金价值

</p>


</div>




</section>





{/* ============================
 年度模拟
============================ */}


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
space-y-4
"
>



{
yearlyTiantian.map(

(item:any)=>(



<div
key={
item.year
}

className="
grid
grid-cols-1
md:grid-cols-5
gap-4
bg-gray-50
rounded-xl
p-5
"
>



<div>

<p
className="
text-gray-400
text-sm
"
>
年份
</p>


<b>
{
item.year
}
</b>


</div>






<div>

<p
className="
text-gray-400
text-sm
"
>
年初资产
</p>


<b>
{
money(
item.beginAsset
)
}

</b>


</div>







<div>

<p
className="
text-gray-400
text-sm
"
>
预计资产
</p>


<b>
{
money(
item.totalAsset
)
}

</b>


</div>








<div>

<p
className="
text-gray-400
text-sm
"
>
天天向上1
</p>


<b
className="
text-blue-700
"
>

{
money(
item.tiantian1
)
}

</b>


</div>








<div>

<p
className="
text-gray-400
text-sm
"
>
天天向上2
</p>


<b
className="
text-green-700
"
>

{
money(
item.tiantian2
)
}

</b>


</div>



</div>


))

}




</div>



</section>
{/* ===================================================== */}
{/* 新增投资 / 收益 / 资产结构 */}
{/* ===================================================== */}


<section
className="
bg-white
rounded-2xl
border
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

📊 财富增长分析

</h2>



<div
className="
grid
grid-cols-1
md:grid-cols-3
gap-6
"
>


<div
className="
bg-gray-50
rounded-xl
p-5
"
>

<p
className="
text-gray-500
text-sm
"
>

当前资产

</p>


<p
className="
text-2xl
font-bold
mt-2
"
>

{
money(
currentAsset
)
}

</p>


</div>





<div
className="
bg-gray-50
rounded-xl
p-5
"
>

<p
className="
text-gray-500
text-sm
"
>

预计新增投资

</p>


<p
className="
text-2xl
font-bold
mt-2
text-blue-700
"
>


{
money(

yearlyTiantian.reduce(

(sum,item)=>

sum
+
Number(
item.newInvestment||0
),

0

)

)

}


</p>


</div>





<div
className="
bg-gray-50
rounded-xl
p-5
"
>

<p
className="
text-gray-500
text-sm
"
>

预计投资收益

</p>


<p
className="
text-2xl
font-bold
mt-2
text-green-700
"
>


{
money(

yearlyTiantian.reduce(

(sum,item)=>

sum
+
Number(
item.investmentReturn||0
),

0

)

)

}


</p>


</div>



</div>


</section>






{/* ===================================================== */}
{/* 最终资产预测 */}
{/* ===================================================== */}


<section
className="
bg-white
rounded-2xl
border
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

🎯 2042 财富目标预测

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
text-sm
"
>

2042预计资产

</p>


<p
className="
text-3xl
font-bold
mt-2
"
>


{

money(

yearlyTiantian.length

?
yearlyTiantian[
yearlyTiantian.length-1
]
.totalAsset

:

0

)

}


</p>


</div>





<div>

<p
className="
text-gray-500
text-sm
"
>

2042天天向上1

</p>


<p
className="
text-3xl
font-bold
text-blue-700
mt-2
"
>


{

money(

yearlyTiantian.length

?

yearlyTiantian[
yearlyTiantian.length-1
]
.tiantian1

:

0

)

}


</p>


</div>





<div>

<p
className="
text-gray-500
text-sm
"
>

2042天天向上2

</p>


<p
className="
text-3xl
font-bold
text-green-700
mt-2
"
>


{

money(

yearlyTiantian.length

?

yearlyTiantian[
yearlyTiantian.length-1
]
.tiantian2

:

0

)

}


</p>


</div>



</div>



</section>







{/* ===================================================== */}
{/* 页面结束 */}
{/* ===================================================== */}



</main>


</>

);