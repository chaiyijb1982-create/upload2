"use client";


export default function AllocationCard(
{
  allocation
}:{
  allocation:any
}){


  const items=[

    {
      name:"固定收益（债券+现金）",
      key:"fixed_income",
      target:45
    },

    {
      name:"全球股票（美国为主）",
      key:"global_stock",
      target:30
    },

    {
      name:"中国股票",
      key:"china_stock",
      target:10
    },

    {
      name:"黄金",
      key:"gold",
      target:15
    }

  ];





  return (

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
      mb-6
      "
      >

        📊 资产配置

      </h2>





      {
        items.map(item=>{


          const current =
            allocation[item.key] || 0;



          const diff =
            (
              current -
              item.target
            )
            .toFixed(1);





          return (

            <div
            key={item.key}
            className="
            mb-6
            "
            >


              <div
              className="
              flex
              justify-between
              "
              >


                <span>

                  {item.name}

                </span>


                <span
                className="
                font-bold
                "
                >

                  {current.toFixed(1)}%
                  
                  /
                  
                  {item.target}%


                </span>


              </div>





              <div
              className="
              mt-2
              bg-gray-200
              rounded-full
              h-3
              "
              >


                <div

                className="
                bg-blue-500
                h-3
                rounded-full
                "

                style={{

                  width:
                  `${current}%`

                }}

                />


              </div>






              <p
              className="
              text-gray-500
              mt-1
              "
              >

                偏离目标：
                {Number(diff)>0?"+":""}
                {diff}%

              </p>




            </div>

          );


        })
      }






      <div
      className="
      mt-8
      text-lg
      font-bold
      "
      >

        🤖 AI建议：

      </div>



      <p
      className="
      text-gray-600
      mt-2
      "
      >

        根据目标配置，
        后续新增资金优先补充低配资产。

      </p>




    </div>

  );


}