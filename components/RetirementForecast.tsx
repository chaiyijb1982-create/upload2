"use client";

import { useState } from "react";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from "recharts";


interface Props {

  mainlandAsset:number;

  hkAsset:number;

}



export default function RetirementForecast({

  mainlandAsset,

  hkAsset

}:Props){


const [working,setWorking]=useState(true);


const returnRate = 0.05;



const cashFlow=[

{year:2027,expense:37,annuity:72.4,hk:6},
{year:2028,expense:37,annuity:61.4,hk:6},
{year:2029,expense:37,annuity:61.4,hk:6},
{year:2030,expense:37,annuity:61.4,hk:6},
{year:2031,expense:37,annuity:61.4,hk:6},
{year:2032,expense:32,annuity:61.4,hk:6},
{year:2033,expense:32,annuity:35.1,hk:12},
{year:2034,expense:32,annuity:25.9,hk:12},
{year:2035,expense:32,annuity:25.9,hk:12},
{year:2036,expense:32,annuity:25.9,hk:12},
{year:2037,expense:32,annuity:25.9,hk:12},
{year:2038,expense:32,annuity:12.9,hk:12},
{year:2039,expense:32,annuity:3.9,hk:15},
{year:2040,expense:32,annuity:3.9,hk:15},
{year:2041,expense:32,annuity:3.9,hk:15},
{year:2042,expense:32,annuity:3.9,hk:15},

];





let mainland =
mainlandAsset / 10000;


let hk =
hkAsset / 10000;



const data:any[]=[];



cashFlow.forEach(item=>{


const income = working ? 110 : 0;



const mortgage =
item.year <=2035
?
20.6807
:
0;



const social =
item.year <=2035
?
3.6
:
0;



const insurance =
item.year >=2034
?
1.2
:
0;




// investment return

mainland *= (1+returnRate);

hk *= (1+returnRate);




// mainland cashflow


mainland +=

income

+

insurance

-

item.expense

-

item.annuity

-

mortgage

-

social

-

item.hk;



// HK investment


hk += item.hk;





data.push({

year:item.year,

mainland:Number(mainland.toFixed(2)),

hk:Number(hk.toFixed(2)),

total:Number(
(mainland+hk).toFixed(2)
),

income,

expense:item.expense,

annuity:item.annuity,

mortgage,

social,

insurance,

transfer:item.hk


});


});





const final =
data[data.length-1];





// ==========================
// Retirement Score
// ==========================


let score = 100;



if(final.total < 500){

score -=30;

}

else if(final.total <1000){

score -=15;

}




const hkRatio =
final.hk/final.total*100;



if(hkRatio <15){

score-=5;

}



if(score<0){

score=0;

}




let level="★★★★★";


if(score<80){

level="★★★★☆";

}


if(score<60){

level="★★★☆☆";

}






// ==========================
// Earliest Retirement
// ==========================


let earlyRetire=2042;



for(const item of data){


if(item.total > 32*20){

earlyRetire=item.year;

break;

}


}







return (

<div

className="
bg-white
rounded-2xl
shadow
p-8
"

>


<h2 className="
text-2xl
font-bold
mb-6
">

🎯 Retirement Forecast

</h2>





<div className="
flex
gap-4
mb-8
">


<button

onClick={()=>setWorking(true)}

className={

working

?

"bg-blue-600 text-white px-5 py-2 rounded-xl"

:

"bg-gray-100 px-5 py-2 rounded-xl"

}

>

🟢 继续工作

</button>




<button

onClick={()=>setWorking(false)}

className={

!working

?

"bg-red-600 text-white px-5 py-2 rounded-xl"

:

"bg-gray-100 px-5 py-2 rounded-xl"

}

>

🔴 停止工作

</button>



</div>






<div className="
grid
grid-cols-1
md:grid-cols-3
gap-6
mb-10
">


<div>

<p className="text-gray-500">

退休健康分

</p>

<p className="text-4xl font-bold">

{score}/100

</p>

</div>



<div>

<p className="text-gray-500">

安全等级

</p>

<p className="text-3xl">

{level}

</p>

</div>



<div>

<p className="text-gray-500">

最早退休年份

</p>

<p className="text-3xl font-bold">

{earlyRetire}

</p>

</div>


</div>








<div className="
grid
grid-cols-1
md:grid-cols-3
gap-6
mb-10
">


<div>

<p className="text-gray-500">

2042大陆

</p>

<p className="text-3xl font-bold">

¥{final.mainland}万

</p>

</div>



<div>

<p className="text-gray-500">

2042香港

</p>

<p className="text-3xl font-bold">

¥{final.hk}万

</p>

</div>



<div>

<p className="text-gray-500">

2042总资产

</p>

<p className="text-3xl font-bold">

¥{final.total}万

</p>

</div>


</div>







<div className="h-96">


<ResponsiveContainer

width="100%"

height="100%"

>


<LineChart data={data}>


<CartesianGrid strokeDasharray="3 3"/>


<XAxis dataKey="year"/>


<YAxis/>


<Tooltip/>


<Line
dataKey="total"
name="总资产"
strokeWidth={3}
/>


<Line
dataKey="mainland"
name="大陆"
/>


<Line
dataKey="hk"
name="香港"
/>



</LineChart>


</ResponsiveContainer>


</div>






<h3 className="
text-xl
font-bold
mt-10
mb-4
">

📊 年度现金流

</h3>



<div className="overflow-auto">


<table className="min-w-full">


<thead>

<tr className="border-b">

<th>年份</th>
<th>收入</th>
<th>生活</th>
<th>年金</th>
<th>房贷</th>
<th>五金</th>
<th>香港</th>
<th>年底资产</th>

</tr>

</thead>



<tbody>


{

data.map(item=>(

<tr

key={item.year}

className="border-b"

>

<td>{item.year}</td>

<td>{item.income}万</td>

<td>{item.expense}万</td>

<td>{item.annuity}万</td>

<td>{item.mortgage.toFixed(1)}万</td>

<td>{item.social}万</td>

<td>{item.transfer}万</td>

<td>{item.total}万</td>


</tr>

))

}


</tbody>


</table>


</div>





</div>

);


}