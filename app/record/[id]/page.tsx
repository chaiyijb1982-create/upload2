"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";

import { getHoldings, type Holding } from "@/lib/asset";

import {
  getFixedIncomeAssets,
  type FixedIncomeAsset,
} from "@/lib/fixed-income";

import { loadCashflowPlanning } from "@/lib/cashflow-planning";

// =====================================================
// 类型
// =====================================================

type RecordItem = {
  id: string;
  title: string;
  content: Record<string, unknown>;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

type RecordTask = {
  id: string;
  record_id: string;
  title: string;
  condition: string | null;
  holding_id: number | null;
  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
};

type RecordFile = {
  id: string;
  record_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  created_at: string;
};

type BatchTaskDraft = {
  id: string;
  title: string;
  assetRelated: boolean;
  condition: string | null;
  holdingId: number | null;
};

// =====================================================
// 工具
// =====================================================

function formatDateTime(value: string | null) {
  if (!value) return "—";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "—";

  return d.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function formatMoney(value: unknown, currency = "CNY") {
  const n = Number(value);

  if (!Number.isFinite(n)) return "—";

  return `${currency === "CNY" ? "¥" : currency + " "}${n.toLocaleString(
    "zh-CN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

function cleanBatchTaskTitle(value: string) {
  return value
    .trim()
    .replace(/^(?:\d+[\.\、\)]\s*|[-•·]\s*|[☐☑✓✔]\s*)/, "")
    .trim();
}

function parseMonitoringCondition(
  title: string,
  condition: string | null = null
) {
  const text = `${title} ${condition ?? ""}`.replace(/\s+/g, "");

  const profitMatch = text.match(
    /盈利\s*(\d+(?:\.\d+)?)\s*%/
  );

  if (profitMatch) {
    const target = Number(profitMatch[1]);

    if (Number.isFinite(target)) {
      return {
        type: "rate",
        operator: ">=",
        target,
        label: `收益率 ≥ ${target}%`,
      } as const;
    }
  }

  const lossMatch = text.match(
    /亏损\s*(\d+(?:\.\d+)?)\s*%/
  );

  if (lossMatch) {
    const target = Number(lossMatch[1]);

    if (Number.isFinite(target)) {
      return {
        type: "rate",
        operator: "<=",
        target: -target,
        label: `收益率 ≤ -${target}%`,
      } as const;
    }
  }

  const rateGteMatch = text.match(
    /收益率\s*(?:达到|大于等于|不低于|至少|超过|高于)\s*(-?\d+(?:\.\d+)?)\s*%/
  );

  if (rateGteMatch) {
    const target = Number(rateGteMatch[1]);

    if (Number.isFinite(target)) {
      return {
        type: "rate",
        operator: ">=",
        target,
        label: `收益率 ≥ ${target}%`,
      } as const;
    }
  }

  const rateLteMatch = text.match(
    /收益率\s*(?:低于|小于|不超过|至多)\s*(-?\d+(?:\.\d+)?)\s*%/
  );

  if (rateLteMatch) {
    const target = Number(rateLteMatch[1]);

    if (Number.isFinite(target)) {
      return {
        type: "rate",
        operator: "<=",
        target,
        label: `收益率 ≤ ${target}%`,
      } as const;
    }
  }

  if (/回本/.test(text)) {
    return {
      type: "rate",
      operator: ">=",
      target: 0,
      label: "收益率 ≥ 0%（回本）",
    } as const;
  }

  return null;
}

function parseBatchTaskLine(value: string) {
  const cleaned = cleanBatchTaskTitle(value);

  if (!cleaned) {
    return {
      title: "",
      condition: null as string | null,
    };
  }

  const match = cleaned.match(/^(.*?)\s*[|｜]\s*(.*?)\s*$/);

  if (!match) {
    return {
      title: cleaned,
      condition: null as string | null,
    };
  }

  return {
    title: match[1]?.trim() ?? "",
    condition: match[2]?.trim() || null,
  };
}

function isLikelyAssetTask(title: string) {
  const text = title.toLowerCase();

  return [
    "卖出",
    "买入",
    "加仓",
    "减仓",
    "清仓",
    "增持",
    "减持",
    "持有",
    "调仓",
    "调整仓位",
    "归拢",
    "换仓",
    "转换",
    "赎回",
    "处理",
    "基金",
    "股票",
    "etf",
    "voo",
    "schd",
    "qqqm",
    "gldm",
    "黄金",
    "纳指",
    "标普",
    "恒生",
    "现金",
    "资产",
    "holding",
    "盈利",
    "亏损",
    "回本",
    "收益率",
    "止损",
    "检查",
    "监控",
  ].some((x) => text.includes(x.toLowerCase()));
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .replace(/[\s_\-—–/\\()[\]{}（）【】]/g, "")
    .replace(/[：:，,。.！!？?]/g, "");
}

const ACTION_WORDS = [
  "卖出",
  "买入",
  "加仓",
  "减仓",
  "清仓",
  "增持",
  "减持",
  "持有",
  "调仓",
  "调整仓位",
  "归拢",
  "换仓",
  "转换",
  "赎回",
  "出售",
  "处理",
];

function stripActionWords(value: string) {
  let text = normalizeText(value);

  for (const word of ACTION_WORDS) {
    text = text.split(normalizeText(word)).join("");
  }

  return text;
}

function holdingField(
  h: Holding,
  key: string
): unknown {
  return (h as unknown as Record<string, unknown>)[key];
}

function holdingName(h: Holding) {
  return String(
    holdingField(h, "name") ??
      holdingField(h, "asset_name") ??
      holdingField(h, "title") ??
      ""
  );
}

function holdingCode(h: Holding) {
  return String(
    holdingField(h, "code") ??
      holdingField(h, "symbol") ??
      holdingField(h, "ticker") ??
      ""
  );
}

function holdingCurrency(h: Holding) {
  return String(
    holdingField(h, "currency") ??
      holdingField(h, "native_currency") ??
      "CNY"
  );
}

function holdingAmount(h: Holding) {
  return Number(
    holdingField(h, "amount") ??
      holdingField(h, "market_value") ??
      holdingField(h, "current_value") ??
      0
  );
}

function holdingCost(h: Holding) {
  return Number(
    holdingField(h, "cost") ??
      holdingField(h, "cost_amount") ??
      holdingField(h, "total_cost") ??
      0
  );
}

function scoreHolding(
  taskTitle: string,
  h: Holding
) {
  const task = normalizeText(taskTitle);
  const stripped = stripActionWords(taskTitle);
  const name = normalizeText(holdingName(h));
  const code = normalizeText(holdingCode(h));

  if (!stripped) return 0;

  if (code && task.includes(code)) return 1000 + code.length;
  if (name && task.includes(name)) return 900 + name.length;
  if (name && stripped.includes(name)) return 850 + name.length;
  if (code && stripped.includes(code)) return 800 + code.length;

  let score = 0;

  const candidates = [name, code].filter(Boolean);

  for (const candidate of candidates) {
    if (stripped.includes(candidate)) score += 100;
    if (candidate.includes(stripped)) score += 80;
  }

  const tokens =
    stripped.match(/[a-z0-9]+|[\u4e00-\u9fff]/g) ?? [];

  for (const token of tokens) {
    if (token.length >= 2 && name.includes(token)) {
      score += token.length * 8;
    }

    if (token.length >= 2 && code.includes(token)) {
      score += token.length * 10;
    }
  }

  const commonPairs = [
    ["日本", "日本"],
    ["摩根", "摩根"],
    ["入息", "入息"],
    ["富兰克林", "富兰克林"],
    ["纳指", "纳指"],
    ["qqq", "qqq"],
    ["tsm", "tsm"],
    ["voo", "voo"],
    ["schd", "schd"],
    ["gldm", "gldm"],
    ["黄金", "黄金"],
  ];

  for (const [a, b] of commonPairs) {
    if (
      stripped.includes(a) &&
      (name.includes(b) || code.includes(b))
    ) {
      score += 60;
    }
  }

  return score;
}

function findMatchingHolding(
  taskTitle: string,
  holdings: Holding[]
) {
  if (!holdings.length) return null;

  const ranked = holdings
    .map((h) => ({
      h,
      score: scoreHolding(taskTitle, h),
    }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return null;

  if (
    ranked[0].score >= 100 ||
    ranked.length === 1
  ) {
    return ranked[0].h;
  }

  if (
    ranked[0].score >= 40 &&
    ranked[0].score >= ranked[1].score + 15
  ) {
    return ranked[0].h;
  }

  return null;
}

function getDecision(
  task: RecordTask,
  h: Holding | null
) {
  if (!h) return null;

  const amount = holdingAmount(h);
  const cost = holdingCost(h);

  if (!Number.isFinite(cost) || cost <= 0) {
    return {
      text: "⚪ 暂无有效 COST，无法判断",
      tone: "gray",
      monitor: null,
    };
  }

  const diff = amount - cost;
  const rate = (diff / cost) * 100;

  const monitor = parseMonitoringCondition(
    task.title,
    task.condition
  );

  if (monitor?.type === "rate") {
    const reached =
      monitor.operator === ">="
        ? rate >= monitor.target
        : rate <= monitor.target;

    if (reached) {
      return {
        text: `🟢 已达到条件：${monitor.label}，建议执行`,
        tone: "green",
        monitor: monitor.label,
      };
    }

    return {
      text: `🟡 尚未达到条件：${monitor.label}，继续监控`,
      tone: "yellow",
      monitor: monitor.label,
    };
  }

  if (/目标价格|目标价/.test(task.condition ?? "")) {
    return {
      text: "🟡 需要目标价格后判断",
      tone: "yellow",
      monitor: "目标价格",
    };
  }

  if (/目标配置|达到目标配置/.test(task.condition ?? "")) {
    return {
      text: "🟡 需要目标配置数据后判断",
      tone: "yellow",
      monitor: "目标配置",
    };
  }

  const explicitSell =
    /卖出|出售|减仓|减持|清仓|赎回/.test(
      task.title
    );

  if (explicitSell) {
    return diff >= 0
      ? {
          text: "🟢 已达到回本条件，建议执行",
          tone: "green",
          monitor: "收益率 ≥ 0%（回本）",
        }
      : {
          text: "🟡 尚未达到回本条件，继续等待",
          tone: "yellow",
          monitor: "收益率 ≥ 0%（回本）",
        };
  }

  if (
    /根据当时价格|价格决定/.test(
      task.condition ?? ""
    ) ||
    /处理/.test(task.title)
  ) {
    return diff >= 0
      ? {
          text: "🟢 已回本，建议重新评估是否执行",
          tone: "green",
          monitor: "当前价格 / 回本状态",
        }
      : {
          text: "🟡 当前仍低于 COST，暂不建议卖出",
          tone: "yellow",
          monitor: "当前价格 / 回本状态",
        };
  }

  return null;
}

// =====================================================
// Holding 信息
// =====================================================
function HoldingInfo({
  task,
  holding,
}: {
  task: RecordTask;
  holding: Holding;
}) {
  const amount = holdingAmount(holding);
  const cost = holdingCost(holding);
  const diff = amount - cost;
  const rate =
    Number.isFinite(cost) && cost > 0
      ? (diff / cost) * 100
      : null;
  const currency = holdingCurrency(holding);
  const decision = getDecision(task, holding);

  return (
    <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
        <div>
          <span className="text-gray-400">当前值</span>
          <div className="font-medium text-gray-700">
            {formatMoney(amount, currency)}
          </div>
        </div>
        <div>
          <span className="text-gray-400">COST</span>
          <div className="font-medium text-gray-700">
            {formatMoney(cost, currency)}
          </div>
        </div>
        <div>
          <span className="text-gray-400">盈亏</span>
          <div className="font-medium text-gray-700">
            {formatMoney(diff, currency)}
          </div>
        </div>
        <div>
          <span className="text-gray-400">收益率</span>
          <div className="font-medium text-gray-700">
            {rate === null ? "—" : `${rate.toFixed(2)}%`}
          </div>
        </div>
      </div>

      {decision && (
        <div className="mt-2 text-xs text-gray-600">
          {decision.text}
        </div>
      )}
    </div>
  );
}

// =====================================================
// 通用资金筹集计算器
// =====================================================

// =====================================================
// 通用资金筹集计算器
// =====================================================

type ManualFundingSource = {
  id: string;
  name: string;
  amount: string;
};

type CashflowFundingRow = {
  id: string;
  year: string;
  month: string;
  expenseName: string;
  amount: string;
};

  type FixedIncomeFundingRow = {
    id: string;
    assetId: string;
    useAmount: string;
  };


type FundingCalculatorData = {
  targetName?: unknown;
  targetAmount?: unknown;
  cashflowRows?: unknown;
  manualSources?: unknown;
  selectedFixedIncomeIds?: unknown;
  fixedIncomeUseAmounts?: unknown;
  fixedIncomeRows?: unknown;
};

function fundingNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function createCashflowRowId() {
  return `cashflow-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function createManualSourceId() {
  return `manual-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 7)}`;
}

function normalizeSavedCashflowRows(
  value: unknown
): CashflowFundingRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (row): row is Record<string, unknown> =>
        !!row &&
        typeof row === "object"
    )
    .map((row) => ({
      id:
        typeof row.id === "string" &&
        row.id.trim()
          ? row.id
          : createCashflowRowId(),

      year:
        typeof row.year === "string"
          ? row.year
          : "",

      month:
        typeof row.month === "string"
          ? row.month
          : "",

      expenseName:
        typeof row.expenseName === "string"
          ? row.expenseName
          : "",

      amount:
        typeof row.amount === "string"
          ? row.amount
          : row.amount !== undefined &&
            row.amount !== null
          ? String(row.amount)
          : "",
    }));
}

function normalizeSavedManualSources(
  value: unknown
): ManualFundingSource[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (source): source is Record<string, unknown> =>
        !!source &&
        typeof source === "object"
    )
    .map((source) => ({
      id:
        typeof source.id === "string" &&
        source.id.trim()
          ? source.id
          : createManualSourceId(),

      name:
        typeof source.name === "string"
          ? source.name
          : "",

      amount:
        typeof source.amount === "string"
          ? source.amount
          : source.amount !== undefined &&
            source.amount !== null
          ? String(source.amount)
          : "",
    }));
}

function FundingCalculator({
  collapsed,
  onToggleCollapse,
  onRemove,
  initialContent,
  onSaveContent,
}: {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onRemove: () => void;
  initialContent: Record<string, unknown> | null;
  onSaveContent: (
    content: Record<string, unknown>
  ) => Promise<void>;
}) {
  const [targetName, setTargetName] =
    useState("年金缴费");

  const [targetAmount, setTargetAmount] =
    useState("221000");

  const [fixedIncomeAssets, setFixedIncomeAssets] =
    useState<FixedIncomeAsset[]>([]);

  const [selectedFixedIncomeIds, setSelectedFixedIncomeIds] =
    useState<string[]>([]);

  const [fixedIncomeUseAmounts, setFixedIncomeUseAmounts] =
    useState<Record<string, string>>({});

  // =====================================================
  // CASHFLOW
  // =====================================================

  const [cashflowYears, setCashflowYears] =
    useState<
      Array<{
        year: number;
        months: Array<{
          month: number;
          expense: Array<{
            name?: string;
            value?: number;
            deleted?: boolean;
          }>;
        }>;
      }>
    >([]);

  const [cashflowRows, setCashflowRows] =
    useState<CashflowFundingRow[]>([]);

  const [manualSources, setManualSources] =
    useState<ManualFundingSource[]>([]);

  const [loadingFixedIncome, setLoadingFixedIncome] =
    useState(true);

  const [loadingCashflow, setLoadingCashflow] =
    useState(true);

  const [sourceError, setSourceError] =
    useState("");

  const [savingCalculator, setSavingCalculator] =
    useState(false);

  const [calculatorHydrated, setCalculatorHydrated] =
    useState(false);

  // =====================================================
  // 从 Record.content 恢复资金筹集计算器
  // =====================================================

  useEffect(() => {
    if (!initialContent) {
      return;
    }

    const saved =
      initialContent.fundingCalculator;

    if (
      !saved ||
      typeof saved !== "object"
    ) {
      setCalculatorHydrated(true);
      return;
    }

    const data =
      saved as FundingCalculatorData;

    if (
      typeof data.targetName === "string"
    ) {
      setTargetName(
        data.targetName
      );
    }

    if (
      typeof data.targetAmount === "string"
    ) {
      setTargetAmount(
        data.targetAmount
      );
    }

    setCashflowRows(
      normalizeSavedCashflowRows(
        data.cashflowRows
      )
    );

    setManualSources(
      normalizeSavedManualSources(
        data.manualSources
      )
    );

    if (
      Array.isArray(
        data.selectedFixedIncomeIds
      )
    ) {
      setSelectedFixedIncomeIds(
        data.selectedFixedIncomeIds.filter(
          (
            id
          ): id is string =>
            typeof id === "string"
        )
      );
    }

    if (
      data.fixedIncomeUseAmounts &&
      typeof data.fixedIncomeUseAmounts ===
        "object"
    ) {
      const source =
        data.fixedIncomeUseAmounts as Record<
          string,
          unknown
        >;

      const normalized: Record<
        string,
        string
      > = {};

      Object.entries(
        source
      ).forEach(
        ([id, value]) => {
          normalized[id] =
            typeof value ===
            "string"
              ? value
              : value !==
                  undefined &&
                value !== null
              ? String(value)
              : "";
        }
      );

      setFixedIncomeUseAmounts(
        normalized
      );
    }

    setCalculatorHydrated(true);
  }, [initialContent]);

  // =====================================================
  // 保存整个资金筹集计算器
  // =====================================================

 async function saveCalculator(
  overrides: Partial<{
    targetName: string;
    targetAmount: string;
    cashflowRows: CashflowFundingRow[];
    manualSources: ManualFundingSource[];
    selectedFixedIncomeIds: string[];
    fixedIncomeUseAmounts: Record<string, string>;
    fixedIncomeRows: FixedIncomeFundingRow[]
  }> = {}
){
    const current =
      initialContent ?? {};

    const nextFundingCalculator = {
      targetName:
        overrides.targetName ??
        targetName,

      targetAmount:
        overrides.targetAmount ??
        targetAmount,

      cashflowRows:
        overrides.cashflowRows ??
        cashflowRows,

      manualSources:
        overrides.manualSources ??
        manualSources,

      selectedFixedIncomeIds:
        overrides.selectedFixedIncomeIds ??
        selectedFixedIncomeIds,

      fixedIncomeUseAmounts:
        overrides.fixedIncomeUseAmounts ??
        fixedIncomeUseAmounts,

      fixedIncomeRows:
        overrides.fixedIncomeRows ??
        fixedIncomeRows,  
    };

    try {
      setSavingCalculator(true);

      await onSaveContent({
        ...current,
        fundingCalculator:
          nextFundingCalculator,
      });
    } catch (error) {
      console.error(
        "保存资金筹集计算器失败:",
        error
      );
    } finally {
      setSavingCalculator(false);
    }
  }

  // =====================================================
  // 加载 Fixed Income + CASHFLOW
  // =====================================================

  useEffect(() => {
    let cancelled = false;

    async function loadSources() {
      setSourceError("");

      // -------------------------------------------------
      // Fixed Income
      // -------------------------------------------------

      try {
        setLoadingFixedIncome(true);

        const data =
          await getFixedIncomeAssets();

        if (!cancelled) {
          setFixedIncomeAssets(
            Array.isArray(data)
              ? data
              : []
          );
        }
      } catch (error) {
        console.error(
          "读取 Fixed Income 失败:",
          error
        );

        if (!cancelled) {
          setSourceError(
            "读取 Fixed Income 失败"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingFixedIncome(
            false
          );
        }
      }

      // -------------------------------------------------
      // CASHFLOW
      // -------------------------------------------------

      try {
        setLoadingCashflow(true);

        const cloud =
          await loadCashflowPlanning();

        const state =
          (
            cloud as unknown as {
              state?: {
                years?: Array<{
                  year: number;
                  months?: Array<{
                    month: number;
                    expense?: Array<{
                      name?: string;
                      value?: number;
                      deleted?: boolean;
                    }>;
                  }>;
                }>;
              };
            }
          ).state;

        const years =
          Array.isArray(
            state?.years
          )
            ? state!.years
            : [];

        if (!cancelled) {
          setCashflowYears(
            years.map(
              (
                yearData
              ) => ({
                year: Number(
                  yearData.year
                ),

                months: (
                  yearData.months ??
                  []
                ).map(
                  (
                    monthData
                  ) => ({
                    month:
                      Number(
                        monthData.month
                      ),

                    expense:
                      monthData.expense ??
                      [],
                  })
                ),
              })
            )
          );
        }
      } catch (error) {
        console.error(
          "读取 CASHFLOW 失败:",
          error
        );

        if (!cancelled) {
          setSourceError(
            "读取 CASHFLOW 失败"
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingCashflow(
            false
          );
        }
      }
    }

    loadSources();

    return () => {
      cancelled = true;
    };
  }, []);

  // =====================================================
  // Fixed Income 选择
  // =====================================================

function toggleFixedIncome(
  asset: FixedIncomeAsset
) {
  const id = asset.id;

  const isSelected =
    selectedFixedIncomeIds.includes(id);

  const nextSelectedIds = isSelected
    ? selectedFixedIncomeIds.filter(
        (item) => item !== id
      )
    : [
        ...selectedFixedIncomeIds,
        id,
      ];

  const nextUseAmounts = {
    ...fixedIncomeUseAmounts,
    ...(isSelected
      ? {}
      : fixedIncomeUseAmounts[id] !==
        undefined
        ? {}
        : {
            [id]: String(
              fundingNumber(asset.amount)
            ),
          }),
  };

  setSelectedFixedIncomeIds(
    nextSelectedIds
  );

  setFixedIncomeUseAmounts(
    nextUseAmounts
  );

  void saveCalculator({
    selectedFixedIncomeIds:
      nextSelectedIds,

    fixedIncomeUseAmounts:
      nextUseAmounts,
  });
}


  // =====================================================
  // Fixed Income 资金行
  // =====================================================



  const [fixedIncomeRows, setFixedIncomeRows] =
    useState<FixedIncomeFundingRow[]>([]);

  // =====================================================
  // 从旧数据恢复 Fixed Income
  // =====================================================

  useEffect(() => {
    if (!initialContent) {
      return;
    }

    const saved =
      initialContent.fundingCalculator;

    if (
      !saved ||
      typeof saved !== "object"
    ) {
      return;
    }

    const data =
      saved as FundingCalculatorData & {
        fixedIncomeRows?: unknown;
      };

    if (
      Array.isArray(
        data.fixedIncomeRows
      )
    ) {
      const rows =
        data.fixedIncomeRows
          .filter(
            (
              row
            ): row is Record<string, unknown> =>
              !!row &&
              typeof row === "object"
          )
          .map((row) => ({
            id:
              typeof row.id === "string" &&
              row.id.trim()
                ? row.id
                : `fixed-income-${Date.now()}-${Math.random()
                    .toString(36)
                    .slice(2, 7)}`,

            assetId:
              typeof row.assetId ===
              "string"
                ? row.assetId
                : "",

            useAmount:
              typeof row.useAmount ===
              "string"
                ? row.useAmount
                : row.useAmount !==
                    undefined &&
                  row.useAmount !==
                    null
                ? String(
                    row.useAmount
                  )
                : "",
          }));

      setFixedIncomeRows(
        rows
      );
    }
  }, [initialContent]);

  // =====================================================
  // 保存 Fixed Income 资金行
  // =====================================================

  async function saveFixedIncomeRows(
    rows: FixedIncomeFundingRow[]
  ) {
    const current =
      initialContent ?? {};

    const saved =
      current.fundingCalculator;

    const currentCalculator =
      saved &&
      typeof saved === "object"
        ? saved
        : {};

    try {
      setSavingCalculator(true);

      await onSaveContent({
        ...current,

        fundingCalculator: {
          ...currentCalculator,

          targetName,
          targetAmount,

          fixedIncomeRows:
            rows,

          cashflowRows,

          manualSources,

          selectedFixedIncomeIds:
            rows.map(
              (row) =>
                row.assetId
            ),

          fixedIncomeUseAmounts:
            rows.reduce(
              (
                result,
                row
              ) => ({
                ...result,
                [row.assetId]:
                  row.useAmount,
              }),
              {} as Record<
                string,
                string
              >
            ),
        },
      });
    } catch (error) {
      console.error(
        "保存 Fixed Income 资金失败:",
        error
      );
    } finally {
      setSavingCalculator(false);
    }
  }

  // =====================================================
  // 添加 Fixed Income 行
  // =====================================================

  function addFixedIncomeRow() {
    const newRow: FixedIncomeFundingRow =
      {
        id: `fixed-income-${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}`,

        assetId: "",

        useAmount: "",
      };

    setFixedIncomeRows(
      (previous) => {
        const next = [
          ...previous,
          newRow,
        ];

        void saveFixedIncomeRows(
          next
        );

        return next;
      }
    );
  }

  // =====================================================
  // 删除 Fixed Income 行
  // =====================================================

  function deleteFixedIncomeRow(
    id: string
  ) {
    setFixedIncomeRows(
      (previous) => {
        const next =
          previous.filter(
            (row) =>
              row.id !== id
          );

        void saveFixedIncomeRows(
          next
        );

        return next;
      }
    );
  }

  // =====================================================
  // 选择 Fixed Income
  // =====================================================

  function updateFixedIncomeAsset(
    rowId: string,
    assetId: string
  ) {
    const asset =
      fixedIncomeAssets.find(
        (item) =>
          item.id === assetId
      );

    const currentAmount =
      asset
        ? fundingNumber(
            asset.amount
          )
        : 0;

    setFixedIncomeRows(
      (previous) => {
        const next =
          previous.map(
            (row) =>
              row.id === rowId
                ? {
                    ...row,

                    assetId,

                    useAmount:
                      asset
                        ? String(
                            currentAmount
                          )
                        : "",
                  }
                : row
          );

        void saveFixedIncomeRows(
          next
        );

        return next;
      }
    );
  }

  // =====================================================
  // 修改 Fixed Income 本次使用金额
  // =====================================================

  function updateFixedIncomeUseAmount(
    rowId: string,
    value: string
  ) {
    const row =
      fixedIncomeRows.find(
        (item) =>
          item.id === rowId
      );

    if (!row) {
      return;
    }

    const asset =
      fixedIncomeAssets.find(
        (item) =>
          item.id ===
          row.assetId
      );

    const available =
      asset
        ? fundingNumber(
            asset.amount
          )
        : 0;

    const requested =
      fundingNumber(
        value
      );

    const safeAmount =
      Math.min(
        Math.max(
          requested,
          0
        ),
        Math.max(
          available,
          0
        )
      );

    const nextValue =
      value === ""
        ? ""
        : String(
            safeAmount
          );

    setFixedIncomeRows(
      (previous) => {
        const next =
          previous.map(
            (item) =>
              item.id === rowId
                ? {
                    ...item,

                    useAmount:
                      nextValue,
                  }
                : item
          );

        void saveFixedIncomeRows(
          next
        );

        return next;
      }
    );
  }



  // =====================================================
  // Fixed Income 本次使用合计
  // =====================================================

  const selectedFixedIncomeTotal =
    useMemo(() => {
      return fixedIncomeRows.reduce(
        (
          sum,
          row
        ) => {
          if (
            !row.assetId
          ) {
            return sum;
          }

          const asset =
            fixedIncomeAssets.find(
              (item) =>
                item.id ===
                row.assetId
            );

          if (!asset) {
            return sum;
          }

          const available =
            fundingNumber(
              asset.amount
            );

          const requested =
            fundingNumber(
              row.useAmount
            );

          const safeAmount =
            Math.min(
              Math.max(
                requested,
                0
              ),
              Math.max(
                available,
                0
              )
            );

          return (
            sum +
            safeAmount
          );
        },
        0
      );
    }, [
      fixedIncomeRows,
      fixedIncomeAssets,
    ]);

  // =====================================================
  // CASHFLOW
  // =====================================================

  const cashflowYearOptions =
    useMemo(() => {
      return cashflowYears
        .map((item) =>
          Number(item.year)
        )
        .filter(
          (
            year,
            index,
            array
          ) =>
            array.indexOf(
              year
            ) === index
        )
        .sort(
          (a, b) => a - b
        );
    }, [cashflowYears]);

  function getCashflowYearData(
    year: string
  ) {
    return cashflowYears.find(
      (item) =>
        Number(item.year) ===
        Number(year)
    );
  }

  function getCashflowMonthOptions(
    year: string
  ) {
    const yearData =
      getCashflowYearData(
        year
      );

    return (
      yearData?.months ?? []
    )
      .map((item) =>
        Number(item.month)
      )
      .filter(
        (
          month,
          index,
          array
        ) =>
          array.indexOf(
            month
          ) === index
      )
      .sort(
        (a, b) => a - b
      );
  }

  function getCashflowExpenseOptions(
    year: string,
    month: string
  ) {
    const yearData =
      getCashflowYearData(
        year
      );

    const monthData =
      yearData?.months?.find(
        (item) =>
          Number(item.month) ===
          Number(month)
      );

    return (
      monthData?.expense ?? []
    )
      .filter(
        (item) =>
          !item.deleted &&
          String(
            item.name ?? ""
          ).trim() !== ""
      )
      .map((item) => ({
        name: String(
          item.name ?? ""
        ).trim(),

        amount:
          fundingNumber(
            item.value
          ),
      }));
  }

  function getDefaultCashflowRow(): CashflowFundingRow {
    const firstYear =
      cashflowYearOptions[0];

    const monthOptions =
      firstYear !==
      undefined
        ? getCashflowMonthOptions(
            String(firstYear)
          )
        : [];

    const firstMonth =
      monthOptions[0];

    const expenseOptions =
      firstYear !==
        undefined &&
      firstMonth !==
        undefined
        ? getCashflowExpenseOptions(
            String(firstYear),
            String(firstMonth)
          )
        : [];

    const firstExpense =
      expenseOptions[0];

    return {
      id: createCashflowRowId(),

      year:
        firstYear !==
        undefined
          ? String(firstYear)
          : "",

      month:
        firstMonth !==
        undefined
          ? String(firstMonth)
          : "",

      expenseName:
        firstExpense?.name ??
        "",

      amount:
        firstExpense
          ? String(
              fundingNumber(
                firstExpense.amount
              )
            )
          : "",
    };
  }

  function addCashflowRow() {
    setCashflowRows(
      (previous) => {
        const next = [
          ...previous,
          getDefaultCashflowRow(),
        ];

        void saveCalculator({
          cashflowRows:
            next,
        });

        return next;
      }
    );
  }

  function updateCashflowYear(
    id: string,
    year: string
  ) {
    const monthOptions =
      getCashflowMonthOptions(
        year
      );

    const month =
      monthOptions.length > 0
        ? String(
            monthOptions[0]
          )
        : "";

    const expenseOptions =
      month
        ? getCashflowExpenseOptions(
            year,
            month
          )
        : [];

    const firstExpense =
      expenseOptions[0];

    setCashflowRows(
      (previous) => {
        const next =
          previous.map(
            (row) =>
              row.id === id
                ? {
                    ...row,

                    year,

                    month,

                    expenseName:
                      firstExpense?.name ??
                      "",

                    amount:
                      firstExpense
                        ? String(
                            fundingNumber(
                              firstExpense.amount
                            )
                          )
                        : "",
                  }
                : row
          );

        void saveCalculator({
          cashflowRows:
            next,
        });

        return next;
      }
    );
  }

  function updateCashflowMonth(
    id: string,
    month: string
  ) {
    const row =
      cashflowRows.find(
        (item) =>
          item.id === id
      );

    if (!row) return;

    const expenseOptions =
      getCashflowExpenseOptions(
        row.year,
        month
      );

    const firstExpense =
      expenseOptions[0];

    setCashflowRows(
      (previous) => {
        const next =
          previous.map(
            (item) =>
              item.id === id
                ? {
                    ...item,

                    month,

                    expenseName:
                      firstExpense?.name ??
                      "",

                    amount:
                      firstExpense
                        ? String(
                            fundingNumber(
                              firstExpense.amount
                            )
                          )
                        : "",
                  }
                : item
          );

        void saveCalculator({
          cashflowRows:
            next,
        });

        return next;
      }
    );
  }

  function updateCashflowExpense(
    id: string,
    expenseName: string
  ) {
    const row =
      cashflowRows.find(
        (item) =>
          item.id === id
      );

    if (!row) return;

    const expenseOptions =
      getCashflowExpenseOptions(
        row.year,
        row.month
      );

    const selectedExpense =
      expenseOptions.find(
        (item) =>
          item.name ===
          expenseName
      );

    setCashflowRows(
      (previous) => {
        const next =
          previous.map(
            (item) =>
              item.id === id
                ? {
                    ...item,

                    expenseName,

                    amount:
                      selectedExpense
                        ? String(
                            fundingNumber(
                              selectedExpense.amount
                            )
                          )
                        : "",
                  }
                : item
          );

        void saveCalculator({
          cashflowRows:
            next,
        });

        return next;
      }
    );
  }

  function updateCashflowAmount(
    id: string,
    amount: string
  ) {
    setCashflowRows(
      (previous) => {
        const next =
          previous.map(
            (item) =>
              item.id === id
                ? {
                    ...item,
                    amount,
                  }
                : item
          );

        void saveCalculator({
          cashflowRows:
            next,
        });

        return next;
      }
    );
  }

  function deleteCashflowRow(
    id: string
  ) {
    setCashflowRows(
      (previous) => {
        const next =
          previous.filter(
            (item) =>
              item.id !== id
          );

        void saveCalculator({
          cashflowRows:
            next,
        });

        return next;
      }
    );
  }

  // =====================================================
  // CASHFLOW 只要有行就直接计入
  // =====================================================

  const cashflowTotal =
    useMemo(() => {
      return cashflowRows.reduce(
        (sum, row) => {
          return (
            sum +
            Math.max(
              fundingNumber(
                row.amount
              ),
              0
            )
          );
        },
        0
      );
    }, [cashflowRows]);

  // =====================================================
  // 手工资金
  // =====================================================

  const manualTotal =
    manualSources.reduce(
      (sum, source) =>
        sum +
        Math.max(
          fundingNumber(
            source.amount
          ),
          0
        ),
      0
    );

  function addManualSource() {
    setManualSources(
      (previous) => {
        const next = [
          ...previous,
          {
            id: createManualSourceId(),
            name: "",
            amount: "",
          },
        ];

        void saveCalculator({
          manualSources:
            next,
        });

        return next;
      }
    );
  }

  function updateManualSource(
    id: string,
    field:
      | "name"
      | "amount",
    value: string
  ) {
    setManualSources(
      (previous) => {
        const next =
          previous.map(
            (source) =>
              source.id === id
                ? {
                    ...source,
                    [field]:
                      value,
                  }
                : source
          );

        void saveCalculator({
          manualSources:
            next,
        });

        return next;
      }
    );
  }

  function deleteManualSource(
    id: string
  ) {
    setManualSources(
      (previous) => {
        const next =
          previous.filter(
            (source) =>
              source.id !== id
          );

        void saveCalculator({
          manualSources:
            next,
        });

        return next;
      }
    );
  }

  // =====================================================
  // 目标字段保存
  // =====================================================

  function updateTargetName(
    value: string
  ) {
    setTargetName(value);

    void saveCalculator({
      targetName: value,
    });
  }

  function updateTargetAmount(
    value: string
  ) {
    setTargetAmount(value);

    void saveCalculator({
      targetAmount: value,
    });
  }

  // =====================================================
  // 最终计算
  // =====================================================

  const target =
    Math.max(
      fundingNumber(
        targetAmount
      ),
      0
    );

  const totalAvailable =
    selectedFixedIncomeTotal +
    cashflowTotal +
    manualTotal;

  const difference =
    totalAvailable -
    target;

  const isEnough =
    difference >= 0;

  // =====================================================
  // 折叠状态
  // =====================================================

  if (collapsed) {
    return (
      <section className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-3">
          <button
            type="button"
            onClick={
              onToggleCollapse
            }
            className="flex items-center gap-2 text-sm font-semibold text-gray-800 hover:text-gray-600"
          >
            <span>▶</span>

            <span>
              资金筹集计算
            </span>

            {savingCalculator && (
              <span className="text-xs font-normal text-gray-400">
                保存中…
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onRemove}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            隐藏
          </button>
        </div>
      </section>
    );
  }

  // =====================================================
  // 展开
  // =====================================================

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="mb-5">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={
              onToggleCollapse
            }
            className="flex items-center gap-2 text-lg font-semibold text-gray-900 hover:text-gray-600"
          >
            <span>▼</span>

            <span>
              资金筹集计算
            </span>

            {savingCalculator && (
              <span className="text-xs font-normal text-gray-400">
                保存中…
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onRemove}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            隐藏
          </button>
        </div>

        <p className="mt-1 text-xs text-gray-500">
          可用于年金、买基金、保险缴费、还款及其他大额资金安排。
          这里只做本次计算，不修改 Fixed Income 或 CASHFLOW 原始数据。
        </p>
      </div>

      {/* =================================================
          目标
      ================================================= */}

      <div className="mb-5 rounded-xl border border-gray-200 p-4">
        <div className="mb-3 text-sm font-semibold text-gray-800">
          ① 资金目标
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              目标用途
            </label>

            <input
              value={targetName}
              onChange={(event) =>
                updateTargetName(
                  event.target.value
                )
              }
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
              placeholder="例如：年金缴费"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs text-gray-500">
              目标金额
            </label>

            <input
              value={targetAmount}
              onChange={(event) =>
                updateTargetAmount(
                  event.target.value
                )
              }
              type="number"
              min="0"
              step="0.01"
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
              placeholder="221000"
            />
          </div>
        </div>
      </div>

      {/* =================================================
          Fixed Income
      ================================================= */}

      <div className="mb-5 rounded-xl border border-gray-200 p-4">
        <div className="mb-1 text-sm font-semibold text-gray-800">
          ② Fixed Income 资金
        </div>

        <div className="mb-4 text-xs text-gray-500">
          点击「添加一行」后选择需要使用的固收资产。
          当前金额为资产实际金额，本次使用金额默认等于当前金额，可以修改。
        </div>

        {loadingFixedIncome ? (
          <div className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-400">
            正在读取 Fixed Income……
          </div>
        ) : fixedIncomeAssets.length === 0 ? (
          <div className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-400">
            暂无 Fixed Income 资产
          </div>
        ) : (
          <>
            {fixedIncomeRows.length > 0 && (
              <div className="space-y-2">
                {fixedIncomeRows.map(
                  (row) => {
                    const asset =
                      fixedIncomeAssets.find(
                        (item) =>
                          item.id ===
                          row.assetId
                      );

                    const available =
                      asset
                        ? fundingNumber(
                            asset.amount
                          )
                        : 0;

                    const useAmount =
                      fundingNumber(
                        row.useAmount
                      );

                    return (
                      <div
                        key={row.id}
                        className="rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-center">
                          {/* 固收选择 */}

                          <div className="min-w-0 flex-1">
                            <select
                              value={
                                row.assetId
                              }
                              onChange={(
                                event
                              ) =>
                                updateFixedIncomeAsset(
                                  row.id,
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                            >
                              <option value="">
                                选择 Fixed Income
                              </option>

                              {fixedIncomeAssets.map(
                                (
                                  item
                                ) => {
                                  const alreadyUsed =
                                    fixedIncomeRows.some(
                                      (
                                        other
                                      ) =>
                                        other.id !==
                                          row.id &&
                                        other.assetId ===
                                          item.id
                                    );

                                  const itemAmount =
                                    fundingNumber(
                                      item.amount
                                    );

                                  return (
                                    <option
                                      key={
                                        item.id
                                      }
                                      value={
                                        item.id
                                      }
                                      disabled={
                                        alreadyUsed
                                      }
                                    >
                                      {item.name}　¥
                                      {itemAmount.toLocaleString(
                                        "zh-CN",
                                        {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        }
                                      )}
                                      {alreadyUsed
                                        ? "（已选择）"
                                        : ""}
                                    </option>
                                  );
                                }
                              )}
                            </select>
                          </div>

                          {/* 当前金额 */}

                          {asset && (
                            <>
                              <div className="shrink-0 whitespace-nowrap text-sm text-gray-600">
                                <span className="text-gray-400">
                                  当前金额{" "}
                                </span>

                                <span className="font-medium text-gray-800">
                                  ¥
                                  {available.toLocaleString(
                                    "zh-CN",
                                    {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    }
                                  )}
                                </span>
                              </div>

                              {/* 本次使用 */}

                              <div className="flex shrink-0 items-center gap-2 whitespace-nowrap">
                                <span className="text-sm text-gray-400">
                                  本次使用
                                </span>

                                <input
                                  value={
                                    row.useAmount
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateFixedIncomeUseAmount(
                                      row.id,
                                      event
                                        .target
                                        .value
                                    )
                                  }
                                  type="number"
                                  min="0"
                                  max={
                                    available
                                  }
                                  step="0.01"
                                  className="w-[150px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                                />
                              </div>
                            </>
                          )}

                          {/* 删除 */}

                          <button
                            type="button"
                            onClick={() =>
                              deleteFixedIncomeRow(
                                row.id
                              )
                            }
                            className="shrink-0 rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          >
                            删除
                          </button>
                        </div>

                        {asset &&
                          useAmount >
                            available && (
                            <div className="mt-2 text-xs text-red-500">
                              本次使用金额不能超过当前金额 ¥
                              {available.toLocaleString(
                                "zh-CN",
                                {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                }
                              )}
                            </div>
                          )}
                      </div>
                    );
                  }
                )}
              </div>
            )}

            <button
              type="button"
              onClick={
                addFixedIncomeRow
              }
              className="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              ＋ 添加一行
            </button>
          </>
        )}

        <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-3">
          <span className="text-sm text-gray-600">
            Fixed Income 本次使用
          </span>

          <span className="text-lg font-bold text-gray-900">
            ¥
            {selectedFixedIncomeTotal.toLocaleString(
              "zh-CN",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </span>
        </div>
      </div>

      {/* =================================================
          CASHFLOW
      ================================================= */}

      <div className="mb-5 rounded-xl border border-gray-200 p-4">
        <div className="mb-1 text-sm font-semibold text-gray-800">
          ③ CASHFLOW 资金
        </div>

        <div className="mb-4 text-xs text-gray-500">
          选择 CASHFLOW 中准备使用的支出项目。
          添加到这里的行会直接计入本次资金筹集。
          本次使用金额可以单独修改。
          这里只做本次计算，不修改 CASHFLOW 原始数据。
        </div>

        {loadingCashflow ? (
          <div className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-400">
            正在读取 CASHFLOW……
          </div>
        ) : cashflowYearOptions.length === 0 ? (
          <div className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-400">
            暂无 CASHFLOW 数据
          </div>
        ) : (
          <>
            {cashflowRows.length > 0 && (
              <div className="space-y-2">
                {cashflowRows.map(
                  (row) => {
                    const monthOptions =
                      getCashflowMonthOptions(
                        row.year
                      );

                    const expenseOptions =
                      getCashflowExpenseOptions(
                        row.year,
                        row.month
                      );

                    return (
                      <div
                        key={row.id}
                        className="rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[120px_100px_minmax(180px,1fr)_180px_60px]">
                          <div>
                            <label className="mb-1 block text-xs text-gray-500">
                              年份
                            </label>

                            <select
                              value={
                                row.year
                              }
                              onChange={(
                                event
                              ) =>
                                updateCashflowYear(
                                  row.id,
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                            >
                              <option value="">
                                选择年份
                              </option>

                              {cashflowYearOptions.map(
                                (
                                  year
                                ) => (
                                  <option
                                    key={
                                      year
                                    }
                                    value={String(
                                      year
                                    )}
                                  >
                                    {year}
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-gray-500">
                              月份
                            </label>

                            <select
                              value={
                                row.month
                              }
                              onChange={(
                                event
                              ) =>
                                updateCashflowMonth(
                                  row.id,
                                  event
                                    .target
                                    .value
                                )
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                            >
                              <option value="">
                                选择月份
                              </option>

                              {monthOptions.map(
                                (
                                  month
                                ) => (
                                  <option
                                    key={
                                      month
                                    }
                                    value={String(
                                      month
                                    )}
                                  >
                                    {month}月
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-gray-500">
                              支出项目
                            </label>

                            <select
                              value={
                                row.expenseName
                              }
                              onChange={(
                                event
                              ) =>
                                updateCashflowExpense(
                                  row.id,
                                  event
                                    .target
                                    .value
                                )
                              }
                              disabled={
                                !row.year ||
                                !row.month
                              }
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500 disabled:bg-gray-50 disabled:text-gray-400"
                            >
                              <option value="">
                                选择支出项目
                              </option>

                              {expenseOptions.map(
                                (
                                  expense,
                                  index
                                ) => (
                                  <option
                                    key={`${expense.name}-${index}`}
                                    value={
                                      expense.name
                                    }
                                  >
                                    {
                                      expense.name
                                    }
                                  </option>
                                )
                              )}
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-xs text-gray-500">
                              本次使用金额
                            </label>

                            <input
                              value={
                                row.amount
                              }
                              onChange={(
                                event
                              ) =>
                                updateCashflowAmount(
                                  row.id,
                                  event
                                    .target
                                    .value
                                )
                              }
                              type="number"
                              min="0"
                              step="0.01"
                              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                            />
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              deleteCashflowRow(
                                row.id
                              )
                            }
                            className="rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                          >
                            删除
                          </button>
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}

            <button
              type="button"
              onClick={
                addCashflowRow
              }
              className="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              ＋ 添加一行
            </button>
          </>
        )}

        <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-3">
          <span className="text-sm text-gray-600">
            CASHFLOW 本次使用
          </span>

          <span className="text-lg font-bold text-gray-900">
            ¥
            {cashflowTotal.toLocaleString(
              "zh-CN",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </span>
        </div>
      </div>

      {/* =================================================
          手工资金
      ================================================= */}

      <div className="mb-5 rounded-xl border border-gray-200 p-4">
        <div className="mb-1 text-sm font-semibold text-gray-800">
          ④ 其他手工资金
        </div>

        <div className="mb-4 text-xs text-gray-500">
          这里可以填写不属于 Fixed Income / CASHFLOW
          的其他资金来源。
        </div>

        {manualSources.length > 0 && (
          <div className="space-y-2">
            {manualSources.map(
              (source) => (
                <div
                  key={source.id}
                  className="grid grid-cols-1 items-end gap-3 md:grid-cols-[minmax(180px,1fr)_220px_60px]"
                >
                  <div>
                    <label className="mb-1 block text-xs text-gray-500">
                      资金来源
                    </label>

                    <input
                      value={
                        source.name
                      }
                      onChange={(
                        event
                      ) =>
                        updateManualSource(
                          source.id,
                          "name",
                          event.target.value
                        )
                      }
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                      placeholder="例如：银行存款"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-gray-500">
                      金额
                    </label>

                    <input
                      value={
                        source.amount
                      }
                      onChange={(
                        event
                      ) =>
                        updateManualSource(
                          source.id,
                          "amount",
                          event.target.value
                        )
                      }
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      deleteManualSource(
                        source.id
                      )
                    }
                    className="rounded-lg px-2 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                  >
                    删除
                  </button>
                </div>
              )
            )}
          </div>
        )}

        <button
          type="button"
          onClick={
            addManualSource
          }
          className="mt-3 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          ＋ 添加资金
        </button>

        <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-3">
          <span className="text-sm text-gray-600">
            其他手工资金
          </span>

          <span className="text-lg font-bold text-gray-900">
            ¥
            {manualTotal.toLocaleString(
              "zh-CN",
              {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              }
            )}
          </span>
        </div>
      </div>

      {/* =================================================
          最终结果
      ================================================= */}

      <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="mb-4 text-sm font-semibold text-gray-800">
          ⑤ 资金筹集结果
        </div>

        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-600">
              资金目标
            </span>

            <span className="font-semibold text-gray-900">
              {targetName ||
                "资金目标"}{" "}
              · ¥
              {target.toLocaleString(
                "zh-CN",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-600">
              Fixed Income
            </span>

            <span className="font-semibold text-gray-900">
              ¥
              {selectedFixedIncomeTotal.toLocaleString(
                "zh-CN",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-600">
              CASHFLOW
            </span>

            <span className="font-semibold text-gray-900">
              ¥
              {cashflowTotal.toLocaleString(
                "zh-CN",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-600">
              其他手工资金
            </span>

            <span className="font-semibold text-gray-900">
              ¥
              {manualTotal.toLocaleString(
                "zh-CN",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>

          <div className="border-t border-gray-200 pt-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-semibold text-gray-800">
                可筹集资金合计
              </span>

              <span className="text-xl font-bold text-gray-900">
                ¥
                {totalAvailable.toLocaleString(
                  "zh-CN",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3">
            <span className="font-semibold text-gray-800">
              {isEnough
                ? "资金余额"
                : "资金缺口"}
            </span>

            <span
              className={[
                "text-lg font-bold",
                isEnough
                  ? "text-gray-900"
                  : "text-red-600",
              ].join(" ")}
            >
              ¥
              {Math.abs(
                difference
              ).toLocaleString(
                "zh-CN",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>

          <div className="pt-2">
            {isEnough ? (
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-3 text-sm font-medium text-gray-800">
                ✓ 资金已足够，可以覆盖本次资金目标。
              </div>
            ) : (
              <div className="rounded-lg border border-red-200 bg-white px-3 py-3 text-sm font-medium text-red-600">
                ⚠ 资金不足，还需要补充 ¥
                {Math.abs(
                  difference
                ).toLocaleString(
                  "zh-CN",
                  {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {sourceError && (
        <div className="mt-4 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs text-red-600">
          {sourceError}
        </div>
      )}
    </section>
  );
}

// =====================================================
// Sortable Task
// =====================================================

function SortableTaskRow({
  task,
  holdings,
  onToggle,
  onDelete,
  onSelectHolding,
}: {
  task: RecordTask;
  holdings: Holding[];
  onToggle: (
    task: RecordTask
  ) => void;
  onDelete: (
    task: RecordTask
  ) => void;
  onSelectHolding: (
    task: RecordTask,
    holdingId: number | null
  ) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
  });

  const style = {
    transform:
      CSS.Transform.toString(
        transform
      ),
    transition,
  };

  const selected =
    task.holding_id !== null
      ? holdings.find(
          (h) =>
            Number(
              holdingField(
                h,
                "id"
              )
            ) ===
            Number(
              task.holding_id
            )
        ) ?? null
      : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={[
        "border-b border-gray-100 px-4 py-3 last:border-b-0",
        isDragging
          ? "relative z-10 bg-gray-50 shadow-sm"
          : "bg-white",
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <button
          type="button"
          aria-label="拖动任务"
          className="mt-1 cursor-grab select-none text-gray-300 hover:text-gray-500 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          ⋮⋮
        </button>

        <input
          type="checkbox"
          checked={
            task.completed
          }
          onChange={() =>
            onToggle(task)
          }
          className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300"
        />

        <div className="min-w-0 flex-1">
          <div
            className={
              task.completed
                ? "text-sm text-gray-400"
                : "text-sm text-gray-900"
            }
          >
            {task.title}
          </div>

          {task.condition && (
            <div className="mt-1 text-xs text-gray-500">
              条件：
              {
                task.condition
              }
            </div>
          )}

          <div className="mt-2">
            <div className="mb-1 text-xs font-medium text-gray-500">
              Holding
            </div>

            <select
              value={
                task.holding_id ===
                null
                  ? ""
                  : String(
                      task.holding_id
                    )
              }
              onChange={(e) =>
                onSelectHolding(
                  task,
                  e.target
                    .value
                    ? Number(
                        e.target
                          .value
                      )
                    : null
                )
              }
              className="w-full max-w-xl rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-500"
            >
              <option value="">
                请选择 Holding
              </option>

              {holdings.map(
                (h) => {
                  const id =
                    Number(
                      holdingField(
                        h,
                        "id"
                      )
                    );

                  if (
                    !Number.isFinite(
                      id
                    )
                  ) {
                    return null;
                  }

                  return (
                    <option
                      key={id}
                      value={id}
                    >
                      {holdingName(
                        h
                      ) ||
                        "未命名资产"}
                      {holdingCode(
                        h
                      )
                        ? ` · ${holdingCode(
                            h
                          )}`
                        : ""}
                    </option>
                  );
                }
              )}
            </select>
          </div>

          {selected && (
            <HoldingInfo
              task={task}
              holding={selected}
            />
          )}

          {task.completed &&
            task.completed_at && (
              <div className="mt-2 text-xs text-gray-400">
                完成于{" "}
                {formatDateTime(
                  task.completed_at
                )}
              </div>
            )}
        </div>

        <button
          type="button"
          onClick={() =>
            onDelete(task)
          }
          className="shrink-0 rounded px-2 py-1 text-xs text-red-400 transition hover:bg-red-50 hover:text-red-600"
        >
          删除
        </button>
      </div>
    </div>
  );
}

// =====================================================
// Page
// =====================================================

export default function RecordDetailPage() {
  const router = useRouter();
  const pathname = usePathname();

  const recordId = useMemo(() => {
    const parts =
      pathname
        .split("/")
        .filter(Boolean);

    return parts.length >= 2
      ? parts[
          parts.length - 1
        ] ?? ""
      : "";
  }, [pathname]);

  const sensors =
    useSensors(
      useSensor(
        PointerSensor,
        {
          activationConstraint:
            {
              distance: 5,
            },
        }
      )
    );

  const [record, setRecord] =
    useState<RecordItem | null>(
      null
    );

  const [tasks, setTasks] =
    useState<RecordTask[]>(
      []
    );

  const [files, setFiles] =
    useState<RecordFile[]>(
      []
    );

  const [holdings, setHoldings] =
    useState<Holding[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [title, setTitle] =
    useState("");

  const [newTask, setNewTask] =
    useState("");

  const [batchText, setBatchText] =
    useState("");

  const [batchDrafts, setBatchDrafts] =
    useState<
      BatchTaskDraft[]
    >([]);

  const [showBatchReview, setShowBatchReview] =
    useState(false);

  const [savingTitle, setSavingTitle] =
    useState(false);

  const [savingContent, setSavingContent] =
    useState(false);

  const [addingTask, setAddingTask] =
    useState(false);

  const [deletingAllTasks, setDeletingAllTasks] =
    useState(false);

  const [showFundingCalculator, setShowFundingCalculator] =
    useState(false);

  const [fundingCalculatorCollapsed, setFundingCalculatorCollapsed] =
    useState(false);

  const [uploading, setUploading] =
    useState(false);

  const editor =
    useEditor({
      extensions: [
        StarterKit,
        TextStyle,
        Color.configure({
          types: [
            "textStyle",
          ],
        }),
      ],

      content: {
        type: "doc",
        content: [
          {
            type: "paragraph",
          },
        ],
      },

      editorProps: {
        attributes: {
          class:
            "min-h-[320px] px-5 py-5 outline-none",
        },
      },

      immediatelyRender: false,
    });

  async function loadRecord() {
    if (!recordId) return;

    const response =
      await fetch(
        `/api/record/${recordId}`,
        {
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "获取记录失败"
      );
    }

    const loadedRecord =
      data?.record ??
      null;

    setRecord(
      loadedRecord
    );

    setTitle(
      loadedRecord?.title ??
        ""
    );

    // =================================================
    // 如果当前 Record 已经保存过资金筹集计算器，
    // 刷新后自动重新显示
    // =================================================

    const hasFundingCalculator =
      Boolean(
        loadedRecord?.content &&
          typeof loadedRecord
            .content ===
            "object" &&
          loadedRecord.content
            .fundingCalculator &&
          typeof loadedRecord
            .content
            .fundingCalculator ===
            "object"
      );

    setShowFundingCalculator(
      hasFundingCalculator
    );

    setFundingCalculatorCollapsed(
      false
    );
  }

  async function loadTasks() {
    if (!recordId) return;

    const response =
      await fetch(
        `/api/record/${recordId}/tasks`,
        {
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "获取任务失败"
      );
    }

    const loadedTasks: RecordTask[] =
      Array.isArray(
        data?.tasks
      )
        ? data.tasks
        : [];

    if (
      holdings.length >
      0
    ) {
      let changed =
        false;

      const nextTasks = [
        ...loadedTasks,
      ];

      for (
        let i = 0;
        i <
        nextTasks.length;
        i++
      ) {
        const task =
          nextTasks[i];

        if (
          task.holding_id !==
          null
        ) {
          continue;
        }

        const matched =
          findMatchingHolding(
            task.title,
            holdings
          );

        if (!matched)
          continue;

        const matchedId =
          Number(
            holdingField(
              matched,
              "id"
            )
          );

        if (
          !Number.isFinite(
            matchedId
          )
        ) {
          continue;
        }

        try {
          const saveResponse =
            await fetch(
              `/api/record/${recordId}/tasks`,
              {
                method:
                  "PUT",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify(
                  {
                    taskId:
                      task.id,

                    holding_id:
                      matchedId,
                  }
                ),
              }
            );

          if (
            saveResponse.ok
          ) {
            nextTasks[i] = {
              ...task,
              holding_id:
                matchedId,
            };

            changed =
              true;
          }
        } catch {
          // 自动匹配失败不影响页面。
        }
      }

      setTasks(
        nextTasks
      );

      return;
    }

    setTasks(
      loadedTasks
    );
  }

  async function loadFiles() {
    if (!recordId) return;

    const response =
      await fetch(
        `/api/record/${recordId}/files`,
        {
          cache: "no-store",
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "获取附件失败"
      );
    }

    setFiles(
      Array.isArray(
        data?.files
      )
        ? data.files
        : []
    );
  }

  async function loadHoldings() {
    try {
      const result =
        await getHoldings();

      setHoldings(
        Array.isArray(
          result
        )
          ? result
          : []
      );
    } catch (e) {
      console.error(
        "获取 Holding 失败:",
        e
      );

      setHoldings(
        []
      );
    }
  }

  useEffect(() => {
    if (!recordId)
      return;

    let cancelled =
      false;

    async function init() {
      try {
        setLoading(
          true
        );

        setError("");

        await Promise.all(
          [
            loadRecord(),
            loadFiles(),
            loadHoldings(),
          ]
        );

        await loadTasks();
      } catch (e) {
        if (
          !cancelled
        ) {
          setError(
            e instanceof
              Error
              ? e.message
              : "加载记录失败"
          );
        }
      } finally {
        if (
          !cancelled
        ) {
          setLoading(
            false
          );
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  // =====================================================
  // 正文恢复
  // 资金筹集计算器不是 TipTap 正文，
  // 所以恢复正文时把 fundingCalculator 排除掉
  // =====================================================

  useEffect(() => {
    if (
      !editor ||
      !record?.content
    ) {
      return;
    }

    const {
      fundingCalculator:
        _fundingCalculator,
      ...editorContent
    } = record.content;

    editor.commands.setContent(
      editorContent
    );
  }, [
    editor,
    record?.id,
  ]);

  // =====================================================
  // 保存资金筹集计算器到当前 Record.content
  // =====================================================

  async function saveFundingCalculatorContent(
    content: Record<string, unknown>
  ) {
    if (!recordId) {
      return;
    }

    const response =
      await fetch(
        `/api/record/${recordId}`,
        {
          method:
            "PUT",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            content,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "保存资金筹集计算失败"
      );
    }

    setRecord(
      data?.record ??
        null
    );
  }

  // =====================================================
  // 删除资金筹集计算器
  // =====================================================

  async function removeFundingCalculator() {
    if (!recordId)
      return;

    try {
      const current =
        record?.content ??
        {};

      const {
        fundingCalculator:
          _fundingCalculator,
        ...restContent
      } = current;

      await saveFundingCalculatorContent(
        restContent
      );

      setShowFundingCalculator(
        false
      );

      setFundingCalculatorCollapsed(
        false
      );
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "隐藏资金筹集计算失败"
      );
    }
  }

  // =====================================================
  // 保存标题
  // =====================================================

  async function saveTitle() {
    const value =
      title.trim();

    if (
      !recordId ||
      !value
    ) {
      alert(
        "记录名称不能为空"
      );
      return;
    }

    try {
      setSavingTitle(
        true
      );

      const response =
        await fetch(
          `/api/record/${recordId}`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              title: value,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "保存标题失败"
        );
      }

      setRecord(
        data?.record ??
          null
      );
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "保存标题失败"
      );
    } finally {
      setSavingTitle(
        false
      );
    }
  }

  // =====================================================
  // 保存正文
  // 注意：保留 fundingCalculator
  // 防止点击「保存正文」把计算器数据覆盖掉
  // =====================================================

  async function saveContent() {
    if (
      !recordId ||
      !editor
    ) {
      return;
    }

    try {
      setSavingContent(
        true
      );

      const editorJson =
        editor.getJSON();

      const currentFundingCalculator =
        record?.content
          ?.fundingCalculator;

      const nextContent: Record<
        string,
        unknown
      > = {
        ...(editorJson as Record<
          string,
          unknown
        >),
      };

      if (
        currentFundingCalculator !==
        undefined
      ) {
        nextContent.fundingCalculator =
          currentFundingCalculator;
      }

      const response =
        await fetch(
          `/api/record/${recordId}`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              content:
                nextContent,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "保存内容失败"
        );
      }

      setRecord(
        data?.record ??
          null
      );
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "保存内容失败"
      );
    } finally {
      setSavingContent(
        false
      );
    }
  }

  // =====================================================
  // 新增任务
  // =====================================================

  async function createTask(
    taskTitle: string,
    condition: string | null = null,
    holdingId: number | null = null
  ) {
    if (
      !recordId ||
      !taskTitle.trim()
    ) {
      return;
    }

    const response =
      await fetch(
        `/api/record/${recordId}/tasks`,
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            title:
              taskTitle.trim(),

            condition,

            holding_id:
              holdingId,
          }),
        }
      );

    const data =
      await response.json();

    if (!response.ok) {
      throw new Error(
        data?.error ||
          "新增任务失败"
      );
    }
  }

  async function handleAddTask() {
    if (
      !newTask.trim()
    )
      return;

    try {
      setAddingTask(
        true
      );

      const parsed =
        parseBatchTaskLine(
          newTask
        );

      if (
        !parsed.title
      )
        return;

      const auto =
        findMatchingHolding(
          parsed.title,
          holdings
        );

      const detected =
        parseMonitoringCondition(
          parsed.title,
          parsed.condition
        );

      const finalCondition =
        parsed.condition?.trim() ||
        detected?.label ||
        null;

      await createTask(
        parsed.title,
        finalCondition,
        auto
          ? Number(
              holdingField(
                auto,
                "id"
              )
            )
          : null
      );

      setNewTask("");

      await loadTasks();
      await loadRecord();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "新增任务失败"
      );
    } finally {
      setAddingTask(
        false
      );
    }
  }

  // =====================================================
  // 批量任务
  // =====================================================

  function buildBatchDrafts() {
    const parsedLines =
      batchText
        .split(/\r?\n/)
        .map(
          parseBatchTaskLine
        )
        .filter(
          (item) =>
            Boolean(
              item.title
            )
        );

    const unique =
      Array.from(
        new Map(
          parsedLines.map(
            (item) => [
              `${item.title}|||${
                item.condition ??
                ""
              }`,
              item,
            ]
          )
        ).values()
      );

    return unique.map(
      (
        item,
        index
      ) => {
        const auto =
          findMatchingHolding(
            item.title,
            holdings
          );

        const detected =
          parseMonitoringCondition(
            item.title,
            item.condition
          );

        return {
          id: `batch-${Date.now()}-${index}`,

          title:
            item.title,

          assetRelated:
            Boolean(auto) ||
            isLikelyAssetTask(
              item.title
            ),

          condition:
            item.condition?.trim() ||
            detected?.label ||
            null,

          holdingId:
            auto
              ? Number(
                  holdingField(
                    auto,
                    "id"
                  )
                )
              : null,
        };
      }
    );
  }

  function handlePreviewBatchTasks() {
    if (
      !batchText.trim()
    )
      return;

    const drafts =
      buildBatchDrafts();

    if (!drafts.length)
      return;

    setBatchDrafts(
      drafts
    );

    setShowBatchReview(
      true
    );
  }

  async function handleConfirmBatchAdd() {
    if (
      !recordId ||
      !batchDrafts.length
    ) {
      return;
    }

    try {
      setAddingTask(
        true
      );

      for (
        const draft of batchDrafts
      ) {
        const detected =
          parseMonitoringCondition(
            draft.title,
            draft.condition
          );

        const finalCondition =
          draft.condition?.trim() ||
          detected?.label ||
          null;

        await createTask(
          draft.title,
          finalCondition,
          draft.holdingId
        );
      }

      setBatchText("");
      setBatchDrafts([]);
      setShowBatchReview(
        false
      );

      await loadTasks();
      await loadRecord();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "批量新增任务失败"
      );
    } finally {
      setAddingTask(
        false
      );
    }
  }

  // =====================================================
  // 任务操作
  // =====================================================

  async function handleToggleTask(
    task: RecordTask
  ) {
    try {
      const response =
        await fetch(
          `/api/record/${recordId}/tasks`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              taskId:
                task.id,

              completed:
                !task.completed,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "更新任务失败"
        );
      }

      await loadTasks();
      await loadRecord();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "更新任务失败"
      );
    }
  }

  async function handleSelectHolding(
    task: RecordTask,
    holdingId: number | null
  ) {
    try {
      const response =
        await fetch(
          `/api/record/${recordId}/tasks`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              taskId:
                task.id,

              holding_id:
                holdingId,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "保存 Holding 失败"
        );
      }

      await loadTasks();
      await loadRecord();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "保存 Holding 失败"
      );
    }
  }

  async function handleDeleteTask(
    task: RecordTask
  ) {
    if (
      !window.confirm(
        `确定删除任务「${task.title}」吗？`
      )
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/record/${recordId}/tasks`,
          {
            method:
              "DELETE",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              taskId:
                task.id,
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "删除任务失败"
        );
      }

      await loadTasks();
      await loadRecord();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "删除任务失败"
      );
    }
  }

  async function handleDeleteAllTasks() {
    if (
      !recordId ||
      tasks.length === 0 ||
      deletingAllTasks
    ) {
      return;
    }

    const taskCount =
      tasks.length;

    const confirmed =
      window.confirm(
        `确定删除当前全部 ${taskCount} 个任务吗？\n\n` +
          `删除后这些 TASK 将全部删除，且无法恢复。\n` +
          `Holding 本身不会被删除。`
      );

    if (!confirmed)
      return;

    try {
      setDeletingAllTasks(
        true
      );

      setError("");

      const currentTasks =
        [...tasks];

      for (
        const task of currentTasks
      ) {
        const response =
          await fetch(
            `/api/record/${recordId}/tasks`,
            {
              method:
                "DELETE",

              headers: {
                "Content-Type":
                  "application/json",
              },

              body: JSON.stringify({
                taskId:
                  task.id,
              }),
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => null
            );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              `删除任务「${task.title}」失败`
          );
        }
      }

      setTasks([]);

      await loadRecord();
    } catch (e) {
      await loadTasks().catch(
        () => {}
      );

      alert(
        e instanceof Error
          ? e.message
          : "批量删除任务失败"
      );
    } finally {
      setDeletingAllTasks(
        false
      );
    }
  }

  async function handleDragEnd(
    event: DragEndEvent
  ) {
    const {
      active,
      over,
    } = event;

    if (
      !over ||
      active.id ===
        over.id
    ) {
      return;
    }

    const oldIndex =
      tasks.findIndex(
        (x) =>
          x.id ===
          active.id
      );

    const newIndex =
      tasks.findIndex(
        (x) =>
          x.id ===
          over.id
      );

    if (
      oldIndex < 0 ||
      newIndex < 0
    ) {
      return;
    }

    const next =
      arrayMove(
        tasks,
        oldIndex,
        newIndex
      ).map(
        (
          task,
          index
        ) => ({
          ...task,
          sort_order:
            index,
        })
      );

    setTasks(next);

    try {
      const response =
        await fetch(
          `/api/record/${recordId}/tasks`,
          {
            method:
              "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              reorder:
                next.map(
                  (
                    task,
                    index
                  ) => ({
                    taskId:
                      task.id,

                    sort_order:
                      index,
                  })
                ),
            }),
          }
        );

      if (
        !response.ok
      ) {
        await loadTasks();
      }
    } catch {
      await loadTasks();
    }
  }

  // =====================================================
  // 附件
  // =====================================================

  async function handleUploadFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value =
      "";

    if (
      !file ||
      !recordId
    ) {
      return;
    }

    try {
      setUploading(
        true
      );

      const formData =
        new FormData();

      formData.append(
        "file",
        file
      );

      const response =
        await fetch(
          `/api/record/${recordId}/files`,
          {
            method:
              "POST",

            body:
              formData,
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "上传附件失败"
        );
      }

      await loadFiles();
      await loadRecord();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "上传附件失败"
      );
    } finally {
      setUploading(
        false
      );
    }
  }

  async function handleOpenFile(
    file: RecordFile
  ) {
    try {
      const response =
        await fetch(
          `/api/record/${recordId}/files/${file.id}`,
          {
            cache:
              "no-store",
          }
        );

      if (
        !response.ok
      ) {
        throw new Error(
          "打开附件失败"
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob
        );

      window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );

      setTimeout(
        () =>
          URL.revokeObjectURL(
            url
          ),
        60_000
      );
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "打开附件失败"
      );
    }
  }

  async function handleDeleteFile(
    file: RecordFile
  ) {
    if (
      !window.confirm(
        `确定删除附件「${file.file_name}」吗？`
      )
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          `/api/record/${recordId}/files/${file.id}`,
          {
            method:
              "DELETE",
          }
        );

      const data =
        await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "删除附件失败"
        );
      }

      await loadFiles();
      await loadRecord();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "删除附件失败"
      );
    }
  }

  // =====================================================
  // Loading
  // =====================================================

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl text-sm text-gray-500">
          正在加载记录……
        </div>
      </main>
    );
  }

  // =====================================================
  // Error
  // =====================================================

  if (
    error ||
    !record
  ) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl">
          <button
            onClick={() =>
              router.back()
            }
            className="mb-5 text-sm text-gray-600 hover:text-gray-900"
          >
            ← 返回
          </button>

          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-600">
            {error ||
              "记录不存在"}
          </div>
        </div>
      </main>
    );
  }

  // =====================================================
  // 页面
  // =====================================================

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        {/* 返回 */}

        <button
          type="button"
          onClick={() =>
            router.back()
          }
          className="mb-5 text-sm text-gray-600 hover:text-gray-900"
        >
          ← 返回
        </button>

        {/* =================================================
            标题
        ================================================= */}

        <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex gap-3">
            <input
              value={title}
              onChange={(e) =>
                setTitle(
                  e.target.value
                )
              }
              className="min-w-0 flex-1 border-0 p-0 text-2xl font-semibold text-gray-900 outline-none"
            />

            <button
              type="button"
              onClick={
                saveTitle
              }
              disabled={
                savingTitle
              }
              className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              {savingTitle
                ? "保存中…"
                : "保存标题"}
            </button>
          </div>

          <div className="mt-2 text-xs text-gray-400">
            最后更新：
            {formatDateTime(
              record.updated_at
            )}
          </div>
        </section>

        {/* =================================================
            正文
        ================================================= */}

        <section className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3">
            <button
              type="button"
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .toggleBold()
                  .run()
              }
              className="rounded px-3 py-1 text-sm font-bold hover:bg-gray-100"
            >
              B
            </button>

            <button
              type="button"
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .toggleHeading({
                    level: 1,
                  })
                  .run()
              }
              className="rounded px-3 py-1 text-sm hover:bg-gray-100"
            >
              H1
            </button>

            <button
              type="button"
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .toggleHeading({
                    level: 2,
                  })
                  .run()
              }
              className="rounded px-3 py-1 text-sm hover:bg-gray-100"
            >
              H2
            </button>

            <button
              type="button"
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .toggleBulletList()
                  .run()
              }
              className="rounded px-3 py-1 text-sm hover:bg-gray-100"
            >
              • 列表
            </button>

            <button
              type="button"
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .toggleOrderedList()
                  .run()
              }
              className="rounded px-3 py-1 text-sm hover:bg-gray-100"
            >
              1. 列表
            </button>

            <button
              type="button"
              onClick={() =>
                editor
                  ?.chain()
                  .focus()
                  .setHorizontalRule()
                  .run()
              }
              className="rounded px-3 py-1 text-sm hover:bg-gray-100"
            >
              ─
            </button>

            {[
              ["红", "#ef4444"],
              ["橙", "#f97316"],
              ["黄", "#eab308"],
              ["绿", "#22c55e"],
              ["蓝", "#3b82f6"],
              ["黑", "#111827"],
            ].map(
              ([label, color]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .setColor(
                        color
                      )
                      .run()
                  }
                  className="rounded px-2 py-1 text-xs hover:bg-gray-100"
                  style={{
                    color,
                  }}
                >
                  {label}
                </button>
              )
            )}

            <button
              type="button"
              onClick={
                saveContent
              }
              disabled={
                savingContent
              }
              className="ml-auto rounded-lg bg-gray-900 px-4 py-1.5 text-sm text-white disabled:opacity-50"
            >
              {savingContent
                ? "保存中…"
                : "保存正文"}
            </button>
          </div>

          <EditorContent
            editor={editor}
          />
        </section>

        {/* =================================================
            资金筹集计算器
        ================================================= */}

        {!showFundingCalculator ? (
          <section className="mb-6">
            <button
              type="button"
              onClick={() => {
                setShowFundingCalculator(
                  true
                );

                setFundingCalculatorCollapsed(
                  false
                );
              }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              ＋ 添加资金筹集计算
            </button>
          </section>
        ) : (
          <FundingCalculator
            collapsed={
              fundingCalculatorCollapsed
            }
            onToggleCollapse={() =>
              setFundingCalculatorCollapsed(
                (value) =>
                  !value
              )
            }
            onRemove={
              removeFundingCalculator
            }
            initialContent={
              record.content
            }
            onSaveContent={
              saveFundingCalculatorContent
            }
          />
        )}

        {/* =================================================
            执行任务
        ================================================= */}

        <section className="mb-6 rounded-xl border border-gray-200 bg-gray-100 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-gray-900">
                执行任务
              </h2>

              <div className="mt-1 text-xs text-gray-500">
                进度：
                {
                  tasks.filter(
                    (x) =>
                      x.completed
                  ).length
                }{" "}
                /{" "}
                {
                  tasks.length
                }
              </div>
            </div>

            <button
              type="button"
              onClick={
                handleDeleteAllTasks
              }
              disabled={
                deletingAllTasks ||
                tasks.length ===
                  0
              }
              className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs text-red-500 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {deletingAllTasks
                ? "全部删除中…"
                : "删除全部任务"}
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <DndContext
              sensors={
                sensors
              }
              collisionDetection={
                closestCenter
              }
              onDragEnd={
                handleDragEnd
              }
            >
              <SortableContext
                items={tasks.map(
                  (x) =>
                    x.id
                )}
                strategy={
                  verticalListSortingStrategy
                }
              >
                {tasks.map(
                  (task) => (
                    <SortableTaskRow
                      key={
                        task.id
                      }
                      task={
                        task
                      }
                      holdings={
                        holdings
                      }
                      onToggle={
                        handleToggleTask
                      }
                      onDelete={
                        handleDeleteTask
                      }
                      onSelectHolding={
                        handleSelectHolding
                      }
                    />
                  )
                )}
              </SortableContext>
            </DndContext>

            {!tasks.length && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">
                暂无任务
              </div>
            )}
          </div>

          {/* 单个添加 */}

          <div className="mt-4 flex gap-2">
            <input
              value={
                newTask
              }
              onChange={(e) =>
                setNewTask(
                  e.target
                    .value
                )
              }
              onKeyDown={(e) => {
                if (
                  e.key ===
                  "Enter"
                ) {
                  handleAddTask();
                }
              }}
              placeholder="添加一个任务，例如：卖出日本基金"
              className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
            />

            <button
              type="button"
              onClick={
                handleAddTask
              }
              disabled={
                addingTask ||
                !newTask.trim()
              }
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
            >
              添加
            </button>
          </div>

          {/* 批量 */}

          <div className="mt-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 text-sm font-medium text-gray-800">
              ＋ 批量添加任务
            </div>

            <textarea
              value={
                batchText
              }
              onChange={(e) =>
                setBatchText(
                  e.target
                    .value
                )
              }
              placeholder={
                "一行一个任务；可用 | 同时填写条件，例如：\n" +
                "002849盈利5%后卖出\n" +
                "002849盈利10%后卖出\n" +
                "002849亏损5%检查\n" +
                "002849回本后减仓\n" +
                "002849盈利5%后卖出 | 收益率达到5%后卖出\n" +
                "检查002849持仓 | 持续观察"
              }
              rows={5}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none"
            />

            <button
              type="button"
              onClick={
                handlePreviewBatchTasks
              }
              disabled={
                !batchText.trim()
              }
              className="mt-2 rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              预览并确认
            </button>
          </div>
        </section>

        {/* =================================================
            批量审核
        ================================================= */}

        {showBatchReview && (
          <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5">
            <h2 className="text-base font-semibold text-gray-900">
              批量任务确认
            </h2>

            <div className="mt-1 text-xs text-gray-500">
              支持「任务 | 条件」格式；系统会自动识别盈利、亏损、回本等监控条件，并自动匹配 Holding；你也可以修改条件或 Holding。
            </div>

            <div className="mt-4 space-y-3">
              {batchDrafts.map(
                (draft) => (
                  <div
                    key={
                      draft.id
                    }
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="font-medium text-sm text-gray-900">
                      {
                        draft.title
                      }
                    </div>

                    <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={
                          draft.assetRelated
                        }
                        onChange={() =>
                          setBatchDrafts(
                            (
                              items
                            ) =>
                              items.map(
                                (
                                  x
                                ) =>
                                  x.id ===
                                  draft.id
                                    ? {
                                        ...x,
                                        assetRelated:
                                          !x.assetRelated,
                                      }
                                    : x
                              )
                          )
                        }
                      />

                      资产相关任务
                    </label>

                    <input
                      value={
                        draft.condition ??
                        ""
                      }
                      onChange={(
                        e
                      ) =>
                        setBatchDrafts(
                          (
                            items
                          ) =>
                            items.map(
                              (
                                x
                              ) =>
                                x.id ===
                                draft.id
                                  ? {
                                      ...x,
                                      condition:
                                        e
                                          .target
                                          .value ||
                                        null,
                                    }
                                  : x
                            )
                        )
                      }
                      placeholder="条件，例如：回本后卖出"
                      className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-xs"
                    />

                    {draft.assetRelated && (
                      <select
                        value={
                          draft.holdingId ===
                          null
                            ? ""
                            : String(
                                draft.holdingId
                              )
                        }
                        onChange={(
                          e
                        ) =>
                          setBatchDrafts(
                            (
                              items
                            ) =>
                              items.map(
                                (
                                  x
                                ) =>
                                  x.id ===
                                  draft.id
                                    ? {
                                        ...x,
                                        holdingId:
                                          e
                                            .target
                                            .value
                                            ? Number(
                                                e
                                                  .target
                                                  .value
                                              )
                                            : null,
                                      }
                                    : x
                              )
                          )
                        }
                        className="mt-2 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                      >
                        <option value="">
                          请选择 Holding
                        </option>

                        {holdings.map(
                          (
                            h
                          ) => {
                            const id =
                              Number(
                                holdingField(
                                  h,
                                  "id"
                                )
                              );

                            if (
                              !Number.isFinite(
                                id
                              )
                            ) {
                              return null;
                            }

                            return (
                              <option
                                key={
                                  id
                                }
                                value={
                                  id
                                }
                              >
                                {holdingName(
                                  h
                                ) ||
                                  "未命名资产"}

                                {holdingCode(
                                  h
                                )
                                  ? ` · ${holdingCode(
                                      h
                                    )}`
                                  : ""}
                              </option>
                            );
                          }
                        )}
                      </select>
                    )}
                  </div>
                )
              )}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={
                  handleConfirmBatchAdd
                }
                disabled={
                  addingTask
                }
                className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
              >
                {addingTask
                  ? "保存中…"
                  : "确认添加"}
              </button>

              <button
                type="button"
                onClick={() =>
                  setShowBatchReview(
                    false
                  )
                }
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
              >
                取消
              </button>
            </div>
          </section>
        )}

        {/* =================================================
            附件
        ================================================= */}

        <section className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <details>
            <summary className="cursor-pointer px-4 py-4 text-sm font-medium text-gray-800">
              📎 附件
              {files.length
                ? `（${files.length}）`
                : ""}
            </summary>

            <div className="border-t border-gray-100 p-4">
              <label className="inline-flex cursor-pointer rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
                {uploading
                  ? "上传中..."
                  : "添加文件"}

                <input
                  type="file"
                  className="hidden"
                  onChange={
                    handleUploadFile
                  }
                  disabled={
                    uploading
                  }
                />
              </label>

              <div className="mt-3 space-y-2">
                {files.map(
                  (file) => (
                    <div
                      key={
                        file.id
                      }
                      className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          handleOpenFile(
                            file
                          )
                        }
                        className="truncate text-left text-sm text-blue-600 hover:underline"
                      >
                        {
                          file.file_name
                        }
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          handleDeleteFile(
                            file
                          )
                        }
                        className="ml-3 shrink-0 text-xs text-red-500"
                      >
                        删除
                      </button>
                    </div>
                  )
                )}

                {!files.length && (
                  <div className="text-sm text-gray-400">
                    暂无附件
                  </div>
                )}
              </div>
            </div>
          </details>
        </section>
      </div>
    </main>
  );
}