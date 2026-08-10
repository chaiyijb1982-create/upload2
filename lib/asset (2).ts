import { supabase } from "./supabase";



// =====================================
// 获取最新资产
// =====================================

export async function getLatestAsset() {


  console.log(
    "开始读取最新资产..."
  );


  const {

    data,

    error


  } = await supabase


    .from("asset_history")


    .select("*")


    .order(

      "id",

      {
        ascending:false
      }

    )


    .limit(1);




  console.log(
    "最新资产:",
    data
  );


  console.log(
    "资产错误:",
    error
  );




  if(error){

    console.log(error);

    return null;

  }



  return data?.[0] ?? null;


}









// =====================================
// 获取财富历史曲线
// =====================================

export async function getAssetHistory(){



  console.log(
    "开始读取财富历史..."
  );



  const {

    data,

    error


  } = await supabase



    .from("asset_history")



    .select("*")



    .order(

      "snapshot_date",

      {

        ascending:true

      }

    );





  console.log(
    "财富历史:",
    data
  );



  console.log(
    "历史错误:",
    error
  );





  if(error){


    console.log(error);


    return [];


  }



  return data ?? [];

}









// =====================================
// 获取全部持仓
// =====================================

export async function getHoldings(){



  console.log(
    "开始读取 holdings..."
  );




  const {

    data,

    error


  } = await supabase



    .from("holdings")



    .select("*")



    .order(

      "amount",

      {

        ascending:false

      }

    );





  console.log(
    "HOLDINGS DATA:",
    data
  );



  console.log(
    "HOLDINGS ERROR:",
    error
  );





  if(error){


    console.log(error);


    return [];


  }




  return data ?? [];


}









// =====================================
// 计算真实资产配置比例
// =====================================

export async function getHoldingsAllocation(){



  console.log(
    "开始计算资产配置..."
  );



  const {

    data,

    error


  } = await supabase



    .from("holdings")



    .select("*");






  console.log(
    "配置原始数据:",
    data
  );






  if(error){


    console.log(error);


    return null;


  }







  const result:any = {



    fixed_income:0,


    global_stock:0,


    china_stock:0,


    gold:0



  };









  data.forEach((item:any)=>{


    const category =
      item.category;



    if(

      result[category]

      !== undefined

    ){



      result[category]

      +=

      Number(item.amount);



    }



  });









  const total =



    Object.values(result)


    .reduce(

      (

        sum:any,

        value:any

      ) =>

        sum + value,


      0

    );









  console.log(
    "分类金额:",
    result
  );


  console.log(
    "总金额:",
    total
  );








  if(total===0){


    return null;


  }









  return {



    fixed_income:

      Number(

        (

          result.fixed_income

          /

          total

          *

          100


        )

        .toFixed(2)

      ),







    global_stock:

      Number(

        (

          result.global_stock

          /

          total

          *

          100


        )

        .toFixed(2)

      ),







    china_stock:

      Number(

        (

          result.china_stock

          /

          total

          *

          100


        )

        .toFixed(2)

      ),







    gold:

      Number(

        (

          result.gold

          /

          total

          *

          100


        )

        .toFixed(2)

      ),








    total_amount:

      total



  };


}