"use client";

import { useState } from "react";


export default function InsuranceSummary({
    data
}: any) {


    // =====================================
    // 两个区域分别控制
    // =====================================

    const [
        showCashValue,
        setShowCashValue
    ] = useState(true);


    const [
        showPremium,
        setShowPremium
    ] = useState(true);


    // =====================================
    // 年/月领取单独控制
    // =====================================

    const [
        showIncome,
        setShowIncome
    ] = useState(false);


    // =====================================
    // 现金价值
    // =====================================

    const totalCashValue =
        Number(
            data?.todayCashValue || 0
        );


    const ownerCashValue =
        data?.ownerCashValue || {};


    // =====================================
    // 累计保费
    // =====================================

    const totalPremium =
        Number(
            data?.totalPremium || 0
        );


    const paidPremium =
        Number(
            data?.paidPremium || 0
        );


    const unpaidPremium =
        Number(
            data?.unpaidPremium || 0
        );


    const premiumProgress =
        Number(
            data?.premiumProgress || 0
        );


    // =====================================
    // 格式化
    // =====================================

    const money = (
        value: number
    ) => {

        return Number(
            value || 0
        ).toLocaleString(
            "zh-CN",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        );

    };


    const money2 = (
        value: number
    ) => {

        return Number(
            value || 0
        ).toLocaleString(
            "zh-CN",
            {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            }
        );

    };


    return (

        <div className="space-y-4">


            {/* =================================
                2026 年现金价值
            ================================= */}

            <div className="bg-white rounded-xl shadow px-5 py-4">


                {/* 标题栏 */}

                <div className="
                    flex
                    items-center
                    justify-between
                    mb-4
                ">

                    <h2 className="
                        text-lg
                        font-bold
                    ">

                        2026 年现金价值

                    </h2>


                    <button
                        type="button"
                        onClick={() =>
                            setShowCashValue(
                                !showCashValue
                            )
                        }
                        className="
                            text-sm
                            text-gray-500
                            hover:text-gray-800
                            px-3
                            py-1
                            rounded-lg
                            hover:bg-gray-100
                        "
                    >

                        {showCashValue
                            ? "🙈 隐藏"
                            : "👁 显示"
                        }

                    </button>

                </div>


                {showCashValue && (

                    <div className="
                        grid
                        grid-cols-4
                        gap-4
                    ">


                        {/* 总现金价值 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                总现金价值

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                            ">

                                ¥ {money2(
                                    totalCashValue
                                )}

                            </h2>

                        </div>


                        {/* 自己 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                自己

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                            ">

                                ¥ {money2(
                                    ownerCashValue[
                                        "自己"
                                    ] || 0
                                )}

                            </h2>

                        </div>


                        {/* 老婆 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                老婆

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                            ">

                                ¥ {money2(
                                    ownerCashValue[
                                        "老婆"
                                    ] || 0
                                )}

                            </h2>

                        </div>


                        {/* 儿子 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                儿子

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                            ">

                                ¥ {money2(
                                    ownerCashValue[
                                        "儿子"
                                    ] || 0
                                )}

                            </h2>

                        </div>


                    </div>

                )}

            </div>


            {/* =================================
                累计保费
            ================================= */}

            <div className="bg-white rounded-xl shadow px-5 py-4">


                {/* 标题栏 */}

                <div className="
                    flex
                    items-center
                    justify-between
                    mb-4
                ">

                    <h2 className="
                        text-lg
                        font-bold
                    ">

                        累计保费

                    </h2>


                    <button
                        type="button"
                        onClick={() =>
                            setShowPremium(
                                !showPremium
                            )
                        }
                        className="
                            text-sm
                            text-gray-500
                            hover:text-gray-800
                            px-3
                            py-1
                            rounded-lg
                            hover:bg-gray-100
                        "
                    >

                        {showPremium
                            ? "🙈 隐藏"
                            : "👁 显示"
                        }

                    </button>

                </div>


                {showPremium && (

                    <div className="
                        grid
                        grid-cols-4
                        gap-4
                    ">


                        {/* 总保费 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                总保费

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                            ">

                                ¥ {money(
                                    totalPremium
                                )}

                            </h2>

                        </div>


                        {/* 已交 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                已交

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                                text-green-600
                            ">

                                ¥ {money(
                                    paidPremium
                                )}

                            </h2>

                        </div>


                        {/* 未交 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                未交

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                                text-orange-600
                            ">

                                ¥ {money(
                                    unpaidPremium
                                )}

                            </h2>

                        </div>


                        {/* 完成率 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                完成

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                            ">

                                {premiumProgress}%

                            </h2>


                            {/* 进度条 */}

                            <div className="
                                w-full
                                h-2
                                bg-gray-200
                                rounded-full
                                mt-2
                                overflow-hidden
                            ">

                                <div
                                    className="
                                        h-2
                                        bg-green-500
                                        rounded-full
                                    "
                                    style={{
                                        width:
                                            `${Math.min(
                                                premiumProgress,
                                                100
                                            )}%`
                                    }}
                                />

                            </div>

                        </div>


                    </div>

                )}

            </div>


            {/* =================================
                年领取 / 月领取
                默认隐藏
            ================================= */}

            <div className="
                bg-white
                rounded-xl
                shadow
                px-5
                py-3
            ">


                <div className="
                    flex
                    items-center
                    justify-between
                ">


                    <div className="
                        font-medium
                        text-gray-700
                    ">

                        保单领取

                    </div>


                    <button
                        type="button"
                        onClick={() =>
                            setShowIncome(
                                !showIncome
                            )
                        }
                        className="
                            text-sm
                            text-gray-500
                            hover:text-gray-800
                            px-3
                            py-1
                            rounded-lg
                            hover:bg-gray-100
                        "
                    >

                        {showIncome
                            ? "🙈 隐藏"
                            : "👁 显示"
                        }

                    </button>


                </div>


                {showIncome && (

                    <div className="
                        grid
                        grid-cols-2
                        gap-4
                        mt-4
                    ">


                        {/* 年领取 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                年领取

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                            ">

                                ¥ {money(
                                    data?.totalAnnualPension || 0
                                )}

                            </h2>

                        </div>


                        {/* 月领取 */}

                        <div>

                            <p className="
                                text-sm
                                text-gray-500
                                mb-1
                            ">

                                月领取

                            </p>


                            <h2 className="
                                text-2xl
                                font-bold
                            ">

                                ¥ {money(
                                    data?.totalMonthlyPension || 0
                                )}

                            </h2>

                        </div>


                    </div>

                )}

            </div>


        </div>

    );

}