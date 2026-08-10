import { supabase } from "./supabase";


// =====================================
// 类型
// =====================================

export type AssetHistory = {

  id?: number;

  snapshot_date?: string;

  total_asset?: number;

  total_wealth?: number;

  mainland_asset?: number;

  hk_asset?: number;

  usd_cny?: number;

  [key:string]: any;

};



export type Holding = {

  id?: string;

  name?: string;

  code?: string;

  category?: string;

  amount?: number;

  market_value?: number;

  quantity?: number;

  price?: number;

  [key:string]: any;

};



export type FixedIncomeAsset = {

  id:string;

  type:string;

  name:string;

  institution?:string|null;

  amount:number;

  interest_rate?:number|null;

  auto_interest?:boolean;

  interest_date?:string|null;

  updated_at?:string|null;

  note?:string|null;

  created_at?:string|null;

  [key:string]:any;

};



// =====================================
// 工具
// =====================================

function toNumber(
  value:any
):number {

  const n =
    Number(value);


  return Number.isFinite(n)
    ?
    n
    :
    0;

}



// =====================================
// 获取最新资产
//
// Dashboard 使用
//
// 注意：
// 不在这里加固收
//
// 不在这里加保险
//
// 保持原始资产快照
// =====================================

export async function getLatestAsset()
:Promise<AssetHistory|null>{


  console.log(
    "开始读取最新资产..."
  );


  const {

    data,

    error

  } = await supabase

    .from(
      "asset_history"
    )

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


  if(error){

    console.error(
      "getLatestAsset error:",
      error
    );


    return null;

  }



  return (
    data?.[0]
    ??
    null
  );

}



// =====================================
// 财富历史
// =====================================

export async function getAssetHistory()
:Promise<AssetHistory[]> {


  const {

    data,

    error

  } = await supabase

    .from(
      "asset_history"
    )

    .select("*")

    .order(
      "snapshot_date",
      {
        ascending:true
      }
    );



  if(error){

    console.error(
      "getAssetHistory error:",
      error
    );


    return [];

  }



  return data ?? [];

}



// =====================================
// 获取全部持仓
// =====================================

export async function getHoldings()
:Promise<Holding[]> {


  const {

    data,

    error

  } = await supabase

    .from(
      "holdings"
    )

    .select("*")

    .order(
      "amount",
      {
        ascending:false
      }
    );



  if(error){

    console.error(
      "getHoldings error:",
      error
    );


    return [];

  }



  return data ?? [];

}



// =====================================
// 获取固收资产
//
// 来源:
// fixed_income_assets
//
// Financial Freedom 使用
//
// Dashboard 不直接调用
// =====================================

export async function getFixedIncomeAssets()
:Promise<FixedIncomeAsset[]> {


  console.log(
    "读取固收资产..."
  );


  const {

    data,

    error

  } = await supabase

    .from(
      "fixed_income_assets"
    )

    .select("*")

    .order(
      "created_at",
      {
        ascending:false
      }
    );



  console.log(
    "固定收益:",
    data
  );



  if(error){

    console.error(
      "getFixedIncomeAssets error:",
      error
    );


    return [];

  }



  return data ?? [];

}



// =====================================
// 固收总额
//
// 返回:
// fixed_income_assets.amount 合计
// =====================================

export async function getFixedIncomeTotal()
:Promise<number>{


  const assets =
    await getFixedIncomeAssets();



  const total =
    assets.reduce(
      (
        sum,
        item
      )=>{


        return (
          sum
          +
          toNumber(
            item.amount
          )
        );


      },
      0
    );



  console.log(
    "固收总额:",
    total
  );


  return total;

}
 
// =====================================
// 获取资产配置比例
//
// 注意：
// holdings 本身分类
//
// 固收资产 fixed_income_assets
// 不参与这里计算
//
// 防止 Dashboard / Allocation 重复
// =====================================

export async function getHoldingsAllocation() {


  console.log(
    "开始计算资产配置..."
  );


  const {

    data,

    error

  } = await supabase

    .from(
      "holdings"
    )

    .select("*");



  if(error){

    console.error(
      "getHoldingsAllocation error:",
      error
    );


    return null;

  }



  const result = {

    fixed_income:0,

    global_stock:0,

    china_stock:0,

    gold:0

  };



  (data ?? [])
    .forEach(
      (
        item:any
      )=>{


        const category =
          item.category;



        if(
          category &&
          result[
            category as keyof typeof result
          ] !== undefined
        ){

          result[
            category as keyof typeof result
          ]
          +=
          toNumber(
            item.amount
          );

        }


      }
    );



  const total =
    Object.values(result)
      .reduce(
        (
          sum,
          value
        )=>
          sum + value,
        0
      );



  if(
    total === 0
  ){

    return null;

  }



  return {

    fixed_income:
      Number(
        (
          result.fixed_income /
          total *
          100
        )
        .toFixed(2)
      ),


    global_stock:
      Number(
        (
          result.global_stock /
          total *
          100
        )
        .toFixed(2)
      ),


    china_stock:
      Number(
        (
          result.china_stock /
          total *
          100
        )
        .toFixed(2)
      ),


    gold:
      Number(
        (
          result.gold /
          total *
          100
        )
        .toFixed(2)
      ),



    total_amount:
      total


  };


}



// =====================================
// Dashboard Total Wealth
//
// 给 Dashboard 使用
//
// 只返回:
// asset_history.total_asset
//
// 不加固收
// 不加保险
//
// 保持你的原系统稳定
// =====================================

export async function getDashboardTotalWealth()
:Promise<number>{


  const asset =
    await getLatestAsset();



  if(!asset){

    return 0;

  }



  return toNumber(
    asset.total_asset
  );


}



// =====================================
// 家庭真实总资产
//
// Financial Freedom 使用
//
// = Dashboard资产
// + 固收资产
//
// 注意:
// 保险不在这里加入
//
// 保险由 insurance.ts 单独管理
// =====================================

export async function getTotalWealthWithFixedIncome()
:Promise<number>{


  const [

    asset,

    fixedIncome

  ] =
  await Promise.all([

    getLatestAsset(),

    getFixedIncomeTotal()

  ]);



  const baseAsset =
    toNumber(
      asset?.total_asset
    );



  return (

    baseAsset

    +

    fixedIncome

  );


}



// =====================================
// 返回详细家庭资产组成
//
// 给 Financial Freedom 展示：
//
// 当前资产
// Dashboard资产
// 固收资产
//
// =====================================

export async function getWealthBreakdown(){


  const [

    asset,

    fixedIncome

  ] =
  await Promise.all([


    getLatestAsset(),


    getFixedIncomeTotal()


  ]);



  const dashboardAsset =
    toNumber(
      asset?.total_asset
    );



  return {


    dashboardAsset,


    fixedIncome,


    total:


      dashboardAsset

      +

      fixedIncome



  };


}