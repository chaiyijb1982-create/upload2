"use client";

import { useEffect, useMemo, useState } from "react";
import { getInsuranceSummary } from "@/lib/insurance";


// =====================================================
// 类型
// =====================================================

type AnyRecord = Record<string, any>;


// =====================================================
// 工具
// =====================================================

function toNumber(value: any): number {

    const n = Number(value);

    if (!Number.isFinite(n)) {
        return 0;
    }

    return n;

}


// =====================================================
// 金额格式
// =====================================================

function money(value: any): string {

    const n = toNumber(value);

    return n.toLocaleString(
        "zh-CN",
        {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
        }
    );

}


// =====================================================
// 万元格式
// =====================================================

function moneyWan(value: any): string {

    const n =
        toNumber(value) / 10000;

    return n.toLocaleString(
        "zh-CN",
        {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }
    );

}


// =====================================================
// 百分比
// =====================================================

function percent(value: any): string {

    return toNumber(value).toLocaleString(
        "zh-CN",
        {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1
        }
    );

}


// =====================================================
// Metric
// =====================================================

function Metric({
    title,
    value,
    subtitle,
    color = "gray"
}: {
    title: string;
    value: string;
    subtitle?: string;
    color?: "gray" | "blue" | "green" | "orange" | "red";
}) {

    const colorClass: Record<string, string> = {

        gray:
            "text-gray-900",

        blue:
            "text-blue-600",

        green:
            "text-green-600",

        orange:
            "text-orange-600",

        red:
            "text-red-600"

    };


    return (

        <div
            className="
                bg-white
                rounded-2xl
                border
                border-gray-100
                shadow-sm
                p-5
            "
        >

            <div
                className="
                    text-sm
                    text-gray-500
                    mb-2
                "
            >
                {title}
            </div>


            <div
                className={`
                    text-2xl
                    font-bold
                    ${colorClass[color]}
                `}
            >
                {value}
            </div>


            {
                subtitle && (

                    <div
                        className="
                            text-xs
                            text-gray-400
                            mt-2
                        "
                    >
                        {subtitle}
                    </div>

                )
            }

        </div>

    );

}


// =====================================================
// Financial Freedom
// =====================================================

export default function FinancialFreedom({
    data
}: {
    data?: AnyRecord;
}) {


    // =================================================
    // 保险数据
    // =================================================

    const [insuranceData, setInsuranceData] =
        useState<AnyRecord | null>(null);


    const [loading, setLoading] =
        useState(true);


    // =================================================
    // 模拟参数
    // =================================================

    const [returnRate, setReturnRate] =
        useState(5);


    const [expenseGrowth, setExpenseGrowth] =
        useState(3);


    // =================================================
    // 读取保险 Summary
    // =================================================

    useEffect(
        () => {

            let cancelled = false;


            async function loadInsurance() {

                try {

                    setLoading(true);


                    const summary =
                        await getInsuranceSummary();


                    if (cancelled) {
                        return;
                    }


                    console.log(
                        "========================================"
                    );

                    console.log(
                        "FINANCIAL FREEDOM INSURANCE SUMMARY"
                    );

                    console.log(
                        "========================================"
                    );

                   console.log(
  "保单数量:",
  summary?.count ?? "-"
);

console.log(
  "总保费:",
  summary?.premiumTotal
);

console.log(
  "累计实际已缴:",
  summary?.paidPremium
);

console.log(
  "累计未缴:",
  summary?.unpaidPremium
);

console.log(
  "完成率:",
  summary?.premiumProgress
);

console.log(
  "当前现金价值:",
  summary?.cashValue ??
  summary?.todayCashValue
);

console.log(
  "家庭现金价值:",
  summary?.cashValue
);

console.log(
  "年领取:",
  summary?.annualIncome ??
  summary?.totalAnnualPension
);

console.log(
  "月领取:",
  summary?.monthlyIncome ??
  summary?.totalMonthlyPension
);

                    console.log(
                        "========================================"
                    );


                    setInsuranceData(
                        summary || {}
                    );

                }
                catch (error) {

                    console.error(
                        "FinancialFreedom insurance error:",
                        error
                    );


                    if (!cancelled) {

                        setInsuranceData({});

                    }

                }
                finally {

                    if (!cancelled) {

                        setLoading(false);

                    }

                }

            }


            loadInsurance();


            return () => {

                cancelled = true;

            };

        },
        []
    );


    // =================================================
    // 大陆资产
    // =================================================

    const mainlandAsset =
        toNumber(
            data?.mainlandAsset ??
            data?.chinaAsset ??
            data?.assets?.mainland ??
            0
        );


    // =================================================
    // 香港资产
    // =================================================

    const hkAsset =
        toNumber(
            data?.hkAsset ??
            data?.hongKongAsset ??
            data?.assets?.hk ??
            0
        );


    // =================================================
    // 原始金融资产
    //
    // 大陆 + 香港
    // =================================================

    const financialAsset =
        mainlandAsset +
        hkAsset;


    // =================================================
    // 年收入
    // =================================================

    const annualIncome =
        toNumber(
            data?.annualIncome ??
            data?.income ??
            data?.salary ??
            0
        );


    // =================================================
    // 年支出
    // =================================================

    const annualExpense =
        toNumber(
            data?.annualExpense ??
            data?.expense ??
            data?.livingExpense ??
            0
        );


    // =================================================
    // 保险总保费
    // =================================================

    const insurancePremiumTotal =
        toNumber(
            insuranceData?.premiumTotal ??
            insuranceData?.totalPremium ??
            0
        );


    // =================================================
    // ★★★ 实际已缴保险 ★★★
    //
    // 绝对使用 insurance.ts 返回的
    //
    // paidPremium
    //
    // 例如：
    //
    // 2,554,000
    // =================================================

    const insurancePaid =
        toNumber(
            insuranceData?.paidPremium ??
            0
        );


    // =================================================
    // 保险未缴
    // =================================================

    const insuranceUnpaid =
        toNumber(
            insuranceData?.unpaidPremium ??
            Math.max(
                insurancePremiumTotal -
                insurancePaid,
                0
            )
        );


    // =================================================
    // 保险完成率
    // =================================================

    const insuranceProgress =
        insuranceData?.premiumProgress !== undefined
            ?
            toNumber(
                insuranceData.premiumProgress
            )
            :
            insurancePremiumTotal > 0
                ?
                (
                    insurancePaid /
                    insurancePremiumTotal
                ) *
                100
                :
                0;


    // =================================================
    // ★★★ 保险当前现金价值 ★★★
    //
    // insurance.ts：
    //
    // 当前现金价值 = 930533.58
    // =================================================

    const insuranceCashValue =
        toNumber(
            insuranceData?.cashValue ??
            insuranceData?.todayCashValue ??
            0
        );


    // =================================================
    // ★★★ 家庭现金价值 ★★★
    // =================================================

    const familyCashValue =
        insuranceData?.familyCashValue ??
        insuranceData?.cashValueByOwner ??
        {};


    // =================================================
    // 自己现金价值
    // =================================================

    const selfCashValue =
        toNumber(
            familyCashValue?.["自己"] ??
            familyCashValue?.self ??
            0
        );


    // =================================================
    // 老婆现金价值
    // =================================================

    const wifeCashValue =
        toNumber(
            familyCashValue?.["老婆"] ??
            familyCashValue?.wife ??
            0
        );


    // =================================================
    // 儿子现金价值
    //
    // 你的当前数据：
    //
    // 103109.85
    // =================================================

    const sonCashValue =
        toNumber(
            familyCashValue?.["儿子"] ??
            familyCashValue?.son ??
            0
        );


    // =================================================
    // ★★★ 核心总资产 ★★★
    //
    // 大陆资产
    // +
    // 香港资产
    // +
    // 保险当前现金价值
    //
    // 注意：
    //
    // 已缴保费 255.4 万
    // 不是再加一次资产
    //
    // 因为真正属于当前资产的是：
    //
    // insuranceCashValue
    // =================================================

    const totalAsset =
        financialAsset +
        insuranceCashValue;


    // =================================================
    // 保险年领取
    // =================================================

    const annualPension =
        toNumber(
            insuranceData?.annualIncome ??
            insuranceData?.totalAnnualPension ??
            0
        );


    // =================================================
    // 保险月领取
    // =================================================

    const monthlyPension =
        toNumber(
            insuranceData?.monthlyIncome ??
            insuranceData?.totalMonthlyPension ??
            0
        );


    // =================================================
    // ★★★ 强制调试日志 ★★★
    // =================================================

    useEffect(
        () => {

            if (loading) {
                return;
            }


            console.log(
                "========================================"
            );

            console.log(
                "FINANCIAL FREEDOM ASSET CALCULATION"
            );

            console.log(
                "========================================"
            );

            console.log(
                "大陆资产:",
                mainlandAsset
            );

            console.log(
                "香港资产:",
                hkAsset
            );

            console.log(
                "大陆 + 香港:",
                financialAsset
            );

            console.log(
                "保险当前现金价值:",
                insuranceCashValue
            );

            console.log(
                "自己现金价值:",
                selfCashValue
            );

            console.log(
                "老婆现金价值:",
                wifeCashValue
            );

            console.log(
                "儿子现金价值:",
                sonCashValue
            );

            console.log(
                "保险累计实际已缴:",
                insurancePaid
            );

            console.log(
                "========================================"
            );

            console.log(
                "最终总资产:",
                totalAsset
            );

            console.log(
                "========================================"
            );

        },
        [
            loading,
            mainlandAsset,
            hkAsset,
            financialAsset,
            insuranceCashValue,
            selfCashValue,
            wifeCashValue,
            sonCashValue,
            insurancePaid,
            totalAsset
        ]
    );


    // =================================================
    // 财务自由倍数
    // =================================================

    const freedomMultiple =
        annualExpense > 0
            ?
            totalAsset /
            annualExpense
            :
            0;


    // =================================================
    // 4% 法则
    // =================================================

    const fourPercentAnnualIncome =
        totalAsset *
        0.04;


    const fourPercentMonthlyIncome =
        fourPercentAnnualIncome /
        12;


    const fourPercentGap =
        fourPercentAnnualIncome -
        annualExpense;


    // =================================================
    // 被动收入
    // =================================================

    const passiveIncome =
        annualPension +
        fourPercentAnnualIncome;


    // =================================================
    // 被动收入覆盖率
    // =================================================

    const passiveIncomeCoverage =
        annualExpense > 0
            ?
            (
                passiveIncome /
                annualExpense
            ) *
            100
            :
            0;


    // =================================================
    // 模拟
    // =================================================

    const simulationYears = 16;


    const simulation =
        useMemo(
            () => {

                const rows: AnyRecord[] = [];


                let assets =
                    totalAsset;


                let expense =
                    annualExpense;


                for (
                    let i = 0;
                    i <= simulationYears;
                    i++
                ) {

                    const year =
                        new Date().getFullYear() +
                        i;


                    const beginningAssets =
                        assets;


                    const investmentIncome =
                        beginningAssets *
                        (
                            returnRate /
                            100
                        );


                    const pension =
                        annualPension;


                    const netCashflow =
                        investmentIncome +
                        pension -
                        expense;


                    const endingAssets =
                        Math.max(
                            beginningAssets +
                            netCashflow,
                            0
                        );


                    rows.push({

                        year,

                        beginningAssets,

                        assets: endingAssets,

                        expense,

                        investmentIncome,

                        pension,

                        netCashflow

                    });


                    assets =
                        endingAssets;


                    expense =
                        expense *
                        (
                            1 +
                            expenseGrowth /
                            100
                        );

                }


                return rows;

            },
            [
                totalAsset,
                annualExpense,
                annualPension,
                returnRate,
                expenseGrowth
            ]
        );


    // =================================================
    // 最终模拟资产
    // =================================================

    const finalSimulation =
        simulation[
            simulation.length - 1
        ];


    const projected2042 =
        toNumber(
            finalSimulation?.assets
        );


    // =================================================
    // 财务自由状态
    // =================================================

    const isFinancialFree =
        annualExpense > 0 &&
        passiveIncome >= annualExpense;


    const statusText =
        isFinancialFree
            ?
            "已达到财务自由"
            :
            "继续积累";


    const statusColor =
        isFinancialFree
            ?
            "green"
            :
            "orange";


    // =================================================
    // Loading
    // =================================================

    if (
        loading &&
        !insuranceData
    ) {

        return (

            <div
                className="
                    mt-8
                    bg-white
                    rounded-2xl
                    border
                    border-gray-100
                    shadow-sm
                    p-6
                "
            >

                <div
                    className="
                        text-lg
                        font-bold
                        text-gray-900
                    "
                >
                    财务自由分析
                </div>


                <div
                    className="
                        text-sm
                        text-gray-400
                        mt-2
                    "
                >
                    正在读取保险及财富数据……
                </div>

            </div>

        );

    }


    // =================================================
    // 页面
    // =================================================

    return (

        <div
            className="
                mt-8
                space-y-6
            "
        >


            {/* =================================================
                标题
            ================================================= */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    border
                    border-gray-100
                    shadow-sm
                    p-6
                "
            >

                <div
                    className="
                        flex
                        items-center
                        justify-between
                        gap-4
                    "
                >

                    <div>

                        <h2
                            className="
                                text-2xl
                                font-bold
                                text-gray-900
                            "
                        >
                            财务自由
                        </h2>


                        <p
                            className="
                                text-sm
                                text-gray-500
                                mt-1
                            "
                        >
                            大陆资产 + 香港资产 + 保险现金价值
                        </p>

                    </div>


                    <div
                        className={`
                            px-4
                            py-2
                            rounded-xl
                            text-sm
                            font-bold
                            ${
                                statusColor === "green"
                                    ?
                                    "bg-green-100 text-green-700"
                                    :
                                    "bg-orange-100 text-orange-700"
                            }
                        `}
                    >
                        {statusText}
                    </div>

                </div>

            </div>


            {/* =================================================
                ★★★ 核心资产明细 ★★★
            ================================================= */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    border
                    border-gray-100
                    shadow-sm
                    p-5
                "
            >

                <div className="mb-5">

                    <h3
                        className="
                            text-xl
                            font-bold
                            text-gray-900
                        "
                    >
                        家庭财富总览
                    </h3>


                    <p
                        className="
                            text-sm
                            text-gray-500
                            mt-1
                        "
                    >
                        当前总资产由大陆、香港及保险当前现金价值组成
                    </p>

                </div>


                <div
                    className="
                        grid
                        grid-cols-1
                        md:grid-cols-2
                        xl:grid-cols-4
                        gap-4
                    "
                >

                    {/* 当前总资产 */}

                    <Metric
                        title="当前总资产"
                        value={`¥ ${money(totalAsset)}`}
                        subtitle={`¥ ${moneyWan(totalAsset)} 万`}
                        color="blue"
                    />


                    {/* 大陆 */}

                    <Metric
                        title="大陆资产"
                        value={`¥ ${money(mainlandAsset)}`}
                        subtitle={`¥ ${moneyWan(mainlandAsset)} 万`}
                        color="gray"
                    />


                    {/* 香港 */}

                    <Metric
                        title="香港资产"
                        value={`¥ ${money(hkAsset)}`}
                        subtitle={`¥ ${moneyWan(hkAsset)} 万`}
                        color="gray"
                    />


                    {/* 已缴保险 */}

                    <Metric
                        title="已缴保险"
                        value={`¥ ${money(insurancePaid)}`}
                        subtitle={`¥ ${moneyWan(insurancePaid)} 万 · 实际缴费`}
                        color="green"
                    />

                </div>


                {/* 第二行 */}

                <div
                    className="
                        mt-4
                        grid
                        grid-cols-1
                        md:grid-cols-2
                        xl:grid-cols-4
                        gap-4
                    "
                >

                    <Metric
                        title="保险当前现金价值"
                        value={`¥ ${money(insuranceCashValue)}`}
                        subtitle={`¥ ${moneyWan(insuranceCashValue)} 万`}
                        color="blue"
                    />


                    <Metric
                        title="儿子现金价值"
                        value={`¥ ${money(sonCashValue)}`}
                        subtitle={`¥ ${moneyWan(sonCashValue)} 万`}
                        color="green"
                    />


                    <Metric
                        title="自己现金价值"
                        value={`¥ ${money(selfCashValue)}`}
                        subtitle={`¥ ${moneyWan(selfCashValue)} 万`}
                        color="gray"
                    />


                    <Metric
                        title="老婆现金价值"
                        value={`¥ ${money(wifeCashValue)}`}
                        subtitle={`¥ ${moneyWan(wifeCashValue)} 万`}
                        color="gray"
                    />

                </div>


                {/* 资产计算公式 */}

                <div
                    className="
                        mt-5
                        rounded-xl
                        bg-gray-50
                        border
                        border-gray-100
                        p-4
                    "
                >

                    <div
                        className="
                            text-sm
                            text-gray-500
                        "
                    >
                        当前总资产计算
                    </div>


                    <div
                        className="
                            mt-2
                            text-base
                            font-semibold
                            text-gray-800
                            overflow-x-auto
                            whitespace-nowrap
                        "
                    >

                        ¥ {money(mainlandAsset)}

                        <span className="mx-2 text-gray-300">
                            +
                        </span>

                        ¥ {money(hkAsset)}

                        <span className="mx-2 text-gray-300">
                            +
                        </span>

                        ¥ {money(insuranceCashValue)}

                        <span className="mx-2 text-gray-300">
                            =
                        </span>

                        <span className="text-blue-600">
                            ¥ {money(totalAsset)}
                        </span>

                    </div>


                    <div
                        className="
                            text-xs
                            text-gray-400
                            mt-2
                        "
                    >
                        注意：累计已缴保险 ¥ {money(insurancePaid)} 不再重复加入总资产；保险资产按当前现金价值计入。
                    </div>

                </div>

            </div>


            {/* =================================================
                财务自由核心指标
            ================================================= */}

            <div
                className="
                    grid
                    grid-cols-1
                    md:grid-cols-2
                    xl:grid-cols-4
                    gap-4
                "
            >

                <Metric
                    title="当前总资产"
                    value={`¥ ${money(totalAsset)}`}
                    subtitle={`¥ ${moneyWan(totalAsset)} 万`}
                    color="blue"
                />


                <Metric
                    title="年度生活支出"
                    value={`¥ ${money(annualExpense)}`}
                    subtitle={
                        annualExpense > 0
                            ?
                            `${moneyWan(annualExpense)} 万 / 年`
                            :
                            "暂无支出数据"
                    }
                    color="orange"
                />


                <Metric
                    title="财务自由倍数"
                    value={`${freedomMultiple.toFixed(1)} 倍`}
                    subtitle="总资产 ÷ 年度支出"
                    color={
                        freedomMultiple >= 25
                            ?
                            "green"
                            :
                            "orange"
                    }
                />


                <Metric
                    title="4%法则年收入"
                    value={`¥ ${money(fourPercentAnnualIncome)}`}
                    subtitle={`约 ¥ ${moneyWan(fourPercentAnnualIncome)} 万 / 年`}
                    color="green"
                />

            </div>


            {/* =================================================
                保险资金情况
            ================================================= */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    border
                    border-gray-100
                    shadow-sm
                    p-5
                "
            >

                <div
                    className="
                        flex
                        items-center
                        justify-between
                        gap-4
                        mb-5
                    "
                >

                    <div>

                        <h3
                            className="
                                text-xl
                                font-bold
                                text-gray-900
                            "
                        >
                            保险资金情况
                        </h3>


                        <p
                            className="
                                text-sm
                                text-gray-500
                                mt-1
                            "
                        >
                            已缴金额严格采用 insurance_premium_records 实际缴费记录
                        </p>

                    </div>


                    <div
                        className="
                            px-3
                            py-1.5
                            rounded-lg
                            bg-blue-50
                            text-blue-700
                            text-xs
                            font-semibold
                        "
                    >
                        实际缴费口径
                    </div>

                </div>


                <div
                    className="
                        grid
                        grid-cols-1
                        md:grid-cols-2
                        xl:grid-cols-4
                        gap-4
                    "
                >

                    <Metric
                        title="保险总保费"
                        value={`¥ ${money(insurancePremiumTotal)}`}
                        subtitle={`¥ ${moneyWan(insurancePremiumTotal)} 万`}
                        color="gray"
                    />


                    <Metric
                        title="累计实际已缴"
                        value={`¥ ${money(insurancePaid)}`}
                        subtitle={`¥ ${moneyWan(insurancePaid)} 万`}
                        color="green"
                    />


                    <Metric
                        title="累计未缴"
                        value={`¥ ${money(insuranceUnpaid)}`}
                        subtitle={`¥ ${moneyWan(insuranceUnpaid)} 万`}
                        color="orange"
                    />


                    <Metric
                        title="保险缴费完成率"
                        value={`${percent(insuranceProgress)}%`}
                        subtitle="实际已缴 ÷ 总保费"
                        color="blue"
                    />

                </div>


                <div
                    className="
                        mt-5
                        rounded-xl
                        bg-gray-50
                        border
                        border-gray-100
                        p-4
                    "
                >

                    <div
                        className="
                            flex
                            flex-wrap
                            items-center
                            gap-x-6
                            gap-y-2
                            text-sm
                        "
                    >

                        <span className="text-gray-500">
                            当前累计实际已缴
                        </span>


                        <span
                            className="
                                text-lg
                                font-bold
                                text-green-600
                            "
                        >
                            ¥ {money(insurancePaid)}
                        </span>


                        <span className="text-gray-300">
                            =
                        </span>


                        <span className="text-gray-500">
                            {moneyWan(insurancePaid)} 万
                        </span>

                    </div>


                    <div
                        className="
                            text-xs
                            text-gray-400
                            mt-2
                        "
                    >
                        数据来源：insurance_premium_records.amount
                    </div>

                </div>

            </div>


            {/* =================================================
                收入覆盖
            ================================================= */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    border
                    border-gray-100
                    shadow-sm
                    p-5
                "
            >

                <h3
                    className="
                        text-xl
                        font-bold
                        text-gray-900
                    "
                >
                    财务自由收入覆盖
                </h3>


                <p
                    className="
                        text-sm
                        text-gray-500
                        mt-1
                    "
                >
                    4%资产收入 + 保险领取收入，对年度生活支出的覆盖程度
                </p>


                <div
                    className="
                        mt-5
                        grid
                        grid-cols-1
                        md:grid-cols-2
                        xl:grid-cols-4
                        gap-4
                    "
                >

                    <Metric
                        title="4%资产收入"
                        value={`¥ ${money(fourPercentAnnualIncome)}`}
                        subtitle="按当前总资产计算"
                        color="blue"
                    />


                    <Metric
                        title="保险年领取"
                        value={`¥ ${money(annualPension)}`}
                        subtitle={
                            monthlyPension > 0
                                ?
                                `约 ¥ ${money(monthlyPension)} / 月`
                                :
                                "当前暂无年领取数据"
                        }
                        color="green"
                    />


                    <Metric
                        title="预计被动收入"
                        value={`¥ ${money(passiveIncome)}`}
                        subtitle={`¥ ${moneyWan(passiveIncome)} 万 / 年`}
                        color="green"
                    />


                    <Metric
                        title="支出覆盖率"
                        value={`${percent(passiveIncomeCoverage)}%`}
                        subtitle={
                            passiveIncomeCoverage >= 100
                                ?
                                "已经覆盖年度支出"
                                :
                                "距离完全覆盖还有差距"
                        }
                        color={
                            passiveIncomeCoverage >= 100
                                ?
                                "green"
                                :
                                "orange"
                        }
                    />

                </div>


                {/* 覆盖进度 */}

                <div className="mt-6">

                    <div
                        className="
                            flex
                            justify-between
                            text-sm
                            mb-2
                        "
                    >

                        <span className="text-gray-500">
                            被动收入覆盖年度支出
                        </span>


                        <span
                            className="
                                font-bold
                                text-gray-800
                            "
                        >
                            {percent(passiveIncomeCoverage)}%
                        </span>

                    </div>


                    <div
                        className="
                            h-3
                            bg-gray-100
                            rounded-full
                            overflow-hidden
                        "
                    >

                        <div
                            className="
                                h-full
                                bg-green-500
                                rounded-full
                                transition-all
                            "
                            style={{
                                width:
                                    `${Math.min(
                                        passiveIncomeCoverage,
                                        100
                                    )}%`
                            }}
                        />

                    </div>

                </div>

            </div>


            {/* =================================================
                长期模拟
            ================================================= */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    border
                    border-gray-100
                    shadow-sm
                    p-5
                "
            >

                <div
                    className="
                        flex
                        items-center
                        justify-between
                        gap-4
                        mb-5
                    "
                >

                    <div>

                        <h3
                            className="
                                text-xl
                                font-bold
                                text-gray-900
                            "
                        >
                            长期财务自由模拟
                        </h3>


                        <p
                            className="
                                text-sm
                                text-gray-500
                                mt-1
                            "
                        >
                            从当前总资产开始，加入投资收益、保险领取及生活支出
                        </p>

                    </div>


                    <div
                        className="
                            text-sm
                            font-semibold
                            text-gray-600
                        "
                    >
                        {simulationYears} 年
                    </div>

                </div>


                {/* 控制 */}

                <div
                    className="
                        grid
                        grid-cols-1
                        md:grid-cols-2
                        gap-6
                        border-t
                        border-gray-100
                        pt-5
                    "
                >

                    <div>

                        <div
                            className="
                                flex
                                justify-between
                                text-sm
                                mb-2
                            "
                        >

                            <span className="text-gray-500">
                                假设年投资收益率
                            </span>


                            <span
                                className="
                                    font-bold
                                    text-blue-600
                                "
                            >
                                {returnRate}%
                            </span>

                        </div>


                        <input
                            type="range"
                            min="1"
                            max="20"
                            step="0.5"
                            value={returnRate}
                            onChange={(e) =>
                                setReturnRate(
                                    Number(
                                        e.target.value
                                    )
                                )
                            }
                            className="w-full"
                        />

                    </div>


                    <div>

                        <div
                            className="
                                flex
                                justify-between
                                text-sm
                                mb-2
                            "
                        >

                            <span className="text-gray-500">
                                年生活支出增长率
                            </span>


                            <span
                                className="
                                    font-bold
                                    text-orange-600
                                "
                            >
                                {expenseGrowth}%
                            </span>

                        </div>


                        <input
                            type="range"
                            min="0"
                            max="8"
                            step="0.5"
                            value={expenseGrowth}
                            onChange={(e) =>
                                setExpenseGrowth(
                                    Number(
                                        e.target.value
                                    )
                                )
                            }
                            className="w-full"
                        />

                    </div>

                </div>


                {/* 模拟结果 */}

                <div
                    className="
                        mt-6
                        grid
                        grid-cols-1
                        md:grid-cols-3
                        gap-4
                    "
                >

                    <Metric
                        title={`${new Date().getFullYear()} 当前资产`}
                        value={`¥ ${money(totalAsset)}`}
                        subtitle={`¥ ${moneyWan(totalAsset)} 万`}
                        color="blue"
                    />


                    <Metric
                        title={`${new Date().getFullYear() + simulationYears} 模拟资产`}
                        value={`¥ ${money(projected2042)}`}
                        subtitle={`¥ ${moneyWan(projected2042)} 万`}
                        color={
                            projected2042 >= totalAsset
                                ?
                                "green"
                                :
                                "orange"
                        }
                    />


                    <Metric
                        title="模拟收益率"
                        value={`${returnRate}%`}
                        subtitle={`支出增长 ${expenseGrowth}%`}
                        color="gray"
                    />

                </div>


                {/* 年度模拟 */}

                <div
                    className="
                        mt-6
                        overflow-x-auto
                    "
                >

                    <table
                        className="
                            w-full
                            min-w-[900px]
                            text-sm
                        "
                    >

                        <thead
                            className="
                                bg-gray-50
                                border-b
                                border-gray-200
                            "
                        >

                            <tr>

                                <th
                                    className="
                                        p-3
                                        text-left
                                        font-semibold
                                        text-gray-600
                                    "
                                >
                                    年份
                                </th>


                                <th
                                    className="
                                        p-3
                                        text-right
                                        font-semibold
                                        text-gray-600
                                    "
                                >
                                    年初资产
                                </th>


                                <th
                                    className="
                                        p-3
                                        text-right
                                        font-semibold
                                        text-gray-600
                                    "
                                >
                                    投资收益
                                </th>


                                <th
                                    className="
                                        p-3
                                        text-right
                                        font-semibold
                                        text-gray-600
                                    "
                                >
                                    保险领取
                                </th>


                                <th
                                    className="
                                        p-3
                                        text-right
                                        font-semibold
                                        text-gray-600
                                    "
                                >
                                    年支出
                                </th>


                                <th
                                    className="
                                        p-3
                                        text-right
                                        font-semibold
                                        text-gray-600
                                    "
                                >
                                    年末资产
                                </th>

                            </tr>

                        </thead>


                        <tbody>

                            {
                                simulation.map(
                                    (
                                        row
                                    ) => (

                                        <tr
                                            key={row.year}
                                            className="
                                                border-b
                                                border-gray-100
                                                last:border-b-0
                                            "
                                        >

                                            <td
                                                className="
                                                    p-3
                                                    font-semibold
                                                    text-gray-800
                                                "
                                            >
                                                {row.year}
                                            </td>


                                            <td
                                                className="
                                                    p-3
                                                    text-right
                                                "
                                            >
                                                ¥ {money(
                                                    row.beginningAssets
                                                )}
                                            </td>


                                            <td
                                                className="
                                                    p-3
                                                    text-right
                                                    text-blue-600
                                                    font-medium
                                                "
                                            >
                                                ¥ {money(
                                                    row.investmentIncome
                                                )}
                                            </td>


                                            <td
                                                className="
                                                    p-3
                                                    text-right
                                                    text-green-600
                                                    font-medium
                                                "
                                            >
                                                ¥ {money(
                                                    row.pension
                                                )}
                                            </td>


                                            <td
                                                className="
                                                    p-3
                                                    text-right
                                                    text-orange-600
                                                    font-medium
                                                "
                                            >
                                                ¥ {money(
                                                    row.expense
                                                )}
                                            </td>


                                            <td
                                                className="
                                                    p-3
                                                    text-right
                                                    font-bold
                                                    text-gray-900
                                                "
                                            >
                                                ¥ {money(
                                                    row.assets
                                                )}
                                            </td>

                                        </tr>

                                    )
                                )
                            }

                        </tbody>

                    </table>

                </div>

            </div>


            {/* =================================================
                财务自由判断
            ================================================= */}

            <div
                className={`
                    rounded-2xl
                    border
                    p-6
                    ${
                        isFinancialFree
                            ?
                            "bg-green-50 border-green-100"
                            :
                            "bg-orange-50 border-orange-100"
                    }
                `}
            >

                <div
                    className="
                        flex
                        items-center
                        justify-between
                        gap-4
                    "
                >

                    <div>

                        <div
                            className="
                                text-sm
                                font-semibold
                                text-gray-500
                            "
                        >
                            当前财务自由判断
                        </div>


                        <div
                            className="
                                text-2xl
                                font-bold
                                mt-1
                                text-gray-900
                            "
                        >
                            {statusText}
                        </div>


                        <div
                            className="
                                text-sm
                                text-gray-500
                                mt-2
                            "
                        >
                            当前被动收入覆盖率：

                            {" "}

                            <span
                                className="
                                    font-bold
                                    text-gray-800
                                "
                            >
                                {percent(
                                    passiveIncomeCoverage
                                )}%
                            </span>

                        </div>

                    </div>


                    <div className="text-right">

                        <div
                            className="
                                text-sm
                                text-gray-500
                            "
                        >
                            4%法则缺口
                        </div>


                        <div
                            className={`
                                text-xl
                                font-bold
                                mt-1
                                ${
                                    fourPercentGap >= 0
                                        ?
                                        "text-green-600"
                                        :
                                        "text-red-600"
                                }
                            `}
                        >

                            {
                                fourPercentGap >= 0
                                    ? "+"
                                    : ""
                            }

                            ¥ {money(
                                fourPercentGap
                            )}

                        </div>

                    </div>

                </div>

            </div>

        </div>

    );

}