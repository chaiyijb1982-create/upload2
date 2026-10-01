"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import { loadCashflowPlanning } from "@/lib/cashflow-planning";
import { supabase } from "@/lib/supabase";
import { getLoans } from "@/lib/loan";
import { calculateRemainingPeriods } from "@/lib/loan-calculations";

// ============================================================
// CASHFLOW-SALARY
// SAL / 储蓄类 / 开销类：取所选月份（默认本月）
// xx类：取所选月份的下一个月（默认下个月）
// 数字默认取 CASHFLOW-PLANNING 的计划值，可以直接修改，修改会保存到 Supabase
//
// 另外：
// 下月法会费用（来自 fh-cost）
// 下月法会红包（来自 fh-hongbao）
//
// 重要：
// 「还信用卡常规」与 CASHFLOW-PLANNING 一致，走动态计算
// （来自 /loan 的信用卡分期），而不是读存储值。
// ============================================================

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

// name 用来和 CASHFLOW-PLANNING 里的项目名匹配，label 是页面上显示的名字
type ItemDef = {
  name: string;
  label: string;
  // 双月（2、4、6…月）时：名字改成 evenMonthLabel，并在后面追加红色备注 evenMonthNote
  evenMonthLabel?: string;
  evenMonthNote?: string;
};

type OverrideState = {
  [key: string]: number;
};

// ============================================================
// 还信用卡常规：与 CASHFLOW-PLANNING 完全一致的动态取值
// ============================================================

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
    if (loan.type !== "信用卡分期") {
      continue;
    }

    const monthly = Number(loan.monthly_payment || 0);

    if (monthly <= 0) {
      continue;
    }

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

    if (!startDate || periods <= 0) {
      continue;
    }

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

// ============================================================
// 下月法会（来自 fh-cost / fh-hongbao）
// ============================================================

type FHTempleRow = {
  id: string;
  name: string;
};

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
        evenMonthNote: "( 本月双月换币去HK，带上招行基金[中行]1200定存)",
      },
      { name: "转去养老保险", label: "转去养老保险" },
    ],
  },
  {
    groupName: "开销类",
    items: [
      { name: "还信用卡+给妈", label: "还信用卡+给妈(中信银行)" },
      { name: "还信用卡常规", label: "还信用卡常规(中信银行)" },
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

function formatSigned(value: number) {
  if (!Number.isFinite(value)) return "—";

  const abs = Math.abs(value).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });

  if (value > 0) return `+${abs}`;
  if (value < 0) return `-${abs}`;

  return "0";
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
      (x) => !x.deleted && normalizeName(x.name) === normalizeName(def.name)
    );

    // 与 CASHFLOW-PLANNING 一致：
    // 「还信用卡常规」走 /loan 动态计算，其他项目读存储值
    const planned = isCreditCardRegularName(def.name)
      ? getCreditCardRegularAmount(creditCardMonthlyMap, year, month)
      : matched.reduce((sum, x) => sum + (Number(x.value) || 0), 0);

    const key = getOverrideKey(year, month, role, def.name);
    const edited = typeof overrides[key] === "number";

    return {
      name: def.name,
      label:
        def.evenMonthLabel && month % 2 === 0 ? def.evenMonthLabel : def.label,
      note: month % 2 === 0 ? def.evenMonthNote : undefined,
      key,
      planned,
      edited,
      value: edited ? overrides[key] : planned,
    };
  });
}

// ============================================================
// 计算器 / 公式工具（不依赖 eval，自己解析公式）
// 支持：+ - * / ^ % ( )，函数 SUM AVERAGE(AVG) MIN MAX COUNT ROUND
// ROUNDUP ROUNDDOWN ABS SQRT POWER MOD INT PI
// 名称：收入、支出、结余（取自本页）；L1、L2… 引用上面行的结果；L1:L3 为范围
// ============================================================

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

    const idMatch = rest.match(/^[A-Za-z_\u4e00-\u9fa5][A-Za-z0-9_\u4e00-\u9fa5]*/);
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

  if (text.startsWith("=") || text.startsWith("＝")) text = text.slice(1);

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

      // 函数调用
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

      // 范围 L1:L3
      if (isOp(":")) {
        i++;
        const t2 = tokens[i];
        const m2 =
          t2 && t2.t === "id" ? t2.v.toLowerCase().match(/^l(\d+)$/) : null;

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

      // 单独引用 L1
      if (lineMatch) {
        const v = lineValue(Number(lineMatch[1]));
        if (v === null) throw new Error(`L${lineMatch[1]} 没有结果`);
        return v;
      }

      // 页面上的数字（收入 / 支出 / 结余）
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

// ------------------------------------------------------------
// 公式工具：像 Excel 一样每行写一个公式，右边直接出结果
// ------------------------------------------------------------
function FormulaTool({ vars }: { vars: Record<string, number> }) {
  const [lines, setLines] = useState<string[]>([""]);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const results: Array<{ value: number | null; error: string | null }> = [];
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
    setLines((prev) => prev.map((l, i) => (i === idx ? text : l)));
  }

  function addLine() {
    setLines((prev) => [...prev, ""]);

    window.setTimeout(() => {
      inputRefs.current[lines.length]?.focus();
    }, 0);
  }

  function removeLine(idx: number) {
    setLines((prev) => (prev.length <= 1 ? [""] : prev.filter((_, i) => i !== idx)));
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-l-4 border-gray-200 border-l-violet-400 bg-gray-50 px-4 py-2">
        <div className="text-sm font-semibold text-gray-800">公式工具</div>

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
                        if (idx === lines.length - 1) {
                          addLine();
                        } else {
                          inputRefs.current[idx + 1]?.focus();
                        }
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
                    {r.error ? "错误" : r.value === null ? "" : formatResult(r.value)}
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
          可用名称：收入、支出、结余（取自本页）；L1、L2 引用上面行的结果，
          L1:L3 表示范围。函数：SUM AVERAGE MIN MAX COUNT ROUND ROUNDUP
          ROUNDDOWN ABS SQRT POWER MOD INT PI。
        </div>
      </div>
    </section>
  );
}

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

  // 信用卡分期每月应还（与 CASHFLOW-PLANNING 一致）
  const [creditCardMonthlyMap, setCreditCardMonthlyMap] = useState<
    Map<string, number>
  >(new Map());

  // ============================================================
  // 下月法会（fh-cost / fh-hongbao）
  // ============================================================
  const [fhData, setFhData] = useState<NextMonthFHData>({
    costTemples: [],
    costRows: [],
    hongbaoTemples: [],
    hongbaoEvents: [],
    hongbaoPackets: [],
  });
  const [fhLoading, setFhLoading] = useState(false);
  const [fhError, setFhError] = useState<string | null>(null);

  const nxt = getFollowingMonth(selectedYear, selectedMonth);

  // 读取 CASHFLOW-PLANNING
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
            err instanceof Error ? err.message : "读取现金流规划数据失败"
          );
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  // 读取信用卡分期（与 CASHFLOW-PLANNING 一致）
  useEffect(() => {
    let mounted = true;

    async function loadCreditCardMonthly() {
      try {
        const map = await getCreditCardMonthlyMap();
        if (!mounted) return;
        setCreditCardMonthlyMap(map);
      } catch (err) {
        console.error("[CASHFLOW-SALARY] 读取信用卡分期失败：", err);
      }
    }

    loadCreditCardMonthly();

    return () => {
      mounted = false;
    };
  }, []);

  // 读取已修改的数字
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
          console.error("[CASHFLOW-SALARY] 读取失败：", error.message);
          return;
        }

        if (!mounted) return;

        const saved = (data?.state as { overrides?: OverrideState } | null)
          ?.overrides;

        if (saved) {
          setOverrides(saved);
        }
      } catch (err) {
        console.error("[CASHFLOW-SALARY] 读取异常：", err);
      } finally {
        if (mounted) {
          setOverridesLoaded(true);
        }
      }
    }

    loadOverrides();

    return () => {
      mounted = false;
    };
  }, []);

  // 读取 fh-cost / fh-hongbao 数据（用于显示下月法会）
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
          hongbaoTemples: (hongbaoTemples || []).map((r: any) => ({
            id: r.id,
            name: r.name,
          })),
          hongbaoEvents: (hongbaoEvents || []).map((r: any) => ({
            id: r.id,
            temple_id: r.temple_id,
            name: r.name,
            event_year: Number(r.event_year) || new Date().getFullYear(),
            start_date: r.start_date || null,
            end_date: r.end_date || null,
          })),
          hongbaoPackets: (hongbaoPackets || []).map((r: any) => ({
            id: r.id,
            event_id: r.event_id,
            packet_amount: Number(r.packet_amount || 0),
          })),
        });
      } catch (err) {
        if (mounted) {
          setFhError(
            err instanceof Error ? err.message : "读取下月法会数据失败"
          );
        }
      } finally {
        if (mounted) {
          setFhLoading(false);
        }
      }
    }

    loadFH();

    return () => {
      mounted = false;
    };
  }, []);

  // 修改后自动保存
  useEffect(() => {
    if (!overridesLoaded || !hasEdited.current) return;

    let mounted = true;

    const timer = window.setTimeout(async () => {
      try {
        setSaving(true);

        const { error } = await supabase.from(SALARY_TABLE).upsert(
          {
            id: SALARY_ROW_ID,
            state: { overrides },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );

        if (error) {
          console.error("[CASHFLOW-SALARY] 保存失败：", error.message);
        }
      } catch (err) {
        console.error("[CASHFLOW-SALARY] 保存异常：", err);
      } finally {
        if (mounted) {
          setSaving(false);
        }
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
    [targetMonth, selectedYear, selectedMonth, overrides, creditCardMonthlyMap]
  );

  const expenseGroups = useMemo(
    () =>
      EXPENSE_GROUPS.map((group) => {
        const source = group.useNextMonth ? nextMonthData : targetMonth;
        const year = group.useNextMonth ? nxt.year : selectedYear;
        const month = group.useNextMonth ? nxt.month : selectedMonth;

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

  // ============================================================
  // 下月法会费用（fh-cost）
  // ============================================================
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
        (a.expense_date || "").localeCompare(b.expense_date || "")
      )
      .map((c) => ({
        id: c.id,
        templeName: templeMap.get(c.temple_id) || "未设置寺庙",
        eventName: c.event_name,
        date: c.expense_date,
        endDate: c.expense_end_date || c.expense_date,
        amount: c.amount,
      }));

    const total = rows.reduce((sum, r) => sum + r.amount, 0);

    return { rows, total };
  }, [fhData.costRows, fhData.costTemples, nxt.year, nxt.month]);

  // ============================================================
  // 下月法会红包（fh-hongbao）
  // ============================================================
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
        templeName: templeMap.get(e.temple_id) || "未设置寺庙",
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

  const totalIncome = incomeRows.reduce((sum, r) => sum + r.value, 0);
  const totalExpense = expenseGroups.reduce((sum, g) => sum + g.subtotal, 0);
  const net = totalIncome - totalExpense;

  function handleChange(key: string, text: string) {
    hasEdited.current = true;

    setOverrides((prev) => ({
      ...prev,
      [key]: Number(text.replace(/,/g, "")) || 0,
    }));
  }

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

  const inputBase =
    "w-28 rounded-md border border-gray-200 bg-gray-50/60 px-2 py-0.5 text-right text-[13px] tabular-nums outline-none transition focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100";

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto w-full max-w-[1200px] px-6 py-4">
        {/* 头部 */}
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              CASHFLOW-SALARY
            </h1>
            <div className="mt-0.5 text-xs text-gray-500">
              SAL、储蓄类、开销类取 {selectedYear} 年 {selectedMonth} 月；
              xx类取 {nxt.year} 年 {nxt.month} 月 · 数字可直接修改
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
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
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm shadow-sm outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m}月
                </option>
              ))}
            </select>

            <span className="w-12 text-xs text-gray-400">
              {saving ? "保存中…" : "已保存"}
            </span>
          </div>
        </div>

        {(!targetMonth || !nextMonthData) && (
          <div className="mb-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
            CASHFLOW-PLANNING 里缺少
            {!targetMonth && ` ${selectedYear} 年 ${selectedMonth} 月`}
            {!targetMonth && !nextMonthData && "、"}
            {!nextMonthData && ` ${nxt.year} 年 ${nxt.month} 月`}
            的数据，对应项目的计划值会显示 0。
          </div>
        )}

        <div className="grid items-start gap-2.5 lg:grid-cols-[minmax(0,1fr)_400px]">
          {/* 左列：收入明细 + 支出明细 + 统计 */}
          <div className="flex flex-col gap-2.5">
            {/* 收入明细 */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-l-4 border-gray-200 border-l-rose-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                收入明细
                <span className="ml-1.5 text-xs font-normal text-gray-500">
                  （{selectedMonth}月）
                </span>
              </div>

              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-500">
                    <th className="border-b border-gray-100 px-3 py-1.5 text-left font-medium">
                      项目
                    </th>
                    <th className="w-36 border-b border-gray-100 px-3 py-1.5 text-right font-medium">
                      金额
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {incomeRows.map((row) => (
                    <tr
                      key={row.name}
                      className="bg-white transition-colors hover:bg-gray-50/70"
                    >
                      <td className="border-b border-gray-100 px-3 py-1.5 text-gray-700">
                        {row.label}
                        {row.edited && row.value !== row.planned && (
                          <span className="ml-1.5 text-[11px] text-gray-400">
                            计划 {formatMoney(row.planned)}
                          </span>
                        )}
                      </td>
                      <td className="border-b border-gray-100 px-3 py-1.5 text-right">
                        <input
                          value={row.value}
                          onChange={(e) => handleChange(row.key, e.target.value)}
                          inputMode="decimal"
                          className={`${inputBase} text-rose-600`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-3 py-1.5 text-gray-800">收入合计</td>
                    <td className="px-3 py-1.5 pr-4 text-right tabular-nums text-rose-600">
                      {formatMoney(totalIncome)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>

            {/* 支出明细 */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-l-4 border-gray-200 border-l-emerald-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                支出明细
              </div>

              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-gray-50/80 text-gray-500">
                    <th className="border-b border-gray-100 px-3 py-1.5 text-left font-medium">
                      项目
                    </th>
                    <th className="w-36 border-b border-gray-100 px-3 py-1.5 text-right font-medium">
                      金额
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {expenseGroups.map((group) => (
                    <Fragment key={group.groupName}>
                      <tr>
                        <td className="border-b border-amber-100 bg-amber-50/70 px-3 py-1.5 text-[13px] font-semibold text-amber-700">
                          {group.groupName}
                          <span className="ml-1.5 text-xs font-normal text-amber-600/80">
                            （{group.monthLabel}）
                          </span>
                        </td>
                        <td className="border-b border-amber-100 bg-amber-50/70 px-3 py-1.5 pr-4 text-right text-[13px] font-semibold tabular-nums text-amber-700">
                          {formatMoney(group.subtotal)}
                        </td>
                      </tr>

                      {group.rows.map((row) => (
                        <tr
                          key={row.name}
                          className="bg-white transition-colors hover:bg-gray-50/70"
                        >
                          <td className="border-b border-gray-100 px-3 py-1.5 pl-6 text-gray-700">
                            {row.label}
                            {row.note && (
                              <span className="ml-0.5 text-red-600">
                                {row.note}
                              </span>
                            )}
                            {row.edited && row.value !== row.planned && (
                              <span className="ml-1.5 text-[11px] text-gray-400">
                                计划 {formatMoney(row.planned)}
                              </span>
                            )}
                          </td>
                          <td className="border-b border-gray-100 px-3 py-1.5 text-right">
                            <input
                              value={row.value}
                              onChange={(e) =>
                                handleChange(row.key, e.target.value)
                              }
                              inputMode="decimal"
                              className={`${inputBase} text-emerald-600`}
                            />
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>

                <tfoot>
                  <tr className="bg-gray-50 font-semibold">
                    <td className="px-3 py-1.5 text-gray-800">支出合计</td>
                    <td className="px-3 py-1.5 pr-4 text-right tabular-nums text-emerald-600">
                      {formatMoney(totalExpense)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </section>

            {/* 统计 */}
            <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-l-4 border-gray-200 border-l-amber-400 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-800">
                统计
              </div>

              <div className="grid gap-2.5 p-2.5">
                <div className="rounded-xl border border-gray-200 bg-gray-50/60 px-3 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-xs text-gray-500">收入 − 支出</div>
                    <div
                      className={`text-base font-semibold tabular-nums ${
                        net >= 0 ? "text-emerald-600" : "text-rose-600"
                      }`}
                    >
                      ¥{formatSigned(net)}
                    </div>
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
                <div className="px-4 py-3 text-xs text-gray-400">加载中…</div>
              ) : fhError ? (
                <div className="px-4 py-3 text-xs text-red-600">{fhError}</div>
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
                            ? ` ~ ${row.endDate.slice(5).replace("-", "/")}`
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
                      <td className="px-3 py-1.5 text-gray-800" colSpan={2}>
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
                <div className="px-4 py-3 text-xs text-gray-400">加载中…</div>
              ) : fhError ? (
                <div className="px-4 py-3 text-xs text-red-600">{fhError}</div>
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
                      <td className="px-3 py-1.5 text-gray-800" colSpan={2}>
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

            {/* 简易计算器 */}
            <MiniCalculator />

            {/* 公式工具 */}
            <FormulaTool
              vars={{ 收入: totalIncome, 支出: totalExpense, 结余: net }}
            />
          </div>
        </div>
      </div>
    </main>
  );
}