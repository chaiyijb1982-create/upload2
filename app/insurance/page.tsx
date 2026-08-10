import {
    getInsurancePoliciesWithCashValue,
    getInsuranceSummary,
    getInsuranceCashValueHistory,
    getInsurancePremiumPlan
} from "@/lib/insurance";


import InsuranceSummary
    from "@/components/InsuranceSummary";


import InsuranceTable
    from "@/components/InsuranceTable";


import InsuranceOwnerCashValue
    from "@/components/InsuranceOwnerCashValue";


import InsurancePremiumPlan
    from "@/components/InsurancePremiumPlan";


// =====================================================
// 保险资产中心
// =====================================================

export default async function InsurancePage() {


    // =================================================
    // 当前年份
    // =================================================

    const currentYear =
        new Date().getFullYear();


    // =================================================
    // 保单
    //
    // 这里的数据包含：
    //
    // owner
    // company
    // product
    // cash_value
    // cash_value_date
    // paid_years
    // pay_years
    // 等
    // =================================================

    const policies =
        await getInsurancePoliciesWithCashValue();


    // =================================================
    // 保险总览
    // =================================================

    const summary =
        await getInsuranceSummary();


    // =================================================
    // 当前年份保费计划
    // =================================================

    const premiumPlan =
        await getInsurancePremiumPlan();


    // =================================================
    // 现金价值历史
    // =================================================

    const history =
        await getInsuranceCashValueHistory();


    // =================================================
    // 页面
    // =================================================

    return (

        <div
            className="
                min-h-screen
                bg-gray-50
                p-4
                md:p-8
            "
        >

            {/* =================================================
                页面标题
            ================================================= */}

            <div
                className="
                    mb-8
                "
            >

                <h1
                    className="
                        text-3xl
                        font-bold
                        text-gray-900
                    "
                >
                    保险资产中心
                </h1>


                <p
                    className="
                        text-sm
                        text-gray-500
                        mt-2
                    "
                >
                    家庭保单、累计保费、现金价值与缴费计划
                </p>

            </div>


            {/* =================================================
                保险总览
            ================================================= */}

            <div className="mb-6">

                <InsuranceSummary
                    data={summary}
                />

            </div>


            {/* =================================================
                当前年份保费计划
                =================================================

                重点：

                premiumPlan
                    ↓
                今年缴费数据

                policies
                    ↓
                当前现金价值

                两份数据同时传进去
            ================================================= */}

            <div className="mb-6">

                <InsurancePremiumPlan
                    data={premiumPlan}
                    policies={policies}
                />

            </div>


            {/* =================================================
                家庭成员现金价值
            ================================================= */}

            <div className="mb-6">

                <InsuranceOwnerCashValue
                    policies={policies}
                />

            </div>


            {/* =================================================
                保单列表
            ================================================= */}
            
            

            
        </div>

    );

}