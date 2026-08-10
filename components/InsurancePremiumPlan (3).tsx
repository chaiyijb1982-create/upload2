
"use client";

export default function InsurancePremiumPlan({
    data
}: any) {

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
    // 关键：
    //
    // 现金价值可能来自不同层级。
    //
    // InsuranceOwnerCashValue 使用：
    //
    // policy.cash_value
    //
    // 这里统一做兼容。
    // =====================================================

    const getCashValue = (
        item: any
    ) => {

        // ---------------------------------------------
        // 第一优先级：当前 item
        // ---------------------------------------------

        if (
            item?.cash_value !== undefined &&
            item?.cash_value !== null &&
            item?.cash_value !== ""
        ) {

            return Number(
                item.cash_value
            );

        }


        // ---------------------------------------------
        // 第二优先级：policy
        // ---------------------------------------------

        if (
            item?.policy?.cash_value !== undefined &&
            item?.policy?.cash_value !== null &&
            item?.policy?.cash_value !== ""
        ) {

            return Number(
                item.policy.cash_value
            );

        }


        // ---------------------------------------------
        // 第三优先级：insurance
        // ---------------------------------------------

        if (
            item?.insurance?.cash_value !== undefined &&
            item?.insurance?.cash_value !== null &&
            item?.insurance?.cash_value !== ""
        ) {

            return Number(
                item.insurance.cash_value
            );

        }


        // ---------------------------------------------
        // 第四优先级：cashValue
        // ---------------------------------------------

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
    // 现金价值日期
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
    // 保险公司
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
    // 产品
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
    // 投保人
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
    //
    // 优先使用 data.items
    //
    // 如果 data.items 没有，
    // 再尝试 data.policies
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
    // 没有数据
    // =====================================================

    if (
        sourceItems.length === 0
    ) {

        return (

            <div
                className="
                    mt-8
                "
            >

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

                <div
                    className="
                        flex
                        items-center
                        gap-8
                        mb-5
                        whitespace-nowrap
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

                </div>


                {/* =================================================
                    年度汇总
                    强制一行
                ================================================= */}

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

                        <span
                            className="
                                text-sm
                                text-gray-500
                            "
                        >
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

                        <span
                            className="
                                text-sm
                                text-gray-500
                            "
                        >
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

                        <span
                            className="
                                text-sm
                                text-gray-500
                            "
                        >
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
                家庭成员
            ================================================= */}

            {owners.map(
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
                                getOwner(
                                    item
                                ) === owner
                        );


                    if (
                        list.length === 0
                    ) {

                        return null;

                    }


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
                                        item.annual_premium ||
                                        item.policy?.annual_premium ||
                                        item.insurance?.annual_premium ||
                                        0
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

                                if (
                                    Boolean(
                                        item.current_paid
                                    )
                                ) {

                                    return (
                                        sum +
                                        Number(
                                            item.annual_premium ||
                                            item.policy?.annual_premium ||
                                            item.insurance?.annual_premium ||
                                            0
                                        )
                                    );

                                }

                                return sum;

                            },
                            0
                        );


                    // =========================================
                    // 当前成员今年待交
                    // =========================================

                    const ownerUnpaid =
                        Math.max(
                            ownerTotal -
                            ownerPaid,
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
                                    getCashValue(
                                        item
                                    )
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
                            ================================================= */}

                            <div
                                className="
                                    flex
                                    items-center
                                    justify-between
                                    gap-8
                                    mb-5
                                    whitespace-nowrap
                                "
                            >

                                {/* 左 */}

                                <div
                                    className="
                                        flex
                                        items-center
                                        gap-4
                                        shrink-0
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
                                            text-gray-500
                                        "
                                    >
                                        {list.length} 张保单
                                    </span>

                                </div>


                                {/* 右 */}

                                <div
                                    className="
                                        flex
                                        items-center
                                        gap-5
                                        shrink-0
                                        text-sm
                                    "
                                >

                                    <span
                                        className="
                                            text-green-600
                                            font-semibold
                                        "
                                    >
                                        已交 ¥{money(ownerPaid)}
                                    </span>


                                    <span
                                        className="
                                            text-gray-300
                                        "
                                    >
                                        /
                                    </span>


                                    <span
                                        className="
                                            text-gray-700
                                            font-semibold
                                        "
                                    >
                                        应交 ¥{money(ownerTotal)}
                                    </span>


                                    <span
                                        className="
                                            text-orange-600
                                            font-semibold
                                        "
                                    >
                                        待交 ¥{money(ownerUnpaid)}
                                    </span>


                                    <span
                                        className="
                                            text-gray-300
                                        "
                                    >
                                        /
                                    </span>


                                    <span
                                        className="
                                            text-blue-600
                                            font-semibold
                                        "
                                    >
                                        现金价值 ¥{money(
                                            ownerCashValue
                                        )}
                                    </span>

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
                                                        Number(
                                                            item.paid_years ||
                                                            0
                                                        );


                                                    const payYears =
                                                        Number(
                                                            item.pay_years ||
                                                            0
                                                        );


                                                    // =================================
                                                    // 剩余年份
                                                    // =================================

                                                    const remainYears =
                                                        Number(
                                                            item.remain_years ??
                                                            Math.max(
                                                                payYears -
                                                                paidYears,
                                                                0
                                                            )
                                                        );


                                                    // =================================
                                                    // 缴费进度
                                                    // =================================

                                                    const progress =
                                                        Number(
                                                            item.progress ||
                                                            0
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
                                                        payYears > 0 &&
                                                        paidYears >= payYears;


                                                    // =================================
                                                    // 当前现金价值
                                                    //
                                                    // 这里不再直接写：
                                                    //
                                                    // item.cash_value || 0
                                                    //
                                                    // 而是统一调用 getCashValue()
                                                    // =================================

                                                    const cashValue =
                                                        getCashValue(
                                                            item
                                                        );


                                                    // =================================
                                                    // 现金价值日期
                                                    // =================================

                                                    const cashValueDate =
                                                        getCashValueDate(
                                                            item
                                                        );


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
                                                                    getOwner(
                                                                        item
                                                                    )
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
                                                                        getCompany(
                                                                            item
                                                                        )
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
                                                                    getProduct(
                                                                        item
                                                                    )
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
                                                                        item.annual_premium ||
                                                                        item.policy?.annual_premium ||
                                                                        item.insurance?.annual_premium
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
                                                                        {progress}%
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
            )}

        </div>

    );

}
