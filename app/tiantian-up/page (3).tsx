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
  getInsuranceSummary,
} from "@/lib/insurance";



// =====================================================
// 生活费用
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
        n /
        100000000
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
        n /
        10000
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
    loading,
    setLoading
  ] = useState(true);





  useEffect(()=>{


    async function load(){


      const [

        asset,

        insuranceData

      ] = await Promise.all([


        getTotalWealthWithFixedIncome(),


        getInsuranceSummary()


      ]);



      setCurrentAsset(
        Number(asset)||0
      );



      setInsurance(
        insuranceData
      );



      setLoading(false);


    }



    load();


  },[]);





  // =====================================================
  // 财务自由目标
  // =====================================================


  const freedomTarget =

    expenseForecast.reduce(

      (
        sum,
        item
      )=>

        sum + item,

      0

    );





  // =====================================================
  // 当前财务自由差额
  // =====================================================


  const freedomGap =


    Math.max(

      freedomTarget
      -
      currentAsset,

      0

    );





  // =====================================================
  // 天天向上1
  //
  // 财务自由差额
  // +
  // 全部未来保险待交保费
  //
  // =====================================================


  const tiantian1 =


    freedomGap

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
  // 夫妻未来待交保费
  // -
  // 儿子现金价值
  //
  // =====================================================


  const tiantian2 =


    freedomGap

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


        <main className="p-10">

          正在加载...

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

距离财富自由，还需要努力多少

</p>





{/* =====================================
当前资产 & 财务自由差额
===================================== */}


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
rounded-2xl
border
p-7
"
>


<p>

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
rounded-2xl
border
p-7
"
>


<p>

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


</div>



</section>






{/* =====================================
天天向上1 / 天天向上2
===================================== */}



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
rounded-2xl
border
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
text-4xl
font-bold
text-blue-700
mt-4
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
rounded-2xl
border
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
text-4xl
font-bold
text-green-700
mt-4
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







{/* =====================================
保险关键数据
===================================== */}



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
"
>

🛡️ 保险关键数据

</h2>





<div
className="
grid
grid-cols-1
md:grid-cols-3
gap-5
mt-5
"
>




<div>

<p>

全部未缴保费

</p>



<b
className="
text-xl
"
>

{
money(
 insurance?.unpaidPremium
 ||
 0
)
}

</b>


</div>






<div>

<p>

夫妻未缴保费

</p>



<b
className="
text-xl
"
>

{
money(
 insurance?.coupleUnpaidPremium
 ||
 0
)
}

</b>


</div>






<div>

<p>

儿子现金价值

</p>



<b
className="
text-xl
"
>

{
money(
 insurance?.sonCashValue
 ||
 0
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