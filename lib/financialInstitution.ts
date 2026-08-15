import { supabase } from "@/lib/supabase";

// =====================================================
// 金融机构类型
// =====================================================

export type FinancialInstitution = {
  id?: string;
  name: string;
  created_at?: string;
};


// =====================================================
// 获取全部金融机构
// =====================================================

export async function getFinancialInstitutions() {

  const {
    data,
    error,
  } = await supabase
    .from("financial_institutions")
    .select("*")
    .order("name", {
      ascending: true,
    });

  if (error) {

    console.error(
      "获取金融机构失败:",
      error
    );

    throw error;
  }

  return data || [];
}


// =====================================================
// 新增金融机构
// =====================================================

export async function addFinancialInstitution(
  name: string
) {

  const institutionName =
    name.trim();

  if (!institutionName) {
    throw new Error(
      "金融机构名称不能为空"
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("financial_institutions")
    .insert([
      {
        name: institutionName,
      },
    ])
    .select()
    .single();

  if (error) {

    console.error(
      "新增金融机构失败:",
      error
    );

    throw error;
  }

  return data;
}


// =====================================================
// 修改金融机构
// =====================================================

export async function updateFinancialInstitution(
  id: string,
  name: string
) {

  const institutionName =
    name.trim();

  if (!institutionName) {
    throw new Error(
      "金融机构名称不能为空"
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("financial_institutions")
    .update({
      name: institutionName,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {

    console.error(
      "修改金融机构失败:",
      error
    );

    throw error;
  }

  return data;
}


// =====================================================
// 删除金融机构
// =====================================================

export async function deleteFinancialInstitution(
  id: string
) {

  const {
    error,
  } = await supabase
    .from("financial_institutions")
    .delete()
    .eq("id", id);

  if (error) {

    console.error(
      "删除金融机构失败:",
      error
    );

    throw error;
  }

  return true;
}

