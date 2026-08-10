"use client";

import TopBar from "@/components/TopBar";
import { useEffect, useState } from "react";


import {

  getLatestAsset,

  getAssetHistory,

  getHoldingsAllocation,

  getHoldings

} from "@/lib/asset";



import AssetSummary from "@/components/AssetSummary";

import WealthTrend from "@/components/WealthTrend";

import AssetAllocation from "@/components/AssetAllocation";

import HoldingsTable from "@/components/HoldingsTable";

import AIAdvisor from "@/components/AIAdvisor";



export default function Home(){



  const [asset,setAsset] =

    useState<any>(null);



  const [history,setHistory] =

    useState<any[]>([]);



  const [allocation,setAllocation] =

    useState<any>(null);



  const [holdings,setHoldings] =

    useState<any[]>([]);






useEffect(()=>{



console.log(
"AI Wealth OS 启动"
);





getLatestAsset()

.then(data=>{


console.log(
"最新资产:",
data
);


setAsset(data);


});







getAssetHistory()

.then(data=>{


console.log(
"财富历史:",
data
);


setHistory(data);


});








getHoldingsAllocation()

.then(data=>{


console.log(
"资产配置:",
data
);


setAllocation(data);


});







getHoldings()

.then(data=>{


console.log(
"HOLDINGS:",
data
);


setHoldings(data);


});





},[]);









if(!asset){


return (

<main

className="
min-h-screen
flex
items-center
justify-center
"

>


Loading...

</main>


);


}









return (



<main

className="
min-h-screen
bg-gray-100
p-10
"


>







<h1

className="
text-4xl
font-bold
"


>

AI Wealth OS


</h1>





<p

className="
text-gray-500
mb-10
"


>

Personal Wealth Dashboard


</p>









{/* V2-1 顶部资产卡 */}



<AssetSummary

asset={asset}

/>









{/* 财富趋势 */}



<WealthTrend

history={history}

/>




<AIAdvisor

  asset={asset}

  allocation={allocation}

  holdings={holdings}

/>




{/* V2-2 当前 vs 目标配置 */}






{

allocation &&


<AssetAllocation

allocation={allocation}

/>


}









{/* V2-3 Holdings */}



<HoldingsTable

holdings={holdings}

/>









{/* 系统状态 */}



<div

className="
bg-white
rounded-2xl
shadow
p-8
mt-10
"


>



<h2

className="
text-2xl
font-bold
"


>

⚙️ 系统状态


</h2>





<p

className="
mt-4
text-gray-600
"


>

数据来源：

Supabase


</p>





<p

className="
text-gray-600
"


>

自动更新：

Excel + Python + Supabase


</p>




</div>








</main>



);



}