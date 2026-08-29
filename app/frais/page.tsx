"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { PDFDocument } from "pdf-lib";
import { createWorker } from "tesseract.js";

// =====================================================
// 类型
// =====================================================

type InvoiceStatus =
  | "waiting"
  | "processing"
  | "success"
  | "failed";

type Invoice = {
  id: string;
  file: File;
  name: string;
  amount: number | null;
  ocrText: string;
  status: InvoiceStatus;
  selected: boolean;
};

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

// =====================================================
// 金额格式
// =====================================================

function formatMoney(value: number) {
  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// =====================================================
// 判断 PDF
// =====================================================

function isPdfFile(file: File) {
  return (
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf")
  );
}

// =====================================================
// OCR 文本提取金额
// =====================================================

function parseAmountFromText(
  text: string
): number | null {
  if (!text) {
    return null;
  }

  const normalized = text
    .replace(/，/g, ",")
    .replace(/￥/g, "¥")
    .replace(/\s+/g, " ");

  // ---------------------------------------------------
  // 优先寻找价税合计
  // ---------------------------------------------------

  const patterns = [
    /价税合计[^\d]{0,30}¥?\s*([\d,]+(?:\.\d{1,2})?)/i,

    /价税合计[^\d]{0,30}([\d,]+(?:\.\d{1,2})?)/i,

    /小写[^\d]{0,30}¥?\s*([\d,]+(?:\.\d{1,2})?)/i,

    /合\s*计[^\d]{0,30}¥?\s*([\d,]+(?:\.\d{1,2})?)/i,

    /金额[^\d]{0,30}¥?\s*([\d,]+(?:\.\d{1,2})?)/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);

    if (match?.[1]) {
      const value = Number(
        match[1].replace(/,/g, "")
      );

      if (
        Number.isFinite(value) &&
        value > 0
      ) {
        return value;
      }
    }
  }

  // ---------------------------------------------------
  // 扫描所有带两位小数的金额
  // ---------------------------------------------------

  const matches = normalized.match(
    /(?:¥|￥)?\s*\d[\d,]*\.\d{2}/g
  );

  if (!matches || matches.length === 0) {
    return null;
  }

  const numbers = matches
    .map((item) =>
      Number(
        item
          .replace(/[¥￥\s]/g, "")
          .replace(/,/g, "")
      )
    )
    .filter(
      (value) =>
        Number.isFinite(value) &&
        value > 0
    );

  if (numbers.length === 0) {
    return null;
  }

  // 没有明确字段时，暂时取最大金额。
  return Math.max(...numbers);
}

// =====================================================
// PDF 转图片
// =====================================================

async function renderPdfToImages(
  file: File
): Promise<string[]> {
  const pdfjsLib =
    await import("pdfjs-dist");

  const arrayBuffer =
    await file.arrayBuffer();

  const loadingTask =
    pdfjsLib.getDocument({
      data: arrayBuffer,
    });

  const pdf =
    await loadingTask.promise;

  const images: string[] = [];

  for (
    let pageNumber = 1;
    pageNumber <= pdf.numPages;
    pageNumber++
  ) {
    const page =
      await pdf.getPage(pageNumber);

    const viewport =
      page.getViewport({
        scale: 2,
      });

    const canvas =
      document.createElement(
        "canvas"
      );

    const context =
      canvas.getContext("2d");

    if (!context) {
      continue;
    }

    canvas.width =
      Math.ceil(viewport.width);

    canvas.height =
      Math.ceil(viewport.height);

    // =================================================
    // 关键修复：
    // 新版 pdfjs-dist 的 RenderParameters
    // 要求 canvas
    // =================================================

    await page.render({
      canvas,
      canvasContext: context,
      viewport,
    }).promise;

    images.push(
      canvas.toDataURL(
        "image/jpeg",
        0.9
      )
    );
  }

  return images;
}

// =====================================================
// OCR
// =====================================================

async function recognizeInvoice(
  file: File,
  worker: any
): Promise<string> {
  // ---------------------------------------------------
  // PDF
  // ---------------------------------------------------

  if (isPdfFile(file)) {
    const images =
      await renderPdfToImages(file);

    if (images.length === 0) {
      throw new Error(
        "PDF 无法转换为图片"
      );
    }

    let result = "";

    for (
      let i = 0;
      i < images.length;
      i++
    ) {
      const pageResult =
        await worker.recognize(
          images[i]
        );

      result +=
        "\n" +
        pageResult.data.text;
    }

    return result;
  }

  // ---------------------------------------------------
  // 图片
  // ---------------------------------------------------

  const result =
    await worker.recognize(file);

  return result.data.text;
}

// =====================================================
// 组合算法
// =====================================================

function findBestMatches(
  invoices: Invoice[],
  target: number
): MatchResult[] {
  const validInvoices =
    invoices
      .map((invoice, index) => ({
        invoice,
        index,
      }))
      .filter(
        ({ invoice }) =>
          invoice.amount !== null &&
          invoice.amount > 0
      );

  if (
    validInvoices.length === 0
  ) {
    return [];
  }

  // ---------------------------------------------------
  // 如果票据数量特别大，限制计算数量
  // ---------------------------------------------------

  const MAX_ITEMS = 36;

  let workingItems =
    validInvoices;

  if (
    workingItems.length >
    MAX_ITEMS
  ) {
    workingItems =
      [...workingItems]
        .sort(
          (a, b) =>
            Math.abs(
              (a.invoice.amount || 0) -
                target
            ) -
            Math.abs(
              (b.invoice.amount || 0) -
                target
            )
        )
        .slice(
          0,
          MAX_ITEMS
        );
  }

  const mid =
    Math.floor(
      workingItems.length / 2
    );

  const left =
    workingItems.slice(
      0,
      mid
    );

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

    for (
      const item of array
    ) {
      const originalLength =
        result.length;

      for (
        let i = 0;
        i < originalLength;
        i++
      ) {
        const subset =
          result[i];

        const amount =
          item.invoice.amount || 0;

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

      // 防止极端情况下浏览器爆内存
      if (
        result.length >
        1_000_000
      ) {
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
    let high =
      array.length;

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

  const matches: MatchResult[] =
    [];

  const seen =
    new Set<string>();

  for (
    const leftSubset of
      leftSubsets
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
      const difference =
        Math.abs(
          a.difference
        ) -
        Math.abs(
          b.difference
        );

      if (
        Math.abs(difference) >
        0.000001
      ) {
        return difference;
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
// 创建最终 PDF
// =====================================================

async function createCombinedPdf(
  invoices: Invoice[],
  selectedIndexes: number[]
): Promise<Uint8Array> {
  const outputPdf =
    await PDFDocument.create();

  for (
    const index of
      selectedIndexes
  ) {
    const invoice =
      invoices[index];

    const file =
      invoice.file;

    // -------------------------------------------------
    // 原始 PDF
    // -------------------------------------------------

    if (isPdfFile(file)) {
      const bytes =
        await file.arrayBuffer();

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
        const page of
          copiedPages
      ) {
        outputPdf.addPage(
          page
        );
      }

      continue;
    }

    // -------------------------------------------------
    // 图片
    // -------------------------------------------------

    const bytes =
      await file.arrayBuffer();

    let image;

    const isPng =
      file.type ===
        "image/png" ||
      file.name
        .toLowerCase()
        .endsWith(".png");

    if (isPng) {
      image =
        await outputPdf.embedPng(
          bytes
        );
    } else {
      image =
        await outputPdf.embedJpg(
          bytes
        );
    }

    const originalWidth =
      image.width;

    const originalHeight =
      image.height;

    // A4
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
      originalWidth *
      scale;

    const height =
      originalHeight *
      scale;

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

  return outputPdf.save();
}

// =====================================================
// 页面
// =====================================================

export default function FraisPage() {
  const [
    invoices,
    setInvoices,
  ] = useState<Invoice[]>([]);

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
    processing,
    setProcessing,
  ] = useState(false);

  const [
    processingText,
    setProcessingText,
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

  const inputRef =
    useRef<HTMLInputElement>(
      null
    );

  // ---------------------------------------------------
  // 清理 URL
  // ---------------------------------------------------

  useEffect(() => {
    return () => {
      if (generatedUrl) {
        URL.revokeObjectURL(
          generatedUrl
        );
      }
    };
  }, [generatedUrl]);

  // ---------------------------------------------------
  // 当前手工选择总额
  // ---------------------------------------------------

  const manualTotal =
    useMemo(() => {
      return invoices
        .filter(
          (invoice) =>
            invoice.selected &&
            invoice.amount !== null
        )
        .reduce(
          (sum, invoice) =>
            sum +
            (invoice.amount || 0),
          0
        );
    }, [invoices]);

  // ---------------------------------------------------
  // 上传文件
  // ---------------------------------------------------

  function handleFiles(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const files =
      Array.from(
        event.target.files || []
      );

    if (
      files.length === 0
    ) {
      return;
    }

    const validFiles =
      files.filter(
        (file) => {
          const pdf =
            isPdfFile(file);

          const image =
            file.type.startsWith(
              "image/"
            );

          return pdf || image;
        }
      );

    const newInvoices =
      validFiles.map(
        (file, index) => ({
          id:
            `${Date.now()}-${index}-${Math.random()}`,

          file,

          name:
            file.name,

          amount:
            null,

          ocrText:
            "",

          status:
            "waiting" as InvoiceStatus,

          selected:
            false,
        })
      );

    setInvoices(
      (previous) => [
        ...previous,
        ...newInvoices,
      ]
    );

    setMatches([]);

    setConfirmed(false);

    setGeneratedUrl(null);

    setGeneratedFileName("");

    event.target.value = "";
  }

  // ---------------------------------------------------
  // 删除
  // ---------------------------------------------------

  function removeInvoice(
    id: string
  ) {
    setInvoices(
      (previous) =>
        previous.filter(
          (invoice) =>
            invoice.id !== id
        )
    );

    setMatches([]);

    setConfirmed(false);

    setGeneratedUrl(null);
  }

  // ---------------------------------------------------
  // 修改金额
  // ---------------------------------------------------

  function updateAmount(
    id: string,
    value: string
  ) {
    if (value === "") {
      setInvoices(
        (previous) =>
          previous.map(
            (invoice) =>
              invoice.id === id
                ? {
                    ...invoice,
                    amount:
                      null,
                    status:
                      "waiting",
                  }
                : invoice
          )
      );
    } else {
      const amount =
        Number(value);

      setInvoices(
        (previous) =>
          previous.map(
            (invoice) =>
              invoice.id === id
                ? {
                    ...invoice,
                    amount:
                      Number.isFinite(
                        amount
                      )
                        ? amount
                        : null,
                    status:
                      "success",
                  }
                : invoice
          )
      );
    }

    setMatches([]);

    setConfirmed(false);

    setGeneratedUrl(null);
  }

  // ---------------------------------------------------
  // OCR
  // ---------------------------------------------------

  async function startOCR() {
    if (
      invoices.length === 0
    ) {
      alert(
        "请先上传发票。"
      );
      return;
    }

    setProcessing(true);

    setConfirmed(false);

    setMatches([]);

    setGeneratedUrl(null);

    let worker: any = null;

    try {
      setProcessingText(
        "正在启动 OCR..."
      );

      worker =
        await createWorker(
          "chi_sim+eng",
          1,
          {
            logger: (message) => {
              if (
                message.status ===
                "recognizing text"
              ) {
                const progress =
                  Math.round(
                    (message.progress ||
                      0) *
                      100
                  );

                setProcessingText(
                  `正在 OCR：${progress}%`
                );
              }
            },
          }
        );

      for (
        let i = 0;
        i < invoices.length;
        i++
      ) {
        const invoice =
          invoices[i];

        setInvoices(
          (previous) =>
            previous.map(
              (item) =>
                item.id ===
                invoice.id
                  ? {
                      ...item,
                      status:
                        "processing",
                    }
                  : item
            )
        );

        setProcessingText(
          `正在识别第 ${
            i + 1
          } / ${
            invoices.length
          } 张：${invoice.name}`
        );

        try {
          const text =
            await recognizeInvoice(
              invoice.file,
              worker
            );

          const amount =
            parseAmountFromText(
              text
            );

          setInvoices(
            (previous) =>
              previous.map(
                (item) =>
                  item.id ===
                  invoice.id
                    ? {
                        ...item,
                        amount,
                        ocrText:
                          text,
                        status:
                          amount !==
                          null
                            ? "success"
                            : "failed",
                      }
                    : item
              )
          );
        } catch (error) {
          console.error(
            `OCR failed: ${invoice.name}`,
            error
          );

          setInvoices(
            (previous) =>
              previous.map(
                (item) =>
                  item.id ===
                  invoice.id
                    ? {
                        ...item,
                        status:
                          "failed",
                      }
                    : item
              )
          );
        }
      }

      setProcessingText(
        "OCR 识别完成"
      );
    } catch (error) {
      console.error(
        error
      );

      alert(
        "OCR 初始化失败。请检查 tesseract.js 是否正常安装。"
      );
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch {}
      }

      setProcessing(false);
    }
  }

  // ---------------------------------------------------
  // 计算最佳组合
  // ---------------------------------------------------

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

    const result =
      findBestMatches(
        invoices,
        targetValue
      );

    if (
      result.length === 0
    ) {
      alert(
        "没有找到可计算的发票。请先 OCR，或者手动填写发票金额。"
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

  // ---------------------------------------------------
  // 选择推荐方案
  // ---------------------------------------------------

  function chooseMatch(
    matchIndex: number
  ) {
    const match =
      matches[matchIndex];

    if (!match) {
      return;
    }

    setSelectedMatchIndex(
      matchIndex
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

  // ---------------------------------------------------
  // 手动选择
  // ---------------------------------------------------

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

  // ---------------------------------------------------
  // 确认
  // ---------------------------------------------------

  function confirmSelection() {
    const selected =
      invoices.filter(
        (invoice) =>
          invoice.selected
      );

    if (
      selected.length === 0
    ) {
      alert(
        "请先选择发票。"
      );
      return;
    }

    const total =
      selected.reduce(
        (sum, invoice) =>
          sum +
          (invoice.amount || 0),
        0
      );

    const targetValue =
      Number(target);

    const difference =
      total -
      targetValue;

    const message =
      `确认使用 ${selected.length} 张发票？\n\n` +
      `目标金额：${formatMoney(
        targetValue
      )}\n` +
      `发票合计：${formatMoney(
        total
      )}\n` +
      `差额：${
        difference >= 0
          ? "+"
          : ""
      }${formatMoney(
        difference
      )}\n\n` +
      `确认后才会生成最终 PDF。`;

    if (
      !window.confirm(
        message
      )
    ) {
      return;
    }

    setConfirmed(true);
  }

  // ---------------------------------------------------
  // 生成 PDF
  // ---------------------------------------------------

  async function generatePdf() {
    if (!confirmed) {
      alert(
        "请先确认发票组合。"
      );
      return;
    }

    if (
      !year ||
      !month
    ) {
      alert(
        "请填写年份和月份。"
      );
      return;
    }

    const selectedIndexes =
      invoices
        .map(
          (invoice, index) => ({
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
          }) => index
        );

    if (
      selectedIndexes.length ===
      0
    ) {
      alert(
        "没有选择发票。"
      );
      return;
    }

    setGenerating(true);

    try {
      const pdfBytes =
        await createCombinedPdf(
          invoices,
          selectedIndexes
        );

      // =================================================
      // 关键修复：
      // Uint8Array<ArrayBufferLike>
      // -> 标准 ArrayBuffer
      // =================================================

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

      const fileName =
        `frais ${year} ${String(
          month
        ).padStart(
          2,
          "0"
        )}.pdf`;

      if (generatedUrl) {
        URL.revokeObjectURL(
          generatedUrl
        );
      }

      setGeneratedUrl(url);

      setGeneratedFileName(
        fileName
      );
    } catch (error) {
      console.error(
        error
      );

      alert(
        "PDF 生成失败，请检查发票文件。"
      );
    } finally {
      setGenerating(false);
    }
  }

  // ---------------------------------------------------
  // 下载 PDF
  // ---------------------------------------------------

  function downloadPdf() {
    if (
      !generatedUrl ||
      !generatedFileName
    ) {
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

  // ---------------------------------------------------
  // 清空
  // ---------------------------------------------------

  function clearAll() {
    if (
      !window.confirm(
        "确定清空全部发票吗？"
      )
    ) {
      return;
    }

    setInvoices([]);

    setMatches([]);

    setConfirmed(false);

    if (generatedUrl) {
      URL.revokeObjectURL(
        generatedUrl
      );
    }

    setGeneratedUrl(null);

    setGeneratedFileName("");

    setProcessingText("");
  }

  // ---------------------------------------------------
  // 当前数据
  // ---------------------------------------------------

  const selectedCount =
    invoices.filter(
      (invoice) =>
        invoice.selected
    ).length;

  const targetValue =
    Number(target) || 0;

  const selectedDifference =
    manualTotal -
    targetValue;

  // =====================================================
  // UI
  // =====================================================

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
            批量上传发票 → OCR 识别 → 自动寻找目标金额组合 → 人工确认 → 合并 PDF
          </div>
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
            {/* 目标金额 */}
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
                value={target}
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

            {/* 年份 */}
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
                value={year}
                onChange={(e) =>
                  setYear(
                    e.target.value
                  )
                }
                type="number"
                placeholder="2026"
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

            {/* 月份 */}
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
                value={month}
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
                      key={i + 1}
                      value={
                        String(
                          i + 1
                        )
                      }
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
              {year || "XXXX"}{" "}
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
        {/* ② 上传 */}
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
            ② 上传发票
          </h2>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="application/pdf,image/png,image/jpeg,image/jpg"
            onChange={
              handleFiles
            }
            style={{
              display:
                "none",
            }}
          />

          <button
            onClick={() =>
              inputRef.current?.click()
            }
            style={{
              width:
                "100%",
              padding:
                "22px",
              border:
                "2px dashed #9ca3af",
              borderRadius:
                "12px",
              background:
                "#fafafa",
              cursor:
                "pointer",
              fontSize:
                "16px",
              fontWeight:
                600,
            }}
          >
            ＋ 一次选择多张发票
          </button>

          <div
            style={{
              marginTop:
                "10px",
              fontSize:
                "13px",
              color:
                "#6b7280",
            }}
          >
            支持 PDF、JPG、JPEG、PNG，可以一次选择多张。
          </div>

          {invoices.length >
            0 && (
            <div
              style={{
                marginTop:
                  "18px",
                display:
                  "flex",
                gap:
                  "10px",
              }}
            >
              <button
                onClick={
                  startOCR
                }
                disabled={
                  processing
                }
                style={{
                  padding:
                    "11px 18px",
                  border:
                    "none",
                  borderRadius:
                    "8px",
                  background:
                    processing
                      ? "#9ca3af"
                      : "#111827",
                  color:
                    "#ffffff",
                  cursor:
                    processing
                      ? "not-allowed"
                      : "pointer",
                  fontWeight:
                    600,
                }}
              >
                {processing
                  ? "正在 OCR..."
                  : "开始识别金额"}
              </button>

              <button
                onClick={
                  clearAll
                }
                disabled={
                  processing
                }
                style={{
                  padding:
                    "11px 18px",
                  border:
                    "1px solid #d1d5db",
                  borderRadius:
                    "8px",
                  background:
                    "#ffffff",
                  cursor:
                    "pointer",
                }}
              >
                清空全部
              </button>
            </div>
          )}

          {processingText && (
            <div
              style={{
                marginTop:
                  "14px",
                padding:
                  "12px",
                background:
                  "#eff6ff",
                borderRadius:
                  "8px",
                color:
                  "#1d4ed8",
              }}
            >
              {processingText}
            </div>
          )}
        </div>

        {/* ================================================= */}
        {/* ③ 发票列表 */}
        {/* ================================================= */}

        {invoices.length >
          0 && (
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
              ③ 发票识别结果
            </h2>

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
                      状态
                    </th>

                    <th
                      style={{
                        padding:
                          "10px",
                        borderBottom:
                          "1px solid #e5e7eb",
                      }}
                    >
                      操作
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {invoices.map(
                    (
                      invoice
                    ) => (
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
                              "420px",
                          }}
                        >
                          <div
                            style={{
                              fontWeight:
                                500,
                              overflow:
                                "hidden",
                              textOverflow:
                                "ellipsis",
                              whiteSpace:
                                "nowrap",
                            }}
                          >
                            {
                              invoice.name
                            }
                          </div>

                          <div
                            style={{
                              fontSize:
                                "12px",
                              color:
                                "#9ca3af",
                              marginTop:
                                "3px",
                            }}
                          >
                            {(
                              invoice
                                .file
                                .size /
                              1024
                            ).toFixed(
                              1
                            )}{" "}
                            KB
                          </div>
                        </td>

                        <td
                          style={{
                            padding:
                              "10px",
                            borderBottom:
                              "1px solid #f0f0f0",
                            textAlign:
                              "right",
                          }}
                        >
                          <input
                            type="number"
                            step="0.01"
                            value={
                              invoice.amount ??
                              ""
                            }
                            onChange={(
                              e
                            ) =>
                              updateAmount(
                                invoice.id,
                                e.target
                                  .value
                              )
                            }
                            style={{
                              width:
                                "130px",
                              padding:
                                "8px",
                              border:
                                "1px solid #d1d5db",
                              borderRadius:
                                "6px",
                              textAlign:
                                "right",
                            }}
                          />
                        </td>

                        <td
                          style={{
                            padding:
                              "10px",
                            borderBottom:
                              "1px solid #f0f0f0",
                            textAlign:
                              "center",
                          }}
                        >
                          {invoice.status ===
                            "waiting" &&
                            "待识别"}

                          {invoice.status ===
                            "processing" &&
                            "识别中..."}

                          {invoice.status ===
                            "success" &&
                            "✓ 已识别"}

                          {invoice.status ===
                            "failed" &&
                            "⚠ 请手动填写"}
                        </td>

                        <td
                          style={{
                            padding:
                              "10px",
                            borderBottom:
                              "1px solid #f0f0f0",
                            textAlign:
                              "center",
                          }}
                        >
                          <button
                            onClick={() =>
                              removeInvoice(
                                invoice.id
                              )
                            }
                            style={{
                              border:
                                "none",
                              background:
                                "transparent",
                              color:
                                "#dc2626",
                              cursor:
                                "pointer",
                            }}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ================================================= */}
        {/* ④ 匹配 */}
        {/* ================================================= */}

        {invoices.length >
          0 && (
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
              onClick={
                calculateMatches
              }
              disabled={
                processing
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

            {matches.length >
              0 && (
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

        {invoices.length >
          0 && (
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

              <br />

              OCR 如果识别错误，可以直接修改金额，然后重新计算。
            </div>

            <button
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
                  "pointer",
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

                下一步生成：

                <strong>
                  {" "}
                  frais{" "}
                  {year || "XXXX"}{" "}
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
                }}
              >
                frais{" "}
                {year || "XXXX"}{" "}
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
              onClick={
                generatePdf
              }
              disabled={
                generating ||
                !year ||
                !month
              }
              style={{
                padding:
                  "13px 22px",
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
                  "15px",
              }}
            >
              {generating
                ? "正在生成 PDF..."
                : "生成 PDF"}
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
                  {
                    generatedFileName
                  }
                </div>

                <button
                  onClick={
                    downloadPdf
                  }
                  style={{
                    padding:
                      "12px 20px",
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
 
