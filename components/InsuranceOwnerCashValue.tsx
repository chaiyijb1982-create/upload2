export default function InsuranceOwnerCashValue({
    policies
}: any) {

    // =====================================================
    // 家庭成员
    // =====================================================

    const owners = [
        "自己",
        "老婆",
        "儿子"
    ];


    // =====================================================
    // 格式化金额
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

        <div className="mt-8 space-y-6">


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
                    现金价值明细
                </h2>


                <p
                    className="
                        text-sm
                        text-gray-500
                        mt-1
                    "
                >
                    按家庭成员查看各保单当前现金价值
                </p>

            </div>


            {/* =================================================
                家庭成员
            ================================================= */}

            {owners.map(
                (owner) => {


                    // =========================================
                    // 当前成员保单
                    // =========================================

                    const list =
                        (policies || []).filter(
                            (p: any) =>
                                p.owner === owner
                        );


                    // =========================================
                    // 当前成员现金价值
                    // =========================================

                    const total =
                        list.reduce(
                            (
                                sum: number,
                                p: any
                            ) =>
                                sum +
                                Number(
                                    p.cash_value || 0
                                ),
                            0
                        );


                    // =========================================
                    // 没有保单
                    // =========================================

                    if (list.length === 0) {

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

                                    <h3
                                        className="
                                            text-xl
                                            font-bold
                                            text-gray-900
                                        "
                                    >
                                        {owner}
                                    </h3>


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
                    // 正常显示
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
                            ================================= */}

                            <div
                                className="
                                    flex
                                    flex-col
                                    sm:flex-row
                                    sm:items-center
                                    sm:justify-between
                                    gap-2
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
                                        {owner}
                                    </h3>


                                    <p
                                        className="
                                            text-xs
                                            text-gray-400
                                            mt-1
                                        "
                                    >
                                        {list.length} 张保单
                                    </p>

                                </div>


                                <div
                                    className="
                                        text-lg
                                        font-bold
                                        text-blue-600
                                    "
                                >
                                    ¥ {money(total)}
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
                                        min-w-[720px]
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
                                                    text-right
                                                    font-semibold
                                                    text-gray-600
                                                    whitespace-nowrap
                                                "
                                            >
                                                当前现金价值
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
                                                数据日期
                                            </th>

                                        </tr>

                                    </thead>


                                    {/* =================================
                                        内容
                                    ================================= */}

                                    <tbody>

                                        {list.map(
                                            (
                                                policy: any
                                            ) => (

                                                <tr
                                                    key={
                                                        policy.id
                                                    }
                                                    className="
                                                        border-b
                                                        border-gray-100
                                                        last:border-b-0
                                                        hover:bg-gray-50
                                                    "
                                                >

                                                    {/* =================
                                                        保险公司
                                                    ================= */}

                                                    <td
                                                        className="
                                                            p-3
                                                            font-semibold
                                                            text-gray-800
                                                        "
                                                    >
                                                        {
                                                            policy.company
                                                            ||
                                                            "-"
                                                        }
                                                    </td>


                                                    {/* =================
                                                        保险产品
                                                    ================= */}

                                                    <td
                                                        className="
                                                            p-3
                                                            text-gray-700
                                                        "
                                                    >
                                                        {
                                                            policy.product
                                                            ||
                                                            "-"
                                                        }
                                                    </td>


                                                    {/* =================
                                                        当前现金价值
                                                    ================= */}

                                                    <td
                                                        className="
                                                            p-3
                                                            text-right
                                                            font-semibold
                                                            text-gray-900
                                                            whitespace-nowrap
                                                        "
                                                    >
                                                        ¥ {
                                                            money(
                                                                policy.cash_value
                                                            )
                                                        }
                                                    </td>


                                                    {/* =================
                                                        数据日期
                                                    ================= */}

                                                    <td
                                                        className="
                                                            p-3
                                                            text-center
                                                            text-gray-500
                                                            whitespace-nowrap
                                                        "
                                                    >
                                                        {
                                                            policy.cash_value_date
                                                                ?
                                                                String(
                                                                    policy.cash_value_date
                                                                ).slice(
                                                                    0,
                                                                    10
                                                                )
                                                                :
                                                                "-"
                                                        }
                                                    </td>

                                                </tr>

                                            )
                                        )}


                                        {/* =================================
                                            合计
                                        ================================= */}

                                        <tr
                                            className="
                                                bg-gray-50
                                                font-bold
                                            "
                                        >

                                            <td
                                                className="
                                                    p-3
                                                "
                                                colSpan={2}
                                            >
                                                合计
                                            </td>


                                            <td
                                                className="
                                                    p-3
                                                    text-right
                                                    text-blue-600
                                                    whitespace-nowrap
                                                "
                                            >
                                                ¥ {
                                                    money(
                                                        total
                                                    )
                                                }
                                            </td>


                                            <td></td>

                                        </tr>

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

