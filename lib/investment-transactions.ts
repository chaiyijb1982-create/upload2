import { supabase } from "./supabase";

// =====================================================
// 类型
// =====================================================

export type InvestmentTransactionType =
  | "BUY"
  | "SELL";


export type InvestmentTransaction = {

  id: string;

  transaction_date: string;

  transaction_type:
    InvestmentTransactionType;

  asset_code: string;

  asset_name: string;

  market: string;

  currency: string;

  trade_amount: number;

  trade_price: number;

  shares: number;

  fee: number;

  fx_rate: number | null;

  trade_value_cny: number;

  cost_basis_cny: number;

  cash_asset_code:
    string | null;

  platform: string;

  remark: string | null;

  created_at: string;

  scenario: "HOLDING" | "NEW";

  category:   | "fixed_income"| "global_stock"| "china_stock"| "gold"| null;
  
};


// =====================================================
// 获取交易记录
// =====================================================

export async function
getInvestmentTransactions() {

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "investment_transactions"
      )
      .select("*")
      .order(
        "transaction_date",
        {
          ascending: false,
        }
      )
      .order(
        "created_at",
        {
          ascending: false,
        }
      );


  if (error) {

    console.error(
      "getInvestmentTransactions error:",
      error
    );

    throw error;
  }


  return (
    data ??
    []
  ) as InvestmentTransaction[];
}


// =====================================================
// 删除交易
//
// 暂时不允许页面调用。
// 因为真正接入 Holdings 后，
// 删除交易必须同时回滚 Holdings。
// =====================================================

export async function
deleteInvestmentTransaction(
  id: string
) {

  const {
    error,
  } =
    await supabase
      .from(
        "investment_transactions"
      )
      .delete()
      .eq(
        "id",
        id
      );


  if (error) {

    console.error(
      "deleteInvestmentTransaction error:",
      error
    );

    throw error;
  }
}