"use client";

import {
  useMemo,
  useState
} from "react";


interface Props {

  currentAsset?: number;

}



export default function ForecastCurve({

  currentAsset = 1600000

}:Props){


  // ===============================
  // 参数
  // ===============================


  const [returnRate,setReturnRate]
  =
  useState(5);



  const [income,setIncome]
  =
  useState(1100000);



  const [expenseGrowth,setExpenseGrowth]
  =
  useState(3);



  const [retireAge,setRetireAge]
  =
  useState(60);



  // ===============================
  // 基础
  // ===============================


  const startYear = 2027;

  const endYear = 2042;


  const startAsset =
    Number(currentAsset);



  const years =
    Array.from(
      {
        length:16
      },
      (_,i)=>
        startYear+i
    );



  // ===============================
  // 年金缴费
  // ===============================


  const annualAnnuity:any={


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



  // ===============================
  // 生活支出
  // ===============================


  const baseExpense:any={


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




  // ===============================
  // 预测
  // ===============================


  const forecast = useMemo(()=>{


    let asset =
      startAsset;


    let lastExpense = 0;



    return years.map(year=>{


      if(lastExpense===0){

        lastExpense =
          baseExpense[year];

      }

      else{

        lastExpense =
          lastExpense *
          (
            1+
            expenseGrowth/100
          );

      }



      const annuity =
        annualAnnuity[year] || 0;



      const salary =
        income;



      const profit =
        asset *
        (
          returnRate/100
        );



      asset =
        asset
        +
        salary
        -
        annuity
        -
        lastExpense
        +
        profit;



      if(asset<0){

        asset=0;

      }



      return {


        year,


        salary,


        annuity,


        expense:lastExpense,


        profit,


        asset


      };



    });



  },[

    returnRate,

    income,

    expenseGrowth,

    startAsset

  ]);





  const finalAsset =
    forecast[
      forecast.length-1
    ].asset;



  const money=(v:number)=>

    Math.round(v)
    .toLocaleString(
      "zh-CN"
    );





  return (

<div
className="
bg-white
rounded-2xl
shadow-sm
border
border-gray-100
p-8
"
>


<h2
className="
text-2xl
font-bold
mb-6
"
>
📈 Wealth Forecast
</h2>




<div
className="
grid
md:grid-cols-4
gap-6
mb-8
"
>


{/*收益*/}

<div>

<p>
投资收益率
</p>

<b>
{returnRate}%
</b>

<input

type="range"

min="1"

max="20"

value={returnRate}

onChange={
e=>
setReturnRate(
Number(e.target.value)
)
}

className="
w-full
"

/>

</div>



{/*收入*/}

<div>

<p>
年度收入
</p>


<b>
¥{money(income)}
</b>


<input

type="range"

min="0"

max="1500000"

step="50000"

value={income}

onChange={
e=>
setIncome(
Number(e.target.value)
)
}

className="
w-full
"

/>


</div>




{/*通胀*/}

<div>

<p>
生活支出增长
</p>


<b>
{expenseGrowth}%
</b>


<input

type="range"

min="0"

max="8"

value={expenseGrowth}

onChange={
e=>
setExpenseGrowth(
Number(e.target.value)
)
}

className="
w-full
"

/>


</div>




{/*退休*/}

<div>

<p>
退休年龄
</p>


<b>
{retireAge}岁
</b>


<input

type="range"

min="50"

max="65"

value={retireAge}

onChange={
e=>
setRetireAge(
Number(e.target.value)
)
}

className="
w-full
"

/>


</div>


</div>





<div
className="
bg-gray-50
rounded-xl
p-5
mb-8
"
>

<p
className="
text-gray-500
"
>
2042年预计资产
</p>


<h1
className="
text-3xl
font-bold
mt-2
"
>

¥ {money(finalAsset)}

</h1>


</div>





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
bg-gray-50
"
>

<th className="p-3">
年份
</th>

<th className="p-3">
工资收入
</th>


<th className="p-3">
年金缴费
</th>


<th className="p-3">
生活支出
</th>


<th className="p-3">
投资收益
</th>


<th className="p-3">
年末资产
</th>


</tr>


</thead>



<tbody>


{
forecast.map(item=>(


<tr
key={item.year}
className="
border-b
"
>


<td className="p-3">
{item.year}
</td>


<td className="p-3 text-right">
¥{money(item.salary)}
</td>


<td className="p-3 text-right text-orange-600">
¥{money(item.annuity)}
</td>


<td className="p-3 text-right">
¥{money(item.expense)}
</td>


<td className="p-3 text-right text-green-600">
¥{money(item.profit)}
</td>


<td className="
p-3
text-right
font-bold
">
¥{money(item.asset)}
</td>


</tr>


))
}



</tbody>


</table>


</div>



</div>

  );


}