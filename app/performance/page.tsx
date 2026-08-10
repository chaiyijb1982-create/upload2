"use client";

import { useEffect, useState } from "react";

import TopBar from "@/components/TopBar";

import {
  getLatestAsset,
  getAssetHistory,
  getHoldings,
} from "@/lib/asset";

import PerformanceSummary from "@/components/PerformanceSummary";
import ProfitTrend from "@/components/ProfitTrend";
import ProfitRanking from "@/components/ProfitRanking";


export default function Performance(){


const [asset,setAsset]=useState<any>(null);

const [history,setHistory]=useState<any[]>([]);

const [holdings,setHoldings]=useState<any[]>([]);



useEffect(()=>{


async function load(){


const [

latest,

historyData,

holdingsData

]=await Promise.all([

getLatestAsset(),

getAssetHistory(),

getHoldings()

]);



setAsset(latest);

setHistory(historyData);

setHoldings(holdingsData);


}



load();



},[]);







if(!asset){

return (

<>

<TopBar

title="Performance"

/>


<div className="p-10">

Loading...

</div>


</>

);


}







return (

<>


<TopBar

title="Performance"

lastUpdate={asset.snapshot_date}

usdCny={asset.usd_cny}

/>



<main

className="
p-10
space-y-10
"

>



<PerformanceSummary

asset={asset}

/>




<ProfitTrend

history={history}

/>




<ProfitRanking

holdings={holdings}

/>





</main>


</>


);


}