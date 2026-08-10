"use client";

export default function InsurancePremiumPlan({
    data
}: any) {

    // =====================================================
    // 当前年份
    // =====================================================

    const currentYear = new Date().getFullYear();


    // =====================================================
    // 数据
    // =====================================================

    const items = Array.isArray(data?.items)
        ? data.items
        : [];


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
            Number(value || 0);

        return number.toLocaleString(
            "zh-CN",
            {
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }
        );

    };


    // =====================================================
    // 判断今年是否已经缴费
    //
    // 这里优先使用 insurance.ts 已经计算好的
    // current_paid
    //
    // 不使用 paid_years >= pay_years
    // 因为 paid_years 是累计缴费进度
    // =====================================================

    const isCurrentPaid = (
        item: any
    ) => {

        return Boolean(
            item?.current_paid
        );

    };


    // =====================================================
    // 判断整个保单缴费是否完成
    //
    // 这是另外一个概念：
    //
    // paid_years >= pay_years
    //
    // 才代表整个缴费周期已经完成
    // =====================================================

    const isPolicyCompleted = (
        item: any
    ) => {

        const paidYears =
            Number(
                item?.paid_years || 0
            );

        const payYears =
            Number(
                item?.pay_years || 0
            );

        return (
            payYears > 0 &&
            paidYears >= payYears
        );

    };


    // =====================================================
    // 总金额
    //
    // 优先使用 data 中的汇总
    // 如果没有，则自己计算
    // =====================================================

    const calculatedTotal =
        items.reduce(
            (
                sum: number,
                item: any
            ) => {

                return (
                    sum +
                    Number(
                        item?.annual_premium || 0
                    )
                );

            },
            0
        );


    const calculatedPaid =
        items.reduce(
            (
                sum: number,
                item: any
            ) => {

                return (
                    sum +
                    (
                        isCurrentPaid(item)
                            ?
                            Number(
                                item?.annual_premium || 0
                            )
                            :
                            0
                    )
                );

            },
            0
        );


    const calculatedUnpaid =
        Math.max(
            calculatedTotal -
            calculatedPaid,
            0
        );


    const total =
        Number(
            data?.total ??
            calculatedTotal
        );


    const paid =
        Number(
            data?.paid ??
            calculatedPaid
        );


    const unpaid =
        Number(
            data?.unpaid ??
            calculatedUnpaid
        );


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
                标题
            ================================================= */}

            <div>

                <h2
                    className="
                        text-2xl
                        font-bold
                        text-gray-900
                    "
                >
                    {currentYear} 年保费计划
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


            {/* =================================================
                年度汇总
                强制一行
            ================================================= */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    shadow-sm
                    border
                    border-gray-100
                    px-5
                    py-4
                    overflow-x-auto
                "
            >

                <div
                    className="
                        flex
                        items-center
                        gap-10
                        min-w-max
                        whitespace-nowrap
                    "
                >


                    {/* ===============================
                        标题
                    =============================== */}

                    <div
                        className="
                            font-bold
                            text-lg
                            text-gray-900
                        "
                    >
                        {currentYear} 年保费计划
                    </div>


                    {/* ===============================
                        今年应交
                    =============================== */}

                    <div
                        className="
                            flex
                            items-center
                            gap-2
                        "
                    >

                        <span
                            className="
                                text-gray-500
                            "
                        >
                            今年应交
                        </span>

                        <span
                            className="
                                font-bold
                                text-gray-900
                            "
                        >
                            ¥ {money(total)}
                        </span>

                    </div>


                    {/* ===============================
                        今年已交
                    =============================== */}

                    <div
                        className="
                            flex
                            items-center
                            gap-2
                        "
                    >

                        <span
                            className="
                                text-gray-500
                            "
                        >
                            今年已交
                        </span>

                        <span
                            className="
                                font-bold
                                text-green-600
                            "
                        >
                            ¥ {money(paid)}
                        </span>

                    </div>


                    {/* ===============================
                        今年待交
                    =============================== */}

                    <div
                        className="
                            flex
                            items-center
                            gap-2
                        "
                    >

                        <span
                            className="
                                text-gray-500
                            "
                        >
                            今年待交
                        </span>

                        <span
                            className="
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
                家庭成员
            ================================================= */}

            {
                owners.map(
                    (owner) => {


                        // =========================================
                        // 当前成员保单
                        // =========================================

                        const list =
                            items.filter(
                                (item: any) =>
                                    item?.owner === owner
                            );


                        // =========================================
                        // 当前成员今年应交
                        // =========================================

                        const ownerTotal =
                            list.reduce(
                                (
                                    sum: number,
                                    item: any
                                ) => {

                                    return (
                                        sum +
                                        Number(
                                            item?.annual_premium || 0
                                        )
                                    );

                                },
                                0
                            );


                        // =========================================
                        // 当前成员今年已交
                        // =========================================

                        const ownerPaid =
                            list.reduce(
                                (
                                    sum: number,
                                    item: any
                                ) => {

                                    return (
                                        sum +
                                        (
                                            isCurrentPaid(item)
                                                ?
                                                Number(
                                                    item?.annual_premium || 0
                                                )
                                                :
                                                0
                                        )
                                    );

                                },
                                0
                            );


                        // =========================================
                        // 没有保单
                        // =========================================

                        if (
                            list.length === 0
                        ) {

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

                                    <div
                                        className="
                                            flex
                                            items-center
                                            justify-between
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
                                                {owner}
                                            </h3>

                                        </div>


                                        <div
                                            className="
                                                text-sm
                                                text-gray-400
                                            "
                                        >
                                            暂无保单
                                        </div>

                                    </div>

                                </div>

                            );

                        }


                        // =========================================
                        // 正常成员区块
                        // =========================================

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


                                {/* =================================
                                    成员标题
                                    一行
                                ================================= */}

                                <div
                                    className="
                                        flex
                                        items-center
                                        justify-between
                                        gap-4
                                        mb-5
                                    "
                                >

                                    <div
                                        className="
                                            flex
                                            items-center
                                            gap-4
                                            whitespace-nowrap
                                        "
                                    >

                                        <h3
                                            className="
                                                text-xl
                                                font-bold
                                                text-gray-900
                                            "
                                        >
                                            {owner}
                                        </h3>


                                        <span
                                            className="
                                                text-sm
                                                text-gray-400
                                            "
                                        >
                                            {list.length} 张保单
                                        </span>

                                    </div>


                                    <div
                                        className="
                                            flex
                                            items-center
                                            gap-5
                                            whitespace-nowrap
                                        "
                                    >

                                        <span
                                            className="
                                                text-sm
                                                text-gray-500
                                            "
                                        >
                                            已交
                                            <span
                                                className="
                                                    ml-2
                                                    font-bold
                                                    text-green-600
                                                "
                                            >
                                                ¥ {money(ownerPaid)}
                                            </span>
                                        </span>


                                        <span
                                            className="
                                                text-sm
                                                text-gray-500
                                            "
                                        >
                                            应交
                                            <span
                                                className="
                                                    ml-2
                                                    font-bold
                                                    text-gray-900
                                                "
                                            >
                                                ¥ {money(ownerTotal)}
                                            </span>
                                        </span>

                                    </div>

                                </div>


                                {/* =================================
                                    表格
                                ================================= */}

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
                                            min-w-[1450px]
                                            text-sm
                                        "
                                    >


                                        {/* =================================
                                            表头
                                        ================================= */}

                                        <thead
                                            className="
                                                bg-gray-50
                                                border-b
                                                border-gray-100
                                            "
                                        >

                                            <tr>


                                                {/* 投保人 */}

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


                                                {/* 保险公司 */}

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


                                                {/* 保险产品 */}

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


                                                {/* 今年缴费 */}

                                                <th
                                                    className="
                                                        p-3
                                                        text-center
                                                        font-semibold
                                                        text-gray-600
                                                        whitespace-nowrap
                                                    "
                                                >
                                                    今年缴费
                                                </th>


                                                {/* 年缴保费 */}

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


                                                {/* 缴费进度 */}

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


                                                {/* 剩余 */}

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


                                                {/* 保单缴费完成 */}

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


                                                {/* 当前现金价值 */}

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


                                        {/* =================================
                                            数据
                                        ================================= */}

                                        <tbody>

                                            {
                                                list.map(
                                                    (
                                                        item: any
                                                    ) => {


                                                        // =================================
                                                        // 累计缴费年份
                                                        // =================================

                                                        const paidYears =
                                                            Number(
                                                                item?.paid_years || 0
                                                            );


                                                        // =================================
                                                        // 总缴费年份
                                                        // =================================

                                                        const payYears =
                                                            Number(
                                                                item?.pay_years || 0
                                                            );


                                                        // =================================
                                                        // 剩余年份
                                                        // =================================

                                                        const remainYears =
                                                            Number(
                                                                item?.remain_years ??
                                                                Math.max(
                                                                    payYears -
                                                                    paidYears,
                                                                    0
                                                                )
                                                            );


                                                        // =================================
                                                        // 进度
                                                        // =================================

                                                        const progress =
                                                            Math.min(
                                                                Math.max(
                                                                    Number(
                                                                        item?.progress || 0
                                                                    ),
                                                                    0
                                                                ),
                                                                100
                                                            );


                                                        // =================================
                                                        // 今年是否已缴
                                                        // =================================

                                                        const currentPaid =
                                                            isCurrentPaid(
                                                                item
                                                            );


                                                        // =================================
                                                        // 整个保单是否完成
                                                        // =================================

                                                        const policyCompleted =
                                                            isPolicyCompleted(
                                                                item
                                                            );


                                                        // =================================
                                                        // ★ 当前现金价值
                                                        //
                                                        // 关键：
                                                        // 直接读取 item.cash_value
                                                        //
                                                        // 与 InsuranceOwnerCashValue
                                                        // 完全一致。
                                                        // =================================

                                                        const cashValue =
                                                            Number(
                                                                item?.cash_value || 0
                                                            );


                                                        return (

                                                            <tr
                                                                key={
                                                                    item?.id ||
                                                                    `${owner}-${item?.product}`
                                                                }
                                                                className="
                                                                    border-b
                                                                    border-gray-100
                                                                    last:border-b-0
                                                                    hover:bg-gray-50
                                                                "
                                                            >


                                                                {/* =================================
                                                                    投保人
                                                                ================================= */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        font-medium
                                                                        text-gray-900
                                                                        whitespace-nowrap
                                                                    "
                                                                >
                                                                    {
                                                                        item?.owner ||
                                                                        owner
                                                                    }
                                                                </td>


                                                                {/* =================================
                                                                    保险公司
                                                                ================================= */}

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
                                                                            whitespace-nowrap
                                                                        "
                                                                    >
                                                                        {
                                                                            item?.company ||
                                                                            "未知保险公司"
                                                                        }
                                                                    </span>

                                                                </td>


                                                                {/* =================================
                                                                    产品
                                                                ================================= */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        font-medium
                                                                        text-gray-800
                                                                        whitespace-nowrap
                                                                    "
                                                                >
                                                                    {
                                                                        item?.product ||
                                                                        "-"
                                                                    }
                                                                </td>


                                                                {/* =================================
                                                                    今年缴费
                                                                ================================= */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        text-center
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
                                                                                    justify-center
                                                                                    gap-2
                                                                                    whitespace-nowrap
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
                                                                                    item?.payment_date && (

                                                                                        <span
                                                                                            className="
                                                                                                text-xs
                                                                                                text-gray-400
                                                                                                whitespace-nowrap
                                                                                            "
                                                                                        >
                                                                                            {
                                                                                                String(
                                                                                                    item.payment_date
                                                                                                ).slice(
                                                                                                    0,
                                                                                                    10
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
                                                                                    whitespace-nowrap
                                                                                "
                                                                            >
                                                                                ⏳ 今年待交
                                                                            </span>

                                                                    }

                                                                </td>


                                                                {/* =================================
                                                                    年缴保费
                                                                ================================= */}

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
                                                                            item?.annual_premium
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


                                                                {/* =================================
                                                                    缴费进度
                                                                ================================= */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        text-center
                                                                        whitespace-nowrap
                                                                    "
                                                                >

                                                                    {
                                                                        payYears > 0

                                                                            ?

                                                                            <div
                                                                                className="
                                                                                    flex
                                                                                    items-center
                                                                                    justify-center
                                                                                    gap-3
                                                                                    whitespace-nowrap
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


                                                                                <div
                                                                                    className="
                                                                                        w-20
                                                                                        h-2
                                                                                        bg-gray-200
                                                                                        rounded-full
                                                                                        overflow-hidden
                                                                                    "
                                                                                >

                                                                                    <div
                                                                                        className="
                                                                                            h-full
                                                                                            bg-blue-600
                                                                                            rounded-full
                                                                                        "
                                                                                        style={{
                                                                                            width:
                                                                                                `${progress}%`
                                                                                        }}
                                                                                    />

                                                                                </div>


                                                                                <span
                                                                                    className="
                                                                                        text-xs
                                                                                        text-gray-500
                                                                                        font-semibold
                                                                                    "
                                                                                >
                                                                                    {progress}%
                                                                                </span>

                                                                            </div>

                                                                            :

                                                                            "-"

                                                                    }

                                                                </td>


                                                                {/* =================================
                                                                    剩余
                                                                ================================= */}

                                                                <td
                                                                    className="
                                                                        p-3
                                                                        text-center
                                                                        whitespace-nowrap
                                                                    "
                                                                >

                                                                    {
                                                                        payYears > 0

                                                                            ?

                                                                            <span
                                                                                className="
                                                                                    font-semibold
                                                                                    text-gray-800
                                                                                "
                                                                            >
                                                                                {remainYears}年
                                                                            </span>

                                                                            :

                                                                            "-"

                                                                    }

                                                                </td>


                                                                {/* =================================
                                                                    保单缴费完成
                                                                ================================= */}

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
                                                                                ⏳ 待交
                                                                            </span>

                                                                    }

                                                                </td>


                                                                {/* =================================
                                                                    当前现金价值
                                                                    ★ 直接读取 cash_value
                                                                ================================= */}

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
                                                                        ¥ {money(cashValue)}
                                                                    </div>


                                                                    {
                                                                        item?.cash_value_date && (

                                                                            <div
                                                                                className="
                                                                                    text-xs
                                                                                    text-gray-400
                                                                                    mt-1
                                                                                "
                                                                            >
                                                                                {
                                                                                    String(
                                                                                        item.cash_value_date
                                                                                    ).slice(
                                                                                        0,
                                                                                        10
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