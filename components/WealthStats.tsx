"use client";


export default function WealthStats(
{
  history
}:{
  history:any[]
}){


  if(!history || history.length < 1){

    return null;

  }



  // 当前资产

  const latest =
    history[history.length-1];


  // 第一笔资产

  const first =
    history[0];



  // 昨日资产

  const yesterday =
    history.length > 1
    ?
    history[history.length-2]
    :
    latest;



  // 今日变化

  const dailyChange =
    latest.total_asset
    -
    yesterday.total_asset;



  const dailyRate =
    yesterday.total_asset
    ?
    (
      dailyChange /
      yesterday.total_asset
      *
      100
    ).toFixed(2)
    :
    "0";



  // 历史最高

  const maxAsset =
    Math.max(
      ...history.map(
        item =>
        item.total_asset
      )
    );



  // 累计增长

  const growth =
    latest.total_asset
    -
    first.total_asset;



  const growthRate =
    first.total_asset
    ?
    (
      growth /
      first.total_asset
      *
      100
    ).toFixed(2)
    :
    "0";




  return (

    <div
    className="
    grid
    grid-cols-1
    md:grid-cols-2
    gap-6
    mt-10
    ">


      {/* 今日变化 */}

      <div
      className="
      bg-white
      rounded-2xl
      shadow
      p-8
      ">

        <p className="text-gray-500">
          📈 今日变化
        </p>


        <h2
        className="
        text-4xl
        font-bold
        mt-4
        ">

        ¥ {
          dailyChange.toLocaleString()
        }

        </h2>


        <p className="text-gray-500 mt-2">

          {dailyRate}%

        </p>


      </div>






      {/* 历史最高 */}

      <div
      className="
      bg-white
      rounded-2xl
      shadow
      p-8
      ">


        <p className="text-gray-500">
          🏆 历史最高
        </p>


        <h2
        className="
        text-4xl
        font-bold
        mt-4
        ">

        ¥ {
          maxAsset.toLocaleString()
        }

        </h2>


      </div>







      {/* 累计增长 */}

      <div
      className="
      bg-white
      rounded-2xl
      shadow
      p-8
      ">


        <p className="text-gray-500">
          🚀 累计增长
        </p>


        <h2
        className="
        text-4xl
        font-bold
        mt-4
        ">

        ¥ {
          growth.toLocaleString()
        }

        </h2>


        <p className="text-gray-500 mt-2">

          {growthRate}%

        </p>


      </div>






      {/* 财富进度 */}

      <div
      className="
      bg-white
      rounded-2xl
      shadow
      p-8
      ">


        <p className="text-gray-500">
          🎯 财富进度
        </p>


        <h2
        className="
        text-4xl
        font-bold
        mt-4
        ">

        15.9%

        </h2>


        <p className="text-gray-500 mt-2">

          Retirement Goal

        </p>


      </div>



    </div>

  );


}