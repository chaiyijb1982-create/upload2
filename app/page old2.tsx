"use client";


import { useEffect, useState } from "react";


import {

  getLatestAsset,

  getAssetHistory,

  getHoldingsAllocation,

  getHoldings

} from "@/lib/asset";


import WealthTrend from "@/components/WealthTrend";

import AssetAllocation from "@/components/AssetAllocation";

import HoldingsTable from "@/components/HoldingsTable";




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

      <main className="
        min-h-screen
        flex
        items-center
        justify-center
      ">

        Loading...

      </main>

    );


  }








  return (


    <main className="
      min-h-screen
      bg-gray-100
      p-10
    ">



      <h1 className="
        text-4xl
        font-bold
      ">

        AI Wealth OS

      </h1>



      <p className="
        text-gray-500
        mb-10
      ">

        Personal Wealth Dashboard

      </p>








      {/* 当前资产 */}



      <div className="
        grid
        grid-cols-1
        md:grid-cols-3
        gap-6
      ">





        <div className="
          bg-white
          rounded-2xl
          shadow
          p-8
        ">


          <p className="
            text-gray-500
          ">

            💰 总资产

          </p>



          <h2 className="
            text-5xl
            font-bold
            mt-4
          ">

            ¥

            {asset.total_asset
              ?.toLocaleString()
            }


          </h2>


          <p className="
            text-gray-400
            mt-3
          ">

            {asset.snapshot_date}

          </p>


        </div>







        <div className="
          bg-white
          rounded-2xl
          shadow
          p-8
        ">


          <p className="
            text-gray-500
          ">

            🇨🇳 大陆资产

          </p>



          <h2 className="
            text-4xl
            font-bold
            mt-4
          ">


            ¥

            {asset.cn_asset
              ?.toLocaleString()
            }


          </h2>


        </div>







        <div className="
          bg-white
          rounded-2xl
          shadow
          p-8
        ">


          <p className="
            text-gray-500
          ">

            🇭🇰 香港资产

          </p>



          <h2 className="
            text-4xl
            font-bold
            mt-4
          ">


            ¥

            {asset.hk_asset
              ?.toLocaleString()
            }


          </h2>


        </div>





      </div>









      {/* 财富曲线 */}



      <WealthTrend

        history={history}

      />









      {/* 资产配置 */}



      {
        allocation &&

        <AssetAllocation

          allocation={allocation}

        />

      }









      {/* Holdings */}



      <HoldingsTable

        holdings={holdings}

      />









      {/* 系统状态 */}



      <div className="
        bg-white
        rounded-2xl
        shadow
        p-8
        mt-10
      ">



        <h2 className="
          text-2xl
          font-bold
        ">

          ⚙️ 系统状态

        </h2>





        <p className="
          mt-4
          text-gray-600
        ">

          数据来源：

          Supabase

        </p>





        <p className="
          text-gray-600
        ">

          自动更新：

          Excel + Python + Supabase

        </p>





      </div>





    </main>


  );

}