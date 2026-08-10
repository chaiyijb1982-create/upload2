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
  value:number
){

  const n =
    Number(value) || 0;



  if(
    n >= 100000000
  ){

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



  if(
    n >= 10000
  ){

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
        Number(asset) || 0
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

    useMemo(()=>{


      return expenseForecast.reduce(

        (
          sum,
          item
        )=>


          sum + item,


        0

      );


    },[]);








  // =====================================================
  // 财务自由差额
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
  //
  // =====================================================


  const tiantian2 =


    freedomGap

    +

    coupleMinusSon;








  if(loading){


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

    财富自由 + 保险压力分析

    </p>





    {/* =====================================
        第一排

        第1列 当前家庭资产
        第3列 财务自由差额

    ===================================== */}


    <section

    style={{

      display:"grid",

      gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

      gap:"24px"

    }}

    >



    <div

    style={{

      gridColumn:"1"

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


    </div>





    <div

    style={{

      gridColumn:"3"

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



    </div>



    </section>








    {/* =====================================
        第二排

        第3列 全部未缴保费
        第4列 天天向上1

    ===================================== */}



    <section

    style={{

      display:"grid",

      gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

      gap:"24px"

    }}

    >



    <div

    style={{

      gridColumn:"3"

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







    <div

    style={{

      gridColumn:"4"

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

      display:"grid",

      gridTemplateColumns:
      "repeat(4,minmax(0,1fr))",

      gap:"24px"

    }}

    >





    <div

    style={{

      gridColumn:"1"

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







    <div

    style={{

      gridColumn:"2"

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







    <div

    style={{

      gridColumn:"3"

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








    <div

    style={{

      gridColumn:"4"

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






    </main>


    </>

  );


}