// =====================================================
// lib/frais.ts
//
// FRAIS 发票模块
//
// 功能：
// 1. 读取 frais_invoices
// 2. 获取 Supabase Storage 发票 URL
// 3. OCR 原文金额解析
// 4. 更新 OCR 结果
// 5. 隐藏 / 恢复发票
// 6. 删除发票及 Storage 文件
// 7. 自动寻找最接近目标金额的发票组合
// 8. 生成发票 PDF 所需的文件数据
// 9. 写入 frais_used_invoices
//
// 不使用 OpenAI
// 不使用 tesseract.js
// =====================================================

import { supabase } from "@/lib/supabase";

// =====================================================
// 常量
// =====================================================

export const FRAIS_STORAGE_BUCKET =
  "frais-invoices";

export const FRAIS_INVOICE_TABLE =
  "frais_invoices";

export const FRAIS_USED_TABLE =
  "frais_used_invoices";

export const DEFAULT_TARGET_AMOUNT =
  4590;

// =====================================================
// 类型
// =====================================================

export type FraisInvoice = {
  id: string;

  file_name:
    | string
    | null;

  file_path:
    | string
    | null;

  file_hash:
    | string
    | null;

  status:
    | string
    | null;

  invoice_number:
    | string
    | null;

  project_name:
    | string
    | null;

  amount:
    | number
    | null;

  invoice_date:
    | string
    | null;

  ocr_text:
    | string
    | null;

  ocr_status:
    | string
    | null;

  ocr_error:
    | string
    | null;

  ocr_updated_at:
    | string
    | null;

  hidden:
    | boolean
    | null;

  is_hidden:
    | boolean
    | null;

  created_at:
    | string
    | null;

  updated_at:
    | string
    | null;

  [key: string]: any;
};


export type FraisOCRResult = {
  invoice_number:
    | string
    | null;

  project_name:
    | string
    | null;

  amount:
    | number
    | null;

  invoice_date:
    | string
    | null;

  ocr_text:
    | string
    | null;
};


export type FraisCombinationResult = {
  invoices:
    FraisInvoice[];

  total:
    number;

  target:
    number;

  difference:
    number;

  exact:
    boolean;
};


// =====================================================
// 工具：数字
// =====================================================

export function normalizeAmount(
  value: unknown
): number | null {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  if (
    typeof value === "number"
  ) {
    if (
      Number.isFinite(value)
    ) {
      return Math.round(
        value * 100
      ) / 100;
    }

    return null;
  }

  let text =
    String(value)
      .trim();

  if (!text) {
    return null;
  }

  text =
    text
      .replace(
        /人民币/g,
        ""
      )
      .replace(
        /元/g,
        ""
      )
      .replace(
        /￥/g,
        ""
      )
      .replace(
        /¥/g,
        ""
      )
      .replace(
        /,/g,
        ""
      )
      .trim();

  const matches =
    text.match(
      /-?\d+(?:\.\d{1,2})?/
    );

  if (!matches) {
    return null;
  }

  const number =
    Number(
      matches[0]
    );

  if (
    !Number.isFinite(number)
  ) {
    return null;
  }

  return Math.round(
    number * 100
  ) / 100;
}


// =====================================================
// 工具：字符串
// =====================================================

export function normalizeString(
  value: unknown
): string | null {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value)
      .replace(
        /\r/g,
        ""
      )
      .trim();

  return text
    ? text
    : null;
}


// =====================================================
// 工具：日期
// =====================================================

function normalizeDate(
  value: unknown
): string | null {

  const text =
    normalizeString(
      value
    );

  if (!text) {
    return null;
  }

  let result =
    text
      .replace(
        /年/g,
        "-"
      )
      .replace(
        /月/g,
        "-"
      )
      .replace(
        /日/g,
        ""
      )
      .replace(
        /\//g,
        "-"
      )
      .trim();

  const match =
    result.match(
      /(\d{4})-(\d{1,2})-(\d{1,2})/
    );

  if (!match) {
    return result;
  }

  const year =
    match[1];

  const month =
    match[2].padStart(
      2,
      "0"
    );

  const day =
    match[3].padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}


// =====================================================
// OCR 原文解析
//
// 重点：
//
// 金额：
// 找「（小写）」
// 「(小写)」
// 「小写」
// 后面的金额
//
// 项目：
// 找「项目名称」
// 然后跳过表头：
// 规格型号 / 单位 / 数量 / 单价 / 金额...
// 找下面真正项目内容
//
// 发票号码：
// 找「发票号码」后面的数字
//
// 日期：
// 找「开票日期」后面的日期
// =====================================================

export function parseFraisOCR(
  ocrText: string
): FraisOCRResult {

  const original =
    String(
      ocrText || ""
    );

  if (!original.trim()) {
    return {
      invoice_number: null,
      project_name: null,
      amount: null,
      invoice_date: null,
      ocr_text: original,
    };
  }

  const normalized =
    original
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      );

  const lines =
    normalized
      .split("\n")
      .map(
        line =>
          line
            .replace(
              /\u00a0/g,
              " "
            )
            .trim()
      )
      .filter(
        line =>
          line.length > 0
      );


  // ===================================================
  // 发票号码
  // ===================================================

  let invoiceNumber:
    string | null =
      null;

  const invoiceNumberPatterns = [
    /发票号码\s*[:：]?\s*([0-9]{6,20})/,
    /发票\s*号码\s*[:：]?\s*([0-9]{6,20})/,
    /号码\s*[:：]\s*([0-9]{6,20})/,
  ];

  for (
    const pattern of
      invoiceNumberPatterns
  ) {
    const match =
      normalized.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      invoiceNumber =
        match[1];

      break;
    }
  }


  // ===================================================
  // 日期
  // ===================================================

  let invoiceDate:
    string | null =
      null;

  const datePatterns = [
    /开票日期\s*[:：]?\s*(\d{4}[年\/-]\d{1,2}[月\/-]\d{1,2}日?)/,
    /开票日期\s*[:：]?\s*(\d{4}\.\d{1,2}\.\d{1,2})/,
    /开票日期\s*[:：]?\s*(\d{4}\s*年\s*\d{1,2}\s*月\s*\d{1,2}\s*日)/,
  ];

  for (
    const pattern of
      datePatterns
  ) {
    const match =
      normalized.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      invoiceDate =
        normalizeDate(
          match[1]
        );

      break;
    }
  }


  // ===================================================
  // 金额
  //
  // 第一优先级：
  // 「（小写）」之后
  //
  // 同时兼容 OCR：
  // （小写）
  // (小写)
  // (小写金额)
  // 小写
  // ===================================================

  let amount:
    number | null =
      null;


  const amountPatterns = [
    /[（(]\s*小写\s*[)）]\s*[:：]?\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,

    /[（(]\s*小写金额\s*[)）]\s*[:：]?\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,

    /小写\s*[:：]?\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,

    /价税合计\s*[（(]\s*小写\s*[)）]\s*[:：]?\s*[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,

    /价税合计.*?[¥￥]\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i,
  ];


  for (
    const pattern of
      amountPatterns
  ) {
    const match =
      normalized.match(
        pattern
      );

    if (
      match?.[1]
    ) {
      amount =
        normalizeAmount(
          match[1]
        );

      if (
        amount !== null
      ) {
        break;
      }
    }
  }


  // ===================================================
  // 如果 OCR 把「小写」和数字分成两行
  // ===================================================

  if (
    amount === null
  ) {

    for (
      let i = 0;
      i < lines.length;
      i++
    ) {

      if (
        /小写/.test(
          lines[i]
        )
      ) {

        const sameLine =
          lines[i].match(
            /小写.*?[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/
          );

        if (
          sameLine?.[1]
        ) {
          amount =
            normalizeAmount(
              sameLine[1]
            );

          break;
        }


        for (
          let j = i + 1;
          j <
            Math.min(
              lines.length,
              i + 4
            );
          j++
        ) {

          const nextMatch =
            lines[j].match(
              /^[¥￥]?\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)\s*$/
            );

          if (
            nextMatch?.[1]
          ) {

            amount =
              normalizeAmount(
                nextMatch[1]
              );

            break;
          }
        }

        if (
          amount !== null
        ) {
          break;
        }
      }
    }
  }


  // ===================================================
  // 项目名称
  //
  // 保持现在已经有效的逻辑：
  // 「项目名称」下面找真正项目内容。
  //
  // 跳过：
  // 规格型号
  // 单位
  // 数量
  // 单价
  // 金额
  // 税率
  // 征收率
  // 税额
  // ===================================================

  let projectName:
    string | null =
      null;

  const projectIndex =
    lines.findIndex(
      line =>
        /项目名称/.test(
          line
        )
    );

  const headerWords =
    [
      "项目名称",
      "规格型号",
      "规格",
      "型号",
      "单位",
      "数量",
      "单价",
      "金额",
      "税率",
      "征收率",
      "税额",
      "合计",
      "价税合计",
    ];


  if (
    projectIndex >= 0
  ) {

    const current =
      lines[
        projectIndex
      ];

    const sameLine =
      current.match(
        /项目名称\s*[:：]?\s*(.+)$/ 
      );

    if (
      sameLine?.[1] &&
      !headerWords.some(
        word =>
          sameLine[1]
            .includes(word)
      )
    ) {
      projectName =
        sameLine[1]
          .trim();
    }


    if (
      !projectName
    ) {

      for (
        let i =
          projectIndex + 1;

        i <
          Math.min(
            lines.length,
            projectIndex + 8
          );

        i++
      ) {

        const candidate =
          lines[i]
            .trim();

        if (!candidate) {
          continue;
        }

        if (
          headerWords.some(
            word =>
              candidate ===
                word ||
              candidate.includes(
                "规格型号"
              ) ||
              candidate.includes(
                "税率/征收率"
              )
          )
        ) {
          continue;
        }

        if (
          /^[-—_]+$/.test(
            candidate
          )
        ) {
          continue;
        }

        if (
          /^¥?\s*\d[\d,.]*$/.test(
            candidate
          )
        ) {
          continue;
        }

        if (
          /发票号码|开票日期|购买方|销售方|统一社会信用代码/.test(
            candidate
          )
        ) {
          continue;
        }

        projectName =
          candidate;

        break;
      }
    }
  }


  return {
    invoice_number:
      invoiceNumber,

    project_name:
      projectName,

    amount,

    invoice_date:
      invoiceDate,

    ocr_text:
      original,
  };
}


// =====================================================
// 获取全部发票
// =====================================================

export async function getFraisInvoices():
  Promise<FraisInvoice[]> {

  const {
    data,
    error,
  } =
    await supabase
      .from(
        FRAIS_INVOICE_TABLE
      )
      .select("*")
      .order(
        "created_at",
        {
          ascending: false,
        }
      );

  if (error) {
    throw new Error(
      `读取发票失败：${error.message}`
    );
  }

  return (
    data || []
  ) as FraisInvoice[];
}


// =====================================================
// Storage URL
// =====================================================

export async function getFraisFileUrl(
  filePath: string
): Promise<string> {

  if (!filePath) {
    throw new Error(
      "发票没有 file_path"
    );
  }

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(
        FRAIS_STORAGE_BUCKET
      )
      .createSignedUrl(
        filePath,
        60 * 60
      );

  if (error) {
    throw new Error(
      `Storage URL 创建失败：${error.message}`
    );
  }

  if (!data?.signedUrl) {
    throw new Error(
      "Storage 没有返回 signed URL"
    );
  }

  return data.signedUrl;
}


// =====================================================
// 更新 OCR
// =====================================================

export async function updateFraisInvoiceOCR(
  invoiceId: string,
  payload: Partial<FraisInvoice>
): Promise<FraisInvoice> {

  const {
    data,
    error,
  } =
    await supabase
      .from(
        FRAIS_INVOICE_TABLE
      )
      .update({
        ...payload,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        invoiceId
      )
      .select("*")
      .single();

  if (error) {
    throw new Error(
      `保存 OCR 结果失败：${error.message}`
    );
  }

  return data as FraisInvoice;
}


// =====================================================
// 设置隐藏
//
// 兼容 hidden / is_hidden 两种字段。
// 实际存在哪个字段，由数据库决定。
//
// 如果数据库已经建立 hidden，使用 hidden。
// =====================================================

export async function setFraisInvoiceHidden(
  invoiceId: string,
  hidden: boolean
): Promise<FraisInvoice> {

  const {
    data,
    error,
  } =
    await supabase
      .from(
        FRAIS_INVOICE_TABLE
      )
      .update({
        hidden,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        invoiceId
      )
      .select("*")
      .single();

  if (error) {
    throw new Error(
      `设置发票隐藏状态失败：${error.message}`
    );
  }

  return data as FraisInvoice;
}


// =====================================================
// 判断是否隐藏
// =====================================================

export function isFraisInvoiceHidden(
  invoice: FraisInvoice
): boolean {

  return (
    invoice.hidden === true ||
    invoice.is_hidden === true
  );
}


// =====================================================
// 自动寻找最接近目标金额的组合
//
// 只考虑：
// - 未隐藏
// - status !== used
// - amount > 0
//
// 使用动态规划。
// 金额以分为单位，避免浮点误差。
//
// 优先：
// 1. 与目标差值最小
// 2. 差值相同时，发票张数少
// =====================================================

export function findClosestFraisCombination(
  invoices: FraisInvoice[],
  targetAmount:
    number = DEFAULT_TARGET_AMOUNT
): FraisCombinationResult {

  const targetCents =
    Math.round(
      targetAmount * 100
    );

  const candidates =
    invoices
      .filter(
        invoice =>
          !isFraisInvoiceHidden(
            invoice
          )
      )
      .filter(
        invoice =>
          invoice.status !==
          "used"
      )
      .filter(
        invoice =>
          invoice.status !==
          "tested"
      )
      .filter(
        invoice =>
          Number.isFinite(
            Number(
              invoice.amount
            )
          )
      )
      .filter(
        invoice =>
          Number(
            invoice.amount
          ) > 0
      )
      .map(
        invoice => ({
          invoice,
          cents:
            Math.round(
              Number(
                invoice.amount
              ) * 100
            ),
        })
      )
      .filter(
        item =>
          item.cents > 0
      );


  if (
    candidates.length === 0
  ) {
    return {
      invoices: [],
      total: 0,
      target:
        targetAmount,
      difference:
        Math.abs(
          targetAmount
        ),
      exact: false,
    };
  }


  // ---------------------------------------------------
  // 动态规划
  //
  // dp[sum] = 选中的候选索引
  //
  // 为避免极端情况下浏览器占用过多，
  // 对搜索范围设置合理上限。
  //
  // 目标附近的组合最重要。
  // ---------------------------------------------------

  const maxSingle =
    Math.max(
      ...candidates.map(
        item =>
          item.cents
      )
    );

  const limit =
    Math.max(
      targetCents +
        maxSingle,
      targetCents * 2
    );


  const dp =
    new Map<
      number,
      number[]
    >();

  dp.set(
    0,
    []
  );


  for (
    let i = 0;
    i <
      candidates.length;
    i++
  ) {

    const item =
      candidates[i];

    const currentEntries =
      Array.from(
        dp.entries()
      );


    for (
      const [
        sum,
        indexes,
      ] of currentEntries
    ) {

      const newSum =
        sum +
        item.cents;

      if (
        newSum >
        limit
      ) {
        continue;
      }


      const existing =
        dp.get(
          newSum
        );


      const newIndexes =
        [
          ...indexes,
          i,
        ];


      if (
        !existing ||
        newIndexes.length <
          existing.length
      ) {

        dp.set(
          newSum,
          newIndexes
        );
      }
    }
  }


  // ---------------------------------------------------
  // 找最佳
  // ---------------------------------------------------

  let bestSum =
    0;

  let bestIndexes:
    number[] =
      [];

  let bestDifference =
    Math.abs(
      targetCents
    );


  for (
    const [
      sum,
      indexes,
    ] of dp.entries()
  ) {

    const difference =
      Math.abs(
        targetCents -
          sum
      );


    if (
      difference <
      bestDifference
    ) {

      bestDifference =
        difference;

      bestSum =
        sum;

      bestIndexes =
        indexes;

    } else if (
      difference ===
      bestDifference
    ) {

      if (
        indexes.length <
        bestIndexes.length
      ) {

        bestSum =
          sum;

        bestIndexes =
          indexes;
      }
    }
  }


  const selected =
    bestIndexes.map(
      index =>
        candidates[index]
          .invoice
    );


  const total =
    bestSum / 100;


  return {
    invoices:
      selected,

    total,

    target:
      targetAmount,

    difference:
      Math.round(
        Math.abs(
          total -
            targetAmount
        ) * 100
      ) / 100,

    exact:
      total ===
      targetAmount,
  };
}


// =====================================================
// 获取可选择发票
// =====================================================

export function getSelectableFraisInvoices(
  invoices: FraisInvoice[]
): FraisInvoice[] {

  return invoices.filter(
    invoice =>
      !isFraisInvoiceHidden(
        invoice
      ) &&
      invoice.status !==
        "used" &&
      invoice.status !==
        "tested" &&
      Number.isFinite(
        Number(
          invoice.amount
        )
      ) &&
      Number(
        invoice.amount
      ) > 0
  );
}


// =====================================================
// 下载 Storage 文件
//
// 用于生成 PDF。
// =====================================================

export async function downloadFraisFile(
  filePath: string
): Promise<Blob> {

  const {
    data,
    error,
  } =
    await supabase.storage
      .from(
        FRAIS_STORAGE_BUCKET
      )
      .download(
        filePath
      );

  if (
    error ||
    !data
  ) {
    throw new Error(
      `下载发票文件失败：${
        error?.message ||
        "没有文件"
      }`
    );
  }

  return data;
}


// =====================================================
// Blob → Data URL
// =====================================================

export function blobToDataUrl(
  blob: Blob
): Promise<string> {

  return new Promise(
    (
      resolve,
      reject
    ) => {

      const reader =
        new FileReader();

      reader.onload =
        () => {

          if (
            typeof reader.result ===
            "string"
          ) {
            resolve(
              reader.result
            );
          } else {
            reject(
              new Error(
                "文件转换失败"
              )
            );
          }
        };

      reader.onerror =
        () =>
          reject(
            new Error(
              "读取文件失败"
            )
          );

      reader.readAsDataURL(
        blob
      );
    }
  );
}


// =====================================================
// 图片转 JPEG
//
// PDF 统一使用 JPEG。
// =====================================================

export async function blobToJpegData(
  blob: Blob
): Promise<{
  dataUrl: string;
  width: number;
  height: number;
}> {

  const objectUrl =
    URL.createObjectURL(
      blob
    );

  try {

    const image =
      await new Promise<HTMLImageElement>(
        (
          resolve,
          reject
        ) => {

          const img =
            new Image();

          img.onload =
            () =>
              resolve(
                img
              );

          img.onerror =
            () =>
              reject(
                new Error(
                  "图片读取失败"
                )
              );

          img.src =
            objectUrl;
        }
      );


    const canvas =
      document.createElement(
        "canvas"
      );

    canvas.width =
      image.naturalWidth;

    canvas.height =
      image.naturalHeight;


    const ctx =
      canvas.getContext(
        "2d"
      );

    if (!ctx) {
      throw new Error(
        "无法创建 Canvas"
      );
    }


    ctx.fillStyle =
      "#ffffff";

    ctx.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    ctx.drawImage(
      image,
      0,
      0
    );


    const dataUrl =
      canvas.toDataURL(
        "image/jpeg",
        0.92
      );


    return {
      dataUrl,
      width:
        image.naturalWidth,
      height:
        image.naturalHeight,
    };

  } finally {

    URL.revokeObjectURL(
      objectUrl
    );
  }
}


// =====================================================
// Base64 工具
// =====================================================

function base64ToUint8Array(
  base64: string
): Uint8Array {

  const binary =
    atob(
      base64
    );

  const bytes =
    new Uint8Array(
      binary.length
    );

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {
    bytes[i] =
      binary.charCodeAt(i);
  }

  return bytes;
}


// =====================================================
// Data URL → JPEG bytes
// =====================================================

function dataUrlToJpeg(
  dataUrl: string
): Uint8Array {

  const comma =
    dataUrl.indexOf(",");

  if (
    comma < 0
  ) {
    throw new Error(
      "无效图片数据"
    );
  }

  const base64 =
    dataUrl.slice(
      comma + 1
    );

  return base64ToUint8Array(
    base64
  );
}


// =====================================================
// PDF 工具
// =====================================================

function escapePdfText(
  text: string
): string {

  return text
    .replace(
      /\\/g,
      "\\\\"
    )
    .replace(
      /\(/g,
      "\\("
    )
    .replace(
      /\)/g,
      "\\)"
    );
}


// =====================================================
// 创建简单 PDF
//
// 每张发票一页。
// 页面里直接放发票图片。
// =====================================================

export async function generateFraisPdf(
  invoices: FraisInvoice[]
): Promise<Blob> {

  if (
    invoices.length === 0
  ) {
    throw new Error(
      "没有发票可以生成 PDF"
    );
  }


  type PdfImage = {
    bytes: Uint8Array;
    width: number;
    height: number;
    invoice: FraisInvoice;
  };


  const images:
    PdfImage[] =
      [];


  for (
    const invoice of
      invoices
  ) {

    if (
      !invoice.file_path
    ) {
      throw new Error(
        `发票没有 file_path：${
          invoice.file_name ||
          invoice.id
        }`
      );
    }


    const blob =
      await downloadFraisFile(
        invoice.file_path
      );


    const jpeg =
      await blobToJpegData(
        blob
      );


    images.push({
      bytes:
        dataUrlToJpeg(
          jpeg.dataUrl
        ),

      width:
        jpeg.width,

      height:
        jpeg.height,

      invoice,
    });
  }


  // ---------------------------------------------------
  // PDF 基础对象
  // ---------------------------------------------------

  const objects:
    string[] =
      [];

  const imageBytes:
    Uint8Array[] =
      [];


  // Object 1：Catalog
  objects.push(
    "<< /Type /Catalog /Pages 2 0 R >>"
  );


  // Object 2：Pages
  //
  // 稍后填充 Kids。
  //
  objects.push(
    ""
  );


  const pageObjectNumbers:
    number[] =
      [];


  const pageContentObjectNumbers:
    number[] =
      [];


  const imageObjectNumbers:
    number[] =
      [];


  // ---------------------------------------------------
  // 为每一页创建对象
  // ---------------------------------------------------

  for (
    let i = 0;
    i <
      images.length;
    i++
  ) {

    const image =
      images[i];


    const imageObjectNumber =
      objects.length + 1;

    imageObjectNumbers.push(
      imageObjectNumber
    );


    objects.push(
      `<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.bytes.length} >>\nstream\n`
    );

    imageBytes.push(
      image.bytes
    );


    const pageContentObjectNumber =
      objects.length + 1;

    pageContentObjectNumbers.push(
      pageContentObjectNumber
    );


    // A4
    const pageWidth =
      595.28;

    const pageHeight =
      841.89;

    const margin =
      20;


    const availableWidth =
      pageWidth -
      margin * 2;

    const availableHeight =
      pageHeight -
      margin * 2;


    const imageRatio =
      image.width /
      image.height;


    let drawWidth =
      availableWidth;

    let drawHeight =
      drawWidth /
      imageRatio;


    if (
      drawHeight >
      availableHeight
    ) {

      drawHeight =
        availableHeight;

      drawWidth =
        drawHeight *
        imageRatio;
    }


    const x =
      (
        pageWidth -
        drawWidth
      ) / 2;


    const y =
      (
        pageHeight -
        drawHeight
      ) / 2;


    const content =
      [
        "q",

        `${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)} cm`,

        `/Im${i + 1} Do`,

        "Q",
      ].join(
        "\n"
      );


    objects.push(
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`
    );


    const pageObjectNumber =
      objects.length + 1;

    pageObjectNumbers.push(
      pageObjectNumber
    );


    objects.push(
      [
        "<<",
        "/Type /Page",
        "/Parent 2 0 R",
        `/MediaBox [0 0 ${pageWidth} ${pageHeight}]`,
        `/Resources << /XObject << /Im${i + 1} ${imageObjectNumber} 0 R >> >>`,
        `/Contents ${pageContentObjectNumber} 0 R`,
        ">>",
      ].join(
        " "
      )
    );
  }


  // ---------------------------------------------------
  // Pages 对象
  // ---------------------------------------------------

  objects[1] =
    [
      "<<",
      "/Type /Pages",
      `/Kids [${pageObjectNumbers
        .map(
          number =>
            `${number} 0 R`
        )
        .join(" ")}]`,
      `/Count ${pageObjectNumbers.length}`,
      ">>",
    ].join(
      " "
    );


  // ---------------------------------------------------
  // 生成 PDF bytes
  // ---------------------------------------------------

  const encoder =
    new TextEncoder();


  const chunks:
    Uint8Array[] =
      [];


  const offsets:
    number[] =
      [0];


  let offset =
    0;


  function pushText(
    text: string
  ) {

    const bytes =
      encoder.encode(
        text
      );

    chunks.push(
      bytes
    );

    offset +=
      bytes.length;
  }


  pushText(
    "%PDF-1.4\n%\xFF\xFF\xFF\xFF\n"
  );


  let imageIndex =
    0;


  for (
    let i = 0;
    i <
      objects.length;
    i++
  ) {

    offsets[i + 1] =
      offset;


    pushText(
      `${i + 1} 0 obj\n`
    );


    const object =
      objects[i];


    if (
      imageObjectNumbers.includes(
        i + 1
      )
    ) {

      pushText(
        `${object}`
      );

      pushText(
        "\n"
      );

      pushText(
        "endstream\nendobj\n"
      );

      imageIndex++;

    } else {

      pushText(
        `${object}\nendobj\n`
      );
    }
  }


  const xrefOffset =
    offset;


  pushText(
    `xref\n0 ${objects.length + 1}\n`
  );

  pushText(
    "0000000000 65535 f \n"
  );


  for (
    let i = 1;
    i <= objects.length;
    i++
  ) {

    pushText(
      `${String(
        offsets[i]
      ).padStart(
        10,
        "0"
      )} 00000 n \n`
    );
  }


  pushText(
    [
      "trailer",
      `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
      "startxref",
      String(
        xrefOffset
      ),
      "%%EOF",
    ].join(
      "\n"
    )
  );


  // ---------------------------------------------------
  // 注意：上面 image stream 的 bytes
  // 需要真正插入对象 stream。
  //
  // 因此重新构建一次。
  // ---------------------------------------------------

  const finalChunks:
    Uint8Array[] =
      [];

  const finalOffsets:
    number[] =
      [0];

  let finalOffset =
    0;


  function finalText(
    text: string
  ) {

    const bytes =
      encoder.encode(
        text
      );

    finalChunks.push(
      bytes
    );

    finalOffset +=
      bytes.length;
  }


  finalText(
    "%PDF-1.4\n"
  );


  let currentImage =
    0;


  for (
    let i = 0;
    i <
      objects.length;
    i++
  ) {

    finalOffsets[i + 1] =
      finalOffset;


    finalText(
      `${i + 1} 0 obj\n`
    );


    if (
      imageObjectNumbers.includes(
        i + 1
      )
    ) {

      const imageNumber =
        imageObjectNumbers.indexOf(
          i + 1
        );

      const image =
        images[
          imageNumber
        ];

      const header =
        objects[i];


      finalText(
        `${header}`
      );

      finalText(
        "\n"
      );

      finalChunks.push(
        image.bytes
      );

      finalOffset +=
        image.bytes.length;

      finalText(
        "\nendstream\nendobj\n"
      );

      currentImage++;

    } else {

      finalText(
        `${objects[i]}\nendobj\n`
      );
    }
  }


  const finalXrefOffset =
    finalOffset;


  finalText(
    `xref\n0 ${objects.length + 1}\n`
  );

  finalText(
    "0000000000 65535 f \n"
  );


  for (
    let i = 1;
    i <= objects.length;
    i++
  ) {

    finalText(
      `${String(
        finalOffsets[i]
      ).padStart(
        10,
        "0"
      )} 00000 n \n`
    );
  }


  finalText(
    [
      "trailer",
      `<< /Size ${objects.length + 1} /Root 1 0 R >>`,
      "startxref",
      String(
        finalXrefOffset
      ),
      "%%EOF",
    ].join(
      "\n"
    )
  );


  const totalLength =
    finalChunks.reduce(
      (
        sum,
        chunk
      ) =>
        sum +
        chunk.length,
      0
    );


  const result =
    new Uint8Array(
      totalLength
    );


  let position =
    0;


  for (
    const chunk of
      finalChunks
  ) {

    result.set(
      chunk,
      position
    );

    position +=
      chunk.length;
  }


  return new Blob(
    [result],
    {
      type:
        "application/pdf",
    }
  );
}


// =====================================================
// 下载 PDF
// =====================================================

export function downloadBlob(
  blob: Blob,
  fileName: string
) {

  const url =
    URL.createObjectURL(
      blob
    );

  const link =
    document.createElement(
      "a"
    );

  link.href =
    url;

  link.download =
    fileName;

  document.body.appendChild(
    link
  );

  link.click();

  link.remove();

  setTimeout(
    () =>
      URL.revokeObjectURL(
        url
      ),
    5000
  );
}


// =====================================================
// PDF 成功后：
// 写入 used 表 + 删除 invoices + 删除 Storage
//
// 顺序：
// 1. Storage 文件存在
// 2. 写 used
// 3. 删除 Storage
// 4. 删除 frais_invoices
//
// 如果中途失败，不继续危险删除。
// =====================================================

export async function finalizeFraisInvoices(
  invoices: FraisInvoice[]
): Promise<void> {

  if (
    invoices.length === 0
  ) {
    throw new Error(
      "没有需要处理的发票"
    );
  }


  // ---------------------------------------------------
  // 1. 写入历史 used
  // ---------------------------------------------------

  const usedRows =
    invoices.map(
      invoice => ({
        invoice_id:
          invoice.id,

        file_name:
          invoice.file_name,

        file_path:
          invoice.file_path,

        file_hash:
          invoice.file_hash,

        invoice_number:
          invoice.invoice_number,

        project_name:
          invoice.project_name,

        amount:
          invoice.amount,

        invoice_date:
          invoice.invoice_date,

        ocr_text:
          invoice.ocr_text,

        used_at:
          new Date().toISOString(),

        status:
          "used",
      })
    );


  const {
    error:
      usedError,
  } =
    await supabase
      .from(
        FRAIS_USED_TABLE
      )
      .insert(
        usedRows
      );


  if (
    usedError
  ) {
    throw new Error(
      `保存 used 记录失败，未删除原发票：${usedError.message}`
    );
  }


  // ---------------------------------------------------
  // 2. 删除 Storage
  // ---------------------------------------------------

  const paths =
    invoices
      .map(
        invoice =>
          invoice.file_path
      )
      .filter(
        (
          path
        ): path is string =>
          Boolean(path)
      );


  if (
    paths.length > 0
  ) {

    const {
      error:
        storageError,
    } =
      await supabase.storage
        .from(
          FRAIS_STORAGE_BUCKET
        )
        .remove(
          paths
        );


    if (
      storageError
    ) {

      throw new Error(
        `PDF 已生成，但 Storage 删除失败，数据库发票暂时保留：${storageError.message}`
      );
    }
  }


  // ---------------------------------------------------
  // 3. 删除 frais_invoices
  // ---------------------------------------------------

  const ids =
    invoices.map(
      invoice =>
        invoice.id
    );


  const {
    error:
      deleteError,
  } =
    await supabase
      .from(
        FRAIS_INVOICE_TABLE
      )
      .delete()
      .in(
        "id",
        ids
      );


  if (
    deleteError
  ) {
    throw new Error(
      `Storage 已删除，但 frais_invoices 删除失败：${deleteError.message}`
    );
  }
}


// =====================================================
// 删除单张发票
//
// 手工 DELETE。
// 同时删除 Storage + frais_invoices。
// =====================================================

export async function deleteFraisInvoice(
  invoice: FraisInvoice
): Promise<void> {

  if (
    invoice.file_path
  ) {

    const {
      error:
        storageError,
    } =
      await supabase.storage
        .from(
          FRAIS_STORAGE_BUCKET
        )
        .remove([
          invoice.file_path,
        ]);

    if (
      storageError
    ) {
      throw new Error(
        `删除发票图片失败：${storageError.message}`
      );
    }
  }


  const {
    error,
  } =
    await supabase
      .from(
        FRAIS_INVOICE_TABLE
      )
      .delete()
      .eq(
        "id",
        invoice.id
      );


  if (error) {
    throw new Error(
      `删除发票记录失败：${error.message}`
    );
  }
}


// =====================================================
// 标记测试
//
// 测试过的发票也不能进入正式组合。
// =====================================================

export async function markFraisInvoiceTested(
  invoiceId: string
): Promise<FraisInvoice> {

  const {
    data,
    error,
  } =
    await supabase
      .from(
        FRAIS_INVOICE_TABLE
      )
      .update({
        status:
          "tested",

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        invoiceId
      )
      .select("*")
      .single();

  if (error) {
    throw new Error(
      `标记测试失败：${error.message}`
    );
  }

  return data as FraisInvoice;
}