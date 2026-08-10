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


import InsuranceChart
from "@/components/InsuranceChart";


import InsurancePremiumPlan
from "@/components/InsurancePremiumPlan";


import InsurancePremiumDetail
from "@/components/InsurancePremiumDetail";


export default async function InsurancePage(){



    // ============================
    // 保单 + 当前现金价值
    // ============================

    const policies =
        await getInsurancePoliciesWithCashValue();





    // ============================
    // 总览
    // ============================

    const summary =
        await getInsuranceSummary();





    // ============================
    // 今年保费计划
    // ============================

    const premiumPlan =
        await getInsurancePremiumPlan();





    // ============================
    // 现金价值历史
    // ============================

    const history =
        await getInsuranceCashValueHistory();







    return (

        <div className="p-8">



            <h1
            className="
            text-3xl
            font-bold
            mb-8
            "
            >

                保险资产中心

            </h1>







            {/* 总览 */}

            <InsuranceSummary

                data={summary}

            />









            {/* 今年保费计划 */}

            <InsurancePremiumPlan

                data={premiumPlan}

            />


            <InsurancePremiumDetail
                 data={premiumPlan}
            />






            {/* 家庭现金价值 */}

            <InsuranceOwnerCashValue

                policies={policies}

            />









            {/* 现金价值曲线 */}

            <InsuranceChart

                data={history}

            />









            {/* 保单列表 */}

            <InsuranceTable

                policies={policies}

            />






        </div>

    );


}