import { supabase } from "./supabase";


// =====================================================
// 类型
// =====================================================

export type FinancialFreedomHistory = {

  id?: number;

  snapshot_date: string;

  total_asset: number;

  freedom_target: number;

  freedom_gap: number;

  freedom_rate: number;

  created_at?: string;

};



// =====================================================
// 保存当天 Financial Freedom 快照
// =====================================================

export async function saveFinancialFreedomHistory(
  data: FinancialFreedomHistory
) : Promise<{
  success:boolean;
  error?:string;
}>  {

  console.log(
    "=== Financial Freedom Save Start ===",
    data
  );

  const {
    error,
  } = await supabase

    .from("financial_freedom_history")

    .upsert(
      {
        snapshot_date:
          data.snapshot_date,

        total_asset:
          data.total_asset,

        freedom_target:
          data.freedom_target,

        freedom_gap:
          data.freedom_gap,

        freedom_rate:
          data.freedom_rate,

      },
      {
        onConflict:
          "snapshot_date",
      }
    );


  if (error) {

    console.error(
      "saveFinancialFreedomHistory error:",
      error
    );

      throw error;


  }


  return {
  success:true,
  };

}



// =====================================================
// 获取 Financial Freedom 历史
// =====================================================

export async function getFinancialFreedomHistory() {


  const {
    data,
    error,
  } = await supabase

    .from("financial_freedom_history")

    .select("*")

    .order(
      "snapshot_date",
      {
        ascending:true,
      }
    );


  if (error) {

    console.error(
      "getFinancialFreedomHistory error:",
      error
    );

    return [];

  }


  return data ?? [];

}