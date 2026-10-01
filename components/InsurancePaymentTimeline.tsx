"use client";

import React, { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// =====================================================
// 类型
// =====================================================

type PremiumPlanItem = {
    id?: string | number;
    policy_id?: string;
    owner?: string;
    company?: string;
    insurer?: string;
    product?: string;
    policy_name?: string;
    premium?: number;
    amount?: number;
    annual_premium?: number;
    payment_month?: number;
    month?: number;
    pay_month?: number;
    payment_date?: string;
    pay_date?: string;
    paid_this_year?: boolean;
    [key: string]: any;
};

type Props = {
    data?: PremiumPlanItem[] | any;
    policies?: any;
    currentYear: number;
};

// =====================================================
// 工具函数
// =====================================================

function toArray<T>(value: any): T[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (Array.isArray(value.items)) return value.items;
    if (Array.isArray(value.data)) return value.data;
    return [];
}

function getPolicyId(item: PremiumPlanItem): string | null {
    if (item.policy_id) return String(item.policy_id);
    if (item.id !== undefined && item.id !== null) return String(item.id);
    return null;
}

function getDate(item: PremiumPlanItem, currentYear: number): Date | null {
    const dateStr = item.payment_date ?? item.pay_date;
    if (typeof dateStr === "string" && dateStr.length >= 7) {
        const parts = dateStr.split(/[-/]/);
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parts[2] ? parseInt(parts[2], 10) : 1;
        if (!isNaN(y) && !isNaN(m) && m >= 1 && m <= 12) {
            return new Date(y, m - 1, d || 1);
        }
    }
    const directMonth = item.payment_month ?? item.month ?? item.pay_month;
    if (typeof directMonth === "number" && directMonth >= 1 && directMonth <= 12) {
        return new Date(currentYear, directMonth - 1, 1);
    }
    return null;
}

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function getDeadlineRange(start: Date): { start: string; end: string } {
    const end = new Date(
        start.getFullYear(),
        start.getMonth() + 2,
        start.getDate()
    );
    return { start: formatDate(start), end: formatDate(end) };
}

function getAmount(item: PremiumPlanItem): number {
    return item.annual_premium ?? item.premium ?? item.amount ?? 0;
}

function getName(item: PremiumPlanItem): string {
    return item.policy_name || item.product || "保单";
}

function getCompany(item: PremiumPlanItem): string {
    return item.company || item.insurer || "";
}

function getOwner(item: PremiumPlanItem): string {
    return item.owner || "";
}

function isPaid(item: PremiumPlanItem): boolean {
    return item.paid_this_year === true;
}

function getGroupKey(month: number): string {
    if (month === 6 || month === 7) return "6-7";
    if (month >= 8 && month <= 10) return "8-10";
    return String(month);
}

function getGroupLabel(key: string): string {
    if (key === "6-7") return "6-7 月";
    if (key === "8-10") return "8-10 月";
    return `${key} 月`;
}

function getGroupOrder(key: string): number {
    if (key === "6-7") return 6.5;
    if (key === "8-10") return 9;
    return Number(key);
}

// =====================================================
// 组件
// =====================================================

export default function InsurancePaymentTimeline({
    data,
    currentYear,
}: Props) {

    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [loadingId, setLoadingId] = useState<string | null>(null);

    const allItems = useMemo(
        () => toArray<PremiumPlanItem>(data),
        [data]
    );

    const initialPaid = useMemo(() => {
        const set = new Set<string>();
        for (const item of allItems) {
            const id = getPolicyId(item);
            if (id && item.paid_this_year === true) set.add(id);
        }
        return set;
    }, [allItems]);

    const [paidSet, setPaidSet] = useState<Set<string>>(initialPaid);

    React.useEffect(() => {
        setPaidSet(initialPaid);
    }, [initialPaid]);

    // =================================================
    // 顶部统计
    // =================================================

    const stats = useMemo(() => {
        let total = 0, paid = 0, remain = 0;
        for (const item of allItems) {
            const id = getPolicyId(item);
            const amount = getAmount(item);
            const done = id
                ? paidSet.has(id) || isPaid(item)
                : isPaid(item);
            total += amount;
            if (done) paid += amount;
            else remain += amount;
        }
        return { total, paid, remain };
    }, [allItems, paidSet]);

    // =================================================
    // 分组
    // =================================================

    const groups = useMemo(() => {

        const valid = allItems
            .map((item) => {
                const date = getDate(item, currentYear);
                return date ? { item, date } : null;
            })
            .filter(Boolean) as { item: PremiumPlanItem; date: Date }[];

        const map = new Map<
            string,
            { month: number; items: PremiumPlanItem[]; date: Date }
        >();

        for (const { item, date } of valid) {
            const month = date.getMonth() + 1;
            const key = getGroupKey(month);
            if (!map.has(key)) {
                map.set(key, { month, items: [], date });
            }
            map.get(key)!.items.push(item);
        }

        const list = Array.from(map.entries()).map(([key, value]) => {
            const range = getDeadlineRange(value.date);
            return {
                key,
                label: getGroupLabel(key),
                order: getGroupOrder(key),
                items: value.items,
                total: value.items.reduce((s, it) => s + getAmount(it), 0),
                range,
            };
        });

        list.sort((a, b) => a.order - b.order);
        return list;

    }, [allItems, currentYear]);

    // =================================================
    // 勾选 / 取消勾选
    // =================================================

    async function handleToggle(item: PremiumPlanItem) {
        const id = getPolicyId(item);
        if (!id) {
            alert("这条保单缺少 policy_id，无法标记");
            return;
        }

        const nextPaid = !(paidSet.has(id) || isPaid(item));
        setLoadingId(id);

        setPaidSet((prev) => {
            const next = new Set(prev);
            if (nextPaid) next.add(id);
            else next.delete(id);
            return next;
        });

        try {
            if (nextPaid) {
                const { error } = await supabase
                    .from("insurance_paid_this_year")
                    .upsert(
                        { policy_id: id, year: currentYear },
                        { onConflict: "policy_id,year" }
                    );
                if (error) {
                    console.error("toggle error:", {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code,
                    });
                    throw new Error(
                        `${error.message} | ${error.details ?? ""} | ${error.hint ?? ""}`
                    );
                }
            } else {
                const { error } = await supabase
                    .from("insurance_paid_this_year")
                    .delete()
                    .eq("policy_id", id)
                    .eq("year", currentYear);
                if (error) {
                    console.error("toggle error:", {
                        message: error.message,
                        details: error.details,
                        hint: error.hint,
                        code: error.code,
                    });
                    throw new Error(
                        `${error.message} | ${error.details ?? ""} | ${error.hint ?? ""}`
                    );
                }
            }

            startTransition(() => {
                router.refresh();
            });
        } catch (err: any) {
            console.error("handleToggle failed:", err);
            alert("操作失败：\n" + (err?.message ?? JSON.stringify(err)));

            setPaidSet((prev) => {
                const next = new Set(prev);
                if (nextPaid) next.delete(id);
                else next.add(id);
                return next;
            });
        } finally {
            setLoadingId(null);
        }
    }

    // =================================================
    // 渲染
    // =================================================

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">

            <div className="flex items-start justify-between mb-6">
                <div>
                    <h2 className="text-xl font-bold text-gray-900">
                        今年{currentYear} 缴费时间表
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                        勾选表示今年已交；缴费日期后 2 个月内都可以缴费
                    </p>
                </div>
            </div>

            {/* 顶部统计 */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-gray-50 rounded-xl p-4">
                    <div className="text-xs text-gray-500">今年应缴</div>
                    <div className="text-xl font-bold text-gray-900 mt-1">
                        ¥{stats.total.toLocaleString()}
                    </div>
                </div>
                <div className="bg-green-50 rounded-xl p-4">
                    <div className="text-xs text-green-700">已交</div>
                    <div className="text-xl font-bold text-green-700 mt-1">
                        ¥{stats.paid.toLocaleString()}
                    </div>
                </div>
                <div className="bg-red-50 rounded-xl p-4">
                    <div className="text-xs text-red-700">还剩要交</div>
                    <div className="text-xl font-bold text-red-700 mt-1">
                        ¥{stats.remain.toLocaleString()}
                    </div>
                </div>
            </div>

            {groups.length === 0 && (
                <div className="text-center text-gray-400 py-10">
                    暂无今年缴费计划
                </div>
            )}

            {groups.length > 0 && (
                <div className="space-y-6">
                    {groups.map((group) => (
                        <div
                            key={group.key}
                            className="border border-gray-100 rounded-xl overflow-hidden"
                        >
                            <div className="flex items-center justify-between bg-gray-50 px-4 py-3">
                                <div className="flex items-center gap-3">
                                    <span className="text-base font-semibold text-gray-900">
                                        {group.label}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                        {group.items.length} 笔
                                    </span>
                                </div>
                                <div className="flex items-center gap-6">
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500">该组合计</div>
                                        <div className="text-sm font-bold text-gray-900">
                                            ¥{group.total.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-xs text-gray-500">可缴费区间</div>
                                        <div className="text-sm font-bold text-red-600">
                                            {group.range.start} ~ {group.range.end} 都可以缴费
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 表头：保险公司 → 产品 → 缴费时间 → 勾选 → 持有人 → 金额 */}
                            <div
                                className="
                                    hidden
                                    md:grid
                                    grid-cols-[0.8fr_1.4fr_1fr_60px_0.8fr_0.8fr]
                                    gap-4
                                    px-4
                                    py-2
                                    bg-white
                                    border-b
                                    border-gray-100
                                    text-xs
                                    font-medium
                                    text-gray-400
                                "
                            >
                                <div>保险公司</div>
                                <div>产品</div>
                                <div>缴费时间</div>
                                <div className="text-center">已交</div>
                                <div>持有人</div>
                                <div className="text-right">金额</div>
                            </div>

                            <div className="divide-y divide-gray-100">
                                {group.items.map((item, idx) => {
                                    const date = getDate(item, currentYear);
                                    const range = date ? getDeadlineRange(date) : null;
                                    const id = getPolicyId(item);
                                    const loading = loadingId === id;
                                    const checked = id
                                        ? paidSet.has(id) || isPaid(item)
                                        : isPaid(item);

                                    return (
                                        <div
                                            key={id ?? idx}
                                            className={`
                                                grid
                                                grid-cols-1
                                                md:grid-cols-[0.8fr_1.4fr_1fr_60px_0.8fr_0.8fr]
                                                gap-2
                                                md:gap-4
                                                px-4
                                                py-3
                                                items-center
                                                ${checked ? "bg-green-50/40" : ""}
                                            `}
                                        >
                                            {/* 保险公司 */}
                                            <div
                                                className={`text-sm truncate ${
                                                    checked ? "text-gray-400" : "text-gray-700"
                                                }`}
                                            >
                                                {getCompany(item) || "-"}
                                            </div>

                                            {/* 产品 */}
                                            <div
                                                className={`text-sm font-medium truncate ${
                                                    checked
                                                        ? "text-gray-400 line-through"
                                                        : "text-gray-900"
                                                }`}
                                            >
                                                {getName(item)}
                                            </div>

                                            {/* 缴费时间 */}
                                            <div
                                                className={`text-sm ${
                                                    checked ? "text-gray-400" : "text-gray-700"
                                                }`}
                                            >
                                                {range
                                                    ? `${range.start} ~ ${range.end} 都可以缴费`
                                                    : "-"}
                                            </div>

                                            {/* 勾选框（挪到这里） */}
                                            <div className="flex justify-center">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={loading || isPending}
                                                    onChange={() => handleToggle(item)}
                                                    className="w-4 h-4 cursor-pointer accent-green-600"
                                                />
                                            </div>

                                            {/* 持有人 */}
                                            <div
                                                className={`text-sm truncate ${
                                                    checked ? "text-gray-400" : "text-gray-700"
                                                }`}
                                            >
                                                {getOwner(item) || "-"}
                                            </div>

                                            {/* 金额 */}
                                            <div
                                                className={`text-sm font-semibold md:text-right ${
                                                    checked
                                                        ? "text-gray-400 line-through"
                                                        : "text-gray-900"
                                                }`}
                                            >
                                                ¥{getAmount(item).toLocaleString()}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}