"use client";
import { useEffect, useMemo, useRef, useState } from "react";

import { loadCashflowPlanning } from "@/lib/cashflow-planning";
import { supabase } from "@/lib/supabase";
import {
  getCreditCardOverview,
  getCreditCards,
  type CreditCard,
} from "@/lib/credit-card";
import {
  getCreditCardFromYuSummary,
  type CreditCardFromYuSummary,
} from "@/lib/credit-card-from-yu-summary";
import {
  getExpenseTransactions,
  type ExpenseTransaction,
} from "@/lib/expense-transactions";
import { getLoans } from "@/lib/loan";
import { calculateRemainingPeriods } from "@/lib/loan-calculations";

type Role = "income" | "expense";

type CellItem = {
  id: string;
  year: number;
  month: number;
  role: Role;
  projectId: string;
  name: string;
  value: number;
  independent: boolean;
  deleted?: boolean;
};

type MonthData = {
  year: number;
  month: number;
  income: CellItem[];
  expense: CellItem[];
};

type YearData = {
  year: number;
  months: MonthData[];
};

type ItemDef = {
  name: string;
  label: string;
  evenMonthLabel?: string;
  evenMonthNote?: string;
  defaultValue?: number;
};

type OverrideState = {
  [key: string]: number;
};

function isCreditCardRegularName(name: string) {
  return normalizeName(name) === normalizeName("还信用卡常规");
}

function getCreditCardRegularAmount(
  creditCardMonthlyMap: Map<string, number>,
  year: number,
  month: number
) {
  const key = `${year}-${String(month).padStart(2, "0")}`;
  return creditCardMonthlyMap.get(key) || 0;
}

async function getCreditCardMonthlyMap() {
  const loans = await getLoans();
  const map = new Map<string, number>();
  const today = new Date();

  for (const loan of loans || []) {
    if (loan.type !== "信用卡分期") continue;

    const monthly = Number(loan.monthly_payment || 0);
    if (monthly <= 0) continue;

    let periods = 0;
    let startDate: Date | null = null;

    if (loan.start_date) {
      startDate = new Date(loan.start_date);
    }

    if (loan.end_date) {
      const end = new Date(loan.end_date);
      const start = startDate || today;

      periods =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth()) +
        1;
    } else {
      periods = calculateRemainingPeriods(loan);
      startDate = today;
    }

    if (!startDate || periods <= 0) continue;

    for (let i = 0; i < periods; i++) {
      const d = new Date(startDate);
      d.setMonth(d.getMonth() + i);

      const key = `${d.getFullYear()}-${String(
        d.getMonth() + 1
      ).padStart(2, "0")}`;

      map.set(key, (map.get(key) || 0) + monthly);
    }
  }

  return map;
}

async function getCreditCardActualBillTotal(
  year: number,
  month: number
): Promise<{ total: number; earlyTotal: number }> {
  const billMonth = `${year}-${String(month).padStart(2, "0")}-01`;
  const now = new Date();
  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  const [cardsRaw, billsRes] = await Promise.all([
    getCreditCardOverview(),
    supabase
      .from("credit_card_monthly_bills")
      .select("credit_card_id, actual_bill_amount")
      .eq("bill_month", billMonth),
  ]);

  if (billsRes.error) throw billsRes.error;

  const billMap = new Map<string, number>();
  for (const row of billsRes.data || []) {
    const id = String(row.credit_card_id || "");
    if (!id) continue;
    billMap.set(id, Number(row.actual_bill_amount) || 0);
  }

  let total = 0;
  let earlyTotal = 0;

  for (const card of (cardsRaw || []) as any[]) {
    const id = String(card.id || "");
    if (!id) continue;

    let amount = 0;

    if (billMap.has(id)) {
      amount = billMap.get(id) || 0;
    } else if (isCurrentMonth) {
      amount = Number(card.actual_bill_amount) || 0;
    }

    total += amount;

    const payDay = Number(card.payment_day);
    if (payDay >= 1 && payDay <= 9) {
      earlyTotal += amount;
    }
  }

  return { total, earlyTotal };
}

type FHTempleRow = { id: string; name: string };

type FHCostRow = {
  id: string;
  temple_id: string;
  event_name: string;
  expense_year: number;
  expense_date: string;
  expense_end_date: string | null;
  amount: number;
};

type FHEventRow = {
  id: string;
  temple_id: string;
  name: string;
  event_year: number;
  start_date: string | null;
  end_date: string | null;
};

type FHRedPacketRow = {
  id: string;
  event_id: string;
  packet_amount: number;
};

type NextMonthFHData = {
  costTemples: FHTempleRow[];
  costRows: FHCostRow[];
  hongbaoTemples: FHTempleRow[];
  hongbaoEvents: FHEventRow[];
  hongbaoPackets: FHRedPacketRow[];
};

const INCOME_ITEMS: ItemDef[] = [
  { name: "SAL", label: "SAL" },
  { name: "年金固收", label: "年金固收(本有)" },
  { name: "LP", label: "LP" },
];

const EXPENSE_GROUPS: Array<{
  groupName: string;
  items: ItemDef[];
  useNextMonth?: boolean;
}> = [
  {
    groupName: "储蓄类",
    items: [
      { name: "年金", label: "年金(存入招商银行)" },
      {
        name: "下月定投",
        label: "下月定投(中行+招行基金)",
        evenMonthLabel: "下月定投",
        evenMonthNote:
          "4.本月双月换币去HK，带上招行基金[中行]1200定存",
      },
      { name: "转去养老保险", label: "转去养老保险" },
    ],
  },
  {
    groupName: "开销类",
    items: [
      {
        name: "还信用卡+给妈",
        label: "还信用卡+给妈(中信银行)",
      },
      {
        name: "给妈",
        label: "给妈",
        defaultValue: 2000,
      },
      {
        name: "还信用卡常规",
        label: "还信用卡常规(中信银行)",
      },
    ],
  },
  {
    groupName: "xx类",
    items: [
      { name: "xx红包", label: "xx红包" },
      { name: "xx法会", label: "xx法会" },
    ],
    useNextMonth: true,
  },
];

const SALARY_TABLE = "cashflow_actual";
const SALARY_ROW_ID = "salary";

function normalizeName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function formatMoney(value: number) {
  if (!Number.isFinite(value)) return "—";

  return value.toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function getCurrentMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function getFollowingMonth(year: number, month: number) {
  if (month >= 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

function getOverrideKey(
  year: number,
  month: number,
  role: Role,
  name: string
) {
  return `${year}-${month}-${role}-${normalizeName(name)}`;
}

function buildRows(
  items: CellItem[] | undefined,
  defs: ItemDef[],
  role: Role,
  year: number,
  month: number,
  overrides: OverrideState,
  creditCardMonthlyMap: Map<string, number>
) {
  return defs.map((def) => {
    const matched = (items ?? []).filter(
      (x) =>
        !x.deleted &&
        normalizeName(x.name) === normalizeName(def.name)
    );

    const planned = isCreditCardRegularName(def.name)
      ? getCreditCardRegularAmount(
          creditCardMonthlyMap,
          year,
          month
        )
      : matched.length > 0
      ? matched.reduce(
          (sum, x) => sum + (Number(x.value) || 0),
          0
        )
      : Number(def.defaultValue || 0);

    const key = getOverrideKey(year, month, role, def.name);
    const edited = typeof overrides[key] === "number";

    return {
      name: def.name,
      label:
        def.evenMonthLabel && month % 2 === 0
          ? def.evenMonthLabel
          : def.label,
      note:
        month % 2 === 0 ? def.evenMonthNote : undefined,
      key,
      planned,
      edited,
      value: edited ? overrides[key] : planned,
    };
  });
}

// =====================================================
// 公式工具
// =====================================================

type Val = number | number[];
type FormulaCtx = {
  vars: Record<string, number>;
  lineResults: Array<number | null>;
  maxLine: number;
};
type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string };

function tokenizeFormula(text: string): Token[] {
  const tokens: Token[] = [];
  let pos = 0;

  while (pos < text.length) {
    const ch = text[pos];

    if (/\s/.test(ch)) {
      pos++;
      continue;
    }

    const rest = text.slice(pos);

    const numMatch = rest.match(/^(\d+\.?\d*|\.\d+)/);

    if (numMatch) {
      tokens.push({ t: "num", v: Number(numMatch[1]) });
      pos += numMatch[1].length;
      continue;
    }

    const idMatch = rest.match(
      /^[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]*/
    );

    if (idMatch) {
      tokens.push({ t: "id", v: idMatch[0] });
      pos += idMatch[0].length;
      continue;
    }

    if ("+-*/^%(),:".includes(ch)) {
      tokens.push({ t: "op", v: ch });
      pos++;
      continue;
    }

    throw new Error(`无法识别 “${ch}”`);
  }

  return tokens;
}

function callFormulaFunc(name: string, a: number[]): number {
  const need = (n: number) => {
    if (a.length < n) throw new Error(`${name.toUpperCase()} 缺少参数`);
  };

  switch (name) {
    case "sum":
      return a.reduce((s, x) => s + x, 0);
    case "average":
    case "avg":
      need(1);
      return a.reduce((s, x) => s + x, 0) / a.length;
    case "min":
      need(1);
      return Math.min(...a);
    case "max":
      need(1);
      return Math.max(...a);
    case "count":
      return a.length;
    case "abs":
      need(1);
      return Math.abs(a[0]);
    case "sqrt":
      need(1);
      if (a[0] < 0) throw new Error("SQRT 不能是负数");
      return Math.sqrt(a[0]);
    case "power":
      need(2);
      return Math.pow(a[0], a[1]);
    case "mod":
      need(2);
      if (a[1] === 0) throw new Error("除数为 0");
      return a[0] - a[1] * Math.floor(a[0] / a[1]);
    case "int":
      need(1);
      return Math.floor(a[0]);
    case "pi":
      return Math.PI;
    case "round":
    case "roundup":
    case "rounddown": {
      need(1);
      const digits = a[1] ?? 0;
      const f = Math.pow(10, digits);
      const x = Number((Math.abs(a[0]) * f).toPrecision(12));
      const r =
        name === "round"
          ? Math.round(x)
          : name === "roundup"
          ? Math.ceil(x)
          : Math.floor(x);
      return (Math.sign(a[0]) * r) / f;
    }
    default:
      throw new Error(`不认识函数 ${name.toUpperCase()}`);
  }
}

function evaluateFormula(input: string, ctx: FormulaCtx): number {
  let text = input.trim();

  if (text.startsWith("=") || text.startsWith("＝")) {
    text = text.slice(1);
  }

  text = text
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .replace(/，/g, ",")
    .replace(/：/g, ":")
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/[−－]/g, "-")
    .replace(/＋/g, "+");

  const tokens = tokenizeFormula(text);
  if (tokens.length === 0) throw new Error("请输入公式");

  let i = 0;

  const isOp = (v: string) => {
    const t = tokens[i];
    return !!t && t.t === "op" && t.v === v;
  };

  const toNum = (v: Val): number => {
    if (Array.isArray(v)) {
      if (v.length === 1) return v[0];
      throw new Error("这里需要单个数值，范围只能放在函数里");
    }
    return v;
  };

  const flatten = (vals: Val[]): number[] =>
    vals.flatMap((v) => (Array.isArray(v) ? v : [v]));

  const lineValue = (n: number): number | null => {
    const idx = n - 1;
    if (idx < 0 || idx >= ctx.maxLine) {
      throw new Error(`L${n} 只能引用上面的行`);
    }
    return ctx.lineResults[idx] ?? null;
  };

  const parsePrimary = (): Val => {
    const t = tokens[i];
    if (!t) throw new Error("公式不完整");

    if (t.t === "num") {
      i++;
      return t.v;
    }

    if (t.t === "op" && t.v === "(") {
      i++;
      const v = parseExpr();
      if (!isOp(")")) throw new Error("缺少右括号");
      i++;
      return v;
    }

    if (t.t === "id") {
      i++;
      const name = t.v.toLowerCase();

      if (isOp("(")) {
        i++;
        const args: Val[] = [];

        if (isOp(")")) {
          i++;
        } else {
          while (true) {
            args.push(parseExpr());
            if (isOp(",")) {
              i++;
              continue;
            }
            if (isOp(")")) {
              i++;
              break;
            }
            throw new Error("函数括号不匹配");
          }
        }

        return callFormulaFunc(name, flatten(args));
      }

      const lineMatch = name.match(/^l(\d+)$/);

      if (isOp(":")) {
        i++;
        const t2 = tokens[i];
        const m2 =
          t2 && t2.t === "id"
            ? t2.v.toLowerCase().match(/^l(\d+)$/)
            : null;

        if (!lineMatch || !m2) throw new Error("范围请写成 L1:L3");
        i++;

        let a = Number(lineMatch[1]);
        let b = Number(m2[1]);
        if (a > b) [a, b] = [b, a];

        const list: number[] = [];
        for (let n = a; n <= b; n++) {
          const v = lineValue(n);
          if (v !== null) list.push(v);
        }
        return list;
      }

      if (lineMatch) {
        const v = lineValue(Number(lineMatch[1]));
        if (v === null) throw new Error(`L${lineMatch[1]} 没有结果`);
        return v;
      }

      if (name in ctx.vars) return ctx.vars[name];
      throw new Error(`不认识 “${t.v}”`);
    }

    throw new Error(`多余的 “${t.v}”`);
  };

  const parsePostfix = (): Val => {
    let v = parsePrimary();
    while (isOp("%")) {
      i++;
      v = toNum(v) / 100;
    }
    return v;
  };

  const parsePower = (): Val => {
    const base = parsePostfix();
    if (isOp("^")) {
      i++;
      const exp = parseUnary();
      return Math.pow(toNum(base), toNum(exp));
    }
    return base;
  };

  const parseUnary = (): Val => {
    if (isOp("-")) {
      i++;
      return -toNum(parseUnary());
    }
    if (isOp("+")) {
      i++;
      return parseUnary();
    }
    return parsePower();
  };

  const parseTerm = (): Val => {
    let left = parseUnary();
    while (isOp("*") || isOp("/")) {
      const mul = isOp("*");
      i++;
      const right = toNum(parseUnary());
      if (!mul && right === 0) throw new Error("除数为 0");
      left = mul ? toNum(left) * right : toNum(left) / right;
    }
    return left;
  };

  const parseExpr = (): Val => {
    let left = parseTerm();
    while (isOp("+") || isOp("-")) {
      const plus = isOp("+");
      i++;
      const right = toNum(parseTerm());
      left = plus ? toNum(left) + right : toNum(left) - right;
    }
    return left;
  };

  const value = toNum(parseExpr());

  if (i < tokens.length) {
    const t = tokens[i];
    if (t.t === "op" && t.v === ",") {
      throw new Error("数字里不要写逗号（千分位）");
    }
    throw new Error(`多余的内容 “${t.v}”`);
  }

  if (!Number.isFinite(value)) throw new Error("结果不是有效数字");
  return value;
}

function formatResult(value: number) {
  return Number(value.toPrecision(12)).toLocaleString("zh-CN", {
    maximumFractionDigits: 6,
  });
}

const CALC_KEYS: Array<{
  label: string;
  key: string;
  kind?: "fn" | "op" | "eq";
}> = [
  { label: "C", key: "C", kind: "fn" },
  { label: "±", key: "±", kind: "fn" },
  { label: "%", key: "%", kind: "fn" },
  { label: "÷", key: "/", kind: "op" },
  { label: "7", key: "7" },
  { label: "8", key: "8" },
  { label: "9", key: "9" },
  { label: "×", key: "*", kind: "op" },
  { label: "4", key: "4" },
  { label: "5", key: "5" },
  { label: "6", key: "6" },
  { label: "−", key: "-", kind: "op" },
  { label: "1", key: "1" },
  { label: "2", key: "2" },
  { label: "3", key: "3" },
  { label: "+", key: "+", kind: "op" },
  { label: "0", key: "0" },
  { label: ".", key: "." },
  { label: "⌫", key: "⌫", kind: "fn" },
  { label: "=", key: "=", kind: "eq" },
];

function MiniCalculator() {
  const [expr, setExpr] = useState("");
  const [justEvaluated, setJustEvaluated] = useState(false);
  const [failed, setFailed] = useState(false);

  const emptyCtx: FormulaCtx = { vars: {}, lineResults: [], maxLine: 0 };

  let preview: string | null = null;

  if (expr.trim() && !justEvaluated) {
    try {
      preview = formatResult(evaluateFormula(expr, emptyCtx));
    } catch {
      preview = null;
    }
  }

  const showPreview =
    preview !== null && preview.replace(/,/g, "") !== expr.trim();

  function equals() {
    if (!expr.trim()) return;
    try {
      const v = evaluateFormula(expr, emptyCtx);
      setExpr(String(Number(v.toPrecision(12))));
      setJustEvaluated(true);
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }

  function press(key: string) {
    setFailed(false);

    if (key === "C") {
      setExpr("");
      setJustEvaluated(false);
      return;
    }

    if (key === "⌫") {
      setExpr((p) => p.slice(0, -1));
      setJustEvaluated(false);
      return;
    }

    if (key === "=") {
      equals();
      return;
    }

    if (key === "±") {
      setExpr((p) => {
        if (!p) return p;
        return p.startsWith("-(") && p.endsWith(")")
          ? p.slice(2, -1)
          : `-(${p})`;
      });
      return;
    }

    const isDigit = /^[0-9.]$/.test(key);
    setExpr((p) => (justEvaluated && isDigit ? key : p + key));
    setJustEvaluated(false);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-l-4 border-gray-200 border-l-sky-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
        简易计算器
      </div>

      <div className="p-2.5">
        <div className="mb-2 rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2">
          <input
            value={expr}
            onChange={(e) => {
              setExpr(e.target.value);
              setJustEvaluated(false);
              setFailed(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") equals();
            }}
            placeholder="0"
            inputMode="decimal"
            className="w-full bg-transparent text-right text-xl font-semibold tabular-nums text-gray-900 outline-none placeholder:text-gray-300"
          />

          <div className="h-4 text-right text-xs tabular-nums text-gray-400">
            {failed ? (
              <span className="text-red-600">算式有误</span>
            ) : showPreview ? (
              `= ${preview}`
            ) : (
              ""
            )}
          </div>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          {CALC_KEYS.map((k) => {
            const style =
              k.kind === "eq"
                ? "border-sky-500 bg-sky-500 text-white hover:bg-sky-600"
                : k.kind === "op"
                ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : k.kind === "fn"
                ? "border-gray-200 bg-gray-100 text-gray-600 hover:bg-gray-200"
                : "border-gray-200 bg-white text-gray-800 hover:bg-gray-50";

            return (
              <button
                key={k.label}
                type="button"
                onClick={() => press(k.key)}
                className={`rounded-lg border py-1.5 text-sm font-medium shadow-sm transition active:scale-95 ${style}`}
              >
                {k.label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function FormulaTool({ vars }: { vars: Record<string, number> }) {
  const [lines, setLines] = useState<string[]>([""]);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const results: Array<{
    value: number | null;
    error: string | null;
  }> = [];
  const nums: Array<number | null> = [];

  lines.forEach((line, idx) => {
    if (!line.trim()) {
      results.push({ value: null, error: null });
      nums.push(null);
      return;
    }

    try {
      const v = evaluateFormula(line, {
        vars,
        lineResults: nums,
        maxLine: idx,
      });
      results.push({ value: v, error: null });
      nums.push(v);
    } catch (err) {
      results.push({
        value: null,
        error: err instanceof Error ? err.message : "公式有误",
      });
      nums.push(null);
    }
  });

  function updateLine(idx: number, text: string) {
    setLines((prev) =>
      prev.map((l, i) => (i === idx ? text : l))
    );
  }

  function addLine() {
    setLines((prev) => [...prev, ""]);
    window.setTimeout(() => {
      inputRefs.current[lines.length]?.focus();
    }, 0);
  }

  function removeLine(idx: number) {
    setLines((prev) =>
      prev.length <= 1 ? [""] : prev.filter((_, i) => i !== idx)
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-l-4 border-gray-200 border-l-violet-400 bg-gray-50 px-4 py-2">
        <div className="text-sm font-semibold text-gray-800">
          公式工具
        </div>

        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={addLine}
            className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-gray-600 transition hover:bg-gray-50"
          >
            + 添加一行
          </button>

          <button
            type="button"
            onClick={() => setLines([""])}
            className="rounded-md border border-gray-200 bg-white px-2 py-0.5 text-gray-600 transition hover:bg-gray-50"
          >
            清空
          </button>
        </div>
      </div>

      <div className="p-2.5">
        <div className="flex flex-col gap-1.5">
          {lines.map((line, idx) => {
            const r = results[idx];

            return (
              <div key={idx}>
                <div className="flex items-center gap-1.5">
                  <span className="w-6 shrink-0 text-right text-[11px] text-gray-400">
                    L{idx + 1}
                  </span>

                  <input
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    value={line}
                    onChange={(e) => updateLine(idx, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (idx === lines.length - 1) addLine();
                        else inputRefs.current[idx + 1]?.focus();
                      }
                    }}
                    placeholder={idx === 0 ? "=SUM(1200,800)*2" : "=L1+收入"}
                    spellCheck={false}
                    className="min-w-0 flex-1 rounded-md border border-gray-200 bg-gray-50/60 px-2 py-1 font-mono text-[13px] outline-none transition focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
                  />

                  <span
                    className={`w-24 shrink-0 text-right text-[13px] font-semibold tabular-nums ${
                      r.error ? "text-red-600" : "text-violet-600"
                    }`}
                  >
                    {r.error
                      ? "错误"
                      : r.value === null
                      ? ""
                      : formatResult(r.value)}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeLine(idx)}
                    className="shrink-0 px-1 text-sm text-gray-300 transition hover:text-gray-500"
                    aria-label="删除这一行"
                  >
                    ×
                  </button>
                </div>

                {r.error && (
                  <div className="pl-[30px] text-[11px] text-red-600">
                    {r.error}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[11px] leading-relaxed text-gray-500">
          可用名称：收入、支出、结余（取自本页）；L1、L2
          引用上面行的结果，L1:L3 表示范围。函数：SUM
          AVERAGE MIN MAX COUNT ROUND ROUNDUP ROUNDDOWN ABS
          SQRT POWER MOD INT PI。
        </div>
      </div>
    </section>
  );
}

function fmtGeneral(value: number) {
  if (!Number.isFinite(value)) return "";
  return String(Math.round(value));
}

function CellInput({
  value,
  onChange,
  title,
}: {
  value: number;
  onChange: (n: number) => void;
  title?: string;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      value={draft ?? fmtGeneral(value)}
      title={title}
      inputMode="decimal"
      onFocus={(e) => {
        setDraft(fmtGeneral(value));
        e.currentTarget.select();
      }}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const cleaned = text.replace(/,/g, "").trim();

        if (cleaned === "") {
          onChange(0);
          return;
        }

        const n = Number(cleaned);
        if (Number.isFinite(n)) onChange(n);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="block w-full bg-transparent px-1.5 py-[3px] text-right text-[13px] tabular-nums text-gray-800 outline-none"
    />
  );
}

// =====================================================
// 信用卡账单周期 + 自己消费 + expense 分类
// =====================================================

function normalizeCardName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")")
    .toLowerCase();
}

function normalizeCardBankName(value: unknown): string {
  let name = normalizeCardName(value);
  if (!name) return "";

  name = name.replace(/信用卡/g, "").replace(/银行/g, "");

  if (name === "工行") return "工商";
  if (name === "建行") return "建设";
  if (name === "中行") return "中国";
  if (name === "交行") return "交通";
  if (name === "招行") return "招商";
  if (name === "中信") return "中信";
  if (name === "宁波") return "宁波";

  return name;
}

function getCardAccountName(card: CreditCard): string {
  const value =
    (card as any).card_name ??
    (card as any).account_name ??
    (card as any).name ??
    "";
  return String(value).trim();
}

function getCardBankName(card: CreditCard): string {
  return String((card as any).bank_name ?? "").trim();
}

function getCardBillingDay(card: CreditCard): number {
  return Math.floor(
    Number(
      (card as any).billing_day ??
        (card as any).bill_day ??
        0
    )
  );
}

function getActualBillingDate(
  year: number,
  monthIndex: number,
  billingDay: number
): Date | null {
  if (!Number.isFinite(billingDay) || billingDay < 1) return null;

  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  const actualDay = Math.min(billingDay, lastDay);

  return new Date(year, monthIndex, actualDay);
}

function getCardBillingCycle(
  month: string,
  billingDay: number
): { start: Date; end: Date } | null {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return null;

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);

  if (!year || monthNumber < 1 || monthNumber > 12) return null;

  const currentBillingDate = getActualBillingDate(
    year,
    monthNumber - 1,
    billingDay
  );

  if (!currentBillingDate) return null;

  const previousBillingDate = getActualBillingDate(
    monthNumber === 1 ? year - 1 : year,
    monthNumber === 1 ? 11 : monthNumber - 2,
    billingDay
  );

  if (!previousBillingDate) return null;

  const start = new Date(previousBillingDate);
  start.setDate(start.getDate() + 1);

  const end = new Date(currentBillingDate);

  return { start, end };
}

function startOfLocalDay(date: Date): Date {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function isDateInBillingCycle(
  transactionDate: Date,
  cycleStart: Date,
  cycleEnd: Date
): boolean {
  const date = startOfLocalDay(transactionDate);
  const start = startOfLocalDay(cycleStart);
  const end = startOfLocalDay(cycleEnd);

  return (
    date.getTime() >= start.getTime() &&
    date.getTime() <= end.getTime()
  );
}

function getLocalTransactionDate(
  item: ExpenseTransaction
): Date | null {
  const raw =
    (item as any).transaction_time ??
    (item as any).transaction_date ??
    (item as any).expense_date ??
    (item as any).date ??
    (item as any).created_at;

  if (!raw) return null;

  const text = String(raw).trim();
  if (!text) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (dateOnly) {
    const d = new Date(
      Number(dateOnly[1]),
      Number(dateOnly[2]) - 1,
      Number(dateOnly[3])
    );
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isSelfCreditCardExpense(
  item: ExpenseTransaction
): boolean {
  if (item.is_settlement) return false;

  const type = item.income_expense_type || "";
  if (type.includes("收入")) return false;

  return item.consumption_type === "self";
}

const SALARY_EXCLUDED_BOOK_NAMES = new Set([
  "平账",
  "法24.6",
  "法国出差",
  "借出款",
  "年金",
  "理财",
  "替别人先付",
]);

function getExpenseBookName(item: ExpenseTransaction): string {
  return (item.book_name || "未设置账本").trim() || "未设置账本";
}

function getExpenseCategory(item: ExpenseTransaction): string {
  return (item.category || "未分类").trim() || "未分类";
}

function isRealConsumption(item: ExpenseTransaction): boolean {
  if (item.is_settlement) return false;

  const incomeExpenseType = (item.income_expense_type || "").trim();
  if (incomeExpenseType && !incomeExpenseType.includes("支出")) {
    return false;
  }

  if (item.consumption_type === "paid_for_others") return false;
  if (item.consumption_type && item.consumption_type !== "self") {
    return false;
  }

  const bookName = getExpenseBookName(item);
  if (SALARY_EXCLUDED_BOOK_NAMES.has(bookName)) return false;

  return true;
}

function isXxExpense(item: ExpenseTransaction): boolean {
  const bookName = getExpenseBookName(item);
  const category = getExpenseCategory(item);

  if (bookName === "xx") return true;
  if (bookName === "日常账本" && category === "修行") return true;

  return false;
}

// =====================================================
// 非 xx 账本的展示分类
//
// - 带「游」的账本（不含小宝）→ 旅游
// - 日常账本 / 小宝账本 / 小宝2.7万：
//     小宝相关分类 → 小宝
//     其他分类 → 原分类
// - 其他账本 → 账本名
// =====================================================

function getNonXxDisplayCategory(
  item: ExpenseTransaction
): string {
  const bookName = getExpenseBookName(item);
  const category = getExpenseCategory(item);

  // 1. 带「游」的账本（不含小宝）→ 旅游
  const isTravelBook =
    bookName.includes("游") && !bookName.includes("小宝");

  if (isTravelBook) return "旅游";

  // 2. 小宝账本 / 小宝2.7万账本 → 小宝
  if (bookName.includes("小宝")) {
    return "小宝";
  }

  // 3. 日常账本：
  //    小宝分类 → 小宝
  //    其他分类 → 原分类
  if (bookName === "日常账本") {
    if (category.includes("小宝")) return "小宝";

    return category || "其他";
  }

  // 4. 其他账本 → 账本名
  return bookName || category || "其他";
}

type CategoryBucket = {
  categories: string[];
  amounts: Record<string, number>;
  total: number;
};

type MonthlyCardCategoryMatrix = {
  xx: CategoryBucket;
  nonXx: CategoryBucket;
  total: number;
};

function buildMonthlyCardCategoryMatrix(
  cards: CreditCard[],
  transactions: ExpenseTransaction[],
  month: string
): MonthlyCardCategoryMatrix {
  const xxAmounts: Record<string, number> = {};
  const nonXxAmounts: Record<string, number> = {};

  let xxTotal = 0;
  let nonXxTotal = 0;

  const cardCycles = cards.map((card) => {
    const accountName = getCardAccountName(card);
    const cardBank = getCardBankName(card);
    const billingDay = getCardBillingDay(card);

    const cycle = getCardBillingCycle(month, billingDay);

    return {
      accountName,
      cardBank,
      targetName: normalizeCardName(accountName),
      targetBank: normalizeCardBankName(cardBank),
      cycle,
    };
  });

  for (const item of transactions) {
    if (!item.is_credit_card) continue;
    if (!isSelfCreditCardExpense(item)) continue;
    if (!isRealConsumption(item)) continue;

    const transactionDate = getLocalTransactionDate(item);
    if (!transactionDate) continue;

    const transactionAccount = String(
      item.account_name || ""
    ).trim();

    if (!transactionAccount) continue;

    const transactionName = normalizeCardName(transactionAccount);
    const transactionBank = normalizeCardBankName(transactionAccount);

    let matched = false;

    for (const c of cardCycles) {
      if (!c.cycle) continue;

      const nameMatched =
        c.targetName && transactionName === c.targetName;

      const bankMatched =
        c.targetBank && transactionBank === c.targetBank;

      if (!nameMatched && !bankMatched) continue;

      if (
        !isDateInBillingCycle(
          transactionDate,
          c.cycle.start,
          c.cycle.end
        )
      ) {
        continue;
      }

      matched = true;
      break;
    }

    if (!matched) continue;

    const amount = Math.abs(Number(item.amount || 0));
    if (!Number.isFinite(amount) || amount <= 0) continue;

    if (isXxExpense(item)) {
      const category = getExpenseCategory(item);
      xxAmounts[category] = (xxAmounts[category] || 0) + amount;
      xxTotal += amount;
    } else {
      const displayCategory = getNonXxDisplayCategory(item);
      nonXxAmounts[displayCategory] =
        (nonXxAmounts[displayCategory] || 0) + amount;
      nonXxTotal += amount;
    }
  }

  const sortCategories = (obj: Record<string, number>) => {
    const keys = Object.keys(obj);
    const specialFirst = ["小宝", "旅游"];

    const head = keys
      .filter((k) => specialFirst.includes(k))
      .sort(
        (a, b) =>
          specialFirst.indexOf(a) -
          specialFirst.indexOf(b)
      );

    const middle = keys
      .filter(
        (k) =>
          !specialFirst.includes(k) && k !== "其他"
      )
      .sort((a, b) => obj[b] - obj[a]);

    const hasOther = keys.includes("其他");

    return hasOther
      ? [...head, ...middle, "其他"]
      : [...head, ...middle];
  };

  return {
    xx: {
      categories: sortCategories(xxAmounts),
      amounts: xxAmounts,
      total: xxTotal,
    },
    nonXx: {
      categories: sortCategories(nonXxAmounts),
      amounts: nonXxAmounts,
      total: nonXxTotal,
    },
    total: xxTotal + nonXxTotal,
  };
}

// =====================================================
// 页面组件
// =====================================================

export default function CashflowSalaryPage() {
  const [years, setYears] = useState<YearData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedYear, setSelectedYear] = useState<number>(
    () => getCurrentMonth().year
  );
  const [selectedMonth, setSelectedMonth] = useState<number>(
    () => getCurrentMonth().month
  );

  const [overrides, setOverrides] = useState<OverrideState>({});
  const [overridesLoaded, setOverridesLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const hasEdited = useRef(false);

  const [creditCardMonthlyMap, setCreditCardMonthlyMap] = useState<
    Map<string, number>
  >(new Map());

  const [creditCardActualBill, setCreditCardActualBill] =
    useState<number>(0);
  const [creditCardEarlyPay, setCreditCardEarlyPay] =
    useState<number>(0);

  const [yuSummary, setYuSummary] =
    useState<CreditCardFromYuSummary | null>(null);
  const [yuLoading, setYuLoading] = useState(false);
  const [yuError, setYuError] = useState<string | null>(null);

  const [fhData, setFhData] = useState<NextMonthFHData>({
    costTemples: [],
    costRows: [],
    hongbaoTemples: [],
    hongbaoEvents: [],
    hongbaoPackets: [],
  });
  const [fhLoading, setFhLoading] = useState(false);
  const [fhError, setFhError] = useState<string | null>(null);

  const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
  const [cardTransactions, setCardTransactions] = useState<
    ExpenseTransaction[]
  >([]);
  const [cardExpenseLoading, setCardExpenseLoading] =
    useState(false);

  const nxt = getFollowingMonth(selectedYear, selectedMonth);

  const annuitySectionRef = useRef<HTMLElement | null>(null);
  const annuityTransferRowRef =
    useRef<HTMLTableRowElement | null>(null);
  const savingsTransferRowRef =
    useRef<HTMLTableRowElement | null>(null);
  const savingsRowObserverRef =
    useRef<ResizeObserver | null>(null);
  const [annuityOffsetY, setAnnuityOffsetY] = useState<number>(0);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        setLoading(true);
        setError(null);

        const cloud = await loadCashflowPlanning();
        if (!mounted) return;

        if (
          !cloud.hasData ||
          !cloud.state ||
          !Array.isArray(cloud.state.years) ||
          cloud.state.years.length === 0
        ) {
          throw new Error(
            "Supabase 中没有 CASHFLOW-PLANNING 数据，请先完成一次初始化。"
          );
        }

        setYears(cloud.state.years as YearData[]);
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error
              ? err.message
              : "读取现金流规划数据失败"
          );
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadCreditCardMonthly() {
      try {
        const map = await getCreditCardMonthlyMap();
        if (!mounted) return;
        setCreditCardMonthlyMap(map);
      } catch (err) {
        console.error(
          "[CASHFLOW-SALARY] 读取信用卡分期失败：",
          err
        );
      }
    }

    loadCreditCardMonthly();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadActualBill() {
      try {
        const { total, earlyTotal } =
          await getCreditCardActualBillTotal(
            selectedYear,
            selectedMonth
          );

        if (!mounted) return;

        setCreditCardActualBill(total);
        setCreditCardEarlyPay(earlyTotal);
      } catch (err) {
        console.error(
          "[CASHFLOW-SALARY] 读取信用卡实际账单失败：",
          err
        );

        if (mounted) {
          setCreditCardActualBill(0);
          setCreditCardEarlyPay(0);
        }
      }
    }

    loadActualBill();

    function onVisible() {
      if (document.visibilityState === "visible") {
        loadActualBill();
      }
    }

    window.addEventListener("focus", loadActualBill);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      window.removeEventListener("focus", loadActualBill);
      document.removeEventListener(
        "visibilitychange",
        onVisible
      );
    };
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    let mounted = true;

    const month = `${selectedYear}-${String(
      selectedMonth
    ).padStart(2, "0")}`;

    async function loadYuSummary() {
      try {
        setYuLoading(true);
        setYuError(null);

        const result = await getCreditCardFromYuSummary(month);
        if (!mounted) return;
        setYuSummary(result);
      } catch (err) {
        console.error(
          "[CASHFLOW-SALARY] 读取信用卡总消费失败：",
          err
        );

        if (mounted) {
          setYuSummary(null);
          setYuError(
            err instanceof Error ? err.message : "读取失败"
          );
        }
      } finally {
        if (mounted) setYuLoading(false);
      }
    }

    loadYuSummary();

    function onVisible() {
      if (document.visibilityState === "visible") {
        loadYuSummary();
      }
    }

    window.addEventListener("focus", loadYuSummary);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      window.removeEventListener("focus", loadYuSummary);
      document.removeEventListener(
        "visibilitychange",
        onVisible
      );
    };
  }, [selectedYear, selectedMonth]);

  useEffect(() => {
    let mounted = true;

    async function loadCardExpense() {
      try {
        setCardExpenseLoading(true);

        const monthStr = `${selectedYear}-${String(
          selectedMonth
        ).padStart(2, "0")}`;

        const match = /^(\d{4})-(\d{2})$/.exec(monthStr);
        if (!match) return;

        const year = Number(match[1]);
        const monthNumber = Number(match[2]);

        const start = new Date(year, monthNumber - 2, 1);
        const end = new Date(year, monthNumber, 1);

        const [cardData, transactionData] = await Promise.all([
          getCreditCards(),
          getExpenseTransactions({
            startDate: start.toISOString(),
            endDate: end.toISOString(),
            creditCardOnly: true,
            excludeSettlement: true,
          }),
        ]);

        if (!mounted) return;

        setCreditCards(Array.isArray(cardData) ? cardData : []);
        setCardTransactions(
          Array.isArray(transactionData) ? transactionData : []
        );
      } catch (err) {
        console.error(
          "[CASHFLOW-SALARY] 读取信用卡消费失败：",
          err
        );

        if (mounted) {
          setCreditCards([]);
          setCardTransactions([]);
        }
      } finally {
        if (mounted) setCardExpenseLoading(false);
      }
    }

    loadCardExpense();

    return () => {
      mounted = false;
    };
  }, [selectedYear, selectedMonth]);

  const monthlyCardCategoryMatrix = useMemo(() => {
    const monthStr = `${selectedYear}-${String(
      selectedMonth
    ).padStart(2, "0")}`;

    return buildMonthlyCardCategoryMatrix(
      creditCards,
      cardTransactions,
      monthStr
    );
  }, [
    creditCards,
    cardTransactions,
    selectedYear,
    selectedMonth,
  ]);

  useEffect(() => {
    let mounted = true;

    async function loadOverrides() {
      try {
        const { data, error } = await supabase
          .from(SALARY_TABLE)
          .select("state")
          .eq("id", SALARY_ROW_ID)
          .maybeSingle();

        if (error) {
          console.error(
            "[CASHFLOW-SALARY] 读取失败：",
            error.message
          );
          return;
        }

        if (!mounted) return;

        const saved = (
          data?.state as {
            overrides?: OverrideState;
          } | null
        )?.overrides;

        if (saved) setOverrides(saved);
      } catch (err) {
        console.error("[CASHFLOW-SALARY] 读取异常：", err);
      } finally {
        if (mounted) setOverridesLoaded(true);
      }
    }

    loadOverrides();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function fetchAllRows(table: string) {
      const pageSize = 1000;
      let from = 0;
      const rows: any[] = [];

      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select("*")
          .range(from, from + pageSize - 1);

        if (error) throw error;

        rows.push(...(data || []));

        if ((data || []).length < pageSize) break;

        from += pageSize;
      }

      return rows;
    }

    async function loadFH() {
      try {
        setFhLoading(true);
        setFhError(null);

        const [
          costTemples,
          costRows,
          hongbaoTemples,
          hongbaoEvents,
          hongbaoPackets,
        ] = await Promise.all([
          fetchAllRows("fh_temples"),
          fetchAllRows("fh_costs"),
          fetchAllRows("fh_temples"),
          fetchAllRows("fh_events"),
          fetchAllRows("fh_red_packets"),
        ]);

        if (!mounted) return;

        setFhData({
          costTemples: (costTemples || []).map((r: any) => ({
            id: r.id,
            name: r.name,
          })),
          costRows: (costRows || []).map((r: any) => ({
            id: r.id,
            temple_id: r.temple_id,
            event_name: r.event_name,
            expense_year: Number(r.expense_year),
            expense_date: r.expense_date,
            expense_end_date: r.expense_end_date || null,
            amount: Number(r.amount || 0),
          })),
          hongbaoTemples: (hongbaoTemples || []).map(
            (r: any) => ({ id: r.id, name: r.name })
          ),
          hongbaoEvents: (hongbaoEvents || []).map((r: any) => ({
            id: r.id,
            temple_id: r.temple_id,
            name: r.name,
            event_year:
              Number(r.event_year) ||
              new Date().getFullYear(),
            start_date: r.start_date || null,
            end_date: r.end_date || null,
          })),
          hongbaoPackets: (hongbaoPackets || []).map(
            (r: any) => ({
              id: r.id,
              event_id: r.event_id,
              packet_amount: Number(r.packet_amount || 0),
            })
          ),
        });
      } catch (err) {
        if (mounted) {
          setFhError(
            err instanceof Error
              ? err.message
              : "读取下月法会数据失败"
          );
        }
      } finally {
        if (mounted) setFhLoading(false);
      }
    }

    loadFH();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!overridesLoaded || !hasEdited.current) return;

    let mounted = true;

    const timer = window.setTimeout(async () => {
      try {
        setSaving(true);

        const { error } = await supabase
          .from(SALARY_TABLE)
          .upsert(
            {
              id: SALARY_ROW_ID,
              state: { overrides },
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" }
          );

        if (error) {
          console.error(
            "[CASHFLOW-SALARY] 保存失败：",
            error.message
          );
        }
      } catch (err) {
        console.error("[CASHFLOW-SALARY] 保存异常：", err);
      } finally {
        if (mounted) setSaving(false);
      }
    }, 700);

    return () => {
      mounted = false;
      window.clearTimeout(timer);
    };
  }, [overrides, overridesLoaded]);

  function findMonth(year: number, month: number) {
    return years
      .find((y) => y.year === year)
      ?.months.find((m) => m.month === month);
  }

  const targetMonth = findMonth(selectedYear, selectedMonth);
  const nextMonthData = findMonth(nxt.year, nxt.month);

  const incomeRows = useMemo(
    () =>
      buildRows(
        targetMonth?.income,
        INCOME_ITEMS,
        "income",
        selectedYear,
        selectedMonth,
        overrides,
        creditCardMonthlyMap
      ),
    [
      targetMonth,
      selectedYear,
      selectedMonth,
      overrides,
      creditCardMonthlyMap,
    ]
  );

  const expenseGroups = useMemo(
    () =>
      EXPENSE_GROUPS.map((group) => {
        const source = group.useNextMonth
          ? nextMonthData
          : targetMonth;

        const year = group.useNextMonth ? nxt.year : selectedYear;
        const month = group.useNextMonth
          ? nxt.month
          : selectedMonth;

        const rows = buildRows(
          source?.expense,
          group.items,
          "expense",
          year,
          month,
          overrides,
          creditCardMonthlyMap
        );

        return {
          groupName: group.groupName,
          monthLabel: `${month}月`,
          rows,
          subtotal: rows.reduce((sum, r) => sum + r.value, 0),
        };
      }),
    [
      targetMonth,
      nextMonthData,
      nxt.year,
      nxt.month,
      selectedYear,
      selectedMonth,
      overrides,
      creditCardMonthlyMap,
    ]
  );

  const nextMonthCosts = useMemo(() => {
    const templeMap = new Map(
      fhData.costTemples.map((t) => [t.id, t.name])
    );

    const rows = fhData.costRows
      .filter((c) => {
        if (!c.expense_date) return false;
        const y = Number(c.expense_date.slice(0, 4));
        const m = Number(c.expense_date.slice(5, 7));
        return y === nxt.year && m === nxt.month;
      })
      .sort((a, b) =>
        (a.expense_date || "").localeCompare(
          b.expense_date || ""
        )
      )
      .map((c) => ({
        id: c.id,
        templeName:
          templeMap.get(c.temple_id) || "未设置寺庙",
        eventName: c.event_name,
        date: c.expense_date,
        endDate: c.expense_end_date || c.expense_date,
        amount: c.amount,
      }));

    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    return { rows, total };
  }, [fhData.costRows, fhData.costTemples, nxt.year, nxt.month]);

  const nextMonthHongbao = useMemo(() => {
    const templeMap = new Map(
      fhData.hongbaoTemples.map((t) => [t.id, t.name])
    );

    const matchedEventIds = new Set(
      fhData.hongbaoEvents
        .filter((e) => {
          if (Number(e.event_year) !== nxt.year) return false;
          if (!e.start_date) return false;
          const m = Number(e.start_date.slice(5, 7));
          return m === nxt.month;
        })
        .map((e) => e.id)
    );

    const byEvent = new Map<
      string,
      { eventName: string; templeName: string; amount: number }
    >();

    for (const e of fhData.hongbaoEvents) {
      if (!matchedEventIds.has(e.id)) continue;
      byEvent.set(e.id, {
        eventName: e.name,
        templeName:
          templeMap.get(e.temple_id) || "未设置寺庙",
        amount: 0,
      });
    }

    for (const p of fhData.hongbaoPackets) {
      const item = byEvent.get(p.event_id);
      if (!item) continue;
      item.amount += p.packet_amount;
    }

    const rows = Array.from(byEvent.values()).sort((a, b) =>
      a.eventName.localeCompare(b.eventName, "zh-CN")
    );

    const total = rows.reduce((sum, r) => sum + r.amount, 0);
    return { rows, total };
  }, [
    fhData.hongbaoEvents,
    fhData.hongbaoPackets,
    fhData.hongbaoTemples,
    nxt.year,
    nxt.month,
  ]);

  type SheetRow = ReturnType<typeof buildRows>[number];
  const byName = (rows: SheetRow[], name: string) =>
    rows.find((r) => r.name === name)!;

  const rSalary = byName(incomeRows, "SAL");
  const rGushou = byName(incomeRows, "年金固收");
  const rLP = byName(incomeRows, "LP");

  const rNianjin = byName(expenseGroups[0].rows, "年金");
  const rDingtou = byName(expenseGroups[0].rows, "下月定投");
  const rTransfer = byName(expenseGroups[0].rows, "转去养老保险");

  const rCardPlus = byName(expenseGroups[1].rows, "还信用卡+给妈");
  const rGiveMom = byName(expenseGroups[1].rows, "给妈");
  const rCardRegular = byName(expenseGroups[1].rows, "还信用卡常规");

  const rXxHongbao = byName(expenseGroups[2].rows, "xx红包");
  const rXxFahui = byName(expenseGroups[2].rows, "xx法会");

  const cardTotalKey = getOverrideKey(
    selectedYear,
    selectedMonth,
    "expense",
    "还信用卡总数"
  );

  const cardTotalEstimate =
    rCardPlus.value + rCardRegular.value;

  const EARLY_PAY_LIMIT = 12000;
  const earlyPayOver = creditCardEarlyPay > EARLY_PAY_LIMIT;
  const cardActualAvailable = creditCardActualBill > 0;
  const cardTotalPlanned = cardActualAvailable
    ? creditCardActualBill
    : cardTotalEstimate;

  const cardTotalEdited =
    typeof overrides[cardTotalKey] === "number";

  const cardTotal = cardTotalEdited
    ? overrides[cardTotalKey]
    : cardTotalPlanned;

  const J13 = rSalary.value;
  const J16 = rNianjin.value;
  const J17 = rDingtou.value;
  const J18 = rTransfer.value;
  const N18 = rGushou.value;
  const P18 = J18 + N18;
  const J20 = J13 - (J16 + J17 + J18);
  const J23 = cardTotal;
  const J24 = -rLP.value;
  const K23 = J23 + J24;
  const J25 = J20 - K23 - rGiveMom.value;
  const J29 = rXxHongbao.value;
  const J30 = rXxFahui.value;

  const totalIncome = J13;
  const totalExpense =
    J16 + J17 + J18 + K23 + rGiveMom.value;
  const net = J25;

  function setOverrideValue(key: string, value: number) {
    hasEdited.current = true;
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (loading) return;

    let raf1 = 0;
    let raf2 = 0;
    let lastY = Number.NaN;

    function measure() {
      const savingsRow = savingsTransferRowRef.current;
      const annuityRow = annuityTransferRowRef.current;

      if (!savingsRow || !annuityRow) {
        setAnnuityOffsetY(0);
        lastY = 0;
        return;
      }

      const currentTransform =
        annuitySectionRef.current?.style.transform || "";

      const match = currentTransform.match(
        /translateY\(\s*(-?\d+(?:\.\d+)?)px\s*\)/
      );

      const currentTy = match ? Number(match[1]) : 0;

      const savingsTop = savingsRow.getBoundingClientRect().top;
      const annuityTop = annuityRow.getBoundingClientRect().top;
      const annuityBaseTop = annuityTop - currentTy;

      const dy = savingsTop - annuityBaseTop;

      if (
        Number.isFinite(lastY) &&
        Math.abs(dy - lastY) < 0.5
      ) {
        return;
      }

      lastY = dy;
      setAnnuityOffsetY(dy);
    }

    function scheduleMeasure() {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      raf1 = requestAnimationFrame(() => {
        raf2 = requestAnimationFrame(measure);
      });
    }

    scheduleMeasure();

    const target = savingsTransferRowRef.current;
    const parentTable = target?.closest("table") ?? null;

    if (
      typeof ResizeObserver !== "undefined" &&
      (target || parentTable)
    ) {
      savingsRowObserverRef.current = new ResizeObserver(
        () => {
          scheduleMeasure();
        }
      );

      if (target) savingsRowObserverRef.current.observe(target);
      if (parentTable)
        savingsRowObserverRef.current.observe(parentTable);
    }

    window.addEventListener("resize", scheduleMeasure);

    if (
      typeof document !== "undefined" &&
      (document as any).fonts?.ready
    ) {
      (document as any).fonts.ready.then(() => {
        scheduleMeasure();
      });
    }

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.removeEventListener("resize", scheduleMeasure);

      if (savingsRowObserverRef.current) {
        savingsRowObserverRef.current.disconnect();
        savingsRowObserverRef.current = null;
      }
    };
  }, [
    loading,
    overrides,
    selectedYear,
    selectedMonth,
    rDingtou.note,
  ]);

  if (loading) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="text-sm text-gray-500">加载中…</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white p-6">
        <div className="text-sm text-red-600">{error}</div>
      </main>
    );
  }

  const g = fmtGeneral;
  const dingtouNote = rDingtou.note ?? "4.中行+招行基金";

  const tbl =
    "w-full table-fixed border-collapse text-[13px] [&_th]:border-b [&_th]:border-gray-100 [&_td]:border-b [&_td]:border-gray-100";

  const thBase = "px-3 py-1.5 text-[12px] font-medium";
  const thLeft = `${thBase} text-left`;
  const thRight = `${thBase} text-right`;

  const tdBase = "px-3 py-1.5 align-middle overflow-hidden";
  const tdLeft = `${tdBase} text-left`;
  const tdRight = `${tdBase} text-right tabular-nums`;

  const headCategory =
    "bg-amber-50 text-amber-700/70 [&:first-child]:font-bold [&:first-child]:text-amber-800";
  const headSaving = headCategory;
  const headSpend = headCategory;
  const headXx = headCategory;
  const headTotal = "bg-gray-50";
  const headColumns = "bg-gray-50/80 text-gray-500";

  const colgroup3 = (
    <colgroup>
      <col />
      <col style={{ width: 150 }} />
      <col style={{ width: 220 }} />
    </colgroup>
  );

  const inputCell = (
    value: number,
    onChange: (n: number) => void,
    opts: { edited?: boolean; title?: string } = {}
  ) => (
    <div
      className={`rounded-md border px-2 py-0.5 ${
        opts.edited
          ? "border-amber-300 bg-amber-50"
          : "border-gray-200 bg-gray-50"
      }`}
    >
      <CellInput value={value} onChange={onChange} title={opts.title} />
    </div>
  );

  return (
    <main className="flex min-h-screen items-center bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-[1440px] px-6 py-4">
        {/* 头部 */}
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              CASHFLOW-SALARY
            </h1>
            <div className="mt-0.5 text-xs text-gray-500">
              SAL、储蓄类、开销类取 {selectedYear} 年{" "}
              {selectedMonth} 月；xx类取 {nxt.year} 年 {nxt.month}{" "}
              月 · 数字可直接修改
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(Number(e.target.value))
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              {years.map((y) => (
                <option key={y.year} value={y.year}>
                  {y.year}
                </option>
              ))}
            </select>

            <select
              value={selectedMonth}
              onChange={(e) =>
                setSelectedMonth(Number(e.target.value))
              }
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map(
                (m) => (
                  <option key={m} value={m}>
                    {m}月
                  </option>
                )
              )}
            </select>

            <span className="w-12 text-xs text-gray-400">
              {saving ? "保存中…" : "已保存"}
            </span>
          </div>
        </div>

        {(!targetMonth || !nextMonthData) && (
          <div className="mb-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            CASHFLOW-PLANNING 里缺少
            {!targetMonth &&
              ` ${selectedYear} 年 ${selectedMonth} 月`}
            {!targetMonth && !nextMonthData && "、"}
            {!nextMonthData &&
              ` ${nxt.year} 年 ${nxt.month} 月`}
            的数据，对应项目的计划值会显示 0。
          </div>
        )}

        <div className="grid items-start gap-2.5 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* 左列 */}
          <div className="min-w-0 grid grid-cols-[220px_minmax(0,1fr)] grid-rows-[auto_1fr] gap-2.5">
            <div aria-hidden="true" />

            {/* 收入表 */}
            <section className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-l-4 border-gray-200 border-l-rose-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                收入 · {selectedYear}/
                {String(selectedMonth).padStart(2, "0")}
              </div>

              <table className={tbl}>
                {colgroup3}
                <thead>
                  <tr>
                    <th className={`${thLeft} ${headColumns}`}>项目</th>
                    <th className={`${thRight} ${headColumns}`}>
                      金额（可修改）
                    </th>
                    <th className={`${thRight} ${headColumns}`}>
                      说明
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td className={tdLeft}>
                      <div className="text-[13px] text-gray-800">
                        Salary
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        工资收入
                      </div>
                    </td>

                    <td className={tdRight}>
                      {inputCell(
                        J13,
                        (n) => setOverrideValue(rSalary.key, n),
                        {
                          edited:
                            rSalary.edited &&
                            rSalary.value !== rSalary.planned,
                          title:
                            rSalary.edited &&
                            rSalary.value !== rSalary.planned
                              ? `计划 ${g(rSalary.planned)}`
                              : undefined,
                        }
                      )}
                    </td>

                    <td className={`${tdRight} text-[11px] text-gray-500`}>
                      {rSalary.edited &&
                      rSalary.value !== rSalary.planned
                        ? `已调整 · 原计划 ${g(
                            rSalary.planned
                          )}`
                        : "来自 CASHFLOW-PLANNING"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </section>

            {/* 年金 + 信用卡总消费 */}
            <section
              ref={annuitySectionRef}
              className="flex w-full flex-col gap-2.5 self-start"
              style={{
                transform: `translateY(${annuityOffsetY}px)`,
              }}
            >
              <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-l-4 border-gray-200 border-l-sky-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                  年金总共
                </div>

                <table className={tbl}>
                  <colgroup>
                    <col />
                    <col style={{ width: 150 }} />
                  </colgroup>
                  <tbody>
                    <tr>
                      <td className={tdLeft}>年金固收</td>
                      <td className={tdRight}>{g(N18)}</td>
                    </tr>
                    <tr ref={annuityTransferRowRef}>
                      <td className={tdLeft}>转去养老保险</td>
                      <td className={tdRight}>{g(J18)}</td>
                    </tr>
                    <tr className={headTotal}>
                      <td className={`${tdLeft} font-semibold`}>
                        年金总共
                      </td>
                      <td className={`${tdRight} font-semibold`}>
                        {g(P18)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="w-full overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-baseline justify-between border-b border-l-4 border-gray-200 border-l-violet-400 bg-gray-50 px-4 py-2">
                  <span className="text-sm font-semibold text-gray-800">
                    信用卡总消费
                  </span>
                  <span className="text-[11px] font-normal text-gray-400">
                    {selectedMonth}月
                  </span>
                </div>

                <table className={tbl}>
                  <colgroup>
                    <col />
                    <col style={{ width: 72 }} />
                  </colgroup>
                  <tbody>
                    {(
                      [
                        ["自己消费总共", yuSummary?.selfExpense],
                        [
                          "替别人提前付总共",
                          yuSummary?.paidForOthersExpense,
                        ],
                      ] as Array<[string, number | undefined]>
                    ).map(([label, value]) => (
                      <tr key={label}>
                        <td
                          className={`${tdLeft} !px-2.5 text-[12px] text-gray-700`}
                        >
                          {label}
                        </td>
                        <td className={`${tdRight} !px-2.5`}>
                          {yuLoading || value === undefined
                            ? "…"
                            : g(value)}
                        </td>
                      </tr>
                    ))}

                    <tr className={headTotal}>
                      <td
                        className={`${tdLeft} !px-2.5 text-[12px] font-semibold text-gray-800`}
                      >
                        合计（信用卡总消费）
                      </td>
                      <td
                        className={`${tdRight} !px-2.5 font-semibold text-red-600`}
                      >
                        {yuLoading || !yuSummary
                          ? "…"
                          : g(yuSummary.excel)}
                      </td>
                    </tr>

                    <tr>
                      <td
                        className={`${tdLeft} !px-2.5 text-[12px] text-gray-700`}
                      >
                        分期月供
                      </td>
                      <td className={`${tdRight} !px-2.5`}>
                        {yuLoading || !yuSummary
                          ? "…"
                          : g(yuSummary.installment)}
                      </td>
                    </tr>

                    <tr className={headTotal}>
                      <td
                        className={`${tdLeft} !px-2.5 text-[12px] font-semibold text-gray-800`}
                      >
                        信用卡总还款
                      </td>
                      <td
                        className={`${tdRight} !px-2.5 font-semibold text-red-600`}
                      >
                        {yuLoading || !yuSummary
                          ? "…"
                          : g(yuSummary.totalRepay)}
                      </td>
                    </tr>
                  </tbody>
                </table>

                <div className="px-3 py-1.5 text-[10px] text-gray-400">
                  {yuError ? (
                    <span className="text-red-500">
                      读取失败：{yuError}
                    </span>
                  ) : (
                    <>
                      数据来自{" "}
                      <a
                        href="/credit-card-from-yu"
                        className="text-blue-600 underline underline-offset-2"
                      >
                        credit-card-from-yu
                      </a>
                    </>
                  )}
                </div>
              </div>
            </section>

            {/* 支出表 */}
            <section className="w-full self-start overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-l-4 border-gray-200 border-l-emerald-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                支出 · {selectedYear} 年 {selectedMonth} 月
              </div>

              {/* 储蓄类 */}
              <table className={tbl}>
                {colgroup3}
                <thead>
                  <tr>
                    <th className={`${thLeft} ${headSaving}`}>
                      储蓄类
                    </th>
                    <th className={`${thRight} ${headSaving}`}>
                      金额
                    </th>
                    <th className={`${thRight} ${headSaving}`}>
                      说明 / 公式
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td className={tdLeft}>
                      <div className="text-[13px] text-gray-800">
                        年金
                      </div>
                      <div className="mt-0.5 text-[11px] text-red-500">
                        1.存入招商银行
                      </div>
                    </td>
                    <td className={tdRight}>
                      {inputCell(
                        J16,
                        (n) => setOverrideValue(rNianjin.key, n),
                        {
                          edited:
                            rNianjin.edited &&
                            rNianjin.value !== rNianjin.planned,
                          title:
                            rNianjin.edited &&
                            rNianjin.value !== rNianjin.planned
                              ? `计划 ${g(rNianjin.planned)}`
                              : undefined,
                        }
                      )}
                    </td>
                    <td className={`${tdRight} text-[11px] text-gray-500`}>
                      {rNianjin.edited &&
                      rNianjin.value !== rNianjin.planned
                        ? `已调整 · 原计划 ${g(
                            rNianjin.planned
                          )}`
                        : ""}
                    </td>
                  </tr>

                  <tr>
                    <td className={tdLeft}>
                      <div className="text-[13px] text-gray-800">
                        下月定投
                      </div>
                      <div className="mt-0.5 text-[11px] leading-4 text-red-500">
                        {dingtouNote}
                      </div>
                    </td>
                    <td className={tdRight}>
                      {inputCell(
                        J17,
                        (n) => setOverrideValue(rDingtou.key, n),
                        {
                          edited:
                            rDingtou.edited &&
                            rDingtou.value !== rDingtou.planned,
                          title:
                            rDingtou.edited &&
                            rDingtou.value !== rDingtou.planned
                              ? `计划 ${g(rDingtou.planned)}`
                              : undefined,
                        }
                      )}
                    </td>
                    <td className={`${tdRight} text-[11px] text-gray-500`}>
                      {rDingtou.edited &&
                      rDingtou.value !== rDingtou.planned
                        ? `已调整 · 原计划 ${g(
                            rDingtou.planned
                          )}`
                        : "作为本月现金流支出"}
                    </td>
                  </tr>

                  <tr ref={savingsTransferRowRef}>
                    <td className={tdLeft}>
                      <div className="text-[13px] text-gray-800">
                        转去养老保险
                      </div>
                      <div className="mt-0.5 text-[11px] text-red-500">
                        3.储蓄 / 养老资金
                      </div>
                    </td>
                    <td className={tdRight}>
                      {inputCell(
                        J18,
                        (n) => setOverrideValue(rTransfer.key, n),
                        {
                          edited:
                            rTransfer.edited &&
                            rTransfer.value !== rTransfer.planned,
                          title:
                            rTransfer.edited &&
                            rTransfer.value !== rTransfer.planned
                              ? `计划 ${g(rTransfer.planned)}`
                              : undefined,
                        }
                      )}
                    </td>
                    <td className={`${tdRight} text-[11px] text-gray-500`}>
                      {rTransfer.edited &&
                      rTransfer.value !== rTransfer.planned
                        ? `已调整 · 原计划 ${g(
                            rTransfer.planned
                          )}`
                        : ""}
                    </td>
                  </tr>

                  <tr className={headTotal}>
                    <td
                      className={`${tdLeft} text-[12px] font-semibold text-gray-800`}
                    >
                      第一阶段剩下
                    </td>
                    <td
                      className={`${tdRight} text-[14px] font-semibold ${
                        J20 < 0
                          ? "text-rose-600"
                          : "text-gray-900"
                      }`}
                    >
                      {g(J20)}
                    </td>
                    <td
                      className={`${tdRight} text-[11px] text-gray-500`}
                    >
                      Salary − 年金 − 下月定投 − 养老保险
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* 开销类 */}
              <table className={`${tbl} mt-4 border-t border-gray-100`}>
                {colgroup3}
                <thead>
                  <tr>
                    <th className={`${thLeft} ${headSpend}`}>
                      开销类
                    </th>
                    <th className={`${thRight} ${headSpend}`}>
                      金额
                    </th>
                    <th className={`${thRight} ${headSpend}`}>
                      说明 / 公式
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td className={tdLeft}>
                      <div className="text-[13px] text-gray-800">
                        还信用卡总数
                        <span className="ml-1.5 text-[11px] font-normal text-gray-400">
                          （预估 {g(cardTotalEstimate)}）
                        </span>
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        包含还信用卡常规（中信银行）
                        {g(rCardRegular.value)} 元 · 给妈{" "}
                        {g(rGiveMom.value)} 元
                      </div>
                    </td>

                    <td className={tdRight}>
                      {inputCell(
                        J23,
                        (n) => setOverrideValue(cardTotalKey, n),
                        {
                          edited:
                            cardTotalEdited &&
                            cardTotal !== cardTotalPlanned,
                          title:
                            cardTotalEdited &&
                            cardTotal !== cardTotalPlanned
                              ? `实际账单 ${g(
                                  cardTotalPlanned
                                )}；cashflow-planning 预估 ${g(
                                  cardTotalEstimate
                                )}`
                              : `cashflow-planning 预估 ${g(
                                  cardTotalEstimate
                                )}`,
                        }
                      )}
                    </td>

                    <td className={`${tdRight} text-[11px] text-gray-500`}>
                      {cardTotalEdited &&
                      cardTotal !== cardTotalPlanned ? (
                        `已调整 · 原计划 ${g(
                          cardTotalPlanned
                        )}`
                      ) : (
                        <>
                          具体金额来自于{" "}
                          <a
                            href="/credit-card"
                            className="text-blue-600 underline underline-offset-2"
                          >
                            credit-card
                          </a>{" "}
                          中实际账单
                        </>
                      )}

                      <div
                        title={`1-9日还款合计 ${g(
                          creditCardEarlyPay
                        )}`}
                        className={`mt-0.5 ${
                          earlyPayOver
                            ? "font-medium text-red-600"
                            : "text-gray-900"
                        }`}
                      >
                        {earlyPayOver
                          ? `1-9日还款超过${EARLY_PAY_LIMIT}还款`
                          : `1-9日还款没有超过${EARLY_PAY_LIMIT}还款`}
                      </div>
                    </td>
                  </tr>

                  <tr>
                    <td className={tdLeft}>
                      <div className="text-[13px] text-gray-800">
                        给妈
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        默认 2000，可修改
                      </div>
                    </td>

                    <td className={tdRight}>
                      {inputCell(
                        rGiveMom.value,
                        (n) => setOverrideValue(rGiveMom.key, n),
                        {
                          edited:
                            rGiveMom.edited &&
                            rGiveMom.value !== rGiveMom.planned,
                          title:
                            rGiveMom.edited &&
                            rGiveMom.value !== rGiveMom.planned
                              ? `计划 ${g(rGiveMom.planned)}`
                              : undefined,
                        }
                      )}
                    </td>

                    <td className={`${tdRight} text-[11px] text-gray-500`}>
                      {rGiveMom.edited &&
                      rGiveMom.value !== rGiveMom.planned
                        ? `已调整 · 原计划 ${g(rGiveMom.planned)}`
                        : "默认 2000"}
                    </td>
                  </tr>

                  <tr>
                    <td className={tdLeft}>
                      <div className="text-[13px] text-gray-800">
                        LP
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        收入，存入中信
                      </div>
                    </td>
                    <td className={tdRight}>
                      {inputCell(
                        J24,
                        (n) => setOverrideValue(rLP.key, -n),
                        {
                          edited:
                            rLP.edited &&
                            rLP.value !== rLP.planned,
                          title:
                            rLP.edited &&
                            rLP.value !== rLP.planned
                              ? `计划 ${g(-rLP.planned)}`
                              : undefined,
                        }
                      )}
                    </td>
                    <td className={`${tdRight} text-[11px] text-gray-500`}>
                      {rLP.edited &&
                      rLP.value !== rLP.planned
                        ? `已调整 · 原计划 ${g(
                            -rLP.planned
                          )}`
                        : "作为信用卡还款抵减项"}
                    </td>
                  </tr>

                  <tr>
                    <td className={`${tdLeft} text-red-600`}>
                      <div className="text-[12px] font-medium">
                        还信用卡自己要放入
                      </div>
                      <div className="mt-0.5 text-[10px] text-red-500">
                        2.存中信现金宝
                      </div>
                    </td>
                    <td
                      className={`${tdRight} text-[14px] font-semibold text-red-600`}
                    >
                      {g(K23)}
                    </td>
                    <td
                      className={`${tdRight} text-[11px] text-gray-500`}
                    >
                      = {g(J23)}
                      {g(J24)}
                    </td>
                  </tr>

                  <tr className={headTotal}>
                    <td
                      className={`${tdLeft} text-[12px] font-semibold text-gray-800`}
                    >
                      第二阶段剩下
                    </td>
                    <td
                      className={`${tdRight} text-[14px] font-semibold ${
                        J25 < 0
                          ? "text-rose-600"
                          : "text-gray-900"
                      }`}
                    >
                      {g(J25)}
                    </td>
                    <td
                      className={`${tdRight} text-[11px] text-gray-500`}
                    >
                      第一阶段剩下 − 信用卡实际要出的钱 − 给妈
                    </td>
                  </tr>
                </tbody>
              </table>

              {/* xx 类 */}
              <table className={`${tbl} mt-4 border-t border-gray-100`}>
                {colgroup3}
                <thead>
                  <tr>
                    <th className={`${thLeft} ${headXx}`}>
                      xx类（下月）
                    </th>
                    <th className={`${thRight} ${headXx}`}>
                      金额
                    </th>
                    <th className={`${thRight} ${headXx}`}>
                      说明
                    </th>
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td className={tdLeft}>
                      <div className="text-[13px] text-gray-800">
                        xx红包
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        下月红包预算
                      </div>
                    </td>
                    <td className={tdRight}>
                      {inputCell(
                        J29,
                        (n) => setOverrideValue(rXxHongbao.key, n),
                        {
                          edited:
                            rXxHongbao.edited &&
                            rXxHongbao.value !==
                              rXxHongbao.planned,
                          title:
                            rXxHongbao.edited &&
                            rXxHongbao.value !==
                              rXxHongbao.planned
                              ? `计划 ${g(
                                  rXxHongbao.planned
                                )}`
                              : undefined,
                        }
                      )}
                    </td>
                    <td className={`${tdRight} text-[11px] text-gray-500`}>
                      {rXxHongbao.edited &&
                      rXxHongbao.value !== rXxHongbao.planned
                        ? `已调整 · 原计划 ${g(
                            rXxHongbao.planned
                          )}`
                        : ""}
                    </td>
                  </tr>

                  <tr>
                    <td className={tdLeft}>
                      <div className="text-[13px] text-gray-800">
                        xx法会
                      </div>
                      <div className="mt-0.5 text-[11px] text-gray-400">
                        下月法会预算
                      </div>
                    </td>
                    <td className={tdRight}>
                      {inputCell(
                        J30,
                        (n) => setOverrideValue(rXxFahui.key, n),
                        {
                          edited:
                            rXxFahui.edited &&
                            rXxFahui.value !== rXxFahui.planned,
                          title:
                            rXxFahui.edited &&
                            rXxFahui.value !== rXxFahui.planned
                              ? `计划 ${g(rXxFahui.planned)}`
                              : undefined,
                        }
                      )}
                    </td>
                    <td className={`${tdRight} text-[11px] text-gray-500`}>
                      {rXxFahui.edited &&
                      rXxFahui.value !== rXxFahui.planned
                        ? `已调整 · 原计划 ${g(
                            rXxFahui.planned
                          )}`
                        : ""}
                    </td>
                  </tr>
                </tbody>
              </table>

              <div className="border-t border-gray-200 bg-gray-50 px-4 py-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-gray-600">
                    公式关系：Salary → 储蓄 → 剩余 → 信用卡/LP →
                    剩余
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <span className="text-gray-600">
                      收入
                      <b className="ml-1 tabular-nums text-emerald-700">
                        {g(totalIncome)}
                      </b>
                    </span>
                    <span className="text-gray-600">
                      支出
                      <b className="ml-1 tabular-nums text-orange-700">
                        {g(totalExpense)}
                      </b>
                    </span>
                    <span
                      className={
                        net < 0
                          ? "text-rose-600"
                          : "text-emerald-700"
                      }
                    >
                      结余
                      <b className="ml-1 tabular-nums">{g(net)}</b>
                    </span>
                  </div>
                </div>
              </div>
            </section>
          </div>

          {/* 右列 */}
          <div className="flex flex-col gap-2.5">
            {/* 下月法会费用 */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-l-4 border-gray-200 border-l-indigo-400 bg-gray-50 px-4 py-2">
                <div className="text-sm font-semibold text-gray-800">
                  下月法会费用
                  <span className="ml-1.5 text-xs font-normal text-gray-500">
                    （{nxt.year} 年 {nxt.month} 月）
                  </span>
                </div>
                <div className="text-sm font-semibold tabular-nums text-indigo-600">
                  ¥{formatMoney(nextMonthCosts.total)}
                </div>
              </div>

              {fhLoading ? (
                <div className="px-4 py-3 text-xs text-gray-400">
                  加载中…
                </div>
              ) : fhError ? (
                <div className="px-4 py-3 text-xs text-red-600">
                  {fhError}
                </div>
              ) : nextMonthCosts.rows.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-400">
                  {nxt.year} 年 {nxt.month} 月没有法会费用记录
                </div>
              ) : (
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-gray-50/80 text-gray-500">
                      <th className="border-b border-gray-100 px-3 py-1.5 text-left font-medium">
                        日期
                      </th>
                      <th className="border-b border-gray-100 px-3 py-1.5 text-left font-medium">
                        寺庙 / 法会
                      </th>
                      <th className="w-24 border-b border-gray-100 px-3 py-1.5 text-right font-medium">
                        金额
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {nextMonthCosts.rows.map((row) => (
                      <tr
                        key={row.id}
                        className="bg-white transition-colors hover:bg-gray-50/70"
                      >
                        <td className="border-b border-gray-100 px-3 py-1.5 text-xs text-gray-500">
                          {row.date.slice(5).replace("-", "/")}
                          {row.endDate && row.endDate !== row.date
                            ? ` ~ ${row.endDate
                                .slice(5)
                                .replace("-", "/")}`
                            : ""}
                        </td>
                        <td className="border-b border-gray-100 px-3 py-1.5 text-gray-700">
                          <span className="mr-1.5 rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
                            {row.templeName}
                          </span>
                          {row.eventName}
                        </td>
                        <td className="border-b border-gray-100 px-3 py-1.5 text-right tabular-nums text-indigo-600">
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td
                        className="px-3 py-1.5 text-gray-800"
                        colSpan={2}
                      >
                        合计
                      </td>
                      <td className="px-3 py-1.5 pr-4 text-right tabular-nums text-indigo-600">
                        {formatMoney(nextMonthCosts.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            {/* 下月法会红包 */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-l-4 border-gray-200 border-l-pink-400 bg-gray-50 px-4 py-2">
                <div className="text-sm font-semibold text-gray-800">
                  下月法会红包
                  <span className="ml-1.5 text-xs font-normal text-gray-500">
                    （{nxt.year} 年 {nxt.month} 月）
                  </span>
                </div>
                <div className="text-sm font-semibold tabular-nums text-pink-600">
                  ¥{formatMoney(nextMonthHongbao.total)}
                </div>
              </div>

              {fhLoading ? (
                <div className="px-4 py-3 text-xs text-gray-400">
                  加载中…
                </div>
              ) : fhError ? (
                <div className="px-4 py-3 text-xs text-red-600">
                  {fhError}
                </div>
              ) : nextMonthHongbao.rows.length === 0 ? (
                <div className="px-4 py-3 text-xs text-gray-400">
                  {nxt.year} 年 {nxt.month} 月没有法会红包记录
                </div>
              ) : (
                <table className="w-full border-collapse text-[13px]">
                  <thead>
                    <tr className="bg-gray-50/80 text-gray-500">
                      <th className="border-b border-gray-100 px-3 py-1.5 text-left font-medium">
                        寺庙
                      </th>
                      <th className="border-b border-gray-100 px-3 py-1.5 text-left font-medium">
                        法会
                      </th>
                      <th className="w-24 border-b border-gray-100 px-3 py-1.5 text-right font-medium">
                        红包
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {nextMonthHongbao.rows.map((row, idx) => (
                      <tr
                        key={`${row.templeName}-${row.eventName}-${idx}`}
                        className="bg-white transition-colors hover:bg-gray-50/70"
                      >
                        <td className="border-b border-gray-100 px-3 py-1.5 text-gray-700">
                          <span className="rounded-full border border-gray-200 bg-gray-50 px-2 py-0.5 text-[11px] text-gray-600">
                            {row.templeName}
                          </span>
                        </td>
                        <td className="border-b border-gray-100 px-3 py-1.5 text-gray-700">
                          {row.eventName}
                        </td>
                        <td className="border-b border-gray-100 px-3 py-1.5 text-right tabular-nums text-pink-600">
                          {formatMoney(row.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr className="bg-gray-50 font-semibold">
                      <td
                        className="px-3 py-1.5 text-gray-800"
                        colSpan={2}
                      >
                        合计
                      </td>
                      <td className="px-3 py-1.5 pr-4 text-right tabular-nums text-pink-600">
                        {formatMoney(nextMonthHongbao.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </section>

            <MiniCalculator />

            <FormulaTool
              vars={{
                收入: totalIncome,
                支出: totalExpense,
                结余: net,
              }}
            />
          </div>
        </div>

        {/* =================================================
            本月信用卡自己消费 - 按 expense 分类
            拆成 xx 账本 / 非 xx 账本 两张表
        ================================================= */}

        <div className="mt-6 space-y-6">
          {/* ================= 非 xx 账本 ================= */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <div className="text-base font-semibold">
                  {selectedYear} 年 {selectedMonth} 月 非 xx 账本 -
                  信用卡自己消费
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  按信用卡账单周期过滤 · 只统计自己消费 ·
                  分类规则与 expense 页面一致
                </div>
              </div>

              <div className="text-sm font-semibold text-blue-600">
                合计：
                {formatMoney(
                  monthlyCardCategoryMatrix.nonXx.total
                )}
              </div>
            </div>

            {cardExpenseLoading ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                正在读取信用卡消费…
              </div>
            ) : monthlyCardCategoryMatrix.nonXx.categories
                .length === 0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                本月没有非 xx 账本的信用卡自己消费记录
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="border-b bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold whitespace-nowrap">
                        月份
                      </th>

                      {monthlyCardCategoryMatrix.nonXx.categories.map(
                        (cat) => (
                          <th
                            key={cat}
                            className="px-5 py-3 text-right font-semibold whitespace-nowrap"
                          >
                            {cat}
                          </th>
                        )
                      )}

                      <th className="px-5 py-3 text-right font-semibold text-blue-600 whitespace-nowrap">
                        月 度 合 计
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    <tr className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-bold text-gray-800 whitespace-nowrap">
                        {selectedYear} 年 {selectedMonth} 月
                      </td>

                      {monthlyCardCategoryMatrix.nonXx.categories.map(
                        (cat) => {
                          const value =
                            monthlyCardCategoryMatrix.nonXx
                              .amounts[cat] || 0;

                          return (
                            <td
                              key={cat}
                              className="px-5 py-3 text-right text-gray-600 whitespace-nowrap"
                            >
                              {value === 0
                                ? "0"
                                : formatMoney(value)}
                            </td>
                          );
                        }
                      )}

                      <td className="px-5 py-3 text-right font-bold text-blue-600 whitespace-nowrap">
                        {formatMoney(
                          monthlyCardCategoryMatrix.nonXx.total
                        )}
                      </td>
                    </tr>
                  </tbody>

                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td className="px-5 py-3 text-left font-bold">
                        占比
                      </td>

                      {monthlyCardCategoryMatrix.nonXx.categories.map(
                        (cat) => {
                          const value =
                            monthlyCardCategoryMatrix.nonXx
                              .amounts[cat] || 0;

                          const rate =
                            monthlyCardCategoryMatrix.nonXx
                              .total > 0
                              ? (value /
                                  monthlyCardCategoryMatrix.nonXx
                                    .total) *
                                100
                              : 0;

                          return (
                            <td
                              key={cat}
                              className="px-5 py-3 text-right text-gray-500 whitespace-nowrap"
                            >
                              {rate.toFixed(1)}%
                            </td>
                          );
                        }
                      )}

                      <td className="px-5 py-3 text-right font-bold text-blue-600 whitespace-nowrap">
                        100.0%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* ================= xx 账本 ================= */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <div>
                <div className="text-base font-semibold">
                  {selectedYear} 年 {selectedMonth} 月 xx 账本 -
                  信用卡自己消费
                </div>
                <div className="mt-1 text-xs text-gray-500">
                  按信用卡账单周期过滤 · 只统计自己消费 ·
                  xx 账本（book_name = "xx"）
                </div>
              </div>

              <div className="text-sm font-semibold text-amber-600">
                合计：{formatMoney(monthlyCardCategoryMatrix.xx.total)}
              </div>
            </div>

            {cardExpenseLoading ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                正在读取信用卡消费…
              </div>
            ) : monthlyCardCategoryMatrix.xx.categories.length ===
              0 ? (
              <div className="px-5 py-8 text-center text-sm text-gray-400">
                本月没有 xx 账本的信用卡自己消费记录
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px] text-sm">
                  <thead className="border-b bg-gray-50 text-gray-600">
                    <tr>
                      <th className="px-5 py-3 text-left font-semibold whitespace-nowrap">
                        月份
                      </th>

                      {monthlyCardCategoryMatrix.xx.categories.map(
                        (cat) => (
                          <th
                            key={cat}
                            className="px-5 py-3 text-right font-semibold whitespace-nowrap"
                          >
                            {cat}
                          </th>
                        )
                      )}

                      <th className="px-5 py-3 text-right font-semibold text-amber-600 whitespace-nowrap">
                        月 度 合 计
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y">
                    <tr className="hover:bg-gray-50">
                      <td className="px-5 py-3 font-bold text-gray-800 whitespace-nowrap">
                        {selectedYear} 年 {selectedMonth} 月
                      </td>

                      {monthlyCardCategoryMatrix.xx.categories.map(
                        (cat) => {
                          const value =
                            monthlyCardCategoryMatrix.xx
                              .amounts[cat] || 0;

                          return (
                            <td
                              key={cat}
                              className="px-5 py-3 text-right text-gray-600 whitespace-nowrap"
                            >
                              {value === 0
                                ? "0"
                                : formatMoney(value)}
                            </td>
                          );
                        }
                      )}

                      <td className="px-5 py-3 text-right font-bold text-amber-600 whitespace-nowrap">
                        {formatMoney(
                          monthlyCardCategoryMatrix.xx.total
                        )}
                      </td>
                    </tr>
                  </tbody>

                  <tfoot>
                    <tr className="border-t bg-gray-50">
                      <td className="px-5 py-3 text-left font-bold">
                        占比
                      </td>

                      {monthlyCardCategoryMatrix.xx.categories.map(
                        (cat) => {
                          const value =
                            monthlyCardCategoryMatrix.xx
                              .amounts[cat] || 0;

                          const rate =
                            monthlyCardCategoryMatrix.xx.total >
                            0
                              ? (value /
                                  monthlyCardCategoryMatrix.xx
                                    .total) *
                                100
                              : 0;

                          return (
                            <td
                              key={cat}
                              className="px-5 py-3 text-right text-gray-500 whitespace-nowrap"
                            >
                              {rate.toFixed(1)}%
                            </td>
                          );
                        }
                      )}

                      <td className="px-5 py-3 text-right font-bold text-amber-600 whitespace-nowrap">
                        100.0%
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}