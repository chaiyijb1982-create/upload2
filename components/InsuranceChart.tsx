"use client";


import {
LineChart,
Line,
XAxis,
YAxis,
Tooltip,
ResponsiveContainer
}
from "recharts";



export default function InsuranceChart({
data
}:any){



return (

<div
className="
bg-white
rounded-xl
shadow
p-6
mt-8
"
>


<h2 className="
text-2xl
font-bold
mb-5
">

保险现金价值增长

</h2>




<div
style={{
height:350
}}
>


<ResponsiveContainer
width="100%"
height="100%"
>


<LineChart
data={data}
>


<XAxis
dataKey="date"
/>



<YAxis
tickFormatter={
(value)=>
(value/10000)
.toFixed(0)+"万"
}
/>



<Tooltip
formatter={
(value:any)=>
[
"¥ "+
Number(value)
.toLocaleString(),
"现金价值"
]
}
/>



<Line

type="monotone"

dataKey="value"

stroke="#2563eb"

strokeWidth={3}

/>



</LineChart>


</ResponsiveContainer>


</div>



</div>

)

}