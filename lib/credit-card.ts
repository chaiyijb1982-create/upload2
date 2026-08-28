// =====================================================
// lib/credit-card.ts
// 信用卡主数据 + 分期 + 月度账单 + 资金安排
// =====================================================

import { supabase } from "@/lib/supabase";

export interface CreditCard {
  id: string;
  bank_name: string;
  card_name: string;
  billing_day: number;
  payment_day: number | null;
  include_billing_day: boolean;
  monthly_estimate: number;
  actual_bill_amount: number;
  active?: boolean;
}

export interface CreditCardInstallment {
  id: string;
  name: string;
  institution: string;
  monthly_payment: number;
  remaining_amount: number;
  status: string;
}

export interface CreditCardFunding {
  id: string;
  lp_actual_amount: number;
  my_actual_amount: number;
  lp_estimate_amount: number;
  my_estimate_amount: number;
}

export interface CreditCardMonthlyBill {
  id: string;
  credit_card_id: string;
  bill_month: string;
  monthly_estimate: number;
  actual_bill_amount: number;
  created_at?: string;
  updated_at?: string;
}

export interface CreditCardMonthlyFunding {
  id: string;
  bill_month: string;
  lp_actual_amount: number;
  my_actual_amount: number;
  lp_estimate_amount: number;
  my_estimate_amount: number;
}

function n(value: unknown): number {
  if (value === null || value === undefined || value === "") return 0;
  const x = Number(String(value).replace(/,/g, "").replace(/¥/g, "").trim());
  return Number.isFinite(x) ? x : 0;
}

function s(value: unknown): string { return String(value ?? "").trim(); }

function normalizeName(value: unknown): string {
  return s(value).replace(/\s+/g, "").replace(/（/g, "(").replace(/）/g, ")").toLowerCase();
}

function normalizeBankName(value: unknown): string {
  const x = normalizeName(value).replace(/银行/g, "").replace(/信用卡/g, "");
  const map: Record<string,string> = {
    "工行":"工商", "工商银行":"工商", "建行":"建设", "建设银行":"建设",
    "中行":"中国", "中国银行":"中国", "农行":"农业", "农业银行":"农业",
    "交行":"交通", "交通银行":"交通", "招行":"招商", "招商银行":"招商",
    "宁波":"宁波", "宁波银行":"宁波", "中信":"中信", "中信银行":"中信",
  };
  return map[x] ?? x;
}

function emptyFunding(): CreditCardFunding {
  return { id: "", lp_actual_amount: 0, my_actual_amount: 0, lp_estimate_amount: 0, my_estimate_amount: 0 };
}

function monthDate(month: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(s(month));
  if (!m) throw new Error("账单月份必须为 YYYY-MM");
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) throw new Error("账单月份无效");
  return `${year}-${String(mon).padStart(2,"0")}-01`;
}

// =====================================================
// 信用卡列表：credit_cards 为主，loans 仅补充未建主卡的分期账本
// =====================================================
export async function getCreditCards(): Promise<CreditCard[]> {
  const { data, error } = await supabase.from("credit_cards").select(`
    id, bank_name, card_name, billing_day, payment_day,
    include_billing_day, monthly_estimate, actual_bill_amount, active
  `).eq("active", true).order("billing_day", { ascending: true });
  if (error) throw error;

  const cards: CreditCard[] = (data ?? []).map((x: any) => ({
    id: String(x.id), bank_name: s(x.bank_name), card_name: s(x.card_name) || s(x.bank_name),
    billing_day: n(x.billing_day), payment_day: x.payment_day == null ? null : n(x.payment_day),
    include_billing_day: x.include_billing_day !== false,
    monthly_estimate: n(x.monthly_estimate), actual_bill_amount: n(x.actual_bill_amount), active: x.active,
  }));

  const { data: loans, error: loanError } = await supabase.from("loans").select(`
    id, name, institution, type, monthly_payment, remaining_amount, status
  `).eq("type", "信用卡分期").eq("status", "active");
  if (loanError) console.error("getCreditCards loans error:", loanError);

  const existing = new Set<string>();
  cards.forEach(c => { if (s(c.bank_name)) existing.add(s(c.bank_name)); if (s(c.card_name)) existing.add(s(c.card_name)); });

  for (const loan of loans ?? []) {
    const bank = s((loan as any).institution) || s((loan as any).name);
    if (!bank || existing.has(bank)) continue;
    cards.push({
      id: `loan-credit-card-${String((loan as any).id)}`,
      bank_name: bank, card_name: bank, billing_day: 0, payment_day: null,
      include_billing_day: true, monthly_estimate: 0, actual_bill_amount: 0, active: true,
    });
    existing.add(bank);
  }

  cards.sort((a,b) => (a.billing_day || 999) - (b.billing_day || 999) || a.bank_name.localeCompare(b.bank_name,"zh-CN"));
  return cards;
}

export async function updateCreditCardEstimate(cardId: string, amount: number): Promise<boolean> {
  if (!cardId || cardId.startsWith("loan-credit-card-")) return false;
  const { error } = await supabase.from("credit_cards").update({ monthly_estimate: Math.max(0,n(amount)) }).eq("id", cardId);
  if (error) { console.error(error); return false; }
  return true;
}

export async function updateCreditCardEstimates(items: {cardId:string; amount:number}[]): Promise<boolean> {
  for (const x of items ?? []) if (!x.cardId.startsWith("loan-credit-card-")) if (!(await updateCreditCardEstimate(x.cardId,x.amount))) return false;
  return true;
}

export async function getCreditCardInstallments(): Promise<CreditCardInstallment[]> {
  const { data, error } = await supabase.from("loans").select(`id,name,type,institution,monthly_payment,remaining_amount,status`)
    .eq("type","信用卡分期").eq("status","active");
  if (error) { console.error(error); return []; }
  return (data ?? []).map((x:any) => ({ id:String(x.id), name:s(x.name), institution:s(x.institution), monthly_payment:n(x.monthly_payment), remaining_amount:n(x.remaining_amount), status:s(x.status) }));
}

export async function getCreditCardInstallmentSummary(): Promise<Record<string,number>> {
  const rows = await getCreditCardInstallments();
  const out: Record<string,number> = {};
  rows.forEach(x => { if (x.institution) out[x.institution] = (out[x.institution] ?? 0) + n(x.monthly_payment); });
  return out;
}

export async function getCreditCardOverview() {
  const [cards, summary] = await Promise.all([getCreditCards(), getCreditCardInstallmentSummary()]);
  return cards.map(c => ({ ...c, installment: n(summary[c.bank_name]) }));
}

export async function getMonthlyCreditCardInstallmentTotal() {
  const x = await getCreditCardInstallmentSummary();
  return Object.values(x).reduce((a,b)=>a+n(b),0);
}

export async function getCreditCardMonthlyPaymentTotal() { return getMonthlyCreditCardInstallmentTotal(); }

// =====================================================
// 旧版总体资金安排：保留兼容
// =====================================================
export async function getCreditCardFunding(): Promise<CreditCardFunding> {
  const { data, error } = await supabase.from("credit_card_funding").select(`id,lp_actual_amount,my_actual_amount,lp_estimate_amount,my_estimate_amount`).limit(1);
  if (error || !data?.length) return emptyFunding();
  const x:any = data[0];
  return { id:String(x.id), lp_actual_amount:n(x.lp_actual_amount), my_actual_amount:n(x.my_actual_amount), lp_estimate_amount:n(x.lp_estimate_amount), my_estimate_amount:n(x.my_estimate_amount) };
}

export async function saveCreditCardFunding(funding: Partial<Omit<CreditCardFunding,"id">>): Promise<CreditCardFunding|null> {
  const payload = {
    lp_actual_amount:n(funding.lp_actual_amount), my_actual_amount:n(funding.my_actual_amount),
    lp_estimate_amount:n(funding.lp_estimate_amount), my_estimate_amount:n(funding.my_estimate_amount),
  };
  const { data: old, error: findError } = await supabase.from("credit_card_funding").select("id").limit(1);
  if (findError) { console.error(findError); return null; }
  const query = old?.length ? supabase.from("credit_card_funding").update(payload).eq("id",old[0].id) : supabase.from("credit_card_funding").insert(payload);
  const { data, error } = await query.select("id,lp_actual_amount,my_actual_amount,lp_estimate_amount,my_estimate_amount").single();
  if (error) { console.error(error); return null; }
  return { id:String(data.id), lp_actual_amount:n(data.lp_actual_amount), my_actual_amount:n(data.my_actual_amount), lp_estimate_amount:n(data.lp_estimate_amount), my_estimate_amount:n(data.my_estimate_amount) };
}

export async function autoSaveCreditCardFunding(funding: Partial<Omit<CreditCardFunding,"id">>) { return (await saveCreditCardFunding(funding)) !== null; }
export async function deleteCreditCardFunding(id:string):Promise<boolean> { if(!id)return false; const {error}=await supabase.from("credit_card_funding").delete().eq("id",id); return !error; }

// =====================================================
// 月度账单：核心历史数据层
// 唯一键 credit_card_id + bill_month
// =====================================================
export async function getCreditCardMonthlyBills(month?: string): Promise<CreditCardMonthlyBill[]> {
  let q = supabase.from("credit_card_monthly_bills").select(`id,credit_card_id,bill_month,monthly_estimate,actual_bill_amount,created_at,updated_at`).order("bill_month",{ascending:false});
  if (month) q = q.eq("bill_month",monthDate(month));
  const {data,error}=await q;
  if(error) throw error;
  return (data??[]).map((x:any)=>({id:String(x.id),credit_card_id:String(x.credit_card_id),bill_month:String(x.bill_month),monthly_estimate:n(x.monthly_estimate),actual_bill_amount:n(x.actual_bill_amount),created_at:x.created_at,updated_at:x.updated_at}));
}

export async function getCreditCardMonthlyBill(cardId:string, month:string):Promise<CreditCardMonthlyBill|null> {
  const {data,error}=await supabase.from("credit_card_monthly_bills").select(`id,credit_card_id,bill_month,monthly_estimate,actual_bill_amount,created_at,updated_at`).eq("credit_card_id",cardId).eq("bill_month",monthDate(month)).maybeSingle();
  if(error) throw error;
  return data ? {id:String(data.id),credit_card_id:String(data.credit_card_id),bill_month:String(data.bill_month),monthly_estimate:n(data.monthly_estimate),actual_bill_amount:n(data.actual_bill_amount),created_at:data.created_at,updated_at:data.updated_at} : null;
}

export async function saveCreditCardMonthlyBill(cardId:string, month:string, values:{monthly_estimate?:number;actual_bill_amount?:number}, options?:{overwrite?:boolean}):Promise<CreditCardMonthlyBill|null> {
  if (!cardId || cardId.startsWith("loan-credit-card-")) throw new Error("该账本来自贷款分期，没有 credit_cards 主记录，不能保存月度账单。");
  const billMonth=monthDate(month);
  const existing=await getCreditCardMonthlyBill(cardId,month);
  if(existing && options?.overwrite !== true) {
    // 不静默覆盖：调用方必须显式确认。
    throw new Error("MONTHLY_BILL_EXISTS");
  }
  const payload:any={credit_card_id:cardId,bill_month:billMonth};
  if(values.monthly_estimate!==undefined) payload.monthly_estimate=Math.max(0,n(values.monthly_estimate));
  if(values.actual_bill_amount!==undefined) payload.actual_bill_amount=Math.max(0,n(values.actual_bill_amount));
  if(existing) {
    const {data,error}=await supabase.from("credit_card_monthly_bills").update(payload).eq("id",existing.id).select(`id,credit_card_id,bill_month,monthly_estimate,actual_bill_amount,created_at,updated_at`).single();
    if(error) throw error;
    return {id:String(data.id),credit_card_id:String(data.credit_card_id),bill_month:String(data.bill_month),monthly_estimate:n(data.monthly_estimate),actual_bill_amount:n(data.actual_bill_amount),created_at:data.created_at,updated_at:data.updated_at};
  }
  // 新记录需要默认值；不能用 upsert，避免把重复月份静默覆盖。
  payload.monthly_estimate=payload.monthly_estimate ?? 0;
  payload.actual_bill_amount=payload.actual_bill_amount ?? 0;
  const {data,error}=await supabase.from("credit_card_monthly_bills").insert(payload).select(`id,credit_card_id,bill_month,monthly_estimate,actual_bill_amount,created_at,updated_at`).single();
  if(error) {
    if(error.code === "23505") throw new Error("MONTHLY_BILL_EXISTS");
    throw error;
  }
  return {id:String(data.id),credit_card_id:String(data.credit_card_id),bill_month:String(data.bill_month),monthly_estimate:n(data.monthly_estimate),actual_bill_amount:n(data.actual_bill_amount),created_at:data.created_at,updated_at:data.updated_at};
}

export async function getCreditCardBillMonths():Promise<string[]> {
  const {data,error}=await supabase.from("credit_card_monthly_bills").select("bill_month").order("bill_month",{ascending:false});
  if(error) throw error;
  return Array.from(new Set((data??[]).map((x:any)=>String(x.bill_month).slice(0,7))));
}

export async function getCreditCardMonthlyFunding(month:string):Promise<CreditCardMonthlyFunding|null> {
  const {data,error}=await supabase.from("credit_card_monthly_funding").select(`id,bill_month,lp_actual_amount,my_actual_amount,lp_estimate_amount,my_estimate_amount`).eq("bill_month",monthDate(month)).maybeSingle();
  if(error) throw error;
  if(!data)return null;
  return {id:String(data.id),bill_month:String(data.bill_month),lp_actual_amount:n(data.lp_actual_amount),my_actual_amount:n(data.my_actual_amount),lp_estimate_amount:n(data.lp_estimate_amount),my_estimate_amount:n(data.my_estimate_amount)};
}

export async function saveCreditCardMonthlyFunding(month:string, funding:Partial<Omit<CreditCardMonthlyFunding,"id"|"bill_month">>):Promise<CreditCardMonthlyFunding|null> {
  const billMonth=monthDate(month);
  const payload={bill_month:billMonth,lp_actual_amount:n(funding.lp_actual_amount),my_actual_amount:n(funding.my_actual_amount),lp_estimate_amount:n(funding.lp_estimate_amount),my_estimate_amount:n(funding.my_estimate_amount)};
  const {data,error}=await supabase.from("credit_card_monthly_funding").upsert(payload,{onConflict:"bill_month"}).select(`id,bill_month,lp_actual_amount,my_actual_amount,lp_estimate_amount,my_estimate_amount`).single();
  if(error) throw error;
  return {id:String(data.id),bill_month:String(data.bill_month),lp_actual_amount:n(data.lp_actual_amount),my_actual_amount:n(data.my_actual_amount),lp_estimate_amount:n(data.lp_estimate_amount),my_estimate_amount:n(data.my_estimate_amount)};
}

export async function getCreditCardEstimateTotal(){const c=await getCreditCards();return c.reduce((a,x)=>a+n(x.monthly_estimate),0);}
export async function getCreditCardActualBillTotal(){const c=await getCreditCards();return c.reduce((a,x)=>a+n(x.actual_bill_amount),0);}

export async function getCreditCardFundingSummary(){
  const [cards,funding,installmentTotal]=await Promise.all([getCreditCards(),getCreditCardFunding(),getMonthlyCreditCardInstallmentTotal()]);
  const estimateBillTotal=cards.reduce((a,x)=>a+n(x.monthly_estimate),0);
  const actualBillTotal=cards.reduce((a,x)=>a+n(x.actual_bill_amount),0);
  const estimateFundingTotal=n(funding.lp_estimate_amount)+n(funding.my_estimate_amount);
  const actualFundingTotal=n(funding.lp_actual_amount)+n(funding.my_actual_amount);
  return {funding,estimate_bill_total:estimateBillTotal,installment_total:installmentTotal,estimate_total:estimateBillTotal+installmentTotal,estimate_funding_total:estimateFundingTotal,estimate_need_myself:Math.max(0,estimateBillTotal+installmentTotal-estimateFundingTotal),actual_bill_total:actualBillTotal,actual_funding_total:actualFundingTotal,actual_need_myself:Math.max(0,actualBillTotal-actualFundingTotal)};
}

export function getCreditCardBillingPeriod(billingDay:number, includeBillingDay=true, referenceDate:Date=new Date()):{startDate:Date;endDate:Date}{
  const d=Math.max(1,Math.min(31,Math.floor(n(billingDay)||1))); const y=referenceDate.getFullYear(),m=referenceDate.getMonth(),day=referenceDate.getDate();
  const endBase=day>=d?new Date(y,m,1):new Date(y,m-1,1); const endLast=new Date(endBase.getFullYear(),endBase.getMonth()+1,0).getDate();
  const end=new Date(endBase.getFullYear(),endBase.getMonth(),Math.min(d,endLast));
  const prevLast=new Date(end.getFullYear(),end.getMonth(),0).getDate(); const prev=new Date(end.getFullYear(),end.getMonth()-1,Math.min(d,prevLast));
  const start=new Date(prev); start.setDate(start.getDate()+1); return {startDate:start,endDate:end};
}

export function isDateInCreditCardBillingPeriod(transactionDate:Date,billingDay:number,includeBillingDay=true,referenceDate:Date=new Date()):boolean{const {startDate,endDate}=getCreditCardBillingPeriod(billingDay,includeBillingDay,referenceDate);const d=new Date(transactionDate);d.setHours(0,0,0,0);startDate.setHours(0,0,0,0);endDate.setHours(0,0,0,0);return d>=startDate&&(includeBillingDay?d<=endDate:d<endDate);}
export function formatCreditCardBillingPeriod(billingDay:number,includeBillingDay=true,referenceDate:Date=new Date()):string{const {startDate,endDate}=getCreditCardBillingPeriod(billingDay,includeBillingDay,referenceDate);const f=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;return `${f(startDate)} → ${f(endDate)}`;}

export async function getCreditCardSummary(){
  const [cards,funding,installmentTotal]=await Promise.all([getCreditCards(),getCreditCardFunding(),getMonthlyCreditCardInstallmentTotal()]);
  const estimate=cards.reduce((a,x)=>a+n(x.monthly_estimate),0), actual=cards.reduce((a,x)=>a+n(x.actual_bill_amount),0);
  const ef=n(funding.lp_estimate_amount)+n(funding.my_estimate_amount), af=n(funding.lp_actual_amount)+n(funding.my_actual_amount);
  return {card_count:cards.length,estimate_bill_total:estimate,actual_bill_total:actual,installment_total:installmentTotal,estimate_funding_total:ef,actual_funding_total:af,estimate_need_myself:Math.max(0,estimate+installmentTotal-ef),actual_need_myself:Math.max(0,actual-af)};
}