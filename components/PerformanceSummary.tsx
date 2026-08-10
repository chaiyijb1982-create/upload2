"use client";


interface Props{

  asset:any;

}


export default function PerformanceSummary({

  asset

}:Props){


const totalProfit =

Number(asset?.total_profit || 0);



const totalAsset =

Number(asset?.total_asset || 0);



const cost =

totalAsset - totalProfit;



const profitRate =

cost > 0

?

(totalProfit / cost * 100).toFixed(2)

:

"0";



const cnProfit =

Number(asset?.cn_profit || 0);



const hkProfit =

Number(asset?.hk_profit || 0);



return (

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
bg-white
rounded-2xl
shadow
p-8
"

>

<p className="text-gray-500">

💰 Total Profit

</p>


<h2 className="text-4xl font-bold mt-4">

¥{totalProfit.toLocaleString()}

</h2>


</div>







<div

className="
bg-white
rounded-2xl
shadow
p-8
"

>

<p className="text-gray-500">

📈 Return Rate

</p>


<h2 className="text-4xl font-bold mt-4">

{profitRate}%

</h2>


</div>







<div

className="
bg-white
rounded-2xl
shadow
p-8
"

>

<p className="text-gray-500">

🌏 Market Profit

</p>



<div className="mt-4 space-y-3">


<p>

🇨🇳 Mainland

<span className="ml-3 font-bold">

¥{cnProfit.toLocaleString()}

</span>

</p>



<p>

🇭🇰 Hong Kong

<span className="ml-3 font-bold">

¥{hkProfit.toLocaleString()}

</span>

</p>



</div>


</div>



</div>


);


}