import React from "react";
import type { InsuranceCashValueMatrixRow } from "@/lib/insurance";

type Props = {
    rows: InsuranceCashValueMatrixRow[];
    years: number[];
    currentYear: number;
};

// =====================================================
// owner 分组顺序
// =====================================================

const OWNER_ORDER = ["自己", "老婆", "儿子"];

const OWNER_ALIAS: Record<string, string> = {
    "自己": "自己",
    "我": "自己",
    "本人": "自己",

    "老婆": "老婆",
    "LP": "老婆",
    "lp": "老婆",
    "太太": "老婆",
    "妻子": "老婆",

    "儿子": "儿子",
    "孩子": "儿子",
    "小孩": "儿子",
};

function normalizeOwner(owner: string): string {
    const key = String(owner ?? "").trim();
    if (!key) return "未知";
    return OWNER_ALIAS[key] ?? key;
}

function ownerRank(owner: string): number {
    const idx = OWNER_ORDER.indexOf(owner);
    return idx === -1 ? OWNER_ORDER.length : idx;
}

// =====================================================
// 工具
// =====================================================

function getValue(
    row: InsuranceCashValueMatrixRow,
    year: number
): number | null {
    const v = row.values.find(x => x.year === year);
    return v ? v.cashValue : null;
}

function getCurrentValue(
    row: InsuranceCashValueMatrixRow,
    currentYear: number
): number {
    const cur = getValue(row, currentYear);
    if (cur !== null) return cur;

    const last = row.values[row.values.length - 1];
    return last ? last.cashValue : 0;
}

function formatDelta(
    current: number | null,
    previous: number | null
): string | null {

    if (current === null) return null;
    if (previous === null) return null;

    const delta = current - previous;

    if (delta === 0) return "±0";

    const sign = delta > 0 ? "+" : "";

    return `${sign}${Math.round(delta).toLocaleString()}`;
}

// =====================================================
// 主组件
// =====================================================

export default function InsuranceCashValueMatrix({
    rows,
    years,
    currentYear,
}: Props) {

    if (rows.length === 0 || years.length === 0) {
        return null;
    }

    // -----------------------------------------------
    // 分组
    // -----------------------------------------------

    const groupMap = new Map<
        string,
        InsuranceCashValueMatrixRow[]
    >();

    rows.forEach(row => {
        const owner = normalizeOwner(row.owner);
        if (!groupMap.has(owner)) {
            groupMap.set(owner, []);
        }
        groupMap.get(owner)!.push(row);
    });

    const groups = Array.from(groupMap.entries())
        .map(([owner, list]) => {

            const sorted = [...list].sort(
                (a, b) =>
                    getCurrentValue(b, currentYear) -
                    getCurrentValue(a, currentYear)
            );

            return { owner, rows: sorted };

        })
        .sort(
            (a, b) =>
                ownerRank(a.owner) - ownerRank(b.owner)
        );

    // -----------------------------------------------
    // 渲染
    // -----------------------------------------------

    return (
        <div className="bg-white rounded-xl shadow p-4 overflow-x-auto">

            <h2 className="text-lg font-semibold mb-4 text-gray-900">
                保单现金价值（按年份）
            </h2>

            <table className="min-w-full text-sm border-separate border-spacing-0">

                <colgroup>

                    <col style={{ width: "220px", minWidth: "220px" }} />

                    {years.map(y => (
                        <col
                            key={y}
                            style={{ width: "120px", minWidth: "120px" }}
                        />
                    ))}

                </colgroup>

                <thead className="sticky top-0 z-20 bg-white">

                    <tr className="border-b">

                        <th className="text-left p-2 bg-white sticky left-0 z-30 whitespace-nowrap">
                            保单
                        </th>

                        {years.map(y => (
                            <th
                                key={y}
                                className={`
                                    text-right p-2 whitespace-nowrap bg-white
                                    ${y === currentYear
                                        ? "text-blue-600 font-semibold"
                                        : "text-gray-500"}
                                `}
                            >
                                {y}
                            </th>
                        ))}

                    </tr>

                </thead>

                <tbody>

                    {groups.map(group => {

                        // ---------------------------------
                        // 该组每年实际缴费
                        // ---------------------------------

                        const paidByYear: Record<number, number> = {};

                        years.forEach(y => {
                            paidByYear[y] = group.rows.reduce(
                                (sum, row) => {
                                    const p = row.paidByYear.find(
                                        x => x.year === y
                                    );
                                    return sum + (p ? p.amount : 0);
                                },
                                0
                            );
                        });

                        // ---------------------------------
                        // 该组每年计划应缴
                        // ---------------------------------

                        const plannedByYear: Record<number, number> = {};

                        years.forEach(y => {
                            plannedByYear[y] = group.rows.reduce(
                                (sum, row) => {
                                    const p = row.plannedByYear.find(
                                        x => x.year === y
                                    );
                                    return sum + (p ? p.amount : 0);
                                },
                                0
                            );
                        });

                        // ---------------------------------
                        // 该组每年现金价值合计
                        // ---------------------------------

                        const totalsByYear: Record<number, number> = {};

                        years.forEach(y => {
                            totalsByYear[y] = group.rows.reduce(
                                (sum, row) => {
                                    const v = getValue(row, y);
                                    return sum + (v ?? 0);
                                },
                                0
                            );
                        });

                        const groupGrandTotal =
                            group.rows.reduce(
                                (sum, row) =>
                                    sum + getCurrentValue(row, currentYear),
                                0
                            );

                        return (

                            <React.Fragment key={group.owner}>

                                {/* -----------------------------
                                    组标题行
                                ----------------------------- */}

                                <tr>
                                    <td
                                        colSpan={years.length + 1}
                                        className="
                                            pt-6 pb-1 px-2
                                            bg-white
                                            sticky left-0
                                        "
                                    >
                                        <div className="flex items-baseline justify-between">

                                            <div className="text-base font-semibold text-gray-900">
                                                {group.owner}
                                                <span className="text-xs text-gray-400 ml-2">
                                                    {group.rows.length} 张保单
                                                </span>
                                            </div>

                                            <div className="text-xs text-gray-500">
                                                {currentYear} 年现金价值：
                                                <span className="text-gray-900 font-semibold ml-1 tabular-nums">
                                                    {Math.round(groupGrandTotal).toLocaleString()}
                                                </span>
                                            </div>

                                        </div>
                                    </td>
                                </tr>

                                {/* -----------------------------
                                    每年缴费行
                                    实缴优先，无实缴用计划
                                ----------------------------- */}

                                <tr className="bg-white">

                                    <td className="p-2 sticky left-0 bg-white z-10 whitespace-nowrap text-xs text-gray-500">
                                        年缴
                                    </td>

                                    {years.map(y => {

                                        const paid = paidByYear[y];
                                        const planned = plannedByYear[y];

                                        const display =
                                            paid > 0
                                                ? paid
                                                : (planned > 0 ? planned : 0);

                                        const isPlanned =
                                            paid <= 0 && planned > 0;

                                        return (
                                            <td
                                                key={y}
                                                className={`
                                                    text-right p-2 tabular-nums whitespace-nowrap
                                                    text-xs font-medium
                                                    ${isPlanned
                                                        ? "text-orange-300"
                                                        : "text-orange-500"}
                                                `}
                                            >
                                                {display > 0
                                                    ? Math.round(display).toLocaleString()
                                                    : "—"}
                                            </td>
                                        );

                                    })}

                                </tr>

                                {/* -----------------------------
                                    保单行
                                ----------------------------- */}

                                {group.rows.map(row => (

                                    <tr
                                        key={row.policyId}
                                        className="border-b hover:bg-gray-50"
                                    >

                                        <td className="p-2 sticky left-0 bg-white z-10 whitespace-nowrap">

                                            <div className="font-medium text-gray-900">
                                                {row.policyName}
                                            </div>

                                            <div className="text-xs text-gray-400">
                                                {row.company || "—"}
                                            </div>

                                        </td>

                                        {years.map((y, idx) => {

                                            const v = getValue(row, y);

                                            const prevYear =
                                                idx > 0
                                                    ? years[idx - 1]
                                                    : null;

                                            const prev =
                                                prevYear !== null
                                                    ? getValue(row, prevYear)
                                                    : null;

                                            const delta =
                                                formatDelta(v, prev);

                                            return (
                                                <td
                                                    key={y}
                                                    className={`
                                                        text-right p-2 tabular-nums whitespace-nowrap align-top
                                                        ${y === currentYear
                                                            ? "bg-blue-50"
                                                            : ""}
                                                    `}
                                                >

                                                    <div>
                                                        {v !== null
                                                            ? Math.round(v).toLocaleString()
                                                            : "—"}
                                                    </div>

                                                    {delta !== null && (
                                                        <div
                                                            className={`
                                                                text-xs mt-0.5
                                                                ${delta.startsWith("+")
                                                                    ? "text-green-600"
                                                                    : delta.startsWith("-")
                                                                        ? "text-red-500"
                                                                        : "text-gray-400"}
                                                            `}
                                                        >
                                                            {delta}
                                                        </div>
                                                    )}

                                                </td>
                                            );

                                        })}

                                    </tr>

                                ))}

                                {/* -----------------------------
                                    小计行
                                ----------------------------- */}

                                <tr className="border-t-2 border-gray-200 bg-gray-50 font-semibold">

                                    <td className="p-2 sticky left-0 bg-gray-50 z-10 whitespace-nowrap text-gray-700">
                                        小计
                                    </td>

                                    {years.map((y, idx) => {

                                        const total =
                                            totalsByYear[y] ?? 0;

                                        const prevYear =
                                            idx > 0
                                                ? years[idx - 1]
                                                : null;

                                        const prevTotal =
                                            prevYear !== null
                                                ? (totalsByYear[prevYear] ?? 0)
                                                : null;

                                        const delta =
                                            prevTotal !== null
                                                ? total - prevTotal
                                                : null;

                                        const deltaText =
                                            delta === null
                                                ? null
                                                : delta === 0
                                                    ? "±0"
                                                    : `${delta > 0 ? "+" : ""}${Math.round(delta).toLocaleString()}`;

                                        return (
                                            <td
                                                key={y}
                                                className={`
                                                    text-right p-2 tabular-nums whitespace-nowrap align-top
                                                    ${y === currentYear
                                                        ? "text-blue-600"
                                                        : "text-gray-700"}
                                                `}
                                            >

                                                <div>
                                                    {total > 0
                                                        ? Math.round(total).toLocaleString()
                                                        : "—"}
                                                </div>

                                                {deltaText !== null && (
                                                    <div
                                                        className={`
                                                            text-xs mt-0.5 font-normal
                                                            ${deltaText.startsWith("+")
                                                                ? "text-green-600"
                                                                : deltaText.startsWith("-")
                                                                    ? "text-red-500"
                                                                    : "text-gray-400"}
                                                        `}
                                                    >
                                                        {deltaText}
                                                    </div>
                                                )}

                                            </td>
                                        );

                                    })}

                                </tr>

                            </React.Fragment>

                        );

                    })}

                </tbody>

            </table>

        </div>
    );

}