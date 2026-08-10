"use client";

import { useState } from "react";

export default function InsurancePremiumPlan({
    data
}: any) {

    // =====================================================
    // 隐藏 / 显示：未来缴费 vs 儿子现金价值
    // =====================================================

    const [showFutureComparison, setShowFutureComparison] =
        useState(true);


    // =====================================================
    // 年度
    // =====================================================

    const year =
        Number(
            data?.year ||
            new Date().getFullYear()
        );


    // =====================================================
    // 年度汇总
    // =====================================================

    const total =
        Number(
            data?.total || 0
        );

    const paid =
        Number(
            data?.paid || 0
        );

    const unpaid =
        Number(
            data?.unpaid || 0
        );


    // =====================================================
    // 家庭成员
    // =====================================================

    const owners = [
        "自己",
        "老婆",
        "儿子"
    ];


    // =====================================================
    // 金额格式
    // =====================================================

    const money = (
        value: any
    ) => {

        const number =
            Number(
                value || 0
            );

        return number.toLocaleString(
            "zh-CN",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        );

    };


    // =====================================================
    // 日期格式
    // =====================================================

    const dateText = (
        value: any
    ) => {

        if (!value) {
            return "";
        }

        return String(
            value
        ).slice(
            0,
            10
        );

    };


    // =====================================================
    // 获取年缴保费
    // =====================================================

    const getAnnualPremium = (
        item: any
    ) => {

        return Number(
            item?.annual_premium ??
            item?.policy?.annual_premium ??
            item?.insurance?.annual_premium ??
            0
        );

    };


    // =====================================================
    // 获取现金价值
    // =====================================================

    const getCashValue = (
        item: any
    ) => {

        if (
            item?.cash_value !== undefined &&
            item?.cash_value !== null &&
            item?.cash_value !== ""
        ) {

            return Number(
                item.cash_value
            );

        }


        if (
            item?.policy?.cash_value !== undefined &&
            item?.policy?.cash_value !== null &&
            item?.policy?.cash_value !== ""
        ) {

            return Number(
                item.policy.cash_value
            );

        }


        if (
            item?.insurance?.cash_value !== undefined &&
            item?.insurance?.cash_value !== null &&
            item?.insurance?.cash_value !== ""
        ) {

            return Number(
                item.insurance.cash_value
            );

        }


        if (
            item?.cashValue !== undefined &&
            item?.cashValue !== null &&
            item?.cashValue !== ""
        ) {

            return Number(
                item.cashValue
            );

        }


        return 0;

    };


    // =====================================================
    // 获取现金价值日期
    // =====================================================

    const getCashValueDate = (
        item: any
    ) => {

        if (
            item?.cash_value_date
        ) {

            return item.cash_value_date;

        }


        if (
            item?.policy?.cash_value_date
        ) {

            return item.policy.cash_value_date;

        }


        if (
            item?.insurance?.cash_value_date
        ) {

            return item.insurance.cash_value_date;

        }


        if (
            item?.cashValueDate
        ) {

            return item.cashValueDate;

        }


        return null;

    };


    // =====================================================
    // 获取保险公司
    // =====================================================

    const getCompany = (
        item: any
    ) => {

        return (
            item?.company ||
            item?.policy?.company ||
            item?.insurance?.company ||
            "-"
        );

    };


    // =====================================================
    // 获取产品
    // =====================================================

    const getProduct = (
        item: any
    ) => {

        return (
            item?.product ||
            item?.policy?.product ||
            item?.insurance?.product ||
            "-"
        );

    };


    // =====================================================
    // 获取投保人
    // =====================================================

    const getOwner = (
        item: any
    ) => {

        return (
            item?.owner ||
            item?.policy?.owner ||
            item?.insurance?.owner ||
            ""
        );

    };


    // =====================================================
    // 数据源
    // =====================================================

    const sourceItems =
        Array.isArray(
            data?.items
        )
            ?
            data.items
            :
            Array.isArray(
                data?.policies
            )
                ?
                data.policies
                :
                [];


    // =====================================================
    // 获取已缴年份
    // =====================================================

    const getPaidYears = (
        item: any
    ) => {

        return Math.max(
            Number(
                item?.paid_years ??
                0
            ),
            0
        );

    };


    // =====================================================
    // 获取总缴费年份
    // =====================================================

    const getPayYears = (
        item: any
    ) => {

        return Math.max(
            Number(
                item?.pay_years ??
                0
            ),
            0
        );

    };


    // =====================================================
    // 获取剩余缴费年份
    // =====================================================

    const getRemainYears = (
        item: any
    ) => {

        const explicitRemain =
            item?.remain_years;

        if (
            explicitRemain !== undefined &&
            explicitRemain !== null &&
            explicitRemain !== ""
        ) {

            return Math.max(
                Number(
                    explicitRemain
                ),
                0
            );

        }


        return Math.max(
            getPayYears(item) -
            getPaidYears(item),
            0
        );

    };


    // =====================================================
    // 判断保单是否已经完成
    //
    // 例如：
    //
    // pay_years = 1
    // paid_years = 1
    //
    // => 一次缴清
    // => 已完成
    // => 不进入今年应交
    // =====================================================

    const isPolicyCompleted = (
        item: any
    ) => {

        const payYears =
            getPayYears(item);

        const paidYears =
            getPaidYears(item);


        return (
            payYears > 0 &&
            paidYears >= payYears
        );

    };


    // =====================================================
    // 父母未来全部缴费
    //
    // 自己 + 老婆
    //
    // 年缴 × 剩余缴费年份
    //
    // 已完成保单自动为 0
    // =====================================================

    const parentItems =
        sourceItems.filter(
            (item: any) =>
                ["自己", "老婆"].includes(
                    getOwner(item)
                )
        );


    const selfFuturePremium =
        parentItems
            .filter(
                (item: any) =>
                    getOwner(item) === "自己"
            )
            .reduce(
                (
                    sum: number,
                    item: any
                ) => {

                    return (
                        sum +
                        getAnnualPremium(item) *
                        getRemainYears(item)
                    );

                },
                0
            );


    const wifeFuturePremium =
        parentItems
            .filter(
                (item: any) =>
                    getOwner(item) === "老婆"
            )
            .reduce(
                (
                    sum: number,
                    item: any
                ) => {

                    return (
                        sum +
                        getAnnualPremium(item) *
                        getRemainYears(item)
                    );

                },
                0
            );


    const parentFuturePremium =
        selfFuturePremium +
        wifeFuturePremium;


    // =====================================================
    // 儿子所有保单
    // =====================================================

    const sonItems =
        sourceItems.filter(
            (item: any) =>
                getOwner(item) === "儿子"
        );


    // =====================================================
    // 儿子当前现金价值
    // =====================================================

    const sonCashValue =
        sonItems.reduce(
            (
                sum: number,
                item: any
            ) => {

                return (
                    sum +
                    getCashValue(item)
                );

            },
            0
        );


    // =====================================================
    // 儿子现金价值 - 父母未来缴费
    // =====================================================

    const futureDifference =
        sonCashValue -
        parentFuturePremium;


    // =====================================================
    // 现金价值覆盖率
    // =====================================================

    const coverageRate =
        parentFuturePremium > 0
            ?
            (
                sonCashValue /
                parentFuturePremium
            ) *
            100
            :
            0;


    // =====================================================
    // 没有数据
    // =====================================================

    if (
        sourceItems.length === 0
    ) {

        return (

            <div className="mt-8">

                <div
                    className="
                        bg-white
                        rounded-2xl
                        shadow-sm
                        border
                        border-gray-100
                        p-6
                    "
                >

                    <h2
                        className="
                            text-2xl
                            font-bold
                            text-gray-900
                        "
                    >
                        {year} 年保费计划
                    </h2>

                    <p
                        className="
                            text-sm
                            text-gray-500
                            mt-1
                        "
                    >
                        查看今年每张保单缴费状态
                    </p>

                    <div
                        className="
                            mt-5
                            text-gray-500
                        "
                    >
                        暂无今年保费计划
                    </div>

                </div>

            </div>

        );

    }


    // =====================================================
    // 页面
    // =====================================================

    return (

        <div
            className="
                mt-8
                space-y-6
            "
        >

            {/* =================================================
                年度总览
            ================================================= */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    shadow-sm
                    border
                    border-gray-100
                    p-5
                "
            >

                <div className="mb-5">

                    <h2
                        className="
                            text-2xl
                            font-bold
                            text-gray-900
                        "
                    >
                        {year} 年保费计划
                    </h2>

                    <p
                        className="
                            text-sm
                            text-gray-500
                            mt-1
                        "
                    >
                        查看今年每张保单缴费状态
                    </p>

                </div>


                <div
                    className="
                        flex
                        items-center
                        gap-12
                        overflow-x-auto
                        whitespace-nowrap
                        border-t
                        border-gray-100
                        pt-4
                    "
                >

                    {/* 今年应交 */}

                    <div
                        className="
                            flex
                            items-center
                            gap-3
                            shrink-0
                        "
                    >

                        <span className="text-sm text-gray-500">
                            今年应交
                        </span>

                        <span
                            className="
                                text-xl
                                font-bold
                                text-gray-900
                            "
                        >
                            ¥ {money(total)}
                        </span>

                    </div>


                    {/* 今年已交 */}

                    <div
                        className="
                            flex
                            items-center
                            gap-3
                            shrink-0
                        "
                    >

                        <span className="text-sm text-gray-500">
                            今年已交
                        </span>

                        <span
                            className="
                                text-xl
                                font-bold
                                text-green-600
                            "
                        >
                            ¥ {money(paid)}
                        </span>

                    </div>


                    {/* 今年待交 */}

                    <div
                        className="
                            flex
                            items-center
                            gap-3
                            shrink-0
                        "
                    >

                        <span className="text-sm text-gray-500">
                            今年待交
                        </span>

                        <span
                            className="
                                text-xl
                                font-bold
                                text-orange-600
                            "
                        >
                            ¥ {money(unpaid)}
                        </span>

                    </div>

                </div>

            </div>


            {/* =================================================
                未来缴费 vs 儿子当前现金价值
            ================================================= */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    shadow-sm
                    border
                    border-gray-100
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

                        <h2
                            className="
                                text-xl
                                font-bold
                                text-gray-900
                            "
                        >
                            未来缴费 vs 儿子当前现金价值
                        </h2>

                        <p
                            className="
                                text-sm
                                text-gray-500
                                mt-1
                            "
                        >
                            自己 + 老婆全部保单未来剩余缴费，与儿子当前全部保单现金价值对比
                        </p>

                    </div>


                    <button
                        type="button"
                        onClick={() =>
                            setShowFutureComparison(
                                !showFutureComparison
                            )
                        }
                        className="
                            shrink-0
                            px-3
                            py-1.5
                            rounded-lg
                            bg-gray-100
                            hover:bg-gray-200
                            text-sm
                            text-gray-600
                            font-medium
                            transition
                        "
                    >
                        {
                            showFutureComparison
                                ? "隐藏"
                                : "显示"
                        }
                    </button>

                </div>


                {
                    showFutureComparison && (

                        <div
                            className="
                                flex
                                items-center
                                gap-8
                                overflow-x-auto
                                whitespace-nowrap
                                border-t
                                border-gray-100
                                pt-4
                            "
                        >

                            {/* 儿子现金价值 */}

                            <div
                                className="
                                    flex
                                    items-center
                                    gap-4
                                    shrink-0
                                "
                            >

                                <span className="text-sm text-gray-500">
                                    儿子当前现金价值
                                </span>

                                <span
                                    className="
                                        text-xl
                                        font-bold
                                        text-blue-600
                                    "
                                >
                                    ¥ {money(sonCashValue)}
                                </span>

                            </div>


                            <span className="text-gray-300 shrink-0">
                                −
                            </span>


                            {/* 父母未来缴费 */}

                            <div
                                className="
                                    flex
                                    items-center
                                    gap-4
                                    shrink-0
                                "
                            >

                                <span className="text-sm text-gray-500">
                                    父母未来缴费
                                </span>

                                <span
                                    className="
                                        text-xl
                                        font-bold
                                        text-orange-600
                                    "
                                >
                                    ¥ {money(parentFuturePremium)}
                                </span>

                            </div>


                            <span className="text-gray-300 shrink-0">
                                =
                            </span>


                            {/* 差额 */}

                            <div
                                className="
                                    flex
                                    items-center
                                    gap-4
                                    shrink-0
                                "
                            >

                                <span className="text-sm text-gray-500">
                                    儿子现金价值 − 父母未来缴费
                                </span>

                                <span
                                    className={`
                                        text-xl
                                        font-bold
                                        ${
                                            futureDifference >= 0
                                                ? "text-green-600"
                                                : "text-red-600"
                                        }
                                    `}
                                >
                                    ¥ {money(futureDifference)}
                                </span>

                            </div>


                            <span className="text-gray-300 shrink-0">
                                /
                            </span>


                            {/* 覆盖率 */}

                            <div
                                className="
                                    flex
                                    items-center
                                    gap-4
                                    shrink-0
                                "
                            >

                                <span className="text-sm text-gray-500">
                                    现金价值覆盖率
                                </span>

                                <span
                                    className={`
                                        text-xl
                                        font-bold
                                        ${
                                            coverageRate >= 100
                                                ? "text-green-600"
                                                :
                                            coverageRate >= 50
                                                ? "text-orange-600"
                                                :
                                                "text-red-600"
                                        }
                                    `}
                                >
                                    {
                                        coverageRate.toLocaleString(
                                            "zh-CN",
                                            {
                                                minimumFractionDigits: 1,
                                                maximumFractionDigits: 1
                                            }
                                        )
                                    }%
                                </span>

                            </div>

                        </div>

                    )
                }

            </div>


            {/* =================================================
                家庭成员
            ================================================= */}

            {
                owners.map(
                    (
                        owner
                    ) => {

                        // =========================================
                        // 当前成员保单
                        // =========================================

                        const list =
                            sourceItems.filter(
                                (
                                    item: any
                                ) =>
                                    getOwner(item) === owner
                            );


                        if (
                            list.length === 0
                        ) {

                            return null;

                        }


                        // =========================================
                        // 今年应交
                        //
                        // 重要：
                        //
                        // 已经完成的保单
                        // 不算今年应交
                        //
                        // 例如：
                        // pay_years = 1
                        // paid_years = 1
                        //
                        // 一次缴清
                        // 不再进入今年应交
                        // =========================================

                        const ownerTotal =
                            list.reduce(
                                (
                                    sum: number,
                                    item: any
                                ) => {

                                    if (
                                        isPolicyCompleted(item)
                                    ) {

                                        return sum;

                                    }


                                    return (
                                        sum +
                                        getAnnualPremium(item)
                                    );

                                },
                                0
                            );


                        // =========================================
                        // 今年已交
                        //
                        // 已经完成的一次缴清保单
                        // 不算今年已交
                        //
                        // 例如：
                        // 增多多3号
                        // 1/1年
                        // 2026-07-27
                        //
                        // 不进入今年已交
                        // =========================================

                        const ownerPaid =
                            list.reduce(
                                (
                                    sum: number,
                                    item: any
                                ) => {

                                    // 已经完成的保单
                                    // 不算今年已交
                                    if (
                                        isPolicyCompleted(item)
                                    ) {

                                        return sum;

                                    }


                                    if (
                                        Boolean(
                                            item.current_paid
                                        )
                                    ) {

                                        return (
                                            sum +
                                            getAnnualPremium(item)
                                        );

                                    }


                                    return sum;

                                },
                                0
                            );


                        // =========================================
                        // 今年待交
                        // =========================================

                        const ownerUnpaid =
                            Math.max(
                                ownerTotal -
                                ownerPaid,
                                0
                            );


                        // =========================================
                        // 所有保单已交
                        //
                        // 年缴保费 × 已缴年份
                        // =========================================

                        const ownerAllPaid =
                            list.reduce(
                                (
                                    sum: number,
                                    item: any
                                ) => {

                                    const annual =
                                        getAnnualPremium(item);


                                    const paidYears =
                                        Math.min(
                                            getPaidYears(item),
                                            getPayYears(item) ||
                                            getPaidYears(item)
                                        );


                                    return (
                                        sum +
                                        annual *
                                        paidYears
                                    );

                                },
                                0
                            );


                        // =========================================
                        // 所有保单待交
                        //
                        // 年缴保费 × 剩余年份
                        // =========================================

                        const ownerAllUnpaid =
                            list.reduce(
                                (
                                    sum: number,
                                    item: any
                                ) => {

                                    const annual =
                                        getAnnualPremium(item);


                                    const remain =
                                        getRemainYears(item);


                                    return (
                                        sum +
                                        annual *
                                        remain
                                    );

                                },
                                0
                            );


                        // =========================================
                        // 当前成员现金价值
                        // =========================================

                        const ownerCashValue =
                            list.reduce(
                                (
                                    sum: number,
                                    item: any
                                ) => {

                                    return (
                                        sum +
                                        getCashValue(item)
                                    );

                                },
                                0
                            );


                        return (

                            <div
                                key={owner}
                                className="
                                    bg-white
                                    rounded-2xl
                                    shadow-sm
                                    border
                                    border-gray-100
                                    p-5
                                "
                            >

                                {/* =================================================
                                    成员标题

                                    左：
                                    自己
                                    4 张保单

                                    中：
                                    今年已交 / 今年应交 / 今年待交
                                    所有保单已交 / 所有保单待交

                                    右：
                                    现金价值
                                ================================================= */}

                                <div
                                    className="
                                        flex
                                        items-center
                                        gap-8
                                        mb-5
                                        min-w-0
                                    "
                                >

                                    {/* =============================================
                                        左：成员 + 保单数量

                                        mr-10：
                                        强制给左侧留出明显空间
                                    ============================================= */}

                                    <div
                                        className="
                                            flex
                                            items-center
                                            gap-4
                                            shrink-0
                                            mr-10
                                        "
                                    >

                                        <h3
                                            className="
                                                text-xl
                                                font-bold
                                                text-gray-900
                                                whitespace-nowrap
                                            "
                                        >
                                            {owner}
                                        </h3>

                                        <span
                                            className="
                                                text-sm
                                                text-gray-500
                                                whitespace-nowrap
                                            "
                                        >
                                            {list.length} 张保单
                                        </span>

                                    </div>


                                    {/* =============================================
                                        中间：缴费信息

                                        flex-1
                                        让中间区域自动占满

                                        gap-5
                                        每个项目之间保持距离
                                    ============================================= */}

                                    <div
                                        className="
                                            flex
                                            items-center
                                            gap-5
                                            text-sm
                                            whitespace-nowrap
                                            overflow-x-auto
                                            min-w-0
                                            flex-1
                                        "
                                    >

                                        {/* 今年已交 */}

                                        <span
                                            className="
                                                text-green-600
                                                font-semibold
                                                shrink-0
                                            "
                                        >
                                            今年已交 ¥{money(ownerPaid)}
                                        </span>


                                        <span
                                            className="
                                                text-gray-300
                                                shrink-0
                                            "
                                        >
                                            /
                                        </span>


                                        {/* 今年应交 */}

                                        <span
                                            className="
                                                text-gray-700
                                                font-semibold
                                                shrink-0
                                            "
                                        >
                                            今年应交 ¥{money(ownerTotal)}
                                        </span>


                                        <span
                                            className="
                                                text-gray-300
                                                shrink-0
                                            "
                                        >
                                            /
                                        </span>


                                        {/* 今年待交 */}

                                        <span
                                            className="
                                                text-orange-600
                                                font-semibold
                                                shrink-0
                                            "
                                        >
                                            今年待交 ¥{money(ownerUnpaid)}
                                        </span>


                                        <span
                                            className="
                                                text-gray-300
                                                shrink-0
                                                mx-1
                                            "
                                        >
                                            |
                                        </span>


                                        {/* 所有保单已交 */}

                                        <span
                                            className="
                                                text-green-700
                                                font-semibold
                                                shrink-0
                                            "
                                        >
                                            所有保单已交 ¥{money(ownerAllPaid)}
                                        </span>


                                        <span
                                            className="
                                                text-gray-300
                                                shrink-0
                                            "
                                        >
                                            /
                                        </span>


                                        {/* 所有保单待交 */}

                                        <span
                                            className="
                                                text-orange-700
                                                font-semibold
                                                shrink-0
                                                mr-10
                                            "
                                        >
                                            所有保单待交 ¥{money(ownerAllUnpaid)}
                                        </span>

                                    </div>


                                    {/* =============================================
                                        最右：现金价值

                                        ml-auto：
                                        强制推到最右

                                        pl-10：
                                        与前面的所有保单待交拉开距离

                                        border-left：
                                        增加视觉分区
                                    ============================================= */}

                                    <div
                                        className="
                                            ml-auto
                                            pl-10
                                            shrink-0
                                            text-right
                                            whitespace-nowrap
                                            border-l
                                            border-gray-100
                                        "
                                    >

                                        <div
                                            className="
                                                text-sm
                                                text-gray-500
                                                mb-1
                                            "
                                        >
                                            现金价值
                                        </div>

                                        <div
                                            className="
                                                text-xl
                                                font-bold
                                                text-blue-600
                                            "
                                        >
                                            ¥ {money(ownerCashValue)}
                                        </div>

                                    </div>

                                </div>


                                {/* =================================================
                                    表格
                                ================================================= */}

                                <div
                                    className="
                                        overflow-x-auto
                                        rounded-xl
                                        border
                                        border-gray-100
                                    "
                                >

                                    <table
                                        className="
                                            w-full
                                            min-w-[1750px]
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
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    投保人
                                                </th>


                                                <th
                                                    className="
                                                        p-3
                                                        text-left
                                                        font-semibold
                                                        text-gray-600
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    保险公司
                                                </th>


                                                <th
                                                    className="
                                                        p-3
                                                        text-left
                                                        font-semibold
                                                        text-gray-600
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    保险产品
                                                </th>


                                                <th
                                                    className="
                                                        p-3
                                                        text-left
                                                        font-semibold
                                                        text-gray-600
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    今年缴费
                                                </th>


                                                <th
                                                    className="
                                                        p-3
                                                        text-right
                                                        font-semibold
                                                        text-gray-600
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    年缴保费
                                                </th>


                                                <th
                                                    className="
                                                        p-3
                                                        text-center
                                                        font-semibold
                                                        text-gray-600
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    缴费进度
                                                </th>


                                                <th
                                                    className="
                                                        p-3
                                                        text-center
                                                        font-semibold
                                                        text-gray-600
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    剩余
                                                </th>


                                                <th
                                                    className="
                                                        p-3
                                                        text-center
                                                        font-semibold
                                                        text-gray-600
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    保单缴费完成
                                                </th>


                                                <th
                                                    className="
                                                        p-3
                                                        text-right
                                                        font-semibold
                                                        text-gray-600
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    当前现金价值
                                                </th>

                                            </tr>

                                        </thead>


                                        <tbody>

                                            {
                                                list.map(
                                                    (
                                                        item: any
                                                    ) => {

                                                        // =================================
                                                        // 缴费年份
                                                        // =================================

                                                        const paidYears =
                                                            getPaidYears(item);

                                                        const payYears =
                                                            getPayYears(item);

                                                        const remainYears =
                                                            getRemainYears(item);


                                                        // =================================
                                                        // 缴费进度
                                                        // =================================

                                                        const progress =
                                                            Number(
                                                                item.progress ||
                                                                (
                                                                    payYears > 0
                                                                        ?
                                                                        (
                                                                            paidYears /
                                                                            payYears
                                                                        ) *
                                                                        100
                                                                        :
                                                                        0
                                                                )
                                                            );


                                                        // =================================
                                                        // 今年是否已交
                                                        // =================================

                                                        const currentPaid =
                                                            Boolean(
                                                                item.current_paid
                                                            );


                                                        // =================================
                                                        // 整张保单是否完成
                                                        // =================================

                                                        const policyCompleted =
                                                            isPolicyCompleted(item);


                                                        // =================================
                                                        // 当前现金价值
                                                        // =================================

                                                        const cashValue =
                                                            getCashValue(item);


                                                        // =================================
                                                        // 现金价值日期
                                                        // =================================

                                                        const cashValueDate =
                                                            getCashValueDate(item);


                                                        return (

                                                            <tr
                                                                key={
                                                                    item.id ||
                                                                    `${owner}-${getProduct(item)}`
                                                                }
                                                                className="
                                                                    border-b
                                                                    border-gray-100
                                                                    last:border-b-0
                                                                    hover:bg-gray-50
                                                                    transition
                                                                "
                                                            >

                                                                {/* 投保人 */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        font-medium
                                                                        text-gray-900
                                                                        whitespace-nowrap
                                                                    "
                                                                >
                                                                    {
                                                                        getOwner(item)
                                                                    }
                                                                </td>


                                                                {/* 保险公司 */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        whitespace-nowrap
                                                                    "
                                                                >

                                                                    <span
                                                                        className="
                                                                            inline-flex
                                                                            items-center
                                                                            px-3
                                                                            py-1.5
                                                                            rounded-lg
                                                                            bg-blue-50
                                                                            text-blue-700
                                                                            font-semibold
                                                                        "
                                                                    >
                                                                        {
                                                                            getCompany(item)
                                                                        }
                                                                    </span>

                                                                </td>


                                                                {/* 产品 */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        font-medium
                                                                        text-gray-800
                                                                        whitespace-nowrap
                                                                    "
                                                                >
                                                                    {
                                                                        getProduct(item)
                                                                    }
                                                                </td>


                                                                {/* 今年缴费 */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        whitespace-nowrap
                                                                    "
                                                                >

                                                                    {
                                                                        currentPaid

                                                                            ?

                                                                            <div
                                                                                className="
                                                                                    flex
                                                                                    items-center
                                                                                    gap-2
                                                                                "
                                                                            >

                                                                                <span
                                                                                    className="
                                                                                        inline-flex
                                                                                        items-center
                                                                                        px-3
                                                                                        py-1.5
                                                                                        rounded-full
                                                                                        bg-green-100
                                                                                        text-green-700
                                                                                        font-semibold
                                                                                    "
                                                                                >
                                                                                    ✅ 今年已交
                                                                                </span>


                                                                                {
                                                                                    item.payment_date && (

                                                                                        <span
                                                                                            className="
                                                                                                text-xs
                                                                                                text-gray-400
                                                                                            "
                                                                                        >
                                                                                            {
                                                                                                dateText(
                                                                                                    item.payment_date
                                                                                                )
                                                                                            }
                                                                                        </span>

                                                                                    )
                                                                                }

                                                                            </div>

                                                                            :

                                                                            <span
                                                                                className="
                                                                                    inline-flex
                                                                                    items-center
                                                                                    px-3
                                                                                    py-1.5
                                                                                    rounded-full
                                                                                    bg-orange-100
                                                                                    text-orange-700
                                                                                    font-semibold
                                                                                "
                                                                            >
                                                                                ⏳ 今年待交
                                                                            </span>
                                                                    }

                                                                </td>


                                                                {/* 年缴保费 */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        text-right
                                                                        font-medium
                                                                        whitespace-nowrap
                                                                    "
                                                                >

                                                                    ¥ {
                                                                        money(
                                                                            getAnnualPremium(item)
                                                                        )
                                                                    }

                                                                    <span
                                                                        className="
                                                                            text-xs
                                                                            text-gray-400
                                                                            ml-1
                                                                        "
                                                                    >
                                                                        /年
                                                                    </span>

                                                                </td>


                                                                {/* 缴费进度 */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        text-center
                                                                        whitespace-nowrap
                                                                    "
                                                                >

                                                                    <div
                                                                        className="
                                                                            flex
                                                                            items-center
                                                                            justify-center
                                                                            gap-2
                                                                        "
                                                                    >

                                                                        <span
                                                                            className="
                                                                                font-bold
                                                                                text-gray-800
                                                                            "
                                                                        >
                                                                            {paidYears}/{payYears}年
                                                                        </span>


                                                                        <span
                                                                            className="
                                                                                text-xs
                                                                                text-gray-500
                                                                            "
                                                                        >
                                                                            {
                                                                                progress.toLocaleString(
                                                                                    "zh-CN",
                                                                                    {
                                                                                        maximumFractionDigits: 1
                                                                                    }
                                                                                )
                                                                            }%
                                                                        </span>

                                                                    </div>

                                                                </td>


                                                                {/* 剩余 */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        text-center
                                                                        font-semibold
                                                                        text-gray-800
                                                                        whitespace-nowrap
                                                                    "
                                                                >
                                                                    {remainYears} 年
                                                                </td>


                                                                {/* 保单缴费完成 */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        text-center
                                                                        whitespace-nowrap
                                                                    "
                                                                >

                                                                    {
                                                                        policyCompleted

                                                                            ?

                                                                            <span
                                                                                className="
                                                                                    inline-flex
                                                                                    items-center
                                                                                    px-3
                                                                                    py-1.5
                                                                                    rounded-full
                                                                                    bg-green-100
                                                                                    text-green-700
                                                                                    font-semibold
                                                                                "
                                                                            >
                                                                                ✅ 已完成
                                                                            </span>

                                                                            :

                                                                            <span
                                                                                className="
                                                                                    inline-flex
                                                                                    items-center
                                                                                    px-3
                                                                                    py-1.5
                                                                                    rounded-full
                                                                                    bg-orange-100
                                                                                    text-orange-700
                                                                                    font-semibold
                                                                                "
                                                                            >
                                                                                ⏳ 待完成
                                                                            </span>
                                                                    }

                                                                </td>


                                                                {/* 当前现金价值 */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        text-right
                                                                        whitespace-nowrap
                                                                    "
                                                                >

                                                                    <div
                                                                        className="
                                                                            font-semibold
                                                                            text-gray-900
                                                                        "
                                                                    >
                                                                        ¥ {
                                                                            money(
                                                                                cashValue
                                                                            )
                                                                        }
                                                                    </div>


                                                                    {
                                                                        cashValueDate && (

                                                                            <div
                                                                                className="
                                                                                    text-xs
                                                                                    text-gray-400
                                                                                    mt-1
                                                                                "
                                                                            >
                                                                                {
                                                                                    dateText(
                                                                                        cashValueDate
                                                                                    )
                                                                                }
                                                                            </div>

                                                                        )
                                                                    }

                                                                </td>

                                                            </tr>

                                                        );

                                                    }
                                                )
                                            }

                                        </tbody>

                                    </table>

                                </div>

                            </div>

                        );

                    }
                )
            }

        </div>

    );

}