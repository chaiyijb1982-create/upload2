import {
    getInsurancePoliciesWithCashValue,
    getInsuranceSummary,
    getInsuranceCashValueHistory,
    getInsurancePremiumPlan,
    getInsuranceCashValueMatrix,
    getInsuranceCashValueYears,
} from "@/lib/insurance";


import InsuranceSummary
    from "@/components/InsuranceSummary";


import InsuranceTable
    from "@/components/InsuranceTable";


import InsuranceOwnerCashValue
    from "@/components/InsuranceOwnerCashValue";


import InsurancePremiumPlan
    from "@/components/InsurancePremiumPlan";


import InsurancePaymentTimeline
    from "@/components/InsurancePaymentTimeline";


import InsuranceCashValueMatrix
    from "@/components/InsuranceCashValueMatrix";


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
    // 现金价值历史（扁平）
    // =================================================

    const history =
        await getInsuranceCashValueHistory();


    // =================================================
    // 现金价值矩阵（按保单 × 年份）
    // =================================================

    const cashValueMatrix =
        await getInsuranceCashValueMatrix();


    const cashValueYears =
        getInsuranceCashValueYears(
            cashValueMatrix
        );


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

            <div className="mb-8">

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
            ================================================= */}

            <div className="mb-6">

                <InsurancePremiumPlan
                    data={premiumPlan}
                    policies={policies}
                />

            </div>


            {/* =================================================
                今年缴费时间表
            ================================================= */}

            <div className="mb-6">

                <InsurancePaymentTimeline
                    data={premiumPlan.items}
                    policies={policies}
                    currentYear={currentYear}
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
                保单现金价值（按年份）
            ================================================= */}

            <div className="mb-6">

                <InsuranceCashValueMatrix
                    rows={cashValueMatrix}
                    years={cashValueYears}
                    currentYear={currentYear}
                />

            </div>


            {/* =================================================
                保单列表（暂时隐藏）
            ================================================= */}

            {/*
            <div className="mb-6">

                <InsuranceTable
                    policies={policies}
                />

            </div>
            */}


        </div>

    );

}