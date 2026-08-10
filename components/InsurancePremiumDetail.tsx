"use client";


// =====================================
// 类型
// =====================================

interface PremiumItem {

    id: string;

    owner?: string;

    company?: string;

    product?: string;

    annual_premium?: number;

    pay_years?: number;

    paid_years?: number;

    remain_years?: number;

    progress?: number;

    status?: "paid" | "unpaid";

    payment_date?: string | null;

}


interface PremiumPlan {

    year: number;

    total: number;

    paid: number;

    unpaid: number;

    items: PremiumItem[];

}


// =====================================
// 金额格式
// =====================================

function formatMoney(
    value: number
) {

    return new Intl.NumberFormat(
        "zh-CN",
        {
            maximumFractionDigits: 0
        }
    ).format(
        Number(value || 0)
    );

}


// =====================================
// Component
// =====================================

export default function InsurancePremiumDetail({
    data
}: {
    data: PremiumPlan;
}) {

    if (
        !data
        ||
        !data.items
        ||
        data.items.length === 0
    ) {

        return null;

    }


    // =====================================
    // 按投保人分组
    // =====================================

    const grouped: Record<
        string,
        PremiumItem[]
    > = {};


    data.items.forEach(item => {

        const owner =
            item.owner || "其他";


        if (!grouped[owner]) {

            grouped[owner] = [];

        }


        grouped[owner].push(item);

    });


    const ownerOrder = [
        "自己",
        "老婆",
        "儿子"
    ];


    const owners = [
        ...ownerOrder.filter(
            owner =>
                grouped[owner]
        ),

        ...Object.keys(grouped)
            .filter(
                owner =>
                    !ownerOrder.includes(owner)
            )

    ];


    return (

        <div
            className="
                mb-8
                rounded-2xl
                border
                border-gray-200
                bg-white
                shadow-sm
                overflow-hidden
            "
        >

            {/* ================================= */}
            {/* 标题 */}
            {/* ================================= */}

            <div
                className="
                    px-5
                    py-4
                    border-b
                    border-gray-100
                "
            >

                <div
                    className="
                        text-base
                        font-semibold
                        text-gray-900
                    "
                >

                    {data.year} 年保费明细

                </div>

            </div>


            {/* ================================= */}
            {/* 内容 */}
            {/* ================================= */}

            <div
                className="
                    px-5
                    py-3
                "
            >

                {owners.map(owner => (

                    <div
                        key={owner}
                        className="
                            mb-4
                            last:mb-0
                        "
                    >

                        {/* ================================= */}
                        {/* 投保人 */}
                        {/* ================================= */}

                        <div
                            className="
                                mb-1.5
                                text-sm
                                font-semibold
                                text-gray-800
                            "
                        >

                            {owner}

                        </div>


                        {/* ================================= */}
                        {/* 保单 */}
                        {/* ================================= */}

                        <div
                            className="
                                flex
                                flex-col
                            "
                        >

                            {grouped[owner].map(item => {

                                const paid =
                                    item.status === "paid";


                                return (

                                    <div
                                        key={item.id}
                                        className="
                                            flex
                                            items-center
                                            gap-2
                                            py-2
                                            border-b
                                            border-gray-100
                                            last:border-b-0
                                            text-sm
                                            whitespace-nowrap
                                            overflow-x-auto
                                        "
                                    >

                                        {/* 产品 */}

                                        <span
                                            className="
                                                font-medium
                                                text-gray-900
                                                shrink-0
                                            "
                                        >
                                            {item.product || "-"}
                                        </span>


                                        {/* 公司 */}

                                        <span
                                            className="
                                                text-gray-500
                                                shrink-0
                                            "
                                        >
                                            ·
                                        </span>

                                        <span
                                            className="
                                                text-gray-500
                                                shrink-0
                                            "
                                        >
                                            {item.company || "-"}
                                        </span>


                                        {/* 状态 */}

                                        <span
                                            className="
                                                text-gray-500
                                                shrink-0
                                            "
                                        >
                                            ·
                                        </span>

                                        <span
                                            className={`
                                                shrink-0
                                                font-medium
                                                ${
                                                    paid
                                                        ?
                                                        "text-green-600"
                                                        :
                                                        "text-orange-500"
                                                }
                                            `}
                                        >

                                            {paid
                                                ? "✅ 已交"
                                                : "⏳ 待交"
                                            }

                                        </span>


                                        {/* 金额 */}

                                        <span
                                            className="
                                                text-gray-500
                                                shrink-0
                                            "
                                        >
                                            ·
                                        </span>

                                        <span
                                            className="
                                                font-medium
                                                text-gray-900
                                                shrink-0
                                            "
                                        >

                                            ¥
                                            {formatMoney(
                                                Number(
                                                    item.annual_premium || 0
                                                )
                                            )}

                                        </span>


                                        {/* 缴费进度 */}

                                        <span
                                            className="
                                                text-gray-500
                                                shrink-0
                                            "
                                        >
                                            ·
                                        </span>

                                        <span
                                            className="
                                                text-gray-600
                                                shrink-0
                                            "
                                        >

                                            {item.paid_years || 0}
                                            /
                                            {item.pay_years || 0}
                                            年

                                        </span>


                                        {/* 剩余 */}

                                        <span
                                            className="
                                                text-gray-500
                                                shrink-0
                                            "
                                        >
                                            ·
                                        </span>

                                        <span
                                            className="
                                                text-gray-600
                                                shrink-0
                                            "
                                        >

                                            剩
                                            {item.remain_years || 0}
                                            年

                                        </span>


                                        {/* 日期 */}

                                        {paid && item.payment_date && (

                                            <>

                                                <span
                                                    className="
                                                        text-gray-500
                                                        shrink-0
                                                    "
                                                >
                                                    ·
                                                </span>

                                                <span
                                                    className="
                                                        text-gray-500
                                                        shrink-0
                                                    "
                                                >

                                                    {item.payment_date}

                                                </span>

                                            </>

                                        )}

                                    </div>

                                );

                            })}

                        </div>

                    </div>

                ))}

            </div>

        </div>

    );

}