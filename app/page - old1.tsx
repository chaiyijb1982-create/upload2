"use client";

import { useEffect, useState } from "react";
import { getLatestAsset } from "@/lib/asset";


export default function Home() {

  const [asset,setAsset] = useState<any>(null);


  useEffect(()=>{

    getLatestAsset()
      .then(data=>{
        setAsset(data);
      })

  },[])



  if(!asset){

    return (
      <main style={{
        padding:40
      }}>
        Loading...
      </main>
    )
  }



  return (

    <main
      style={{
        padding:40,
        fontFamily:"Arial"
      }}
    >

      <h1>
        AI Wealth OS
      </h1>


      <hr/>


      <h2>
        💰 总资产
      </h2>

      <h1>
        ¥ {asset.total_asset.toLocaleString()}
      </h1>


      <div>

        <h3>
          🇨🇳 大陆资产
        </h3>

        <h2>
          ¥ {asset.cn_asset.toLocaleString()}
        </h2>


      </div>



      <div>

        <h3>
          🇭🇰 香港资产
        </h3>

        <h2>
          ¥ {asset.hk_asset.toLocaleString()}
        </h2>

      </div>



      <p>
        更新时间：
        {asset.snapshot_date}
      </p>


    </main>

  )

}