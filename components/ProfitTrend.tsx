"use client";


import {

LineChart,

Line,

XAxis,

YAxis,

CartesianGrid,

Tooltip,

ResponsiveContainer

} from "recharts";



interface Props{

history?:any[];

}



export default function ProfitTrend({

history=[]

}:Props){

console.log(
"ProfitTrend Render"
);

const data =

(history || []).map(item=>({


date:item.snapshot_date,


profit:Number(item.total_profit || 0)


}));




return (

<div

className="
bg-white
rounded-2xl
shadow
p-8
"

>



<h2

className="
text-2xl
font-bold
mb-8
"

>

📈 Profit Trend test

</h2>




<div className="h-96">


{

data.length===0 ?


(

<div className="text-gray-400">

暂无收益数据

</div>


)


:


<ResponsiveContainer

width="100%"

height="100%"

>


<LineChart

data={data}

>


<CartesianGrid

strokeDasharray="3 3"

/>



<XAxis

dataKey="date"

/>



<YAxis

tickFormatter={(value)=>

`¥${(value/10000).toFixed(0)}万`

}

/>



<Tooltip

formatter={(value:any)=>

[

`¥${Number(value).toLocaleString()}`,

"Profit"

]

}

/>



<Line

type="monotone"

dataKey="profit"

stroke="#2563eb"

strokeWidth={3}

dot={false}

/>



</LineChart>


</ResponsiveContainer>


}



</div>



</div>


);


}