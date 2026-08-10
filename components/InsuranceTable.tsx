
export default function InsuranceTable({
    policies
}: any) {

    console.log(
        "TABLE POLICIES:",
        policies
    );


    // =====================================================
    // 没有数据
    // =====================================================

    if (
        !policies ||
        policies.length === 0
    ) {

        return (

            <div className="mt-8">

                <p className="text-gray-500">
                    暂无保险数据
                </p>

            </div>

        );

    }


    // =====================================================
    // 金额格式
    // =====================================================

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


    // =====================================================
    // 页面
    // =====================================================

    return (

        <div className="mt-10">


            {/* =================================================
                标题
            ================================================= */}

            <div className="mb-5">

                <h2
                    className="
                        text-2xl
                        font-bold
                        text-gray-900
                    "
                >
                    保单明细
                </h2>


                <p
                    className="
                        text-sm
                        text-gray-500
                        mt-1
                    "
                >
                    查看今年缴费状态、累计缴费进度及现金价值
                </p>

            </div>


            {/* =================================================
                表格
            ================================================= */}

            <div
                className="
                    bg-white
                    rounded-2xl
                    shadow-sm
                    border
                    border-gray-100
                    overflow-x-auto
                "
            >

                <table
                    className="
                        min-w-[1150px]
                        w-full
                        text-sm
                    "
                >

                    {/* =================================================
                        表头
                    ================================================= */}

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
                                    p-4
                                    text-left
                                    font-semibold
                                    text-gray-600
                                "
                            >
                                投保人
                            </th>


                            <th
                                className="
                                    p-4
                                    text-left
                                    font-semibold
                                    text-gray-600
                                "
                            >
                                保险公司
                            </th>


                            <th
                                className="
                                    p-4
                                    text-left
                                    font-semibold
                                    text-gray-600
                                "
                            >
                                产品
                            </th>


                            <th
                                className="
                                    p-4
                                    text-center
                                    font-semibold
                                    text-gray-600
                                "
                            >
                                今年缴费
                            </th>


                            <th
                                className="
                                    p-4
                                    text-right
                                    font-semibold
                                    text-gray-600
                                "
                            >
                                年缴保费
                            </th>


                            <th
                                className="
                                    p-4
                                    text-center
                                    font-semibold
                                    text-gray-600
                                "
                            >
                                缴费进度
                            </th>


                            <th
                                className="
                                    p-4
                                    text-center
                                    font-semibold
                                    text-gray-600
                                "
                            >
                                剩余
                            </th>


                            <th
                                className="
                                    p-4
                                    text-right
                                    font-semibold
                                    text-gray-600
                                "
                            >
                                当前现金价值
                            </th>

                        </tr>

                    </thead>


                    {/* =================================================
                        数据
                    ================================================= */}

                    <tbody>

                        {
                            policies.map(
                                (item: any) => {


                                    // =================================
                                    // 累计缴费年份
                                    // =================================

                                    const paidYears =
                                        Number(
                                            item.paid_years || 0
                                        );


                                    // =================================
                                    // 总缴费年份
                                    // =================================

                                    const payYears =
                                        Number(
                                            item.pay_years || 0
                                        );


                                    // =================================
                                    // 剩余缴费年份
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
                                    // 累计缴费进度
                                    // =================================

                                    const progress =
                                        Number(
                                            item.progress || 0
                                        );


                                    // =================================
                                    // 今年是否已缴
                                    //
                                    // 重点：
                                    //
                                    // 这里绝对不能使用：
                                    //
                                    // paidYears >= payYears
                                    //
                                    // 因为那个是整个保单是否完成。
                                    //
                                    // 这里使用 insurance.ts
                                    // 计算出来的 current_paid。
                                    // =================================

                                    const currentPaid =
                                        Boolean(
                                            item.current_paid
                                        );


                                    return (

                                        <tr
                                            key={item.id}
                                            className="
                                                border-b
                                                border-gray-100
                                                last:border-b-0
                                                hover:bg-gray-50
                                                transition
                                            "
                                        >


                                            {/* =================================
                                                投保人
                                            ================================= */}

                                            <td
                                                className="
                                                    p-4
                                                    font-medium
                                                    text-gray-900
                                                    whitespace-nowrap
                                                "
                                            >

                                                {
                                                    item.owner ||
                                                    "-"
                                                }

                                            </td>


                                            {/* =================================
                                                保险公司
                                            ================================= */}

                                            <td
                                                className="
                                                    p-4
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
                                                        item.company ||
                                                        "未知保险公司"
                                                    }

                                                </span>

                                            </td>


                                            {/* =================================
                                                产品
                                            ================================= */}

                                            <td
                                                className="
                                                    p-4
                                                    font-medium
                                                    text-gray-800
                                                "
                                            >

                                                {
                                                    item.product ||
                                                    "-"
                                                }

                                            </td>


                                            {/* =================================
                                                今年缴费状态
                                            ================================= */}

                                            <td
                                                className="
                                                    p-4
                                                    text-center
                                                "
                                            >

                                                {
                                                    currentPaid

                                                        ?

                                                        <div
                                                            className="
                                                                inline-flex
                                                                flex-col
                                                                items-center
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
                                                                    text-sm
                                                                    font-semibold
                                                                    whitespace-nowrap
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
                                                                            mt-1
                                                                        "
                                                                    >

                                                                        {
                                                                            item.payment_date
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
                                                                text-sm
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
                                                    p-4
                                                    text-right
                                                    font-medium
                                                    whitespace-nowrap
                                                "
                                            >

                                                ¥ {
                                                    money(
                                                        item.annual_premium
                                                    )
                                                }

                                                <div
                                                    className="
                                                        text-xs
                                                        text-gray-400
                                                        mt-1
                                                    "
                                                >
                                                    / 年
                                                </div>

                                            </td>


                                            {/* =================================
                                                累计缴费进度
                                            ================================= */}

                                            <td
                                                className="
                                                    p-4
                                                    text-center
                                                "
                                            >

                                                {
                                                    payYears > 0

                                                        ?

                                                        <div
                                                            className="
                                                                min-w-[100px]
                                                            "
                                                        >

                                                            <div
                                                                className="
                                                                    font-bold
                                                                    text-gray-800
                                                                "
                                                            >

                                                                {
                                                                    paidYears
                                                                }

                                                                /

                                                                {
                                                                    payYears
                                                                }

                                                            </div>


                                                            <div
                                                                className="
                                                                    w-24
                                                                    h-2
                                                                    bg-gray-200
                                                                    rounded-full
                                                                    mx-auto
                                                                    mt-2
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
                                                                            `${Math.min(
                                                                                Math.max(
                                                                                    progress,
                                                                                    0
                                                                                ),
                                                                                100
                                                                            )}%`
                                                                    }}
                                                                />

                                                            </div>


                                                            <div
                                                                className="
                                                                    text-xs
                                                                    text-gray-500
                                                                    mt-1
                                                                "
                                                            >

                                                                {
                                                                    progress
                                                                }%

                                                            </div>

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
                                                    p-4
                                                    text-center
                                                    whitespace-nowrap
                                                "
                                            >

                                                {
                                                    payYears > 0

                                                        ?

                                                        <>

                                                            <div
                                                                className="
                                                                    font-semibold
                                                                    text-gray-800
                                                                "
                                                            >

                                                                {
                                                                    remainYears
                                                                }

                                                                年

                                                            </div>


                                                            <div
                                                                className="
                                                                    text-xs
                                                                    text-gray-400
                                                                    mt-1
                                                                "
                                                            >

                                                                剩余

                                                            </div>

                                                        </>

                                                        :

                                                        "-"

                                                }

                                            </td>


                                            {/* =================================
                                                当前现金价值
                                            ================================= */}

                                            <td
                                                className="
                                                    p-4
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
                                                            item.cash_value
                                                        )
                                                    }

                                                </div>


                                                {
                                                    item.cash_value_date && (

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

