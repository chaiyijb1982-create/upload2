"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getCreditCards,
  getCreditCardMonthlyBills,
  saveCreditCardMonthlyBill,
} from "@/lib/credit-card";

// =====================================================
// 类型
// =====================================================

type Card = {
  id: string;
  bank_name: string;
  card_name: string;
  billing_day: number;
  monthly_estimate: number;
  actual_bill_amount: number;
};

type Row = {
  id: string;

  // OCR 显示名称
  ocrName: string;

  // OCR 原始区块
  rawText: string;

  // 合并前的卡号后四位
  last4: string;

  // 合并前多个卡号后四位
  last4List?: string[];

  // 实际账单金额
  amount: number;

  // 匹配到的 credit_cards.id
  cardId: string;

  // 是否自动匹配
  matched: boolean;

  // 数据库已有金额
  existing?: number;

  // 是否由多个 OCR 区块合并而来
  merged?: boolean;
};

declare global {
  interface Window {
    Tesseract?: any;
  }
}

// =====================================================
// 基础工具
// =====================================================

const pad = (x: number) =>
  String(x).padStart(2, "0");

const money = (v: number) =>
  `¥ ${Number(v || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// =====================================================
// OCR 文本标准化
// =====================================================

function cleanOCRText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[|｜]/g, " ")
    .replace(/[：:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// =====================================================
// 银行名称标准化
//
// 特别注意：
//
// 宁波银行
// 宁波银行2
//
// 必须严格区分。
// =====================================================

function normalizeBankName(value: unknown): string {
  let x = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")");

  // OCR 常见误识别字符
  x = x
    .replace(/©/g, "")
    .replace(/@/g, "")
    .replace(/心/g, "")
    .replace(/四/g, "")
    .replace(/Ge/g, "")
    .replace(/\[/g, "")
    .replace(/\]/g, "");

  // 信用卡文字
  x = x.replace(/信用卡/g, "");

  // ===================================================
  // 极其重要：
  // 宁波银行2 必须在宁波银行之前判断
  // ===================================================

  if (
    x === "宁波银行2" ||
    x === "宁波2银行" ||
    x === "宁波银行(2)" ||
    x === "宁波银行（2）"
  ) {
    return "宁波银行2";
  }

  // ===================================================
  // 常见银行名称
  // ===================================================

  const map: Record<string, string> = {
    工行: "工商银行",
    工商: "工商银行",
    工商银行: "工商银行",

    建行: "建设银行",
    建设: "建设银行",
    建设银行: "建设银行",

    中行: "中国银行",
    中国: "中国银行",
    中国银行: "中国银行",

    农行: "农业银行",
    农业: "农业银行",
    农业银行: "农业银行",

    交行: "交通银行",
    交通: "交通银行",
    交通银行: "交通银行",

    招行: "招商银行",
    招商: "招商银行",
    招商银行: "招商银行",

    中信: "中信银行",
    中信银行: "中信银行",

    宁波: "宁波银行",
    宁波银行: "宁波银行",

    宁波银行2: "宁波银行2",
  };

  return map[x] ?? x;
}

// =====================================================
// 从 OCR 文本中检测银行
// =====================================================

function detectBankName(text: string): string {
  const raw = cleanOCRText(text);

  // ===================================================
  // 顺序非常重要
  // 宁波银行2 必须先判断
  // ===================================================

  const patterns = [
    /宁波\s*银行\s*2/i,
    /宁波\s*银行/i,

    /建设\s*银行/i,
    /交通\s*银行/i,
    /招商\s*银行/i,
    /工商\s*银行/i,
    /中国\s*银行/i,
    /农业\s*银行/i,
    /中信\s*银行/i,

    /建行/i,
    /交行/i,
    /招行/i,
    /工行/i,
    /中行/i,
    /农行/i,
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);

    if (match) {
      return normalizeBankName(match[0]);
    }
  }

  return "";
}

// =====================================================
// 提取卡号后四位
// =====================================================

function extractLast4(text: string): string {
  const raw = cleanOCRText(text);

  // ---------------------------------------------------
  // 优先识别 [] 中的数字
  // ---------------------------------------------------

  const bracketMatch = raw.match(
    /[\[(【]\s*(\d{4})\s*[\])】]/
  );

  if (bracketMatch) {
    return bracketMatch[1];
  }

  // ---------------------------------------------------
  // 常见掩码
  // ---------------------------------------------------

  const maskedMatch = raw.match(
    /(?:\*{2,}|x{2,}|X{2,})\s*(\d{4})/
  );

  if (maskedMatch) {
    return maskedMatch[1];
  }

  // ---------------------------------------------------
  // 有些 OCR：
  //
  // 建设银行 2215
  //
  // 但是不能随便把数字当卡号。
  // 这里只针对银行标题行处理。
  // ---------------------------------------------------

  const bankTitle = detectBankName(raw);

  if (bankTitle) {
    const numbers = [
      ...raw.matchAll(/\b(\d{4})\b/g),
    ];

    if (numbers.length > 0) {
      return numbers[0][1];
    }
  }

  return "";
}

// =====================================================
// 判断是否银行标题
// =====================================================

function isBankHeader(text: string): boolean {
  return !!detectBankName(text);
}

// =====================================================
// 提取实际账单金额
// =====================================================

function extractBillAmount(
  blockText: string,
  last4: string
): number {
  const raw = blockText
    .replace(/\r/g, "\n")
    .trim();

  // ===================================================
  // ① 优先识别货币符号
  // ===================================================

  const currencyPatterns = [
    /[¥￥]\s*([0-9][0-9,]*(?:\.\d{1,2})?)/g,

    /\bRMB\s*([0-9][0-9,]*(?:\.\d{1,2})?)\b/gi,

    /\bY\s*([0-9][0-9,]*(?:\.\d{1,2})?)\b/g,
  ];

  const currencyCandidates: number[] = [];

  for (const pattern of currencyPatterns) {
    for (const match of raw.matchAll(pattern)) {
      const value = Number(
        String(match[1] ?? "").replace(/,/g, "")
      );

      if (
        Number.isFinite(value) &&
        value > 0 &&
        value < 100000000
      ) {
        currencyCandidates.push(value);
      }
    }
  }

  if (currencyCandidates.length > 0) {
    return currencyCandidates[
      currencyCandidates.length - 1
    ];
  }

  // ===================================================
  // ② 删除卡号后四位
  // ===================================================

  let text = raw;

  if (last4) {
    const escaped = last4.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&"
    );

    text = text.replace(
      new RegExp(`\\b${escaped}\\b`, "g"),
      " "
    );
  }

  // ===================================================
  // ③ 删除日期和天数
  // ===================================================

  text = text
    .replace(
      /\d{1,2}\s*月\s*\d{1,2}\s*日/g,
      " "
    )
    .replace(
      /\d{1,3}\s*天\s*后/g,
      " "
    )
    .replace(
      /\d{1,2}\s*月/g,
      " "
    )
    .replace(
      /\d{1,2}\s*日/g,
      " "
    );

  // ===================================================
  // ④ 删除非金额上下文
  // ===================================================

  text = text
    .replace(/到期/g, " ")
    .replace(/分期/g, " ")
    .replace(/还款/g, " ")
    .replace(/明细/g, " ");

  // ===================================================
  // ⑤ 小数金额
  // ===================================================

  const decimalCandidates: number[] = [];

  const decimalPattern =
    /\b([0-9][0-9,]*\.[0-9]{1,2})\b/g;

  for (const match of text.matchAll(
    decimalPattern
  )) {
    const value = Number(
      String(match[1] ?? "").replace(/,/g, "")
    );

    if (
      Number.isFinite(value) &&
      value > 0 &&
      value < 100000000
    ) {
      decimalCandidates.push(value);
    }
  }

  if (decimalCandidates.length > 0) {
    return decimalCandidates[
      decimalCandidates.length - 1
    ];
  }

  // ===================================================
  // ⑥ 最后才识别整数
  // ===================================================

  const integerCandidates: number[] = [];

  const integerPattern =
    /\b([0-9][0-9,]{1,})\b/g;

  for (const match of text.matchAll(
    integerPattern
  )) {
    const rawNumber = String(
      match[1] ?? ""
    );

    const value = Number(
      rawNumber.replace(/,/g, "")
    );

    if (!Number.isFinite(value)) continue;

    // 5 / 15 / 6 / 16 / 113 等不能成为账单金额
    if (value < 100) continue;

    if (value > 100000000) continue;

    // 卡号后四位不能作为金额
    if (
      last4 &&
      rawNumber.replace(/,/g, "") === last4
    ) {
      continue;
    }

    integerCandidates.push(value);
  }

  if (integerCandidates.length > 0) {
    return integerCandidates[
      integerCandidates.length - 1
    ];
  }

  return 0;
}

// =====================================================
// OCR 区块
// =====================================================

type OCRBlock = {
  bankName: string;
  last4: string;
  rawText: string;
};

// =====================================================
// 将 OCR 文本切成信用卡区块
// =====================================================

function splitOCRBlocks(
  text: string
): OCRBlock[] {
  const lines = text
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);

  const blocks: OCRBlock[] = [];

  let current: OCRBlock | null = null;

  for (const line of lines) {
    const bankName =
      detectBankName(line);

    // -------------------------------------------------
    // 找到新的银行标题
    // -------------------------------------------------

    if (bankName) {
      if (current) {
        blocks.push(current);
      }

      current = {
        bankName,
        last4: extractLast4(line),
        rawText: line,
      };

      continue;
    }

    // -------------------------------------------------
    // 继续加入当前区块
    // -------------------------------------------------

    if (current) {
      current.rawText +=
        "\n" + line;

      // OCR 有时候会把后四位单独放在下一行
      if (
        !current.last4 &&
        /^\d{4}$/.test(line)
      ) {
        current.last4 = line;
      }
    }
  }

  if (current) {
    blocks.push(current);
  }

  return blocks;
}

// =====================================================
// 信用卡匹配
//
// 第一优先：
// 银行 + 后四位
//
// 第二优先：
// 严格银行名称
//
// 宁波银行 != 宁波银行2
// =====================================================

function matchCard(
  bankName: string,
  last4: string,
  cards: Card[]
): Card | undefined {
  const normalizedOCRBank =
    normalizeBankName(bankName);

  // ===================================================
  // ① 银行 + 后四位
  // ===================================================

  if (last4) {
    const exactCandidates =
      cards.filter((card) => {
        const cardBank =
          normalizeBankName(
            card.bank_name
          );

        const cardName =
          normalizeBankName(
            card.card_name
          );

        const bankEqual =
          cardBank ===
            normalizedOCRBank ||
          cardName ===
            normalizedOCRBank;

        if (!bankEqual) {
          return false;
        }

        return (
          String(
            card.card_name
          ).includes(last4) ||
          String(
            card.bank_name
          ).includes(last4)
        );
      });

    if (
      exactCandidates.length === 1
    ) {
      return exactCandidates[0];
    }
  }

  // ===================================================
  // ② 严格银行匹配
  //
  // 如果同银行有多张卡：
  //
  // 建设银行
  // 建设银行
  //
  // 不能直接决定是哪一张。
  //
  // 后面会通过“银行合并目标卡”解决。
  // ===================================================

  const strictCandidates =
    cards.filter((card) => {
      const cardBank =
        normalizeBankName(
          card.bank_name
        );

      const cardName =
        normalizeBankName(
          card.card_name
        );

      return (
        cardBank ===
          normalizedOCRBank ||
        cardName ===
          normalizedOCRBank
      );
    });

  if (
    strictCandidates.length === 1
  ) {
    return strictCandidates[0];
  }

  return undefined;
}

// =====================================================
// 找到“银行最终写入卡”
//
// 这是本次最重要的新逻辑。
//
// 例如数据库：
//
// 建设银行
//   - 建设银行信用卡
//   - 建设银行信用卡2
//
// OCR：
//
// 建设银行 [2215]
// 建设银行 [7357]
//
// 两张都识别成建设银行后，
// 最终统一写入名称为“建设银行信用卡”的那一张。
//
// =====================================================

function findMergedTargetCard(
  bankName: string,
  cards: Card[]
): Card | undefined {
  const normalizedBank =
    normalizeBankName(bankName);

  const candidates =
    cards.filter((card) => {
      const cardBank =
        normalizeBankName(
          card.bank_name
        );

      const cardName =
        normalizeBankName(
          card.card_name
        );

      return (
        cardBank === normalizedBank ||
        cardName === normalizedBank
      );
    });

  if (!candidates.length) {
    return undefined;
  }

  // ===================================================
  // 如果只有一张，直接使用
  // ===================================================

  if (candidates.length === 1) {
    return candidates[0];
  }

  // ===================================================
  // 如果有多张：
  //
  // 优先选择 card_name / bank_name
  // 明确等于“建设银行信用卡”的主卡。
  //
  // 不修改数据库，只决定本次写入目标。
  // ===================================================

  const preferredNames = [
    "建设银行信用卡",
    "交通银行信用卡",
    "招商银行信用卡",
    "工商银行信用卡",
    "中国银行信用卡",
    "农业银行信用卡",
    "中信银行信用卡",
    "宁波银行信用卡",
  ];

  const preferred =
    candidates.find((card) => {
      const name =
        String(card.card_name)
          .trim();

      return preferredNames.includes(
        name
      );
    });

  if (preferred) {
    return preferred;
  }

  // ===================================================
  // 如果找不到明确主卡：
  //
  // 选择 card_name 与银行标准名称
  // 最接近的一张。
  //
  // 例如：
  // 建设银行
  // 建设银行信用卡
  //
  // 会优先选择后者。
  // ===================================================

  const exactBankName =
    candidates.find(
      (card) =>
        String(
          card.card_name
        ).trim() ===
        `${normalizedBank}信用卡`
    );

  if (exactBankName) {
    return exactBankName;
  }

  // ===================================================
  // 最后使用第一张。
  //
  // 注意：
  // 这只决定导入目标，
  // 不会修改 credit_cards。
  // ===================================================

  return candidates[0];
}

// =====================================================
// OCR 原始结果 → Row
//
// 这里先保持“一个 OCR 区块一行”。
// 然后下一步专门执行“银行合并”。
// =====================================================

function parseOCRToRawRows(
  text: string,
  cards: Card[]
): Row[] {
  const blocks =
    splitOCRBlocks(text);

  const rows: Row[] = [];

  for (
    let i = 0;
    i < blocks.length;
    i++
  ) {
    const block =
      blocks[i];

    const amount =
      extractBillAmount(
        block.rawText,
        block.last4
      );

    const matchedCard =
      matchCard(
        block.bankName,
        block.last4,
        cards
      );

    rows.push({
      id:
        `ocr-${Date.now()}-${i}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      ocrName:
        block.last4
          ? `${block.bankName} [${block.last4}]`
          : block.bankName,

      rawText:
        block.rawText,

      last4:
        block.last4,

      last4List:
        block.last4
          ? [block.last4]
          : [],

      amount,

      cardId:
        matchedCard?.id ?? "",

      matched:
        !!matchedCard,
    });
  }

  return rows;
}

// =====================================================
// 银行合并
//
// ⭐ 本次修改核心
//
// 建设银行 [2215]
// 建设银行 [7357]
//
// → 建设银行信用卡
//
// amount = amount1 + amount2
//
// 但是：
//
// 宁波银行
// 宁波银行2
//
// 因为 normalizeBankName 不一样，
// 所以绝对不会合并。
// =====================================================

function mergeRowsByBank(
  rawRows: Row[],
  cards: Card[]
): Row[] {
  const groups =
    new Map<string, Row[]>();

  for (const row of rawRows) {
    // -------------------------------------------------
    // 未识别银行的行不合并
    // -------------------------------------------------

    const bankName =
      detectBankName(
        row.rawText
      );

    if (!bankName) {
      const key =
        `UNMATCHED-${row.id}`;

      groups.set(key, [row]);

      continue;
    }

    const normalizedBank =
      normalizeBankName(
        bankName
      );

    // -------------------------------------------------
    // 严格使用标准银行名作为合并 key
    //
    // 建设银行
    // 建设银行
    //
    // → 同一个 key
    //
    // 宁波银行
    // 宁波银行2
    //
    // → 两个不同 key
    // -------------------------------------------------

    const key =
      `BANK:${normalizedBank}`;

    const existing =
      groups.get(key);

    if (existing) {
      existing.push(row);
    } else {
      groups.set(key, [row]);
    }
  }

  const mergedRows: Row[] = [];

  for (
    const [key, group] of groups
  ) {
    // =================================================
    // 未匹配行
    // =================================================

    if (
      key.startsWith(
        "UNMATCHED-"
      )
    ) {
      mergedRows.push(
        group[0]
      );

      continue;
    }

    const first =
      group[0];

    const bankName =
      detectBankName(
        first.rawText
      );

    // =================================================
    // 找最终写入目标卡
    // =================================================

    const targetCard =
      findMergedTargetCard(
        bankName,
        cards
      );

    // =================================================
    // 合计金额
    // =================================================

    const totalAmount =
      group.reduce(
        (sum, row) =>
          sum +
          Number(
            row.amount || 0
          ),
        0
      );

    // =================================================
    // 合并所有后四位
    // =================================================

    const last4List =
      Array.from(
        new Set(
          group.flatMap(
            (row) =>
              row.last4List?.length
                ? row.last4List
                : row.last4
                  ? [row.last4]
                  : []
          )
        )
      );

    // =================================================
    // 合并 OCR 原始文本
    // =================================================

    const mergedRawText =
      group
        .map(
          (row, index) =>
            `========== OCR 区块 ${
              index + 1
            } ==========\n${row.rawText}`
        )
        .join("\n\n");

    // =================================================
    // 显示名称
    // =================================================

    const displayName =
      targetCard
        ? `${targetCard.bank_name}${
            targetCard.card_name &&
            targetCard.card_name !==
              targetCard.bank_name
              ? ` · ${targetCard.card_name}`
              : ""
          }`
        : bankName;

    // =================================================
    // 创建合并 Row
    // =================================================

    mergedRows.push({
      id:
        `merged-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 8)}`,

      ocrName:
        last4List.length > 0
          ? `${displayName} [${last4List.join(
              " + "
            )}]`
          : displayName,

      rawText:
        mergedRawText,

      last4:
        last4List[0] ?? "",

      last4List,

      amount:
        Number(
          totalAmount.toFixed(2)
        ),

      cardId:
        targetCard?.id ?? "",

      matched:
        !!targetCard,

      merged:
        group.length > 1,
    });
  }

  return mergedRows;
}

// =====================================================
// 主页面
// =====================================================

export default function CreditCardImportPage() {
  const now =
    new Date();

  const [
    year,
    setYear,
  ] = useState(
    now.getFullYear()
  );

  const [
    month,
    setMonth,
  ] = useState(
    now.getMonth() + 1
  );

  const [
    cards,
    setCards,
  ] = useState<Card[]>([]);

  const [
    rows,
    setRows,
  ] = useState<Row[]>([]);

  const [
    files,
    setFiles,
  ] = useState<File[]>([]);

  const [
    preview,
    setPreview,
  ] = useState<string[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    ocring,
    setOcring,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    message,
    setMessage,
  ] = useState("");

  // ===================================================
  // 当前账单月份
  // ===================================================

  const billMonth =
    `${year}-${pad(month)}`;

  // ===================================================
  // 年份
  //
  // 当前年份前5年 + 当前年 + 后2年
  // ===================================================

  const years =
    useMemo(() => {
      const currentYear =
        now.getFullYear();

      return Array.from(
        { length: 8 },
        (_, i) =>
          currentYear - 5 + i
      );
    }, [now]);

  // ===================================================
  // 加载信用卡
  //
  // 只读取 credit_cards
  //
  // 不读取 loans
  // ===================================================

  useEffect(() => {
    let cancelled =
      false;

    (async () => {
      try {
        setLoading(true);

        const data =
          await getCreditCards();

        if (cancelled) {
          return;
        }

        const realCards =
          data.filter(
            (card) =>
              !String(
                card.id
              ).startsWith(
                "loan-credit-card-"
              )
          ) as Card[];

        setCards(
          realCards
        );
      } catch (
        error: any
      ) {
        console.error(
          error
        );

        setMessage(
          `加载信用卡失败：${
            error?.message ||
            error
          }`
        );
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // ===================================================
  // 加载 Tesseract
  // ===================================================

  async function loadTesseract() {
    if (
      window.Tesseract
    ) {
      return window.Tesseract;
    }

    await new Promise<void>(
      (
        resolve,
        reject
      ) => {
        const old =
          document.getElementById(
            "tesseract-script"
          );

        if (old) {
          old.addEventListener(
            "load",
            () => resolve()
          );

          old.addEventListener(
            "error",
            () =>
              reject(
                new Error(
                  "OCR 引擎加载失败"
                )
              )
          );

          return;
        }

        const script =
          document.createElement(
            "script"
          );

        script.id =
          "tesseract-script";

        script.src =
          "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js";

        script.onload =
          () => resolve();

        script.onerror =
          () =>
            reject(
              new Error(
                "OCR 引擎加载失败"
              )
            );

        document.body.appendChild(
          script
        );
      }
    );

    return window.Tesseract;
  }

  // ===================================================
  // 选择图片
  // ===================================================

  function chooseFiles(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const selected =
      Array.from(
        event.target.files || []
      );

    setFiles(
      selected
    );

    setRows([]);

    setMessage("");

    setPreview(
      selected.map(
        (file) =>
          URL.createObjectURL(
            file
          )
      )
    );
  }

  // ===================================================
  // OCR
  // ===================================================

  async function runOCR() {
    if (!files.length) {
      alert(
        "请先上传信用卡账单截图"
      );

      return;
    }

    try {
      setOcring(true);

      setMessage(
        "正在加载 OCR 引擎……"
      );

      const T =
        await loadTesseract();

      const allTexts: string[] =
        [];

      for (
        let i = 0;
        i < files.length;
        i++
      ) {
        setMessage(
          `正在识别第 ${
            i + 1
          }/${files.length} 张截图……`
        );

        const result =
          await T.recognize(
            files[i],
            "chi_sim+eng",
            {
              logger: (
                info: any
              ) => {
                if (
                  info.status ===
                  "recognizing text"
                ) {
                  setMessage(
                    `OCR ${Math.round(
                      (info.progress ||
                        0) *
                        100
                    )}%`
                  );
                }
              },
            }
          );

        const text =
          result?.data
            ?.text || "";

        allTexts.push(
          text
        );
      }

      const combinedText =
        allTexts.join(
          "\n"
        );

      // =================================================
      // 控制台保留原始 OCR
      // =================================================

      console.log(
        "========== OCR 原始文本 =========="
      );

      console.log(
        combinedText
      );

      console.log(
        "===================================="
      );

      // =================================================
      // 第一阶段：
      // 保持原来的 OCR 识别逻辑
      // =================================================

      const rawRows =
        parseOCRToRawRows(
          combinedText,
          cards
        );

      console.log(
        "========== OCR 原始区块 =========="
      );

      console.table(
        rawRows.map(
          (row) => ({
            bank:
              detectBankName(
                row.rawText
              ),
            last4:
              row.last4,
            amount:
              row.amount,
            cardId:
              row.cardId,
          })
        )
      );

      // =================================================
      // 第二阶段：
      // 同银行合并
      // =================================================

      const mergedRows =
        mergeRowsByBank(
          rawRows,
          cards
        );

      console.log(
        "========== OCR 合并后 =========="
      );

      console.table(
        mergedRows.map(
          (row) => ({
            name:
              row.ocrName,
            last4:
              row.last4List?.join(
                " + "
              ),
            amount:
              row.amount,
            cardId:
              row.cardId,
            merged:
              row.merged,
          })
        )
      );

      setRows(
        mergedRows
      );

      setMessage(
        `OCR 完成：识别 ${
          rawRows.length
        } 个信用卡区块，合并后 ${
          mergedRows.length
        } 张实际账单。请确认银行、卡号和金额后保存。`
      );
    } catch (
      error: any
    ) {
      console.error(
        error
      );

      setMessage(
        `OCR失败：${
          error?.message ||
          error
        }`
      );
    } finally {
      setOcring(
        false
      );
    }
  }

  // ===================================================
  // 读取当前月份已有实际账单
  // ===================================================

  async function refreshExisting(
    nextRows: Row[]
  ) {
    if (
      !nextRows.length
    ) {
      return;
    }

    try {
      const bills =
        await getCreditCardMonthlyBills(
          billMonth
        );

      const map =
        new Map<
          string,
          number
        >();

      for (
        const bill of bills
      ) {
        map.set(
          bill.credit_card_id,
          bill.actual_bill_amount
        );
      }

      setRows(
        (previous) =>
          previous.map(
            (row) => ({
              ...row,

              existing:
                row.cardId
                  ? map.get(
                      row.cardId
                    )
                  : undefined,
            })
          )
      );
    } catch (
      error
    ) {
      console.error(
        "读取已有账单失败：",
        error
      );
    }
  }

  // ===================================================
  // 月份改变
  // ===================================================

  useEffect(() => {
    if (
      !rows.length
    ) {
      return;
    }

    refreshExisting(
      rows
    ).catch(
      console.error
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [billMonth]);

  // ===================================================
  // 修改 Row
  // ===================================================

  function updateRow(
    id: string,
    patch: Partial<Row>
  ) {
    setRows(
      (previous) =>
        previous.map(
          (row) =>
            row.id === id
              ? {
                  ...row,
                  ...patch,
                }
              : row
        )
    );
  }

  // ===================================================
  // 保存
  // ===================================================

  async function saveAll() {
    const validRows =
      rows.filter(
        (row) =>
          row.cardId &&
          Number.isFinite(
            row.amount
          ) &&
          row.amount >= 0
      );

    if (
      !validRows.length
    ) {
      alert(
        "没有可以保存的已匹配账单。"
      );

      return;
    }

    // =================================================
    // 第一次检查数据库
    // =================================================

    let bills;

    try {
      bills =
        await getCreditCardMonthlyBills(
          billMonth
        );
    } catch (
      error: any
    ) {
      alert(
        `检查已有账单失败：${
          error?.message ||
          error
        }`
      );

      return;
    }

    const existingMap =
      new Map<
        string,
        number
      >();

    for (
      const bill of bills
    ) {
      existingMap.set(
        bill.credit_card_id,
        bill.actual_bill_amount
      );
    }

    // =================================================
    // 数据库已有账单
    // =================================================

    const duplicateRows =
      validRows.filter(
        (row) =>
          existingMap.has(
            row.cardId
          )
      );

    let overwrite =
      false;

    if (
      duplicateRows.length
    ) {
      const detail =
        duplicateRows
          .map(
            (row) => {
              const card =
                cards.find(
                  (item) =>
                    item.id ===
                    row.cardId
                );

              const oldAmount =
                existingMap.get(
                  row.cardId
                ) ?? 0;

              return `${
                card?.bank_name ||
                row.ocrName
              }${
                row.last4List &&
                row.last4List.length
                  ? ` [${row.last4List.join(
                      " + "
                    )}]`
                  : ""
              }：已有 ${money(
                oldAmount
              )}，本次 ${money(
                row.amount
              )}`;
            }
          )
          .join("\n");

      overwrite =
        window.confirm(
          `${billMonth} 已存在实际账单：\n\n` +
            `${detail}\n\n` +
            `点击“确定”才覆盖已有数据。\n` +
            `点击“取消”则不会修改已有数据。`
        );

      if (
        !overwrite
      ) {
        return;
      }
    }

    // =================================================
    // 同一次导入中检查同一个 cardId
    // =================================================

    const cardCount =
      new Map<
        string,
        number
      >();

    for (
      const row of validRows
    ) {
      cardCount.set(
        row.cardId,
        (cardCount.get(
          row.cardId
        ) || 0) + 1
      );
    }

    const duplicatedInImport =
      validRows.filter(
        (row) =>
          (cardCount.get(
            row.cardId
          ) || 0) > 1
      );

    if (
      duplicatedInImport.length
    ) {
      const duplicateNames =
        Array.from(
          new Set(
            duplicatedInImport.map(
              (row) => {
                const card =
                  cards.find(
                    (item) =>
                      item.id ===
                      row.cardId
                  );

                return (
                  card?.bank_name ||
                  row.ocrName
                );
              }
            )
          )
        ).join("、");

      const continueSave =
        window.confirm(
          `本次 OCR 中发现同一张信用卡出现多条记录：\n\n` +
            `${duplicateNames}\n\n` +
            `这通常表示同一张账单截图被重复识别。\n\n` +
            `点击“确定”继续保存最后一条数据，` +
            `点击“取消”停止保存。`
        );

      if (
        !continueSave
      ) {
        return;
      }
    }

    // =================================================
    // 开始保存
    // =================================================

    try {
      setSaving(true);

      // =================================================
      // 同一个 cardId 最后一条为最终值
      // =================================================

      const finalRows =
        new Map<
          string,
          Row
        >();

      for (
        const row of validRows
      ) {
        finalRows.set(
          row.cardId,
          row
        );
      }

      // =================================================
      // 逐张保存
      // =================================================

      for (
        const row of finalRows.values()
      ) {
        await saveCreditCardMonthlyBill(
          row.cardId,
          billMonth,
          {
            actual_bill_amount:
              row.amount,
          },
          {
            overwrite,
          }
        );
      }

      alert(
        `${billMonth} 实际账单保存成功，共 ${
          finalRows.size
        } 张卡。`
      );

      setMessage(
        `保存成功。${billMonth} 的实际账单已经写入月度账单数据。`
      );

      // =================================================
      // 保存后重新读取
      // =================================================

      const refreshed =
        await getCreditCardMonthlyBills(
          billMonth
        );

      const refreshedMap =
        new Map<
          string,
          number
        >();

      for (
        const bill of refreshed
      ) {
        refreshedMap.set(
          bill.credit_card_id,
          bill.actual_bill_amount
        );
      }

      setRows(
        (previous) =>
          previous.map(
            (row) => ({
              ...row,

              existing:
                row.cardId
                  ? refreshedMap.get(
                      row.cardId
                    )
                  : undefined,
            })
          )
      );
    } catch (
      error: any
    ) {
      console.error(
        "保存实际账单失败：",
        error
      );

      if (
        error?.message ===
        "MONTHLY_BILL_EXISTS"
      ) {
        alert(
          `保存失败：${billMonth} 的账单已经存在。\n\n` +
            `系统没有静默覆盖，请重新确认后再保存。`
        );
      } else {
        alert(
          `保存失败：${
            error?.message ||
            error
          }`
        );
      }
    } finally {
      setSaving(
        false
      );
    }
  }

  // ===================================================
  // UI
  // ===================================================

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="信用卡账单导入" />

      <main className="max-w-[1200px] mx-auto px-6 py-8 space-y-6">

        {/* =================================================
            账单年月
        ================================================= */}

        <section className="bg-white rounded-xl border border-gray-200 p-6">

          <h1 className="text-2xl font-bold text-gray-900">
            信用卡实际账单导入
          </h1>

          <p className="mt-2 text-sm text-gray-500">
            先选择账单年月，再上传信用卡账单截图。
            OCR 只负责识别，最终金额由你确认后才写入数据库。
          </p>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">

            {/* 年份 */}

            <label className="block">

              <span className="text-sm font-medium text-gray-700">
                年份
              </span>

              <select
                value={year}
                onChange={(event) => {
                  setYear(
                    Number(
                      event.target.value
                    )
                  );

                  setRows([]);
                }}
                className="mt-2 w-full border rounded-lg px-3 py-2.5 bg-white"
              >
                {years.map(
                  (item) => (
                    <option
                      key={item}
                      value={item}
                    >
                      {item}年
                    </option>
                  )
                )}
              </select>

            </label>

            {/* 月份 */}

            <label className="block">

              <span className="text-sm font-medium text-gray-700">
                月份
              </span>

              <select
                value={month}
                onChange={(event) => {
                  setMonth(
                    Number(
                      event.target.value
                    )
                  );

                  setRows([]);
                }}
                className="mt-2 w-full border rounded-lg px-3 py-2.5 bg-white"
              >
                {Array.from(
                  {
                    length: 12,
                  },
                  (_, index) => (
                    <option
                      key={
                        index + 1
                      }
                      value={
                        index + 1
                      }
                    >
                      {index + 1}月
                    </option>
                  )
                )}
              </select>

            </label>

          </div>

          <div className="mt-5 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-800">

            当前账单月份：
            <b>
              {year}年
              {month}月
            </b>

            <br />

            <span className="text-blue-700">
              月份选择不受数据库已有数据限制，
              过去月份和未来月份都可以直接选择。
            </span>

          </div>

        </section>

        {/* =================================================
            上传
        ================================================= */}

        <section className="bg-white rounded-xl border border-gray-200 p-6">

          <h2 className="text-lg font-bold">
            ① 上传账单截图
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            可以一次选择多张截图。
          </p>

          <input
            className="mt-4 block w-full text-sm"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            multiple
            onChange={
              chooseFiles
            }
          />

          {preview.length >
            0 && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">

              {preview.map(
                (
                  src,
                  index
                ) => (
                  <img
                    key={`${src}-${index}`}
                    src={src}
                    alt={`账单截图${
                      index +
                      1
                    }`}
                    className="w-full h-40 object-contain border rounded-lg bg-gray-50"
                  />
                )
              )}

            </div>
          )}

          <button
            disabled={
              ocring ||
              loading ||
              !files.length
            }
            onClick={
              runOCR
            }
            className="mt-5 rounded-lg bg-blue-600 text-white px-5 py-2.5 disabled:bg-gray-300"
          >
            {ocring
              ? "OCR识别中……"
              : "开始 OCR 识别"}
          </button>

          {message && (
            <div className="mt-3 text-sm text-gray-600 whitespace-pre-line">
              {message}
            </div>
          )}

        </section>

        {/* =================================================
            OCR结果
        ================================================= */}

        <section className="bg-white rounded-xl border border-gray-200 p-6">

          <div className="flex items-center justify-between gap-4">

            <div>

              <h2 className="text-lg font-bold">
                ② 确认 OCR 结果
              </h2>

              <p className="text-sm text-gray-500 mt-1">
                银行、信用卡和金额都可以人工修改。
              </p>

            </div>

            <button
              disabled={
                saving ||
                !rows.length
              }
              onClick={
                saveAll
              }
              className="rounded-lg bg-green-600 text-white px-5 py-2.5 disabled:bg-gray-300"
            >
              {saving
                ? "保存中……"
                : "保存实际账单"}
            </button>

          </div>

          <div className="mt-5 overflow-x-auto">

            <table className="w-full text-sm">

              <thead>

                <tr className="border-b bg-gray-50">

                  <th className="text-left px-3 py-3">
                    OCR识别
                  </th>

                  <th className="text-left px-3 py-3">
                    信用卡匹配
                  </th>

                  <th className="text-right px-3 py-3">
                    实际账单
                  </th>

                  <th className="text-right px-3 py-3">
                    已有数据
                  </th>

                  <th className="px-3 py-3">
                    状态
                  </th>

                  <th className="px-3 py-3">
                    操作
                  </th>

                </tr>

              </thead>

              <tbody>

                {rows.length ===
                0 ? (

                  <tr>

                    <td
                      colSpan={6}
                      className="text-center py-12 text-gray-400"
                    >
                      暂无 OCR 结果
                    </td>

                  </tr>

                ) : (

                  rows.map(
                    (row) => (
                      <tr
                        key={
                          row.id
                        }
                        className="border-b align-top"
                      >

                        {/* =================================================
                            OCR
                        ================================================= */}

                        <td className="px-3 py-3">

                          <div className="font-medium text-gray-900">
                            {
                              row.ocrName
                            }

                            {row.merged && (
                              <span className="ml-2 inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700">
                                已合并
                              </span>
                            )}
                          </div>

                          {row.last4List &&
                            row.last4List.length >
                              0 && (
                              <div className="text-xs text-gray-500 mt-1">
                                卡号后四位：
                                {row.last4List.join(
                                  " + "
                                )}
                              </div>
                            )}

                          {row.merged && (
                            <div className="text-xs text-blue-600 mt-1">
                              多张同银行信用卡金额已自动合并
                            </div>
                          )}

                          <details className="mt-2">

                            <summary className="cursor-pointer text-xs text-blue-600">
                              查看OCR原始
                            </summary>

                            <pre className="mt-2 max-w-[360px] whitespace-pre-wrap break-words text-xs text-gray-500 bg-gray-50 rounded p-2">
                              {
                                row.rawText
                              }
                            </pre>

                          </details>

                        </td>

                        {/* =================================================
                            信用卡匹配
                        ================================================= */}

                        <td className="px-3 py-3">

                          <select
                            value={
                              row.cardId
                            }
                            onChange={(
                              event
                            ) => {

                              const cardId =
                                event
                                  .target
                                  .value;

                              updateRow(
                                row.id,
                                {
                                  cardId,
                                  matched:
                                    !!cardId,
                                }
                              );

                            }}
                            className="border rounded-md px-2 py-1.5 min-w-[240px]"
                          >

                            <option value="">
                              请选择信用卡
                            </option>

                            {cards.map(
                              (
                                card
                              ) => (
                                <option
                                  key={
                                    card.id
                                  }
                                  value={
                                    card.id
                                  }
                                >
                                  {
                                    card.bank_name
                                  }

                                  {card.card_name !==
                                  card.bank_name
                                    ? ` · ${card.card_name}`
                                    : ""}
                                </option>
                              )
                            )}

                          </select>

                        </td>

                        {/* =================================================
                            金额
                        ================================================= */}

                        <td className="px-3 py-3 text-right">

                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={
                              row.amount
                            }
                            onChange={(
                              event
                            ) => {

                              const value =
                                Number(
                                  event
                                    .target
                                    .value
                                );

                              updateRow(
                                row.id,
                                {
                                  amount:
                                    Number.isFinite(
                                      value
                                    )
                                      ? value
                                      : 0,
                                }
                              );

                            }}
                            className="w-32 border rounded-md px-2 py-1.5 text-right"
                          />

                        </td>

                        {/* =================================================
                            已有数据
                        ================================================= */}

                        <td className="px-3 py-3 text-right">

                          {row.existing ===
                          undefined
                            ? "—"
                            : money(
                                row.existing
                              )}

                        </td>

                        {/* =================================================
                            状态
                        ================================================= */}

                        <td className="px-3 py-3 text-center whitespace-nowrap">

                          {!row.cardId ? (

                            <span className="text-orange-600">
                              未匹配
                            </span>

                          ) : row.existing !==
                            undefined ? (

                            <span className="text-red-600">
                              将覆盖
                            </span>

                          ) : row.merged ? (

                            <span className="text-blue-600">
                              合并后新账单
                            </span>

                          ) : (

                            <span className="text-green-600">
                              新账单
                            </span>

                          )}

                        </td>

                        {/* =================================================
                            删除
                        ================================================= */}

                        <td className="px-3 py-3 text-center">

                          <button
                            onClick={() =>
                              setRows(
                                (
                                  previous
                                ) =>
                                  previous.filter(
                                    (
                                      item
                                    ) =>
                                      item.id !==
                                      row.id
                                  )
                              )
                            }
                            className="text-red-500 hover:text-red-700"
                          >
                            删除
                          </button>

                        </td>

                      </tr>
                    )
                  )

                )}

              </tbody>

            </table>

          </div>

          {/* =================================================
              规则说明
          ================================================= */}

          {rows.length >
            0 && (
            <div className="mt-5 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3 text-xs text-gray-600">

              <div className="font-medium text-gray-700 mb-1">
                本次 OCR 处理规则
              </div>

              <div>
                • 一个银行标题对应一个 OCR 区块
              </div>

              <div>
                • 建设银行多张卡会自动合并为一条建设银行实际账单
              </div>

              <div>
                • 合并后的金额 = 同银行所有卡金额之和
              </div>

              <div>
                • 建设银行 [2215] + [7357] 会合并
              </div>

              <div>
                • 宁波银行与宁波银行2严格区分，不会合并
              </div>

              <div>
                • 卡号后四位不会被当作账单金额
              </div>

              <div>
                • “5天后 / 15天后 / 113天后”等数字不会被当作账单金额
              </div>

              <div>
                • 优先识别 ¥ / ￥ / RMB / Y 后面的金额
              </div>

              <div>
                • OCR 金额可以人工修改
              </div>

              <div>
                • 保存前再次检查数据库已有账单
              </div>

              <div>
                • 已有账单必须明确确认后才允许覆盖
              </div>

              <div>
                • 本页面不会修改 credit_cards
              </div>

              <div>
                • 本页面不会修改 loans
              </div>

            </div>
          )}

        </section>

      </main>
    </div>
  );
}