"use client";

import { supabase } from "@/lib/supabase";

// =====================================================
// 类型
// =====================================================

export type FraisInvoiceRow = {
  id: string;
  file_name: string;
  file_path: string;
  file_hash: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: number | null;
  project_name: string | null;
  project_category: string | null;
  ocr_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type FraisProjectRule = {
  id: string;
  project_key: string;
  project_name: string;
  category: string | null;
  allowed: boolean;
  updated_at: string;
};

export type FraisUsedInvoice = {
  id: string;
  invoice_number: string | null;
  file_hash: string | null;
  invoice_date: string | null;
  amount: number | null;
  project_name: string | null;
  project_category: string | null;
  used_at: string;
  frais_pdf_name: string;
};

export type FraisInvoice = {
  id: string;
  file_name: string;
  file_path: string;
  file_hash: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  amount: number | null;
  project_name: string | null;
  project_category: string | null;
  ocr_text: string | null;
  status: string;
  created_at: string;
  updated_at: string;

  selected: boolean;

  // 前端显示
  file_url?: string | null;
};

// =====================================================
// Storage Bucket
//
// 如果你的 Bucket 不是 invoices，
// 只修改这里。
// =====================================================

export const FRAIS_STORAGE_BUCKET = "invoices";

// =====================================================
// 获取所有发票
// =====================================================

export async function getFraisInvoices(): Promise<FraisInvoiceRow[]> {
  const { data, error } = await supabase
    .from("frais_invoices")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "getFraisInvoices error:",
      error
    );

    throw new Error(
      `读取发票失败：${error.message}`
    );
  }

  return (data || []) as FraisInvoiceRow[];
}

// =====================================================
// 获取已经使用的发票
// =====================================================

export async function getFraisUsedInvoices(): Promise<FraisUsedInvoice[]> {
  const { data, error } = await supabase
    .from("frais_used_invoices")
    .select("*")
    .order("used_at", {
      ascending: false,
    });

  if (error) {
    console.error(
      "getFraisUsedInvoices error:",
      error
    );

    throw new Error(
      `读取已使用发票失败：${error.message}`
    );
  }

  return (data || []) as FraisUsedInvoice[];
}

// =====================================================
// 获取项目规则
// =====================================================

export async function getFraisProjectRules(): Promise<FraisProjectRule[]> {
  const { data, error } = await supabase
    .from("frais_project_rules")
    .select("*")
    .order("project_name", {
      ascending: true,
    });

  if (error) {
    console.error(
      "getFraisProjectRules error:",
      error
    );

    throw new Error(
      `读取项目规则失败：${error.message}`
    );
  }

  return (data || []) as FraisProjectRule[];
}

// =====================================================
// 判断是否已经使用
//
// 优先：invoice_number
// 其次：file_hash
// =====================================================

export function isFraisInvoiceUsed(
  invoice: FraisInvoiceRow,
  usedInvoices: FraisUsedInvoice[]
): boolean {
  if (
    invoice.invoice_number &&
    invoice.invoice_number.trim()
  ) {
    const number =
      invoice.invoice_number.trim();

    return usedInvoices.some(
      (used) =>
        used.invoice_number &&
        used.invoice_number.trim() === number
    );
  }

  if (
    invoice.file_hash &&
    invoice.file_hash.trim()
  ) {
    const hash =
      invoice.file_hash.trim();

    return usedInvoices.some(
      (used) =>
        used.file_hash &&
        used.file_hash.trim() === hash
    );
  }

  return false;
}

// =====================================================
// 项目是否允许
// =====================================================

export function isFraisProjectAllowed(
  invoice: FraisInvoiceRow,
  rules: FraisProjectRule[]
): boolean {
  // 没有项目名称
  // 暂时保留，避免 OCR 数据消失
  if (
    !invoice.project_name ||
    !invoice.project_name.trim()
  ) {
    return true;
  }

  const projectName =
    invoice.project_name.trim();

  // 精确项目名称
  const exactRule =
    rules.find(
      (rule) =>
        rule.project_name.trim() ===
        projectName
    );

  if (exactRule) {
    return exactRule.allowed;
  }

  // project_key
  const projectKey =
    projectName
      .toLowerCase()
      .replace(/\s+/g, "");

  const keyRule =
    rules.find(
      (rule) =>
        rule.project_key
          ?.toLowerCase()
          .replace(/\s+/g, "") ===
        projectKey
    );

  if (keyRule) {
    return keyRule.allowed;
  }

  // 如果没有规则，默认允许
  return true;
}

// =====================================================
// 转换成前端 Invoice
// =====================================================

export function convertFraisInvoice(
  invoice: FraisInvoiceRow
): FraisInvoice {
  return {
    ...invoice,
    selected: false,
    file_url: null,
  };
}

// =====================================================
// 获取 Storage 临时 URL
//
// file_path 可以是：
// 1. 完整 http URL
// 2. Storage path
// =====================================================

export async function getFraisFileUrl(
  filePath: string
): Promise<string | null> {
  if (!filePath) {
    return null;
  }

  if (
    filePath.startsWith("http://") ||
    filePath.startsWith("https://")
  ) {
    return filePath;
  }

  const {
    data,
    error,
  } = await supabase.storage
    .from(FRAIS_STORAGE_BUCKET)
    .createSignedUrl(
      filePath,
      60 * 60
    );

  if (error) {
    console.error(
      "createSignedUrl error:",
      error
    );

    return null;
  }

  return data?.signedUrl || null;
}

// =====================================================
// 保存项目规则
// =====================================================

export async function updateFraisProjectRule(
  id: string,
  allowed: boolean
) {
  const { error } =
    await supabase
      .from("frais_project_rules")
      .update({
        allowed,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id);

  if (error) {
    console.error(
      "updateFraisProjectRule error:",
      error
    );

    throw new Error(
      `保存项目规则失败：${error.message}`
    );
  }
}

// =====================================================
// 记录已使用发票
// =====================================================

export async function markFraisInvoicesUsed(
  invoices: FraisInvoice[],
  pdfName: string
) {
  const rows =
    invoices.map((invoice) => ({
      invoice_number:
        invoice.invoice_number || null,

      file_hash:
        invoice.file_hash || null,

      invoice_date:
        invoice.invoice_date || null,

      amount:
        invoice.amount ?? null,

      project_name:
        invoice.project_name || null,

      project_category:
        invoice.project_category || null,

      used_at:
        new Date().toISOString(),

      frais_pdf_name:
        pdfName,
    }));

  if (rows.length === 0) {
    return;
  }

  const { error } =
    await supabase
      .from("frais_used_invoices")
      .insert(rows);

  if (error) {
    console.error(
      "markFraisInvoicesUsed error:",
      error
    );

    throw new Error(
      `记录已使用发票失败：${error.message}`
    );
  }
}

// =====================================================
// PDF 历史
// =====================================================

export async function saveFraisPdfHistory(params: {
  pdfName: string;
  year: number;
  month: number;
  targetAmount: number;
  actualAmount: number;
  difference: number;
  invoiceCount: number;
  mode?: string;
}) {
  const { error } =
    await supabase
      .from("frais_pdf_history")
      .insert({
        pdf_name:
          params.pdfName,

        year:
          params.year,

        month:
          params.month,

        target_amount:
          params.targetAmount,

        actual_amount:
          params.actualAmount,

        difference:
          params.difference,

        invoice_count:
          params.invoiceCount,

        mode:
          params.mode || "manual",

        created_at:
          new Date().toISOString(),
      });

  if (error) {
    console.error(
      "saveFraisPdfHistory error:",
      error
    );

    throw new Error(
      `保存 PDF 历史失败：${error.message}`
    );
  }
}