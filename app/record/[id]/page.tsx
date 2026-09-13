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
// 通用资金筹集计算器
// =====================================================

type ManualFundingSource = {
  id: string;
  name: string;
  amount: string;
};

function fundingNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function FundingCalculator() {
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

  const [septemberAmount, setSeptemberAmount] =
    useState("");

  const [octoberAmount, setOctoberAmount] =
    useState("");

  const [manualSources, setManualSources] =
    useState<ManualFundingSource[]>([]);

  const [loadingFixedIncome, setLoadingFixedIncome] =
    useState(true);

  const [loadingCashflow, setLoadingCashflow] =
    useState(true);

  const [sourceError, setSourceError] =
    useState("");

  const currentYear =
    new Date().getFullYear();

  // -----------------------------------------------------
  // 加载 Fixed Income + CASHFLOW
  // -----------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    async function loadSources() {
      setSourceError("");

      try {
        setLoadingFixedIncome(true);

        const data =
          await getFixedIncomeAssets();

        if (!cancelled) {
          setFixedIncomeAssets(
            Array.isArray(data) ? data : []
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
          setLoadingFixedIncome(false);
        }
      }

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
          Array.isArray(state?.years)
            ? state!.years
            : [];

        /*
         * 这里读取的是 CASHFLOW 当前 Supabase 数据：
         *
         * 2026 → 9月 → expense → 转去养老保险
         * 2026 → 10月 → expense → 转去养老保险
         *
         * 这里只读，不保存、不修改。
         */

        function findPensionAmount(
          monthNumber: number
        ) {
          const yearData =
            years.find(
              (year) =>
                Number(year.year) ===
                currentYear
            );

          if (!yearData) return 0;

          const monthData =
            yearData.months?.find(
              (month) =>
                Number(month.month) ===
                monthNumber
            );

          if (!monthData) return 0;

          return (
            monthData.expense ?? []
          )
            .filter(
              (item) =>
                !item.deleted &&
                String(
                  item.name ?? ""
                ).trim() ===
                  "转去养老保险"
            )
            .reduce(
              (sum, item) =>
                sum +
                fundingNumber(
                  item.value
                ),
              0
            );
        }

        if (!cancelled) {
          setSeptemberAmount(
            String(findPensionAmount(9))
          );

          setOctoberAmount(
            String(findPensionAmount(10))
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
          setLoadingCashflow(false);
        }
      }
    }

    loadSources();

    return () => {
      cancelled = true;
    };
  }, [currentYear]);

  // -----------------------------------------------------
  // Fixed Income 选择
  // -----------------------------------------------------

  function toggleFixedIncome(
    asset: FixedIncomeAsset
  ) {
    const id = asset.id;

    setSelectedFixedIncomeIds(
      (previous) => {
        if (previous.includes(id)) {
          return previous.filter(
            (item) => item !== id
          );
        }

        return [...previous, id];
      }
    );

    setFixedIncomeUseAmounts(
      (previous) => {
        if (
          previous[id] !== undefined
        ) {
          return previous;
        }

        return {
          ...previous,
          [id]: String(
            fundingNumber(asset.amount)
          ),
        };
      }
    );
  }

  function updateFixedIncomeUseAmount(
    id: string,
    value: string
  ) {
    setFixedIncomeUseAmounts(
      (previous) => ({
        ...previous,
        [id]: value,
      })
    );
  }

  // -----------------------------------------------------
  // 选中的 Fixed Income
  // -----------------------------------------------------

  const selectedFixedIncomeAssets =
    useMemo(() => {
      return fixedIncomeAssets.filter(
        (asset) =>
          selectedFixedIncomeIds.includes(
            asset.id
          )
      );
    }, [
      fixedIncomeAssets,
      selectedFixedIncomeIds,
    ]);

  const selectedFixedIncomeTotal =
    useMemo(() => {
      return selectedFixedIncomeAssets.reduce(
        (sum, asset) => {
          const requested =
            fundingNumber(
              fixedIncomeUseAmounts[
                asset.id
              ]
            );

          const available =
            fundingNumber(asset.amount);

          /*
           * 本次使用金额不能超过当前固收金额。
           * 即使用户输入更大，计算也最多按当前资产金额计算。
           */
          const safeAmount = Math.min(
            Math.max(requested, 0),
            Math.max(available, 0)
          );

          return sum + safeAmount;
        },
        0
      );
    }, [
      selectedFixedIncomeAssets,
      fixedIncomeUseAmounts,
    ]);

  // -----------------------------------------------------
  // CASHFLOW
  // -----------------------------------------------------

  const september =
    Math.max(
      fundingNumber(septemberAmount),
      0
    );

  const october =
    Math.max(
      fundingNumber(octoberAmount),
      0
    );

  const cashflowTotal =
    september + october;

  // -----------------------------------------------------
  // 手工资金
  // -----------------------------------------------------

  const manualTotal =
    manualSources.reduce(
      (sum, source) =>
        sum +
        Math.max(
          fundingNumber(source.amount),
          0
        ),
      0
    );

  function addManualSource() {
    setManualSources(
      (previous) => [
        ...previous,
        {
          id: `manual-${Date.now()}-${Math.random()
            .toString(36)
            .slice(2, 7)}`,
          name: "",
          amount: "",
        },
      ]
    );
  }

  function updateManualSource(
    id: string,
    field: "name" | "amount",
    value: string
  ) {
    setManualSources(
      (previous) =>
        previous.map((source) =>
          source.id === id
            ? {
                ...source,
                [field]: value,
              }
            : source
        )
    );
  }

  function deleteManualSource(
    id: string
  ) {
    setManualSources(
      (previous) =>
        previous.filter(
          (source) => source.id !== id
        )
    );
  }

  // -----------------------------------------------------
  // 最终计算
  // -----------------------------------------------------

  const target =
    Math.max(
      fundingNumber(targetAmount),
      0
    );

  const totalAvailable =
    selectedFixedIncomeTotal +
    cashflowTotal +
    manualTotal;

  const difference =
    totalAvailable - target;

  const isEnough =
    difference >= 0;

  return (
    <section className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      {/* =================================================
          标题
      ================================================= */}

      <div className="mb-5">
        <h2 className="text-lg font-semibold text-gray-900">
          资金筹集计算
        </h2>

        <p className="mt-1 text-xs text-gray-500">
          可用于年金、买基金、保险缴费、还款及其他大额资金安排。
          这里只做本次计算，不修改 Fixed Income 或 CASHFLOW 原始数据。
        </p>
      </div>

      {/* =================================================
          目标
      ================================================= */}

      <div className="mb-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className="mb-3 text-sm font-semibold text-gray-800">
          ① 资金目标
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-gray-500">
              目标名称
            </label>

            <input
              value={targetName}
              onChange={(event) =>
                setTargetName(
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
                setTargetAmount(
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
          这里直接读取「固收资产」页面的数据，不读取 Holding。
          勾选后填写本次实际准备使用的金额。
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
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {fixedIncomeAssets.map(
              (asset) => {
                const selected =
                  selectedFixedIncomeIds.includes(
                    asset.id
                  );

                const available =
                  fundingNumber(
                    asset.amount
                  );

                const useAmount =
                  fundingNumber(
                    fixedIncomeUseAmounts[
                      asset.id
                    ]
                  );

                return (
                  <div
                    key={asset.id}
                    className={[
                      "rounded-lg border p-3 transition",
                      selected
                        ? "border-gray-400 bg-gray-50"
                        : "border-gray-200 bg-white",
                    ].join(" ")}
                  >
                    <label className="flex cursor-pointer items-start gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() =>
                          toggleFixedIncome(
                            asset
                          )
                        }
                        className="mt-1 h-4 w-4 shrink-0 cursor-pointer"
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="truncate text-sm font-medium text-gray-900">
                            {asset.name}
                          </div>

                          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-500">
                            {asset.type}
                          </span>
                        </div>

                        {asset.institution && (
                          <div className="mt-1 text-xs text-gray-400">
                            {asset.institution}
                          </div>
                        )}

                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-gray-500">
                            当前资产
                          </span>

                          <span className="text-sm font-semibold text-gray-900">
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
                      </div>
                    </label>

                    {selected && (
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <label className="mb-1 block text-xs text-gray-500">
                          本次使用金额
                        </label>

                        <input
                          value={
                            fixedIncomeUseAmounts[
                              asset.id
                            ] ?? ""
                          }
                          onChange={(event) =>
                            updateFixedIncomeUseAmount(
                              asset.id,
                              event.target.value
                            )
                          }
                          type="number"
                          min="0"
                          max={available}
                          step="0.01"
                          className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                        />

                        {useAmount >
                          available && (
                          <div className="mt-1 text-xs text-red-500">
                            不能超过当前资产
                            ¥
                            {available.toLocaleString(
                              "zh-CN"
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              }
            )}
          </div>
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
          自动读取 {currentYear} 年 CASHFLOW 中「转去养老保险」的
          9月、10月金额。这里可以临时修改，但不会修改 CASHFLOW。
        </div>

        {loadingCashflow ? (
          <div className="rounded-lg bg-gray-50 px-3 py-5 text-center text-sm text-gray-400">
            正在读取 CASHFLOW……
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <label className="mb-1 block text-xs text-gray-500">
                {currentYear}年9月转去养老保险
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  ¥
                </span>

                <input
                  value={septemberAmount}
                  onChange={(event) =>
                    setSeptemberAmount(
                      event.target.value
                    )
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-7 pr-3 text-sm outline-none focus:border-gray-500"
                />
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <label className="mb-1 block text-xs text-gray-500">
                {currentYear}年10月转去养老保险
              </label>

              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  ¥
                </span>

                <input
                  value={octoberAmount}
                  onChange={(event) =>
                    setOctoberAmount(
                      event.target.value
                    )
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-7 pr-3 text-sm outline-none focus:border-gray-500"
                />
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-3">
          <span className="text-sm text-gray-600">
            CASHFLOW 资金合计
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
        <div className="mb-1 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-gray-800">
              ④ 其他资金
            </div>

            <div className="mt-1 text-xs text-gray-500">
              用于以后其他场景，例如香港现金、银行卡现金、奖金等。
            </div>
          </div>

          <button
            type="button"
            onClick={addManualSource}
            className="shrink-0 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
          >
            ＋ 添加资金
          </button>
        </div>

        {manualSources.length === 0 ? (
          <div className="mt-4 rounded-lg bg-gray-50 px-3 py-4 text-center text-xs text-gray-400">
            暂无其他资金来源
          </div>
        ) : (
          <div className="mt-4 space-y-2">
            {manualSources.map(
              (source) => (
                <div
                  key={source.id}
                  className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3 md:flex-row"
                >
                  <input
                    value={source.name}
                    onChange={(event) =>
                      updateManualSource(
                        source.id,
                        "name",
                        event.target.value
                      )
                    }
                    placeholder="资金名称，例如：香港现金"
                    className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
                  />

                  <input
                    value={source.amount}
                    onChange={(event) =>
                      updateManualSource(
                        source.id,
                        "amount",
                        event.target.value
                      )
                    }
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="金额"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 md:w-48"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      deleteManualSource(
                        source.id
                      )
                    }
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                  >
                    删除
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {manualSources.length > 0 && (
          <div className="mt-4 flex items-center justify-between rounded-lg bg-gray-50 px-3 py-3">
            <span className="text-sm text-gray-600">
              其他资金合计
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
        )}
      </div>

      {/* =================================================
          最终结果
      ================================================= */}

      <div
        className={[
          "rounded-xl border p-5",
          isEnough
            ? "border-green-200 bg-green-50"
            : "border-red-200 bg-red-50",
        ].join(" ")}
      >
        <div className="mb-4 text-base font-semibold text-gray-900">
          ⑤ {targetName || "资金目标"} 计算结果
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-gray-600">
              目标金额
            </span>

            <span className="font-semibold text-gray-900">
              ¥
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
              {currentYear}年9月转去养老保险
            </span>

            <span className="font-semibold text-gray-900">
              ¥
              {september.toLocaleString(
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
              {currentYear}年10月转去养老保险
            </span>

            <span className="font-semibold text-gray-900">
              ¥
              {october.toLocaleString(
                "zh-CN",
                {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                }
              )}
            </span>
          </div>

          {manualSources.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <span className="text-gray-600">
                其他资金
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
          )}

          <div className="my-3 border-t border-gray-200" />

          <div className="flex items-center justify-between gap-3">
            <span className="font-medium text-gray-700">
              总可筹资金
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

          <div className="mt-3 flex items-center justify-between gap-3">
            <span className="font-medium text-gray-700">
              {isEnough
                ? "剩余"
                : "还需要补"}
            </span>

            <span
              className={[
                "text-xl font-bold",
                isEnough
                  ? "text-green-600"
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
        </div>

        <div
          className={[
            "mt-4 rounded-lg px-3 py-3 text-sm font-medium",
            isEnough
              ? "bg-white text-green-700"
              : "bg-white text-red-700",
          ].join(" ")}
        >
          {isEnough
            ? `资金足够，可以覆盖「${
                targetName || "资金目标"
              }」。`
            : `资金还差 ¥${Math.abs(
                difference
              ).toLocaleString("zh-CN", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}，需要另外补足。`}
        </div>
      </div>

      {sourceError && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {sourceError}
        </div>
      )}
    </section>
  );
}

// =====================================================
// Holding Card
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
    cost > 0 ? (diff / cost) * 100 : null;

  const currency =
    holdingCurrency(holding);

  const decision =
    getDecision(task, holding);

  return (
    <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <div className="min-w-0 text-xs text-gray-700">
        <span className="font-medium">
          Holding：
        </span>

        <span>
          {holdingName(holding) ||
            "未命名资产"}
        </span>

        {holdingCode(holding) && (
          <span className="text-gray-500">
            {" · "}
            {holdingCode(holding)}
          </span>
        )}
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span className="whitespace-nowrap">
          <span className="text-gray-400">
            当前值{" "}
          </span>

          <span className="font-medium text-gray-700">
            {formatMoney(
              amount,
              currency
            )}
          </span>
        </span>

        <span className="whitespace-nowrap">
          <span className="text-gray-400">
            COST{" "}
          </span>

          <span className="font-medium text-gray-700">
            {formatMoney(
              cost,
              currency
            )}
          </span>
        </span>

        <span className="whitespace-nowrap">
          <span className="text-gray-400">
            盈亏{" "}
          </span>

          <span
            className={`font-medium ${
              diff >= 0
                ? "text-green-600"
                : "text-red-500"
            }`}
          >
            {diff >= 0 ? "+" : ""}
            {formatMoney(
              diff,
              currency
            )}
          </span>
        </span>

        <span className="whitespace-nowrap">
          <span className="text-gray-400">
            收益率{" "}
          </span>

          <span
            className={`font-medium ${
              (rate ?? 0) >= 0
                ? "text-green-600"
                : "text-red-500"
            }`}
          >
            {rate === null
              ? "—"
              : `${
                  rate >= 0 ? "+" : ""
                }${rate.toFixed(2)}%`}
          </span>
        </span>
      </div>

      {decision?.monitor && (
        <div className="mt-1 text-xs text-gray-400">
          监控：{decision.monitor}
        </div>
      )}

      {decision && (
        <div
          className={`mt-1 text-xs ${
            decision.tone === "green"
              ? "text-green-600"
              : decision.tone === "yellow"
              ? "text-amber-600"
              : "text-gray-500"
          }`}
        >
          {decision.text}
        </div>
      )}
    </div>
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
  onToggle: (task: RecordTask) => void;
  onDelete: (task: RecordTask) => void;
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
      CSS.Transform.toString(transform),
    transition,
  };

  const selected =
    task.holding_id !== null
      ? holdings.find(
          (h) =>
            Number(
              holdingField(h, "id")
            ) ===
            Number(task.holding_id)
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
          checked={task.completed}
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
              条件：{task.condition}
            </div>
          )}

          <div className="mt-2">
            <div className="mb-1 text-xs font-medium text-gray-500">
              Holding
            </div>

            <select
              value={
                task.holding_id === null
                  ? ""
                  : String(
                      task.holding_id
                    )
              }
              onChange={(e) =>
                onSelectHolding(
                  task,
                  e.target.value
                    ? Number(
                        e.target.value
                      )
                    : null
                )
              }
              className="w-full max-w-xl rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-gray-500"
            >
              <option value="">
                请选择 Holding
              </option>

              {holdings.map((h) => {
                const id = Number(
                  holdingField(h, "id")
                );

                if (!Number.isFinite(id)) {
                  return null;
                }

                return (
                  <option
                    key={id}
                    value={id}
                  >
                    {holdingName(h) ||
                      "未命名资产"}
                    {holdingCode(h)
                      ? ` · ${holdingCode(
                          h
                        )}`
                      : ""}
                  </option>
                );
              })}
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
      ? parts[parts.length - 1] ?? ""
      : "";
  }, [pathname]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    })
  );

  const [record, setRecord] =
    useState<RecordItem | null>(null);

  const [tasks, setTasks] =
    useState<RecordTask[]>([]);

  const [files, setFiles] =
    useState<RecordFile[]>([]);

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
    useState<BatchTaskDraft[]>([]);

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

  const [uploading, setUploading] =
    useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color.configure({
        types: ["textStyle"],
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

    const response = await fetch(
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

    setRecord(
      data?.record ?? null
    );

    setTitle(
      data?.record?.title ?? ""
    );
  }

  async function loadTasks() {
    if (!recordId) return;

    const response = await fetch(
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
      Array.isArray(data?.tasks)
        ? data.tasks
        : [];

    if (holdings.length > 0) {
      let changed = false;
      const nextTasks = [
        ...loadedTasks,
      ];

      for (
        let i = 0;
        i < nextTasks.length;
        i++
      ) {
        const task =
          nextTasks[i];

        if (
          task.holding_id !== null
        ) {
          continue;
        }

        const matched =
          findMatchingHolding(
            task.title,
            holdings
          );

        if (!matched) continue;

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
                method: "PUT",
                headers: {
                  "Content-Type":
                    "application/json",
                },
                body: JSON.stringify({
                  taskId: task.id,
                  holding_id:
                    matchedId,
                }),
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

            changed = true;
          }
        } catch {
          // 自动匹配失败不影响页面。
        }
      }

      setTasks(nextTasks);

      return;
    }

    setTasks(
      loadedTasks
    );
  }

  async function loadFiles() {
    if (!recordId) return;

    const response = await fetch(
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
      Array.isArray(data?.files)
        ? data.files
        : []
    );
  }

  async function loadHoldings() {
    try {
      const result =
        await getHoldings();

      setHoldings(
        Array.isArray(result)
          ? result
          : []
      );
    } catch (e) {
      console.error(
        "获取 Holding 失败:",
        e
      );

      setHoldings([]);
    }
  }

  useEffect(() => {
    if (!recordId) return;

    let cancelled = false;

    async function init() {
      try {
        setLoading(true);
        setError("");

        await Promise.all([
          loadRecord(),
          loadFiles(),
          loadHoldings(),
        ]);

        await loadTasks();
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error
              ? e.message
              : "加载记录失败"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      cancelled = true;
    };
  }, [recordId]);

  useEffect(() => {
    if (
      !editor ||
      !record?.content
    ) {
      return;
    }

    editor.commands.setContent(
      record.content
    );
  }, [
    editor,
    record?.id,
  ]);

  async function saveTitle() {
    const value =
      title.trim();

    if (!recordId || !value) {
      alert(
        "记录名称不能为空"
      );
      return;
    }

    try {
      setSavingTitle(true);

      const response =
        await fetch(
          `/api/record/${recordId}`,
          {
            method: "PUT",
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
        data?.record ?? null
      );
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "保存标题失败"
      );
    } finally {
      setSavingTitle(false);
    }
  }

  async function saveContent() {
    if (
      !recordId ||
      !editor
    ) {
      return;
    }

    try {
      setSavingContent(true);

      const response =
        await fetch(
          `/api/record/${recordId}`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              content:
                editor.getJSON(),
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
        data?.record ?? null
      );
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "保存内容失败"
      );
    } finally {
      setSavingContent(false);
    }
  }

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
          method: "POST",
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
    if (!newTask.trim()) return;

    try {
      setAddingTask(true);

      const parsed =
        parseBatchTaskLine(
          newTask
        );

      if (!parsed.title) return;

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
      setAddingTask(false);
    }
  }

  function buildBatchDrafts() {
    const parsedLines =
      batchText
        .split(/\r?\n/)
        .map(parseBatchTaskLine)
        .filter(
          (item) =>
            Boolean(item.title)
        );

    const unique =
      Array.from(
        new Map(
          parsedLines.map(
            (item) => [
              `${item.title}|||${
                item.condition ?? ""
              }`,
              item,
            ]
          )
        ).values()
      );

    return unique.map(
      (item, index) => {
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

          holdingId: auto
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
    if (!batchText.trim()) return;

    const drafts =
      buildBatchDrafts();

    if (!drafts.length) return;

    setBatchDrafts(drafts);
    setShowBatchReview(true);
  }

  async function handleConfirmBatchAdd() {
    if (
      !recordId ||
      !batchDrafts.length
    ) {
      return;
    }

    try {
      setAddingTask(true);

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
      setShowBatchReview(false);

      await loadTasks();
      await loadRecord();
    } catch (e) {
      alert(
        e instanceof Error
          ? e.message
          : "批量新增任务失败"
      );
    } finally {
      setAddingTask(false);
    }
  }

  async function handleToggleTask(
    task: RecordTask
  ) {
    try {
      const response =
        await fetch(
          `/api/record/${recordId}/tasks`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              taskId: task.id,
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
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              taskId: task.id,
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
            method: "DELETE",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              taskId: task.id,
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

    if (!confirmed) return;

    try {
      setDeletingAllTasks(true);
      setError("");

      const currentTasks = [
        ...tasks,
      ];

      for (
        const task of currentTasks
      ) {
        const response =
          await fetch(
            `/api/record/${recordId}/tasks`,
            {
              method: "DELETE",
              headers: {
                "Content-Type":
                  "application/json",
              },
              body: JSON.stringify({
                taskId: task.id,
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
      setDeletingAllTasks(false);
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
      active.id === over.id
    ) {
      return;
    }

    const oldIndex =
      tasks.findIndex(
        (x) =>
          x.id === active.id
      );

    const newIndex =
      tasks.findIndex(
        (x) =>
          x.id === over.id
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
        (task, index) => ({
          ...task,
          sort_order: index,
        })
      );

    setTasks(next);

    try {
      const response =
        await fetch(
          `/api/record/${recordId}/tasks`,
          {
            method: "PUT",
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

      if (!response.ok) {
        await loadTasks();
      }
    } catch {
      await loadTasks();
    }
  }

  async function handleUploadFile(
    event: React.ChangeEvent<HTMLInputElement>
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (
      !file ||
      !recordId
    ) {
      return;
    }

    try {
      setUploading(true);

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
            method: "POST",
            body: formData,
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
      setUploading(false);
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
            cache: "no-store",
          }
        );

      if (!response.ok) {
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
            method: "DELETE",
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

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto max-w-5xl text-sm text-gray-500">
          正在加载记录……
        </div>
      </main>
    );
  }

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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
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
                      .setColor(color)
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

        <FundingCalculator />

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
                / {tasks.length}
              </div>
            </div>

            <button
              type="button"
              onClick={
                handleDeleteAllTasks
              }
              disabled={
                deletingAllTasks ||
                tasks.length === 0
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
              sensors={sensors}
              collisionDetection={
                closestCenter
              }
              onDragEnd={
                handleDragEnd
              }
            >
              <SortableContext
                items={tasks.map(
                  (x) => x.id
                )}
                strategy={
                  verticalListSortingStrategy
                }
              >
                {tasks.map(
                  (task) => (
                    <SortableTaskRow
                      key={task.id}
                      task={task}
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
              value={newTask}
              onChange={(e) =>
                setNewTask(
                  e.target.value
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
              value={batchText}
              onChange={(e) =>
                setBatchText(
                  e.target.value
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500"
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
                    key={draft.id}
                    className="rounded-lg border border-gray-200 p-3"
                  >
                    <div className="font-medium text-sm text-gray-900">
                      {draft.title}
                    </div>

                    <label className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                      <input
                        type="checkbox"
                        checked={
                          draft.assetRelated
                        }
                        onChange={() =>
                          setBatchDrafts(
                            (items) =>
                              items.map(
                                (x) =>
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
                      onChange={(e) =>
                        setBatchDrafts(
                          (items) =>
                            items.map(
                              (x) =>
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
                        onChange={(e) =>
                          setBatchDrafts(
                            (items) =>
                              items.map(
                                (x) =>
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
                      key={file.id}
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
                        {file.file_name}
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