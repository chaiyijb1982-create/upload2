"use client";


import {
  useEffect,
  useState,
} from "react";


import TopBar from "@/components/TopBar";


import {
  supabase,
} from "@/lib/supabase";



// =====================================================
// 页面
// =====================================================

export default function FinancialFreedomHistoryPage(){


  const [
    history,
    setHistory
  ] = useState<any[]>([]);



  const [
    loading,
    setLoading
  ] = useState(true);



  // =====================================================
  // 加载历史
  // =====================================================

  useEffect(()=>{


    async function load(){


      const {
        data,
        error
      } =
      await supabase
      .from(
        "financial_freedom_history"
      )
      .select(
        "*"
      )
      .order(
        "snapshot_date",
        {
          ascending:true
        }
      );


      if(error){

        console.error(
          "Financial Freedom History error:",
          error
        );

      }


      setHistory(
        Array.isArray(data)
        ?
        data
        :
        []
      );


      setLoading(false);


    }


    load();


  },[]);





  // =====================================================
  // 金额格式
  // =====================================================

  function money(
    num:number
  ){

    return (
      "¥ " +
      Number(
        num || 0
      )
      .toLocaleString(
        "zh-CN",
        {
          maximumFractionDigits:0
        }
      )
    );

  }




  if(loading){

    return (

      <>
      
      <TopBar
        title="Financial Freedom History"
      />

      <main
        className="
        p-8
        "
      >

        Loading...

      </main>

      </>

    );

  }




  const latest =
    history.length > 0
    ?
    history[
      history.length - 1
    ]
    :
    null;



  return (

    <>


    <TopBar
      title="Financial Freedom History"
    />



    <main
      className="
      max-w-[1400px]
      mx-auto
      p-8
      space-y-8
      "
    >



      <div>


        <h1
          className="
          text-3xl
          font-bold
          "
        >

          📈 财务自由历史

        </h1>


        <p
          className="
          text-gray-500
          mt-2
          "
        >

          查看家庭净资产与财务自由目标变化

        </p>


      </div>





      {/* =================================================
          最新状态
      ================================================= */}


      {
        latest &&

        <section
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
            border
            rounded-2xl
            p-6
            shadow-sm
            "
          >

            <div
              className="
              text-gray-500
              text-sm
              "
            >

              当前家庭净资产

            </div>


            <div
              className="
              text-3xl
              font-bold
              mt-3
              text-green-700
              "
            >

              {
                money(
                  latest.total_asset
                )
              }

            </div>


          </div>




          <div
            className="
            bg-white
            border
            rounded-2xl
            p-6
            shadow-sm
            "
          >

            <div
              className="
              text-gray-500
              text-sm
              "
            >

              财务自由目标

            </div>


            <div
              className="
              text-3xl
              font-bold
              mt-3
              text-blue-700
              "
            >

              {
                money(
                  latest.freedom_target
                )
              }

            </div>


          </div>





          <div
            className="
            bg-white
            border
            rounded-2xl
            p-6
            shadow-sm
            "
          >

            <div
              className="
              text-gray-500
              text-sm
              "
            >

              财务自由完成率

            </div>


            <div
              className="
              text-3xl
              font-bold
              mt-3
              text-indigo-700
              "
            >

              {
                Number(
                  latest.freedom_rate || 0
                )
                .toFixed(1)
              }

              %

            </div>


          </div>



        </section>

      }






      {/* =================================================
          历史表
      ================================================= */}


      <section
        className="
        bg-white
        border
        rounded-2xl
        p-6
        shadow-sm
        overflow-auto
        "
      >


        <h2
          className="
          text-xl
          font-bold
          mb-5
          "
        >

          📊 历史记录

        </h2>



        <table
          className="
          w-full
          text-sm
          min-w-[900px]
          "
        >


          <thead>


          <tr
            className="
            border-b
            text-gray-500
            "
          >

            <th className="p-3 text-left">
              日期
            </th>


            <th className="p-3 text-right">
              家庭净资产
            </th>


            <th className="p-3 text-right">
              财务自由目标
            </th>


            <th className="p-3 text-right">
              缺口
            </th>


            <th className="p-3 text-right">
              完成率
            </th>


          </tr>


          </thead>



          <tbody>


          {
            history.map(
              (
                row:any
              )=>(


              <tr
                key={
                  row.snapshot_date
                }
                className="
                border-b
                hover:bg-gray-50
                "
              >


                <td
                  className="
                  p-3
                  "
                >

                  {
                    row.snapshot_date
                  }

                </td>



                <td
                  className="
                  p-3
                  text-right
                  "
                >

                  {
                    money(
                      row.total_asset
                    )
                  }

                </td>



                <td
                  className="
                  p-3
                  text-right
                  "
                >

                  {
                    money(
                      row.freedom_target
                    )
                  }

                </td>



                <td
                  className="
                  p-3
                  text-right
                  text-orange-600
                  "
                >

                  {
                    money(
                      row.freedom_gap
                    )
                  }

                </td>



                <td
                  className="
                  p-3
                  text-right
                  "
                >

                  {
                    Number(
                      row.freedom_rate || 0
                    )
                    .toFixed(1)
                  }

                  %

                </td>


              </tr>


              )
            )
          }


          </tbody>


        </table>


      </section>




    </main>


    </>

  );

}