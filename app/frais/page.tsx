"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { PDFDocument } from "pdf-lib";

import {
  FraisInvoice,
  FraisInvoiceRow,
  FraisProjectRule,
  FraisUsedInvoice,
  FRAIS_STORAGE_BUCKET,
  getFraisInvoices,
  getFraisProjectRules,
  getFraisUsedInvoices,
  getFraisFileUrl,
  isFraisInvoiceUsed,
  isFraisProjectAllowed,
  updateFraisProjectRule,
  markFraisInvoicesUsed,
  saveFraisPdfHistory,
} from "@/lib/frais";


// =====================================================
// 类型
// =====================================================

type MatchResult = {
  indexes: number[];
  total: number;
  difference: number;
};


// =====================================================
// 常量
// =====================================================

const DEFAULT_TARGET = 4590;

const MAX_COMBINATION_RESULTS = 5;

const MAX_ITEMS = 36;


// =====================================================
// 金额
// =====================================================

function formatMoney(value: number) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


// =====================================================
// 文件判断
// =====================================================

function isPdfFile(fileName: string) {
  return fileName
    .toLowerCase()
    .endsWith(".pdf");
}

function isPngFile(fileName: string) {
  return fileName
    .toLowerCase()
    .endsWith(".png");
}


// =====================================================
// ArrayBuffer
// =====================================================

async function fetchFileBytes(
  url: string
): Promise<ArrayBuffer> {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(
      `无法读取发票文件：HTTP ${response.status}`
    );
  }

  return await response.arrayBuffer();
}


// =====================================================
// 组合算法
// =====================================================

function findBestMatches(
  invoices: FraisInvoice[],
  target: number
): MatchResult[] {

  const validInvoices = invoices
    .map((invoice, index) => ({
      invoice,
      index,
    }))
    .filter(
      ({ invoice }) =>
        invoice.amount !== null &&
        Number(invoice.amount) > 0
    );

  if (validInvoices.length === 0) {
    return [];
  }


  let workingItems = validInvoices;


  if (workingItems.length > MAX_ITEMS) {
    workingItems = [...workingItems]
      .sort(
        (a, b) =>
          Math.abs(
            Number(a.invoice.amount || 0) -
              target
          ) -
          Math.abs(
            Number(b.invoice.amount || 0) -
              target
          )
      )
      .slice(0, MAX_ITEMS);
  }


  const mid = Math.floor(
    workingItems.length / 2
  );


  const left =
    workingItems.slice(0, mid);

  const right =
    workingItems.slice(mid);


  type Subset = {
    total: number;
    indexes: number[];
  };


  function generateSubsets(
    array: typeof left
  ): Subset[] {

    const result: Subset[] = [
      {
        total: 0,
        indexes: [],
      },
    ];


    for (const item of array) {

      const originalLength =
        result.length;


      for (
        let i = 0;
        i < originalLength;
        i++
      ) {

        const subset = result[i];

        const amount =
          Number(
            item.invoice.amount || 0
          );


        result.push({
          total:
            subset.total +
            amount,

          indexes: [
            ...subset.indexes,
            item.index,
          ],
        });
      }


      if (result.length > 1000000) {
        break;
      }
    }


    return result;
  }


  const leftSubsets =
    generateSubsets(left);

  const rightSubsets =
    generateSubsets(right);


  rightSubsets.sort(
    (a, b) =>
      a.total - b.total
  );


  function lowerBound(
    array: Subset[],
    targetValue: number
  ) {

    let low = 0;

    let high = array.length;


    while (low < high) {

      const middle =
        Math.floor(
          (low + high) / 2
        );


      if (
        array[middle].total <
        targetValue
      ) {

        low =
          middle + 1;

      } else {

        high = middle;
      }
    }


    return low;
  }


  const matches: MatchResult[] = [];

  const seen = new Set<string>();


  for (
    const leftSubset of leftSubsets
  ) {

    const wanted =
      target -
      leftSubset.total;


    const position =
      lowerBound(
        rightSubsets,
        wanted
      );


    const candidates = [
      position - 2,
      position - 1,
      position,
      position + 1,
      position + 2,
    ];


    for (
      const candidateIndex of
        candidates
    ) {

      if (
        candidateIndex < 0 ||
        candidateIndex >=
          rightSubsets.length
      ) {
        continue;
      }


      const rightSubset =
        rightSubsets[
          candidateIndex
        ];


      const total =
        leftSubset.total +
        rightSubset.total;


      if (total <= 0) {
        continue;
      }


      const indexes = [
        ...leftSubset.indexes,
        ...rightSubset.indexes,
      ].sort(
        (a, b) => a - b
      );


      const key =
        indexes.join(",");


      if (seen.has(key)) {
        continue;
      }


      seen.add(key);


      matches.push({
        indexes,
        total,
        difference:
          total - target,
      });
    }
  }


  matches.sort(
    (a, b) => {

      const diff =
        Math.abs(
          a.difference
        ) -
        Math.abs(
          b.difference
        );


      if (
        Math.abs(diff) >
        0.000001
      ) {
        return diff;
      }


      return (
        a.indexes.length -
        b.indexes.length
      );
    }
  );


  return matches.slice(
    0,
    MAX_COMBINATION_RESULTS
  );
}


// =====================================================
// 创建 PDF
// =====================================================

async function createCombinedPdf(
  invoices: FraisInvoice[],
  selectedIndexes: number[]
): Promise<Uint8Array> {

  const outputPdf =
    await PDFDocument.create();


  for (
    const index of selectedIndexes
  ) {

    const invoice =
      invoices[index];


    if (!invoice) {
      continue;
    }


    if (!invoice.file_url) {
      throw new Error(
        `发票文件无法读取：${invoice.file_name}`
      );
    }


    const bytes =
      await fetchFileBytes(
        invoice.file_url
      );


    // =================================================
    // PDF
    // =================================================

    if (
      isPdfFile(
        invoice.file_name
      )
    ) {

      const sourcePdf =
        await PDFDocument.load(
          bytes
        );


      const copiedPages =
        await outputPdf.copyPages(
          sourcePdf,
          sourcePdf.getPageIndices()
        );


      for (
        const page of copiedPages
      ) {

        outputPdf.addPage(page);
      }


      continue;
    }


    // =================================================
    // 图片
    // =================================================

    const image =
      isPngFile(
        invoice.file_name
      )
        ? await outputPdf.embedPng(
            bytes
          )
        : await outputPdf.embedJpg(
            bytes
          );


    const originalWidth =
      image.width;

    const originalHeight =
      image.height;


    const pageWidth = 595;

    const pageHeight = 842;


    const scale =
      Math.min(
        pageWidth /
          originalWidth,

        pageHeight /
          originalHeight
      );


    const width =
      originalWidth * scale;

    const height =
      originalHeight * scale;


    const page =
      outputPdf.addPage([
        pageWidth,
        pageHeight,
      ]);


    page.drawImage(
      image,
      {
        x:
          (pageWidth -
            width) /
          2,

        y:
          (pageHeight -
            height) /
          2,

        width,

        height,
      }
    );
  }


  return await outputPdf.save();
}


// =====================================================
// 页面
// =====================================================

export default function FraisPage() {

  // ===================================================
  // 数据
  // ===================================================

  const [
    invoices,
    setInvoices,
  ] = useState<FraisInvoice[]>([]);


  const [
    rules,
    setRules,
  ] = useState<FraisProjectRule[]>([]);


  const [
    usedInvoices,
    setUsedInvoices,
  ] = useState<FraisUsedInvoice[]>([]);


  // ===================================================
  // 状态
  // ===================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    error,
    setError,
  ] = useState("");


  const [
    target,
    setTarget,
  ] = useState(
    String(DEFAULT_TARGET)
  );


  const [
    year,
    setYear,
  ] = useState(
    String(
      new Date().getFullYear()
    )
  );


  const [
    month,
    setMonth,
  ] = useState("");


  const [
    matches,
    setMatches,
  ] = useState<MatchResult[]>([]);


  const [
    selectedMatchIndex,
    setSelectedMatchIndex,
  ] = useState(0);


  const [
    confirmed,
    setConfirmed,
  ] = useState(false);


  const [
    generating,
    setGenerating,
  ] = useState(false);


  const [
    generatedUrl,
    setGeneratedUrl,
  ] = useState<string | null>(
    null
  );


  const [
    generatedFileName,
    setGeneratedFileName,
  ] = useState("");


  const [
    savingRules,
    setSavingRules,
  ] = useState(false);


  // ===================================================
  // 清理 URL
  // ===================================================

  useEffect(() => {

    return () => {

      if (generatedUrl) {
        URL.revokeObjectURL(
          generatedUrl
        );
      }
    };

  }, [generatedUrl]);


  // ===================================================
  // 加载 Supabase
  // ===================================================

  const loadInvoices =
    useCallback(
      async () => {

        setLoading(true);

        setError("");


        try {

          const [
            invoiceRows,
            usedRows,
            projectRules,
          ] =
            await Promise.all([
              getFraisInvoices(),
              getFraisUsedInvoices(),
              getFraisProjectRules(),
            ]);


          setUsedInvoices(
            usedRows
          );


          setRules(
            projectRules
          );


          // =========================================
          // 排除已经使用的
          // =========================================

          const availableRows =
            invoiceRows.filter(
              (invoice) =>
                !isFraisInvoiceUsed(
                  invoice,
                  usedRows
                )
            );


          // =========================================
          // 排除项目规则明确禁止的
          // =========================================

          const allowedRows =
            availableRows.filter(
              (invoice) =>
                isFraisProjectAllowed(
                  invoice,
                  projectRules
                )
            );


          // =========================================
          // 转换
          // =========================================

          const converted =
            await Promise.all(
              allowedRows.map(
                async (
                  invoice
                ) => {

                  const url =
                    await getFraisFileUrl(
                      invoice.file_path
                    );


                  return {
                    ...invoice,

                    selected:
                      true,

                    file_url:
                      url,
                  };
                }
              )
            );


          setInvoices(
            converted
          );


          setMatches([]);

          setConfirmed(false);

        } catch (err) {

          console.error(err);


          setError(
            err instanceof Error
              ? err.message
              : "读取发票失败"
          );

        } finally {

          setLoading(false);
        }

      },
      []
    );


  useEffect(() => {

    loadInvoices();

  }, [loadInvoices]);


  // ===================================================
  // 重新加载
  // ===================================================

  async function refreshInvoices() {

    await loadInvoices();

  }


  // ===================================================
  // 项目规则切换
  // ===================================================

  async function toggleProjectRule(
    rule: FraisProjectRule
  ) {

    setSavingRules(true);


    try {

      await updateFraisProjectRule(
        rule.id,
        !rule.allowed
      );


      setRules(
        (previous) =>
          previous.map(
            (item) =>
              item.id === rule.id
                ? {
                    ...item,
                    allowed:
                      !item.allowed,
                  }
                : item
          )
      );


      await loadInvoices();

    } catch (err) {

      alert(
        err instanceof Error
          ? err.message
          : "保存规则失败"
      );

    } finally {

      setSavingRules(false);
    }
  }


  // ===================================================
  // 发票选择
  // ===================================================

  function toggleInvoice(
    id: string
  ) {

    setInvoices(
      (previous) =>
        previous.map(
          (invoice) =>
            invoice.id === id
              ? {
                  ...invoice,
                  selected:
                    !invoice.selected,
                }
              : invoice
        )
    );


    setConfirmed(false);

    setGeneratedUrl(null);
  }


  // ===================================================
  // 全选
  // ===================================================

  function selectAll() {

    setInvoices(
      (previous) =>
        previous.map(
          (invoice) => ({
            ...invoice,
            selected: true,
          })
        )
    );


    setConfirmed(false);
  }


  // ===================================================
  // 取消全选
  // ===================================================

  function unselectAll() {

    setInvoices(
      (previous) =>
        previous.map(
          (invoice) => ({
            ...invoice,
            selected: false,
          })
        )
    );


    setConfirmed(false);
  }


  // ===================================================
  // 计算组合
  // ===================================================

  function calculateMatches() {

    const targetValue =
      Number(target);


    if (
      !Number.isFinite(
        targetValue
      ) ||
      targetValue <= 0
    ) {

      alert(
        "请输入正确的目标金额。"
      );

      return;
    }


    const available =
      invoices.filter(
        (invoice) =>
          invoice.amount !== null &&
          Number(invoice.amount) > 0
      );


    if (available.length === 0) {

      alert(
        "没有可计算的发票。"
      );

      return;
    }


    const result =
      findBestMatches(
        invoices,
        targetValue
      );


    if (result.length === 0) {

      alert(
        "没有找到可计算的组合。"
      );

      return;
    }


    setMatches(result);

    setSelectedMatchIndex(0);

    setConfirmed(false);

    setGeneratedUrl(null);


    const best =
      result[0];


    const selectedIds =
      new Set(
        best.indexes.map(
          (index) =>
            invoices[index]?.id
        )
      );


    setInvoices(
      (previous) =>
        previous.map(
          (invoice) => ({
            ...invoice,

            selected:
              selectedIds.has(
                invoice.id
              ),
          })
        )
    );
  }


  // ===================================================
  // 选择方案
  // ===================================================

  function chooseMatch(
    index: number
  ) {

    const match =
      matches[index];


    if (!match) {
      return;
    }


    setSelectedMatchIndex(
      index
    );


    const selectedIds =
      new Set(
        match.indexes.map(
          (invoiceIndex) =>
            invoices[
              invoiceIndex
            ]?.id
        )
      );


    setInvoices(
      (previous) =>
        previous.map(
          (invoice) => ({
            ...invoice,

            selected:
              selectedIds.has(
                invoice.id
              ),
          })
        )
    );


    setConfirmed(false);

    setGeneratedUrl(null);
  }


  // ===================================================
  // 确认
  // ===================================================

  function confirmSelection() {

    const selected =
      invoices.filter(
        (invoice) =>
          invoice.selected
      );


    if (selected.length === 0) {

      alert(
        "请先选择发票。"
      );

      return;
    }


    const total =
      selected.reduce(
        (sum, invoice) =>
          sum +
          Number(
            invoice.amount || 0
          ),
        0
      );


    const targetValue =
      Number(target);


    const difference =
      total -
      targetValue;


    const message =
      `确认使用 ${selected.length} 张发票？\n\n` +
      `目标金额：${formatMoney(targetValue)}\n` +
      `发票合计：${formatMoney(total)}\n` +
      `差额：${
        difference >= 0
          ? "+"
          : ""
      }${formatMoney(difference)}\n\n` +
      `确认后可以生成 PDF。`;


    if (
      !window.confirm(
        message
      )
    ) {
      return;
    }


    setConfirmed(true);
  }


  // ===================================================
  // 生成 PDF
  // ===================================================

  async function generatePdf() {

    if (!confirmed) {

      alert(
        "请先确认发票组合。"
      );

      return;
    }


    if (!year.trim()) {

      alert(
        "请填写年份。"
      );

      return;
    }


    if (!month) {

      alert(
        "请选择月份。"
      );

      return;
    }


    const selectedIndexes =
      invoices
        .map(
          (
            invoice,
            index
          ) => ({
            invoice,
            index,
          })
        )
        .filter(
          ({
            invoice,
          }) =>
            invoice.selected
        )
        .map(
          ({
            index,
          }) =>
            index
        );


    if (
      selectedIndexes.length === 0
    ) {

      alert(
        "没有选择发票。"
      );

      return;
    }


    const selectedInvoices =
      selectedIndexes.map(
        (index) =>
          invoices[index]
      );


    const invalidFile =
      selectedInvoices.find(
        (invoice) =>
          !invoice.file_url
      );


    if (invalidFile) {

      alert(
        `发票文件无法读取：${invalidFile.file_name}`
      );

      return;
    }


    setGenerating(true);

    setGeneratedUrl(null);


    try {

      const pdfName =
        `frais ${year.trim()} ${String(
          month
        ).padStart(
          2,
          "0"
        )}.pdf`;


      // ===============================================
      // 生成 PDF
      // ===============================================

      const pdfBytes =
        await createCombinedPdf(
          invoices,
          selectedIndexes
        );


      // ===============================================
      // Blob
      // ===============================================

      const pdfBuffer =
        new ArrayBuffer(
          pdfBytes.byteLength
        );


      new Uint8Array(
        pdfBuffer
      ).set(pdfBytes);


      const blob =
        new Blob(
          [pdfBuffer],
          {
            type:
              "application/pdf",
          }
        );


      const url =
        URL.createObjectURL(
          blob
        );


      setGeneratedUrl(url);

      setGeneratedFileName(
        pdfName
      );


      // ===============================================
      // 保存 PDF 历史
      // ===============================================

      const actualAmount =
        selectedInvoices.reduce(
          (sum, invoice) =>
            sum +
            Number(
              invoice.amount || 0
            ),
          0
        );


      const targetAmount =
        Number(target);


      await saveFraisPdfHistory({
        pdfName,

        year:
          Number(year),

        month:
          Number(month),

        targetAmount,

        actualAmount,

        difference:
          actualAmount -
          targetAmount,

        invoiceCount:
          selectedInvoices.length,

        mode:
          "manual",
      });


      // ===============================================
      // 标记已经使用
      // ===============================================

      await markFraisInvoicesUsed(
        selectedInvoices,
        pdfName
      );


      alert(
        "PDF 已生成，并且这些发票已经标记为已使用。"
      );

    } catch (err) {

      console.error(
        "generatePdf error:",
        err
      );


      alert(
        `生成 PDF 失败：${
          err instanceof Error
            ? err.message
            : "未知错误"
        }`
      );

    } finally {

      setGenerating(false);
    }
  }


  // ===================================================
  // 下载
  // ===================================================

  function downloadPdf() {

    if (
      !generatedUrl ||
      !generatedFileName
    ) {

      alert(
        "请先生成 PDF。"
      );

      return;
    }


    const link =
      document.createElement(
        "a"
      );


    link.href =
      generatedUrl;


    link.download =
      generatedFileName;


    document.body.appendChild(
      link
    );


    link.click();


    document.body.removeChild(
      link
    );
  }


  // ===================================================
  // 当前统计
  // ===================================================

  const selectedInvoices =
    useMemo(
      () =>
        invoices.filter(
          (invoice) =>
            invoice.selected
        ),
      [invoices]
    );


  const selectedCount =
    selectedInvoices.length;


  const manualTotal =
    useMemo(
      () =>
        selectedInvoices.reduce(
          (sum, invoice) =>
            sum +
            Number(
              invoice.amount || 0
            ),
          0
        ),
      [selectedInvoices]
    );


  const targetValue =
    Number(target) || 0;


  const selectedDifference =
    manualTotal -
    targetValue;


  // ===================================================
  // 项目名称
  // ===================================================

  const projectNames =
    useMemo(() => {

      const names =
        invoices
          .map(
            (invoice) =>
              invoice.project_name
          )
          .filter(
            (
              name
            ): name is string =>
              Boolean(
                name &&
                name.trim()
              )
          );


      return Array.from(
        new Set(
          names.map(
            (name) =>
              name.trim()
          )
        )
      );

    }, [invoices]);


  // ===================================================
  // Loading
  // ===================================================

  if (loading) {

    return (
      <div
        style={{
          minHeight:
            "100vh",

          background:
            "#f5f7fa",

          display:
            "flex",

          alignItems:
            "center",

          justifyContent:
            "center",

          fontSize:
            "18px",

          color:
            "#4b5563",
        }}
      >
        正在从 Supabase 读取发票……
      </div>
    );
  }


  // ===================================================
  // UI
  // ===================================================

  return (
    <div
      style={{
        minHeight:
          "100vh",

        background:
          "#f5f7fa",

        padding:
          "32px",

        color:
          "#111827",
      }}
    >

      <div
        style={{
          maxWidth:
            "1200px",

          margin:
            "0 auto",
        }}
      >

        {/* ================================================= */}
        {/* 标题 */}
        {/* ================================================= */}

        <div
          style={{
            marginBottom:
              "28px",
          }}
        >

          <h1
            style={{
              fontSize:
                "30px",

              fontWeight:
                700,

              margin:
                "0 0 8px",
            }}
          >
            FRAIS 发票匹配
          </h1>


          <div
            style={{
              color:
                "#6b7280",
            }}
          >
            手机上传发票 → Supabase 保存 → 电脑自动读取 → 自动排除已使用发票 → 项目筛选 → 金额匹配 → 生成 PDF
          </div>

        </div>


        {/* ================================================= */}
        {/* 错误 */}
        {/* ================================================= */}

        {error && (

          <div
            style={{
              background:
                "#fef2f2",

              border:
                "1px solid #fecaca",

              color:
                "#991b1b",

              borderRadius:
                "10px",

              padding:
                "16px",

              marginBottom:
                "20px",
            }}
          >
            <strong>
              读取失败：
            </strong>{" "}
            {error}
          </div>

        )}


        {/* ================================================= */}
        {/* 数据状态 */}
        {/* ================================================= */}

        <div
          style={{
            background:
              "#ffffff",

            borderRadius:
              "16px",

            padding:
              "20px 24px",

            marginBottom:
              "20px",

            boxShadow:
              "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >

          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(4, 1fr)",

              gap:
                "12px",
            }}
          >

            <div
              style={{
                padding:
                  "15px",

                background:
                  "#eff6ff",

                borderRadius:
                  "10px",
              }}
            >
              <div
                style={{
                  color:
                    "#6b7280",

                  fontSize:
                    "13px",
                }}
              >
                当前可用发票
              </div>

              <div
                style={{
                  fontSize:
                    "24px",

                  fontWeight:
                    700,

                  marginTop:
                    "5px",
                }}
              >
                {invoices.length}
              </div>
            </div>


            <div
              style={{
                padding:
                  "15px",

                background:
                  "#f0fdf4",

                borderRadius:
                  "10px",
              }}
            >
              <div
                style={{
                  color:
                    "#6b7280",

                  fontSize:
                    "13px",
                }}
              >
                当前选择
              </div>

              <div
                style={{
                  fontSize:
                    "24px",

                  fontWeight:
                    700,

                  marginTop:
                    "5px",
                }}
              >
                {selectedCount}
              </div>
            </div>


            <div
              style={{
                padding:
                  "15px",

                background:
                  "#fff7ed",

                borderRadius:
                  "10px",
              }}
            >
              <div
                style={{
                  color:
                    "#6b7280",

                  fontSize:
                    "13px",
                }}
              >
                已使用发票
              </div>

              <div
                style={{
                  fontSize:
                    "24px",

                  fontWeight:
                    700,

                  marginTop:
                    "5px",
                }}
              >
                {usedInvoices.length}
              </div>
            </div>


            <div
              style={{
                padding:
                  "15px",

                background:
                  "#f9fafb",

                borderRadius:
                  "10px",
              }}
            >
              <div
                style={{
                  color:
                    "#6b7280",

                  fontSize:
                    "13px",
                }}
              >
                Storage
              </div>

              <div
                style={{
                  fontSize:
                    "15px",

                  fontWeight:
                    700,

                  marginTop:
                    "8px",
                }}
              >
                {FRAIS_STORAGE_BUCKET}
              </div>
            </div>

          </div>


          <button
            type="button"
            onClick={
              refreshInvoices
            }
            style={{
              marginTop:
                "15px",

              padding:
                "9px 16px",

              border:
                "1px solid #d1d5db",

              borderRadius:
                "8px",

              background:
                "#ffffff",

              cursor:
                "pointer",

              fontWeight:
                600,
            }}
          >
            ↻ 刷新 Supabase 发票
          </button>

        </div>


        {/* ================================================= */}
        {/* ① 设置 */}
        {/* ================================================= */}

        <div
          style={{
            background:
              "#ffffff",

            borderRadius:
              "16px",

            padding:
              "24px",

            marginBottom:
              "20px",

            boxShadow:
              "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >

          <h2
            style={{
              margin:
                "0 0 18px",

              fontSize:
                "19px",
            }}
          >
            ① 设置
          </h2>


          <div
            style={{
              display:
                "grid",

              gridTemplateColumns:
                "repeat(3, 1fr)",

              gap:
                "16px",
            }}
          >

            <div>

              <label
                style={{
                  display:
                    "block",

                  marginBottom:
                    "7px",

                  fontWeight:
                    600,
                }}
              >
                目标金额
              </label>


              <input
                value={
                  target
                }

                onChange={(e) =>
                  setTarget(
                    e.target.value
                  )
                }

                type="number"

                step="0.01"

                style={{
                  width:
                    "100%",

                  padding:
                    "11px 12px",

                  border:
                    "1px solid #d1d5db",

                  borderRadius:
                    "8px",

                  fontSize:
                    "16px",

                  boxSizing:
                    "border-box",
                }}
              />

            </div>


            <div>

              <label
                style={{
                  display:
                    "block",

                  marginBottom:
                    "7px",

                  fontWeight:
                    600,
                }}
              >
                年份
              </label>


              <input
                value={
                  year
                }

                onChange={(e) =>
                  setYear(
                    e.target.value
                  )
                }

                type="number"

                style={{
                  width:
                    "100%",

                  padding:
                    "11px 12px",

                  border:
                    "1px solid #d1d5db",

                  borderRadius:
                    "8px",

                  fontSize:
                    "16px",

                  boxSizing:
                    "border-box",
                }}
              />

            </div>


            <div>

              <label
                style={{
                  display:
                    "block",

                  marginBottom:
                    "7px",

                  fontWeight:
                    600,
                }}
              >
                月份
              </label>


              <select
                value={
                  month
                }

                onChange={(e) =>
                  setMonth(
                    e.target.value
                  )
                }

                style={{
                  width:
                    "100%",

                  padding:
                    "11px 12px",

                  border:
                    "1px solid #d1d5db",

                  borderRadius:
                    "8px",

                  fontSize:
                    "16px",

                  boxSizing:
                    "border-box",

                  background:
                    "#ffffff",
                }}
              >

                <option value="">
                  请选择月份
                </option>


                {Array.from(
                  {
                    length: 12,
                  },
                  (_, i) => (

                    <option
                      key={
                        i + 1
                      }

                      value={String(
                        i + 1
                      )}
                    >
                      {i + 1} 月
                    </option>

                  )
                )}

              </select>

            </div>

          </div>


          <div
            style={{
              marginTop:
                "16px",

              padding:
                "12px 14px",

              background:
                "#f3f4f6",

              borderRadius:
                "8px",

              fontSize:
                "14px",

              color:
                "#4b5563",
            }}
          >
            最终文件名：

            <strong
              style={{
                color:
                  "#111827",

                marginLeft:
                  "5px",
              }}
            >
              frais{" "}
              {year ||
                "XXXX"}{" "}
              {month
                ? String(
                    month
                  ).padStart(
                    2,
                    "0"
                  )
                : "XX"}
              .pdf
            </strong>

          </div>

        </div>


        {/* ================================================= */}
        {/* ② 项目规则 */}
        {/* ================================================= */}

        {rules.length > 0 && (

          <div
            style={{
              background:
                "#ffffff",

              borderRadius:
                "16px",

              padding:
                "24px",

              marginBottom:
                "20px",

              boxShadow:
                "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >

            <h2
              style={{
                margin:
                  "0 0 10px",

                fontSize:
                  "19px",
              }}
            >
              ② 项目筛选规则
            </h2>


            <div
              style={{
                color:
                  "#6b7280",

                fontSize:
                  "14px",

                marginBottom:
                  "16px",
              }}
            >
              默认允许所有项目。你关闭某个项目后，下次上传相同项目的发票会自动排除。
            </div>


            <div
              style={{
                display:
                  "flex",

                flexWrap:
                  "wrap",

                gap:
                  "10px",
              }}
            >

              {rules.map(
                (rule) => (

                  <label
                    key={
                      rule.id
                    }

                    style={{
                      display:
                        "flex",

                      alignItems:
                        "center",

                      gap:
                        "8px",

                      padding:
                        "10px 14px",

                      border:
                        "1px solid #e5e7eb",

                      borderRadius:
                        "9px",

                      background:
                        rule.allowed
                          ? "#f0fdf4"
                          : "#fef2f2",

                      cursor:
                        savingRules
                          ? "wait"
                          : "pointer",
                    }}
                  >

                    <input
                      type="checkbox"

                      checked={
                        rule.allowed
                      }

                      disabled={
                        savingRules
                      }

                      onChange={() =>
                        toggleProjectRule(
                          rule
                        )
                      }
                    />

                    <span>
                      {rule.project_name}
                    </span>

                  </label>

                )
              )}

            </div>

          </div>

        )}


        {/* ================================================= */}
        {/* ③ 发票 */}
        {/* ================================================= */}

        <div
          style={{
            background:
              "#ffffff",

            borderRadius:
              "16px",

            padding:
              "24px",

            marginBottom:
              "20px",

            boxShadow:
              "0 2px 10px rgba(0,0,0,0.05)",
          }}
        >

          <div
            style={{
              display:
                "flex",

              justifyContent:
                "space-between",

              alignItems:
                "center",

              marginBottom:
                "18px",
            }}
          >

            <div>

              <h2
                style={{
                  margin:
                    "0 0 5px",

                  fontSize:
                    "19px",
                }}
              >
                ③ Supabase 发票
              </h2>

              <div
                style={{
                  color:
                    "#6b7280",

                  fontSize:
                    "13px",
                }}
              >
                这些就是手机已经上传到 Supabase 的发票，电脑不需要再次上传。
              </div>

            </div>


            {invoices.length > 0 && (

              <div
                style={{
                  display:
                    "flex",

                  gap:
                    "8px",
                }}
              >

                <button
                  type="button"
                  onClick={
                    selectAll
                  }
                  style={{
                    padding:
                      "8px 12px",

                    border:
                      "1px solid #d1d5db",

                    borderRadius:
                      "7px",

                    background:
                      "#ffffff",

                    cursor:
                      "pointer",
                  }}
                >
                  全选
                </button>


                <button
                  type="button"
                  onClick={
                    unselectAll
                  }
                  style={{
                    padding:
                      "8px 12px",

                    border:
                      "1px solid #d1d5db",

                    borderRadius:
                      "7px",

                    background:
                      "#ffffff",

                    cursor:
                      "pointer",
                  }}
                >
                  全不选
                </button>

              </div>

            )}

          </div>


          {invoices.length === 0 ? (

            <div
              style={{
                padding:
                  "45px 20px",

                textAlign:
                  "center",

                background:
                  "#f9fafb",

                borderRadius:
                  "12px",

                color:
                  "#6b7280",
              }}
            >

              <div
                style={{
                  fontSize:
                    "42px",

                  marginBottom:
                    "12px",
                }}
              >
                📭
              </div>

              <div
                style={{
                  fontSize:
                    "17px",

                  fontWeight:
                    600,

                  color:
                    "#374151",
                }}
              >
                当前没有可用发票
              </div>

              <div
                style={{
                  marginTop:
                    "8px",

                  fontSize:
                    "14px",
                }}
              >
                可能是还没有上传，或者这些发票已经生成过 PDF。
              </div>

              <button
                type="button"
                onClick={
                  refreshInvoices
                }
                style={{
                  marginTop:
                    "15px",

                  padding:
                    "10px 18px",

                  border:
                    "none",

                  borderRadius:
                    "8px",

                  background:
                    "#2563eb",

                  color:
                    "#ffffff",

                  cursor:
                    "pointer",

                  fontWeight:
                    600,
                }}
              >
                刷新
              </button>

            </div>

          ) : (

            <div
              style={{
                overflowX:
                  "auto",
              }}
            >

              <table
                style={{
                  width:
                    "100%",

                  borderCollapse:
                    "collapse",
                }}
              >

                <thead>

                  <tr>

                    <th
                      style={{
                        textAlign:
                          "left",

                        padding:
                          "10px",

                        borderBottom:
                          "1px solid #e5e7eb",
                      }}
                    >
                      选择
                    </th>


                    <th
                      style={{
                        textAlign:
                          "left",

                        padding:
                          "10px",

                        borderBottom:
                          "1px solid #e5e7eb",
                      }}
                    >
                      发票
                    </th>


                    <th
                      style={{
                        textAlign:
                          "left",

                        padding:
                          "10px",

                        borderBottom:
                          "1px solid #e5e7eb",
                      }}
                    >
                      发票号码
                    </th>


                    <th
                      style={{
                        textAlign:
                          "left",

                        padding:
                          "10px",

                        borderBottom:
                          "1px solid #e5e7eb",
                      }}
                    >
                      项目
                    </th>


                    <th
                      style={{
                        textAlign:
                          "right",

                        padding:
                          "10px",

                        borderBottom:
                          "1px solid #e5e7eb",
                      }}
                    >
                      金额
                    </th>


                    <th
                      style={{
                        textAlign:
                          "center",

                        padding:
                          "10px",

                        borderBottom:
                          "1px solid #e5e7eb",
                      }}
                    >
                      日期
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {invoices.map(
                    (invoice) => (

                      <tr
                        key={
                          invoice.id
                        }
                      >

                        <td
                          style={{
                            padding:
                              "10px",

                            borderBottom:
                              "1px solid #f0f0f0",
                          }}
                        >

                          <input
                            type="checkbox"

                            checked={
                              invoice.selected
                            }

                            onChange={() =>
                              toggleInvoice(
                                invoice.id
                              )
                            }

                            style={{
                              width:
                                "18px",

                              height:
                                "18px",
                            }}
                          />

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            borderBottom:
                              "1px solid #f0f0f0",

                            maxWidth:
                              "300px",
                          }}
                        >

                          <div
                            style={{
                              fontWeight:
                                600,

                              overflow:
                                "hidden",

                              textOverflow:
                                "ellipsis",

                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              invoice.file_name
                            }
                          </div>

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            borderBottom:
                              "1px solid #f0f0f0",

                            fontSize:
                              "13px",
                          }}
                        >
                          {
                            invoice.invoice_number ||
                            "-"
                          }
                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            borderBottom:
                              "1px solid #f0f0f0",
                          }}
                        >

                          {invoice.project_name ||
                            "未识别项目"}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            borderBottom:
                              "1px solid #f0f0f0",

                            textAlign:
                              "right",

                            fontWeight:
                              600,
                          }}
                        >

                          {invoice.amount !==
                          null
                            ? formatMoney(
                                Number(
                                  invoice.amount
                                )
                              )
                            : "-"}

                        </td>


                        <td
                          style={{
                            padding:
                              "10px",

                            borderBottom:
                              "1px solid #f0f0f0",

                            textAlign:
                              "center",

                            fontSize:
                              "13px",

                            color:
                              "#6b7280",
                          }}
                        >

                          {
                            invoice.invoice_date ||
                            "-"
                          }

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </div>


        {/* ================================================= */}
        {/* 项目统计 */}
        {/* ================================================= */}

        {projectNames.length > 0 && (

          <div
            style={{
              background:
                "#ffffff",

              borderRadius:
                "16px",

              padding:
                "24px",

              marginBottom:
                "20px",

              boxShadow:
                "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >

            <h2
              style={{
                margin:
                  "0 0 15px",

                fontSize:
                  "19px",
              }}
            >
              当前发票项目
            </h2>


            <div
              style={{
                display:
                  "flex",

                flexWrap:
                  "wrap",

                gap:
                  "10px",
              }}
            >

              {projectNames.map(
                (name) => (

                  <div
                    key={
                      name
                    }

                    style={{
                      padding:
                        "9px 13px",

                      background:
                        "#f3f4f6",

                      borderRadius:
                        "8px",

                      fontSize:
                        "14px",
                    }}
                  >
                    {name}
                  </div>

                )
              )}

            </div>

          </div>

        )}


        {/* ================================================= */}
        {/* ④ 匹配 */}
        {/* ================================================= */}

        {invoices.length > 0 && (

          <div
            style={{
              background:
                "#ffffff",

              borderRadius:
                "16px",

              padding:
                "24px",

              marginBottom:
                "20px",

              boxShadow:
                "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >

            <h2
              style={{
                margin:
                  "0 0 18px",

                fontSize:
                  "19px",
              }}
            >
              ④ 自动寻找最接近{" "}
              {formatMoney(
                targetValue
              )}
            </h2>


            <button
              type="button"
              onClick={
                calculateMatches
              }
              style={{
                padding:
                  "12px 20px",

                border:
                  "none",

                borderRadius:
                  "8px",

                background:
                  "#2563eb",

                color:
                  "#ffffff",

                cursor:
                  "pointer",

                fontWeight:
                  600,
              }}
            >
              🔍 计算最佳组合
            </button>


            {matches.length > 0 && (

              <div
                style={{
                  marginTop:
                    "20px",
                }}
              >

                <div
                  style={{
                    fontWeight:
                      600,

                    marginBottom:
                      "12px",
                  }}
                >
                  推荐组合
                </div>


                {matches.map(
                  (
                    match,
                    index
                  ) => {

                    const exact =
                      Math.abs(
                        match.difference
                      ) < 0.01;


                    return (

                      <button
                        type="button"

                        key={
                          index
                        }

                        onClick={() =>
                          chooseMatch(
                            index
                          )
                        }

                        style={{
                          width:
                            "100%",

                          textAlign:
                            "left",

                          padding:
                            "14px",

                          marginBottom:
                            "8px",

                          border:
                            selectedMatchIndex ===
                            index
                              ? "2px solid #2563eb"
                              : "1px solid #e5e7eb",

                          borderRadius:
                            "10px",

                          background:
                            selectedMatchIndex ===
                            index
                              ? "#eff6ff"
                              : "#ffffff",

                          cursor:
                            "pointer",
                        }}
                      >

                        <div
                          style={{
                            display:
                              "flex",

                            justifyContent:
                              "space-between",

                            alignItems:
                              "center",
                          }}
                        >

                          <div>

                            <strong>
                              {index ===
                              0
                                ? "🎯 最佳方案"
                                : `方案 ${
                                    index +
                                    1
                                  }`}
                            </strong>


                            {exact && (

                              <span
                                style={{
                                  marginLeft:
                                    "10px",

                                  color:
                                    "#16a34a",

                                  fontWeight:
                                    700,
                                }}
                              >
                                精确匹配
                              </span>

                            )}


                            <span
                              style={{
                                marginLeft:
                                  "12px",

                                color:
                                  "#6b7280",
                              }}
                            >
                              {
                                match
                                  .indexes
                                  .length
                              }{" "}
                              张
                            </span>

                          </div>


                          <div
                            style={{
                              fontWeight:
                                700,

                              fontSize:
                                "18px",
                            }}
                          >
                            {formatMoney(
                              match.total
                            )}
                          </div>

                        </div>


                        <div
                          style={{
                            marginTop:
                              "6px",

                            fontSize:
                              "13px",

                            color:
                              exact
                                ? "#16a34a"
                                : "#6b7280",
                          }}
                        >
                          差额：

                          {match.difference >=
                          0
                            ? "+"
                            : ""}

                          {formatMoney(
                            match.difference
                          )}
                        </div>

                      </button>

                    );
                  }
                )}

              </div>

            )}

          </div>

        )}


        {/* ================================================= */}
        {/* ⑤ 确认 */}
        {/* ================================================= */}

        {invoices.length > 0 && (

          <div
            style={{
              background:
                "#ffffff",

              borderRadius:
                "16px",

              padding:
                "24px",

              marginBottom:
                "20px",

              boxShadow:
                "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >

            <h2
              style={{
                margin:
                  "0 0 18px",

                fontSize:
                  "19px",
              }}
            >
              ⑤ 确认发票
            </h2>


            <div
              style={{
                display:
                  "grid",

                gridTemplateColumns:
                  "repeat(3, 1fr)",

                gap:
                  "12px",

                marginBottom:
                  "18px",
              }}
            >

              <div
                style={{
                  padding:
                    "16px",

                  background:
                    "#f9fafb",

                  borderRadius:
                    "10px",
                }}
              >

                <div
                  style={{
                    color:
                      "#6b7280",

                    fontSize:
                      "13px",
                  }}
                >
                  目标金额
                </div>


                <div
                  style={{
                    fontSize:
                      "24px",

                    fontWeight:
                      700,

                    marginTop:
                      "5px",
                  }}
                >
                  {formatMoney(
                    targetValue
                  )}
                </div>

              </div>


              <div
                style={{
                  padding:
                    "16px",

                  background:
                    "#f9fafb",

                  borderRadius:
                    "10px",
                }}
              >

                <div
                  style={{
                    color:
                      "#6b7280",

                    fontSize:
                      "13px",
                  }}
                >
                  当前选择
                </div>


                <div
                  style={{
                    fontSize:
                      "24px",

                    fontWeight:
                      700,

                    marginTop:
                      "5px",
                  }}
                >
                  {formatMoney(
                    manualTotal
                  )}
                </div>

              </div>


              <div
                style={{
                  padding:
                    "16px",

                  background:
                    Math.abs(
                      selectedDifference
                    ) < 0.01
                      ? "#f0fdf4"
                      : "#f9fafb",

                  borderRadius:
                    "10px",
                }}
              >

                <div
                  style={{
                    color:
                      "#6b7280",

                    fontSize:
                      "13px",
                  }}
                >
                  差额
                </div>


                <div
                  style={{
                    fontSize:
                      "24px",

                    fontWeight:
                      700,

                    marginTop:
                      "5px",

                    color:
                      Math.abs(
                        selectedDifference
                      ) < 0.01
                        ? "#16a34a"
                        : "#111827",
                  }}
                >

                  {selectedDifference >=
                  0
                    ? "+"
                    : ""}

                  {formatMoney(
                    selectedDifference
                  )}

                </div>

              </div>

            </div>


            <div
              style={{
                marginBottom:
                  "15px",

                color:
                  "#4b5563",
              }}
            >
              已选择{" "}
              <strong>
                {selectedCount}
              </strong>{" "}
              张发票。
            </div>


            <button
              type="button"
              onClick={
                confirmSelection
              }
              disabled={
                selectedCount ===
                0
              }
              style={{
                padding:
                  "13px 22px",

                border:
                  "none",

                borderRadius:
                  "8px",

                background:
                  confirmed
                    ? "#16a34a"
                    : "#111827",

                color:
                  "#ffffff",

                cursor:
                  selectedCount ===
                  0
                    ? "not-allowed"
                    : "pointer",

                fontWeight:
                  700,

                fontSize:
                  "15px",
              }}
            >
              {confirmed
                ? "✓ 已确认"
                : "确认这组发票"}
            </button>


            {confirmed && (

              <div
                style={{
                  marginTop:
                    "15px",

                  padding:
                    "13px",

                  background:
                    "#f0fdf4",

                  border:
                    "1px solid #bbf7d0",

                  borderRadius:
                    "8px",

                  color:
                    "#166534",
                }}
              >
                已确认。

                <br />

                可以生成：

                <strong>
                  {" "}
                  frais{" "}
                  {year ||
                    "XXXX"}{" "}
                  {month
                    ? String(
                        month
                      ).padStart(
                        2,
                        "0"
                      )
                    : "XX"}
                  .pdf
                </strong>

              </div>

            )}

          </div>

        )}


        {/* ================================================= */}
        {/* ⑥ PDF */}
        {/* ================================================= */}

        {confirmed && (

          <div
            style={{
              background:
                "#ffffff",

              borderRadius:
                "16px",

              padding:
                "24px",

              marginBottom:
                "20px",

              boxShadow:
                "0 2px 10px rgba(0,0,0,0.05)",
            }}
          >

            <h2
              style={{
                margin:
                  "0 0 18px",

                fontSize:
                  "19px",
              }}
            >
              ⑥ 生成 PDF
            </h2>


            <div
              style={{
                marginBottom:
                  "16px",

                color:
                  "#4b5563",
              }}
            >
              文件名：

              <strong
                style={{
                  color:
                    "#111827",

                  marginLeft:
                    "5px",
                }}
              >
                frais{" "}
                {year ||
                  "XXXX"}{" "}
                {month
                  ? String(
                      month
                    ).padStart(
                      2,
                      "0"
                    )
                  : "XX"}
                .pdf
              </strong>

            </div>


            <button
              type="button"
              onClick={
                generatePdf
              }
              disabled={
                generating
              }
              style={{
                padding:
                  "14px 24px",

                border:
                  "none",

                borderRadius:
                  "8px",

                background:
                  generating
                    ? "#9ca3af"
                    : "#7c3aed",

                color:
                  "#ffffff",

                cursor:
                  generating
                    ? "not-allowed"
                    : "pointer",

                fontWeight:
                  700,

                fontSize:
                  "16px",

                minWidth:
                  "180px",
              }}
            >
              {generating
                ? "正在生成 PDF..."
                : "📄 生成 PDF"}
            </button>


            {generatedUrl && (

              <div
                style={{
                  marginTop:
                    "18px",

                  padding:
                    "18px",

                  background:
                    "#f0fdf4",

                  border:
                    "1px solid #bbf7d0",

                  borderRadius:
                    "10px",
                }}
              >

                <div
                  style={{
                    fontWeight:
                      700,

                    color:
                      "#166534",

                    marginBottom:
                      "10px",

                    fontSize:
                      "17px",
                  }}
                >
                  ✓ PDF 已生成
                </div>


                <div
                  style={{
                    marginBottom:
                      "12px",

                    fontSize:
                      "14px",
                  }}
                >
                  文件：

                  <strong>
                    {" "}
                    {
                      generatedFileName
                    }
                  </strong>

                </div>


                <button
                  type="button"
                  onClick={
                    downloadPdf
                  }
                  style={{
                    padding:
                      "13px 22px",

                    border:
                      "none",

                    borderRadius:
                      "8px",

                    background:
                      "#16a34a",

                    color:
                      "#ffffff",

                    cursor:
                      "pointer",

                    fontWeight:
                      700,

                    fontSize:
                      "15px",
                  }}
                >
                  ⬇ 下载 PDF
                </button>

              </div>

            )}

          </div>

        )}

      </div>

    </div>
  );
}
 
