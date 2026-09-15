"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Lunar, Solar } from "lunar-javascript";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MONTH_NAMES = ["", "正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "冬月", "腊月"];
const DAY_NAMES = ["", "初一", "初二", "初三", "初四", "初五", "初六", "初七", "初八", "初九", "初十", "十一", "十二", "十三", "十四", "十五", "十六", "十七", "十八", "十九", "二十", "廿一", "廿二", "廿三", "廿四", "廿五", "廿六", "廿七", "廿八", "廿九", "三十"];

const FALLBACK_COLORS = [
  { bg: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { bg: "bg-purple-50 text-purple-800 border-purple-200" },
  { bg: "bg-cyan-50 text-cyan-800 border-cyan-200" },
  { bg: "bg-indigo-50 text-indigo-800 border-indigo-200" },
  { bg: "bg-orange-50 text-orange-800 border-orange-200" },
];

function getTempleColor(templeName: string) {
  if (templeName.includes("龙华寺")) {
    return { bg: "bg-amber-100 text-amber-900 border-amber-300" }; // 黄色
  }
  if (templeName.includes("法藏讲寺")) {
    return { bg: "bg-rose-100 text-rose-900 border-rose-300" }; // 红色
  }
  if (templeName.includes("圆明讲堂")) {
    return { bg: "bg-sky-100 text-sky-900 border-sky-300" }; // 蓝色
  }

  let hash = 0;
  for (let i = 0; i < templeName.length; i++) {
    hash = templeName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % FALLBACK_COLORS.length;
  return FALLBACK_COLORS[index];
}

type ScheduleItem = {
  date: string; // YYYY-MM-DD
  type: "焰口" | "蒙山";
};

type Temple = { id: string; name: string };
type Cost = {
  id: string;
  temple_id: string;
  event_name: string;
  expense_year: number;
  expense_date: string;
  expense_end_date: string | null;
  lunar_year: number | null;
  lunar_month: number | null;
  lunar_day: number | null;
  lunar_leap: boolean;
  lunar_end_year: number | null;
  lunar_end_month: number | null;
  lunar_end_day: number | null;
  lunar_end_leap: boolean;
  schedules: ScheduleItem[];
  need_xibo: boolean;
  xibo_bags: number;
  xibo_price: number;
  amount: number;
  note: string | null;
  created_at: string;
};

type CostForm = {
  id?: string;
  temple_id: string;
  event_name: string;
  expense_year: number;
  expense_date: string;
  expense_end_date: string;
  is_single_day: boolean;
  lunar_year: number;
  lunar_month: number;
  lunar_day: number;
  lunar_leap: boolean;
  lunar_end_year: number;
  lunar_end_month: number;
  lunar_end_day: number;
  lunar_end_leap: boolean;
  schedules: ScheduleItem[];
  need_xibo: boolean;
  xibo_bags: string;
  xibo_price: string;
  amount: string;
  note: string;
};

function money(value: number) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function solarToLunar(date: string) {
  if (!date) return null;
  try {
    const [y, m, d] = date.split("-").map(Number);
    const lunar = Solar.fromYmd(y, m, d).getLunar();
    return { year: Number(lunar.getYear()), month: Number(lunar.getMonth()), day: Number(lunar.getDay()), leap: false };
  } catch { return null; }
}
function lunarToSolar(year: number, month: number, day: number) {
  try {
    const solar = Lunar.fromYmd(year, month, day).getSolar();
    return `${solar.getYear()}-${String(solar.getMonth()).padStart(2, "0")}-${String(solar.getDay()).padStart(2, "0")}`;
  } catch { return null; }
}
function emptyForm(year = new Date().getFullYear()): CostForm {
  return { 
    temple_id: "", 
    event_name: "", 
    expense_year: year, 
    expense_date: "", 
    expense_end_date: "", 
    is_single_day: true,
    lunar_year: year, 
    lunar_month: 1, 
    lunar_day: 1, 
    lunar_leap: false, 
    lunar_end_year: year,
    lunar_end_month: 1, 
    lunar_end_day: 1, 
    lunar_end_leap: false,
    schedules: [],
    need_xibo: false,
    xibo_bags: "",
    xibo_price: "18", // 默认18元/袋
    amount: "", 
    note: "" 
  };
}

async function fetchAllRows(table: string) {
  const pageSize = 1000;
  let from = 0;
  const rows: any[] = [];
  while (true) {
    const { data, error } = await supabase.from(table).select("*").range(from, from + pageSize - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if ((data || []).length < pageSize) break;
    from += pageSize;
  }
  return rows;
}

export default function FHCostPage() {
  const currentYear = new Date().getFullYear();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [temples, setTemples] = useState<Temple[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CostForm>(emptyForm(currentYear));
  const [copyTargetYear, setCopyTargetYear] = useState(String(currentYear + 1));

  const templeMap = useMemo(() => new Map(temples.map(t => [t.id, t.name])), [temples]);
  const years = useMemo(() => {
    const s = new Set<number>([currentYear]);
    costs.forEach(c => s.add(c.expense_year));
    return [...s].sort((a, b) => b - a);
  }, [costs, currentYear]);
  const yearCosts = useMemo(() => costs.filter(c => c.expense_year === selectedYear).sort((a, b) => a.expense_date.localeCompare(b.expense_date)), [costs, selectedYear]);
  
  const totalAmount = useMemo(() => costs.reduce((s, c) => s + Number(c.amount || 0), 0), [costs]);
  const yearTotal = useMemo(() => yearCosts.reduce((s, c) => s + Number(c.amount || 0), 0), [yearCosts]);
  const yearXiboTotal = useMemo(() => yearCosts.reduce((s, c) => s + (c.need_xibo ? (c.xibo_bags * (c.xibo_price || 18)) : 0), 0), [yearCosts]);
  
  const templeStats = useMemo(() => {
    const map = new Map<string, { templeId: string; templeName: string; count: number; amount: number }>();
    for (const c of costs) {
      const id = c.temple_id || "__unknown__";
      const item = map.get(id) || { templeId: id, templeName: templeMap.get(id) || "未设置寺庙", count: 0, amount: 0 };
      item.count += 1;
      item.amount += Number(c.amount || 0);
      map.set(id, item);
    }
    return [...map.values()].sort((a, b) => b.amount - a.amount);
  }, [costs, templeMap]);

  async function loadAll() {
    try {
      setLoading(true); setError("");
      const [templeRows, costRows] = await Promise.all([fetchAllRows("fh_temples"), fetchAllRows("fh_costs")]);
      setTemples((templeRows || []).map((r: any) => ({ id: r.id, name: r.name })));
      setCosts((costRows || []).map((r: any) => ({ 
        ...r, 
        expense_year: Number(r.expense_year), 
        amount: Number(r.amount || 0), 
        expense_end_date: r.expense_end_date || null,
        lunar_year: r.lunar_year == null ? null : Number(r.lunar_year), 
        lunar_month: r.lunar_month == null ? null : Number(r.lunar_month), 
        lunar_day: r.lunar_day == null ? null : Number(r.lunar_day), 
        lunar_leap: Boolean(r.lunar_leap),
        lunar_end_year: r.lunar_end_year == null ? null : Number(r.lunar_end_year), 
        lunar_end_month: r.lunar_end_month == null ? null : Number(r.lunar_end_month), 
        lunar_end_day: r.lunar_end_day == null ? null : Number(r.lunar_end_day), 
        lunar_end_leap: Boolean(r.lunar_end_leap),
        schedules: Array.isArray(r.schedules) ? r.schedules : [],
        need_xibo: Boolean(r.need_xibo),
        xibo_bags: Number(r.xibo_bags || 0),
        xibo_price: r.xibo_price != null ? Number(r.xibo_price) : 18
      })) as Cost[]);
    } catch (e: any) { setError(e?.message || "读取法会费用失败"); }
    finally { setLoading(false); }
  }
  useEffect(() => { loadAll(); }, []);

  function clearMsg() { setError(""); setMessage(""); }
  function openNew() { clearMsg(); setForm(emptyForm(selectedYear)); setShowForm(true); }
  function openEdit(c: Cost) {
    clearMsg();
    const isSingle = !c.expense_end_date || c.expense_end_date === c.expense_date;
    setForm({ 
      id: c.id, 
      temple_id: c.temple_id, 
      event_name: c.event_name || "", 
      expense_year: c.expense_year, 
      expense_date: c.expense_date || "", 
      expense_end_date: c.expense_end_date || c.expense_date || "",
      is_single_day: isSingle,
      lunar_year: c.lunar_year || c.expense_year, 
      lunar_month: c.lunar_month || 1, 
      lunar_day: c.lunar_day || 1, 
      lunar_leap: Boolean(c.lunar_leap),
      lunar_end_year: c.lunar_end_year || c.expense_year,
      lunar_end_month: c.lunar_end_month || c.lunar_month || 1, 
      lunar_end_day: c.lunar_end_day || c.lunar_day || 1, 
      lunar_end_leap: Boolean(c.lunar_end_leap),
      schedules: c.schedules ? JSON.parse(JSON.stringify(c.schedules)) : [],
      need_xibo: c.need_xibo,
      xibo_bags: c.xibo_bags ? String(c.xibo_bags) : "",
      xibo_price: c.xibo_price != null ? String(c.xibo_price) : "18",
      amount: String(c.amount ?? ""), 
      note: c.note || "" 
    });
    setShowForm(true);
  }

  function applySolarToLunarStart() {
    const r = solarToLunar(form.expense_date);
    if (!r) return setError("开始阳历日期无法转换成农历");
    setForm(f => ({ 
      ...f, 
      lunar_year: r.year, 
      lunar_month: r.month, 
      lunar_day: r.day, 
      lunar_leap: r.leap, 
      expense_year: Number(form.expense_date.slice(0, 4)),
      ...(f.is_single_day ? {
        lunar_end_year: r.year,
        lunar_end_month: r.month,
        lunar_end_day: r.day,
        lunar_end_leap: r.leap
      } : {})
    }));
  }

  function applySolarToLunarEnd() {
    const r = solarToLunar(form.expense_end_date);
    if (!r) return setError("结束阳历日期无法转换成农历");
    setForm(f => ({ 
      ...f, 
      lunar_end_year: r.year, 
      lunar_end_month: r.month, 
      lunar_end_day: r.day, 
      lunar_end_leap: r.leap 
    }));
  }

  function applyLunarToSolarStart() {
    const solar = lunarToSolar(form.lunar_year, form.lunar_month, form.lunar_day);
    if (!solar) return setError("开始农历日期无法转换成阳历");
    setForm(f => ({ 
      ...f, 
      expense_date: solar, 
      expense_year: Number(solar.slice(0, 4)),
      ...(f.is_single_day ? { 
        expense_end_date: solar,
        lunar_end_year: f.lunar_year,
        lunar_end_month: f.lunar_month,
        lunar_end_day: f.lunar_day,
        lunar_end_leap: f.lunar_leap
      } : {})
    }));
  }

  function applyLunarToSolarEnd() {
    const solar = lunarToSolar(form.lunar_end_year, form.lunar_end_month, form.lunar_end_day);
    if (!solar) return setError("结束农历日期无法转换成阳历");
    setForm(f => ({ 
      ...f, 
      expense_end_date: solar 
    }));
  }

  async function saveCost() {
    clearMsg();
    const amount = Number(form.amount);
    const xiboBagsNum = form.need_xibo ? Number(form.xibo_bags || 0) : 0;
    const xiboPriceNum = form.need_xibo ? Number(form.xibo_price || 18) : 18;
    
    if (!form.temple_id) return setError("请选择寺庙");
    if (!form.event_name.trim()) return setError("请输入法会名称");
    if (!form.expense_date) return setError("请选择开始日期");
    const endDate = form.is_single_day ? form.expense_date : (form.expense_end_date || form.expense_date);
    if (!Number.isFinite(amount) || amount < 0) return setError("请输入正确的费用金额");
    if (form.need_xibo && (!Number.isFinite(xiboBagsNum) || xiboBagsNum <= 0)) return setError("请输入正确的锡箔袋数");

    try {
      setSaving(true);
      const payload = { 
        temple_id: form.temple_id, 
        event_name: form.event_name.trim(), 
        expense_year: Number(form.expense_year), 
        expense_date: form.expense_date, 
        expense_end_date: endDate,
        lunar_year: Number(form.lunar_year), 
        lunar_month: Number(form.lunar_month), 
        lunar_day: Number(form.lunar_day), 
        lunar_leap: Boolean(form.lunar_leap), 
        lunar_end_year: Number(form.is_single_day ? form.lunar_year : form.lunar_end_year),
        lunar_end_month: Number(form.is_single_day ? form.lunar_month : form.lunar_end_month), 
        lunar_end_day: Number(form.is_single_day ? form.lunar_day : form.lunar_end_day), 
        lunar_end_leap: Boolean(form.is_single_day ? form.lunar_leap : form.lunar_end_leap),
        schedules: form.schedules,
        need_xibo: form.need_xibo,
        xibo_bags: xiboBagsNum,
        xibo_price: xiboPriceNum,
        amount, 
        note: form.note.trim() || null 
      };
      if (form.id) {
        const { data, error } = await supabase.from("fh_costs").update(payload).eq("id", form.id).select().single();
        if (error) throw error;
        setCosts(prev => prev.map(c => c.id === form.id ? ({ ...data, amount: Number(data.amount || 0) } as Cost) : c));
        setMessage("费用已保存");
      } else {
        const { data, error } = await supabase.from("fh_costs").insert(payload).select().single();
        if (error) throw error;
        setCosts(prev => [...prev, { ...data, amount: Number(data.amount || 0) } as Cost]);
        setMessage("费用已添加");
      }
      setSelectedYear(Number(form.expense_year)); setShowForm(false);
    } catch (e: any) { setError(e?.message || "保存费用失败"); }
    finally { setSaving(false); }
  }

  async function deleteCost(c: Cost) {
    if (!confirm(`确定删除「${c.event_name}」的 ${money(c.amount)} 费用吗？`)) return;
    try {
      setSaving(true); clearMsg();
      const { error } = await supabase.from("fh_costs").delete().eq("id", c.id);
      if (error) throw error;
      setCosts(prev => prev.filter(x => x.id !== c.id)); setMessage("费用已删除");
    } catch (e: any) { setError(e?.message || "删除失败"); }
    finally { setSaving(false); }
  }

  async function copyCostsToYear() {
    clearMsg();
    if (!yearCosts.length) return setError(`${selectedYear} 年没有费用记录`);

    if (!/^\d{4}$/.test(copyTargetYear)) {
      return setError("复制到年份必须是4位数字");
    }

    const targetYear = Number(copyTargetYear);
    if (targetYear <= currentYear) {
      return setError(`复制到年份必须大于今年（${currentYear}）`);
    }
    if (targetYear >= 2200) {
      return setError("复制到年份必须小于2200");
    }
    if (targetYear === selectedYear) return setError("目标年份不能和模板年份相同");

    if (!confirm(`确定把模板 ${selectedYear} 年的 ${yearCosts.length} 条费用复制到 ${targetYear} 年吗？`)) return;
    try {
      setSaving(true);
      const inserts: any[] = [];
      for (const c of yearCosts) {
        const duplicate = costs.some(x => x.expense_year === targetYear && x.temple_id === c.temple_id && x.event_name === c.event_name && x.amount === c.amount && x.lunar_month === c.lunar_month && x.lunar_day === c.lunar_day);
        if (duplicate) continue;

        let targetDate = "";
        if (c.lunar_month && c.lunar_day) {
          targetDate = lunarToSolar(targetYear, c.lunar_month, c.lunar_day) || "";
        }
        if (!targetDate && c.expense_date) {
          const [, m, d] = c.expense_date.split("-");
          targetDate = `${targetYear}-${m}-${d}`;
        }

        let targetEndDate = "";
        const endMonth = c.lunar_end_month || c.lunar_month;
        const endDay = c.lunar_end_day || c.lunar_day;
        if (endMonth && endDay) {
          targetEndDate = lunarToSolar(targetYear, endMonth, endDay) || "";
        }
        if (!targetEndDate && c.expense_end_date) {
          const [, em, ed] = c.expense_end_date.split("-");
          targetEndDate = `${targetYear}-${em}-${ed}`;
        }
        if (!targetEndDate) {
          targetEndDate = targetDate;
        }

        const startLunar = targetDate ? solarToLunar(targetDate) : null;
        const endLunar = targetEndDate ? solarToLunar(targetEndDate) : null;

        const newSchedules = (c.schedules || []).map(sch => {
          if (!sch.date) return sch;
          const [, m, d] = sch.date.split("-");
          return { ...sch, date: `${targetYear}-${m}-${d}` };
        });

        inserts.push({ 
          temple_id: c.temple_id, 
          event_name: c.event_name, 
          expense_year: targetYear, 
          expense_date: targetDate, 
          expense_end_date: targetEndDate,
          lunar_year: startLunar?.year ?? targetYear, 
          lunar_month: startLunar?.month ?? c.lunar_month, 
          lunar_day: startLunar?.day ?? c.lunar_day, 
          lunar_leap: false, 
          lunar_end_year: endLunar?.year ?? targetYear,
          lunar_end_month: endLunar?.month ?? c.lunar_end_month ?? c.lunar_month, 
          lunar_end_day: endLunar?.day ?? c.lunar_end_day ?? c.lunar_day, 
          lunar_end_leap: false,
          schedules: newSchedules,
          need_xibo: c.need_xibo,
          xibo_bags: c.xibo_bags,
          xibo_price: c.xibo_price,
          amount: c.amount, 
          note: c.note 
        });
      }
      if (!inserts.length) { setMessage("目标年份已有相同费用，没有重复复制"); return; }
      const { data, error } = await supabase.from("fh_costs").insert(inserts).select();
      if (error) throw error;
      const newRows = (data || []) as Cost[];
      setCosts(prev => [...prev, ...newRows.map(r => ({ ...r, amount: Number(r.amount || 0) }))]);
      setSelectedYear(targetYear); setCopyTargetYear(String(targetYear + 1)); setMessage(`已复制 ${newRows.length} 条费用到 ${targetYear} 年`);
    } catch (e: any) { setError(e?.message || "复制失败"); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="min-h-screen bg-gray-50 p-8"><div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 shadow-sm">正在读取法会费用……</div></main>;

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-6">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div><h1 className="text-3xl font-bold tracking-tight">法会费用</h1><p className="mt-1 text-sm text-gray-500">按月份时间轴记录法会费用，支持阳历 / 农历互转、跨年份复制及寺庙统计。</p></div>
          <button onClick={openNew} className="rounded-xl bg-gray-900 px-5 py-2.5 text-sm font-semibold text-white">＋ 新增费用</button>
        </div>

        {(error || message) && <div className={`mb-5 rounded-xl border px-4 py-3 text-sm ${error ? "border-red-200 bg-red-50 text-red-700" : "border-green-200 bg-green-50 text-green-700"}`}>{error || message}</div>}

        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-sm text-gray-500">全部费用</div><div className="mt-2 text-3xl font-bold">{money(totalAmount)}</div><div className="mt-1 text-xs text-gray-400">共 {costs.length} 笔</div></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-sm text-gray-500">{selectedYear} 年费用</div><div className="mt-2 text-3xl font-bold">{money(yearTotal)}</div><div className="mt-1 text-xs text-gray-400">共 {yearCosts.length} 笔</div></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-sm text-gray-500">{selectedYear} 年锡箔</div><div className="mt-2 text-3xl font-bold text-amber-600">{money(yearXiboTotal)}</div><div className="mt-1 text-xs text-gray-400">年度锡箔费用总计</div></div>
          <div className="rounded-2xl border bg-white p-5 shadow-sm"><div className="text-sm text-gray-500">寺庙数量</div><div className="mt-2 text-3xl font-bold">{templeStats.length}</div><div className="mt-1 text-xs text-gray-400">按全部年份统计</div></div>
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-bold">全部费用 · 寺庙统计</h2><div className="text-lg font-bold">合计 {money(totalAmount)}</div></div>
          {templeStats.length === 0 ? <div className="rounded-xl bg-gray-50 p-6 text-center text-gray-400">还没有费用记录</div> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-sm"><thead><tr className="border-b text-left text-gray-500"><th className="px-3 py-3">寺庙</th><th className="px-3 py-3">费用笔数</th><th className="px-3 py-3 text-right">费用金额</th><th className="px-3 py-3 text-right">占全部</th></tr></thead><tbody>{templeStats.map(s => <tr key={s.templeId} className="border-b last:border-0"><td className="px-3 py-3 font-medium">{s.templeName}</td><td className="px-3 py-3">{s.count}</td><td className="px-3 py-3 text-right font-semibold">{money(s.amount)}</td><td className="px-3 py-3 text-right text-gray-500">{totalAmount ? ((s.amount / totalAmount) * 100).toFixed(1) : "0.0"}%</td></tr>)}</tbody><tfoot><tr className="font-bold"><td className="px-3 py-3">全部寺庙合计</td><td className="px-3 py-3">{costs.length}</td><td className="px-3 py-3 text-right">{money(totalAmount)}</td><td className="px-3 py-3 text-right">100%</td></tr></tfoot></table></div>}
        </section>

        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><h2 className="text-xl font-bold">费用记录</h2><select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))} className="rounded-lg border px-3 py-2 text-sm">{years.map(y => <option key={y} value={y}>{y}年</option>)}</select></div><div className="flex flex-wrap items-center gap-2"><span className="text-sm text-gray-600">模板是 <span className="font-semibold text-gray-900">{selectedYear}年</span></span><span className="text-sm text-gray-500">复制到</span><input type="text" inputMode="numeric" maxLength={4} value={copyTargetYear} onChange={e => setCopyTargetYear(e.target.value.replace(/\D/g, "").slice(0, 4))} className="w-24 rounded-lg border px-3 py-2 text-sm" placeholder={String(currentYear + 1)} /><span className="text-sm text-gray-500">年</span><button onClick={copyCostsToYear} disabled={saving || !yearCosts.length} className="rounded-lg border border-gray-900 px-4 py-2 text-sm font-medium disabled:opacity-40">复制</button></div></div>
        </section>

        <section className="space-y-5">
          {yearCosts.length === 0 ? (
            <div className="rounded-2xl border bg-white p-10 text-center text-gray-400">
              {selectedYear} 年还没有费用记录
            </div>
          ) : (
            Array.from(
              new Map(
                yearCosts.map(c => {
                  const month = Number(c.expense_date.slice(5, 7));
                  return [month, yearCosts.filter(x => Number(x.expense_date.slice(5, 7)) === month)];
                })
              ).entries()
            ).map(([month, monthCosts]) => {
              const monthTotal = monthCosts.reduce((sum, c) => sum + Number(c.amount || 0), 0);
              const monthXiboTotal = monthCosts.reduce((sum, c) => sum + (c.need_xibo ? (c.xibo_bags * (c.xibo_price || 18)) : 0), 0);

              return (
                <section key={month} className="overflow-hidden rounded-2xl border bg-white shadow-sm">
                  <div className="border-b bg-gray-50 px-5 py-3 flex items-center gap-3">
                    <h3 className="text-lg font-bold">{month}月</h3>
                    <div className="text-sm text-gray-600 font-medium">
                      本月: <span className="font-bold text-gray-900">{money(monthTotal)}</span> 
                      {monthXiboTotal > 0 && <span className="ml-2 text-amber-600">| 锡箔: {money(monthXiboTotal)}</span>}
                    </div>
                  </div>

                  <div className="divide-y">
                    {monthCosts.map(c => {
                      const templeName = templeMap.get(c.temple_id) || "未设置寺庙";
                      const templeColor = getTempleColor(templeName);
                      const startDateText = c.expense_date ? c.expense_date.slice(5).replace("-", "月") + "日" : "";
                      const endDateText = c.expense_end_date && c.expense_end_date !== c.expense_date 
                        ? c.expense_end_date.slice(5).replace("-", "月") + "日" 
                        : "";
                      const dateDisplay = endDateText ? `${startDateText} ~ ${endDateText}` : startDateText;

                      const startLunarText = c.lunar_month && c.lunar_day
                        ? `${MONTH_NAMES[c.lunar_month] || `${c.lunar_month}月`}${DAY_NAMES[c.lunar_day] || `${c.lunar_day}日`}`
                        : "";
                      const endLunarText = c.lunar_end_month && c.lunar_end_day && !(c.lunar_end_month === c.lunar_month && c.lunar_end_day === c.lunar_day)
                        ? `${MONTH_NAMES[c.lunar_end_month] || `${c.lunar_end_month}月`}${DAY_NAMES[c.lunar_end_day] || `${c.lunar_end_day}日`}`
                        : "";
                      const lunarDisplay = endLunarText ? `${startLunarText} ~ ${endLunarText}` : (startLunarText || "—");

                      return (
                        <div key={c.id} className="px-5 py-3.5 hover:bg-gray-50 transition-colors">
                          <div className="flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
                            {/* 左侧：阳历与农历时间 */}
                            <div className="w-[160px] shrink-0">
                              <div className="font-semibold text-gray-900 text-sm">
                                {dateDisplay}
                              </div>
                              <div className="text-xs text-gray-500">
                                {lunarDisplay}
                              </div>
                            </div>

                            {/* 寺庙标签 */}
                            <div className="shrink-0">
                              <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${templeColor.bg}`}>
                                {templeName}
                              </span>
                            </div>

                            {/* 法会名称与日程安排 */}
                            <div className="min-w-[150px] flex-1">
                              <div className="font-medium text-gray-900 text-sm flex items-center gap-2 flex-wrap">
                                <span>{c.event_name}</span>
                                {c.need_xibo && (
                                  <span className="bg-amber-50 text-amber-800 border border-amber-200 text-xs px-2 py-0.5 rounded-full font-normal">
                                    锡箔: {c.xibo_bags}袋 ({money(c.xibo_bags * (c.xibo_price || 18))})
                                  </span>
                                )}
                              </div>

                              {/* 日程展示 */}
                              {c.schedules && c.schedules.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 mt-1">
                                  {c.schedules.map((sch, sIdx) => {
                                    const schDateStr = sch.date ? sch.date.slice(5).replace("-", "/") : "";
                                    const isMengshan = sch.type === "蒙山";
                                    return (
                                      <span key={sIdx} className={`text-xs px-2 py-0.5 rounded-md border font-medium ${isMengshan ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-purple-50 text-purple-700 border-purple-200"}`}>
                                        {sch.type} {schDateStr && `(${schDateStr})`}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}

                              {c.note && (
                                <div className="text-xs text-gray-400 mt-0.5">
                                  备注：{c.note}
                                </div>
                              )}
                            </div>

                            {/* 金额 */}
                            <div className="shrink-0 text-right text-base font-bold text-gray-900">
                              {money(c.amount)}
                            </div>

                            {/* 编辑和删除按钮 */}
                            <div className="flex shrink-0 gap-2">
                              <button
                                onClick={() => openEdit(c)}
                                className="rounded-lg border bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 shadow-sm"
                              >
                                编辑
                              </button>
                              <button
                                onClick={() => deleteCost(c)}
                                disabled={saving}
                                className="rounded-lg border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 shadow-sm"
                              >
                                删除
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </section>

        {showForm && (
          <div className="fixed inset-0 z-50 overflow-y-auto bg-black/30 p-4">
            <div className="mx-auto mt-10 max-w-3xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">{form.id ? "编辑法会费用" : "新增法会费用"}</h2>
                <button onClick={() => setShowForm(false)} className="text-xl text-gray-400">✕</button>
              </div>
              <div className="grid gap-5">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">寺庙</label>
                    <select value={form.temple_id} onChange={e => setForm(f => ({ ...f, temple_id: e.target.value }))} className="w-full rounded-lg border px-3 py-2.5">
                      <option value="">请选择寺庙</option>
                      {temples.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">法会名称</label>
                    <input value={form.event_name} onChange={e => setForm(f => ({ ...f, event_name: e.target.value }))} placeholder="例如：水陆法会" className="w-full rounded-lg border px-3 py-2.5" />
                  </div>
                </div>

                <div className="rounded-xl border bg-gray-50 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="font-semibold">日期设置（支持阳历 / 农历双向互转）</span>
                    <label className="flex items-center gap-2 text-sm cursor-pointer select-none font-medium text-gray-700">
                      <input 
                        type="checkbox" 
                        checked={form.is_single_day} 
                        onChange={e => {
                          const checked = e.target.checked;
                          setForm(f => ({ 
                            ...f, 
                            is_single_day: checked, 
                            expense_end_date: checked ? f.expense_date : f.expense_end_date,
                            lunar_end_year: checked ? f.lunar_year : f.lunar_end_year,
                            lunar_end_month: checked ? f.lunar_month : f.lunar_end_month,
                            lunar_end_day: checked ? f.lunar_day : f.lunar_end_day,
                          }));
                        }} 
                        className="rounded border-gray-300"
                      />
                      单日法会
                    </label>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    {/* 开始时间组 */}
                    <div className="space-y-3">
                      <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">{form.is_single_day ? "法会日期（阳历）" : "开始日期（阳历）"}</label>
                        <div className="flex gap-2">
                          <input 
                            type="date" 
                            value={form.expense_date} 
                            onChange={e => {
                              const val = e.target.value;
                              setForm(f => ({ 
                                ...f, 
                                expense_date: val, 
                                expense_year: Number(val.slice(0, 4)) || f.expense_year,
                                ...(f.is_single_day ? { 
                                  expense_end_date: val 
                                } : {})
                              }));
                            }} 
                            className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm" 
                          />
                          <button type="button" onClick={applySolarToLunarStart} className="rounded-lg border bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100">转农历</button>
                        </div>
                      </div>

                      <div>
                        <label className="mb-1 block text-xs text-gray-500">农历开始日期</label>
                        <div className="grid grid-cols-3 gap-1.5">
                          <input type="number" value={form.lunar_year} onChange={e => setForm(f => ({ ...f, lunar_year: Number(e.target.value) }))} className="rounded-lg border bg-white px-2 py-1.5 text-sm" />
                          <select value={form.lunar_month} onChange={e => setForm(f => ({ ...f, lunar_month: Number(e.target.value) }))} className="rounded-lg border bg-white px-1 py-1.5 text-sm">{MONTH_NAMES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}</select>
                          <select value={form.lunar_day} onChange={e => setForm(f => ({ ...f, lunar_day: Number(e.target.value) }))} className="rounded-lg border bg-white px-1 py-1.5 text-sm">{DAY_NAMES.slice(1).map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}</select>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between">
                          <label className="text-xs text-gray-600"><input type="checkbox" checked={form.lunar_leap} onChange={e => setForm(f => ({ ...f, lunar_leap: e.target.checked }))} className="mr-1" />闰月</label>
                          <button type="button" onClick={applyLunarToSolarStart} className="rounded-lg border bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">转阳历</button>
                        </div>
                      </div>
                    </div>

                    {/* 结束时间组（多日时显示） */}
                    {!form.is_single_day && (
                      <div className="space-y-3 border-t md:border-t-0 md:border-l md:pl-4 pt-3 md:pt-0 border-gray-200">
                        <div>
                          <label className="mb-1 block text-sm font-medium text-gray-700">结束日期（阳历）</label>
                          <div className="flex gap-2">
                            <input 
                              type="date" 
                              value={form.expense_end_date} 
                              onChange={e => setForm(f => ({ ...f, expense_end_date: e.target.value }))} 
                              className="min-w-0 flex-1 rounded-lg border bg-white px-3 py-2 text-sm" 
                            />
                            <button type="button" onClick={applySolarToLunarEnd} className="rounded-lg border bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100">转农历</button>
                          </div>
                        </div>

                        <div>
                          <label className="mb-1 block text-xs text-gray-500">农历结束日期</label>
                          <div className="grid grid-cols-3 gap-1.5">
                            <input type="number" value={form.lunar_end_year} onChange={e => setForm(f => ({ ...f, lunar_end_year: Number(e.target.value) }))} className="rounded-lg border bg-white px-2 py-1.5 text-sm" />
                            <select value={form.lunar_end_month} onChange={e => setForm(f => ({ ...f, lunar_end_month: Number(e.target.value) }))} className="rounded-lg border bg-white px-1 py-1.5 text-sm">{MONTH_NAMES.slice(1).map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}</select>
                            <select value={form.lunar_end_day} onChange={e => setForm(f => ({ ...f, lunar_end_day: Number(e.target.value) }))} className="rounded-lg border bg-white px-1 py-1.5 text-sm">{DAY_NAMES.slice(1).map((d, i) => <option key={i + 1} value={i + 1}>{d}</option>)}</select>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <label className="text-xs text-gray-600"><input type="checkbox" checked={form.lunar_end_leap} onChange={e => setForm(f => ({ ...f, lunar_end_leap: e.target.checked }))} className="mr-1" />闰月</label>
                            <button type="button" onClick={applyLunarToSolarEnd} className="rounded-lg border bg-white px-2 py-1 text-xs text-gray-600 hover:bg-gray-100">转阳历</button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 法会具体日程（焰口 / 蒙山） */}
                <div className="rounded-xl border bg-purple-50/40 p-4 border-purple-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-sm text-purple-900">法会日程安排（焰口 / 蒙山）</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        const defaultDate = form.expense_date || "";
                        setForm(f => ({ ...f, schedules: [...f.schedules, { date: defaultDate, type: "焰口" }] }));
                      }}
                      className="rounded-lg bg-purple-600 text-white px-3 py-1 text-xs font-medium hover:bg-purple-700"
                    >
                      ＋ 添加日程
                    </button>
                  </div>

                  {(!form.schedules || form.schedules.length === 0) ? (
                    <div className="text-xs text-gray-400 py-2 text-center">暂无日程安排，点击上方按钮添加</div>
                  ) : (
                    <div className="space-y-2">
                      {form.schedules.map((sch, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-purple-100 shadow-sm">
                          <select 
                            value={sch.type} 
                            onChange={e => {
                              const val = e.target.value as "焰口" | "蒙山";
                              setForm(f => {
                                const newSch = [...f.schedules];
                                newSch[idx].type = val;
                                return { ...f, schedules: newSch };
                              });
                            }}
                            className="rounded-lg border px-2 py-1.5 text-xs font-medium bg-gray-50"
                          >
                            <option value="焰口">焰口</option>
                            <option value="蒙山">蒙山</option>
                          </select>

                          <input 
                            type="date" 
                            min={form.expense_date || undefined}
                            max={form.is_single_day ? form.expense_date : (form.expense_end_date || form.expense_date || undefined)}
                            value={sch.date} 
                            onChange={e => {
                              const val = e.target.value;
                              setForm(f => {
                                const newSch = [...f.schedules];
                                newSch[idx].date = val;
                                return { ...f, schedules: newSch };
                              });
                            }}
                            className="flex-1 rounded-lg border px-2 py-1.5 text-xs bg-white"
                          />

                          <button 
                            type="button" 
                            onClick={() => {
                              setForm(f => ({ ...f, schedules: f.schedules.filter((_, i) => i !== idx) }));
                            }}
                            className="text-red-500 hover:text-red-700 text-xs px-2 py-1 font-bold"
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="text-[11px] text-purple-700 mt-2">提示：日程日期会自动受限于上方设置的法会开始/结束时间范围内。</div>
                </div>

                {/* 锡箔选项 */}
                <div className="rounded-xl border bg-amber-50/50 p-4 border-amber-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={form.need_xibo} 
                      onChange={e => setForm(f => ({ ...f, need_xibo: e.target.checked }))} 
                      className="rounded border-gray-300 w-4 h-4 text-amber-600 focus:ring-amber-500"
                    />
                    需要准备锡箔
                  </label>
                  
                  {form.need_xibo && (
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">数量：</span>
                        <input 
                          type="number" 
                          min="1" 
                          value={form.xibo_bags} 
                          onChange={e => setForm(f => ({ ...f, xibo_bags: e.target.value }))} 
                          placeholder="几袋" 
                          className="w-20 rounded-lg border bg-white px-2 py-1.5 text-sm" 
                        />
                        <span className="text-sm text-gray-600">袋</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">单价：</span>
                        <input 
                          type="number" 
                          min="0"
                          step="0.1" 
                          value={form.xibo_price} 
                          onChange={e => setForm(f => ({ ...f, xibo_price: e.target.value }))} 
                          placeholder="18" 
                          className="w-20 rounded-lg border bg-white px-2 py-1.5 text-sm" 
                        />
                        <span className="text-sm text-gray-600">元/袋</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">费用金额</label>
                    <div className="flex items-center rounded-lg border">
                      <span className="pl-3 text-gray-400">¥</span>
                      <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="0" className="w-full rounded-lg px-2 py-2.5 outline-none" />
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">备注</label>
                    <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} placeholder="可选" className="w-full rounded-lg border px-3 py-2.5" />
                  </div>
                </div>

                <div className="flex justify-end gap-3 border-t pt-5">
                  <button onClick={() => setShowForm(false)} className="rounded-lg border px-5 py-2.5">取消</button>
                  <button onClick={saveCost} disabled={saving} className="rounded-lg bg-gray-900 px-5 py-2.5 font-semibold text-white disabled:opacity-50">{saving ? "保存中…" : "保存"}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}