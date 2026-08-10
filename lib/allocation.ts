// =====================================
// AI Wealth OS
// 目标资产配置
// =====================================


export const targetAllocation = {


  fixed_income: {

    name: "固定收益（债券+现金）",

    target: 45

  },


  global_stock: {

    name: "全球股票（美国为主）",

    target: 30

  },


  china_stock: {

    name: "中国股票",

    target: 10

  },


  gold: {

    name: "黄金",

    target: 15

  }


};





// =====================================
// 计算当前配置比例
// =====================================


export function calculateAllocation(

  assets:any

){


  const total =
    assets.fixed_income
    +
    assets.global_stock
    +
    assets.china_stock
    +
    assets.gold;



  return {


    fixed_income:

      assets.fixed_income
      /
      total
      *
      100,



    global_stock:

      assets.global_stock
      /
      total
      *
      100,



    china_stock:

      assets.china_stock
      /
      total
      *
      100,



    gold:

      assets.gold
      /
      total
      *
      100


  };


}