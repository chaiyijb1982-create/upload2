import { supabase } from "./supabase";


// =====================================================
// 类型
// =====================================================

type AnyRecord = Record<string, any>;


// =====================================================
// 工具函数
// =====================================================

function normalizeId(value: any): string {
    return String(value ?? "").trim();
}


// =====================================================
// 数字
// =====================================================

function toNumber(value: any): number {
    const n = Number(value);

    if (!Number.isFinite(n)) {
        return 0;
    }

    return n;
}


// =====================================================
// 日期
// =====================================================

function toDate(value: any): Date | null {

    if (!value) {
        return null;
    }

    const d = new Date(value);

    if (Number.isNaN(d.getTime())) {
        return null;
    }

    return d;
}


// =====================================================
// 判断日期是否已经发生
// =====================================================

function isDateReached(
    value: any,
    today: Date
): boolean {

    const d = toDate(value);

    if (!d) {
        return false;
    }

    const paymentDate = new Date(
        d.getFullYear(),
        d.getMonth(),
        d.getDate()
    );

    const todayDate = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
    );

    return paymentDate <= todayDate;
}


// =====================================================
// 判断是不是某一年
// =====================================================

function isThisYear(
    value: any,
    year: number
): boolean {

    const d = toDate(value);

    if (!d) {
        return false;
    }

    return d.getFullYear() === year;
}


// =====================================================
// 日期格式
// =====================================================

function formatPaymentDate(value: any): string | null {

    const d = toDate(value);

    if (!d) {
        return null;
    }

    const year = d.getFullYear();

    const month = String(
        d.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        d.getDate()
    ).padStart(2, "0");

    return `${year}/${month}/${day}`;
}


// =====================================================
// 获取保单总保费
//
// 优先：premium_total
//
// 如果数据库没有 premium_total：
// annual_premium × pay_years
// =====================================================

function getPolicyPremiumTotal(
    policy: AnyRecord
): number {

    const premiumTotal = toNumber(
        policy.premium_total
    );

    if (premiumTotal > 0) {
        return premiumTotal;
    }

    const annualPremium = toNumber(
        policy.annual_premium
    );

    const payYears = toNumber(
        policy.pay_years
    );

    if (
        annualPremium > 0 &&
        payYears > 0
    ) {
        return (
            annualPremium *
            payYears
        );
    }

    return 0;
}


// =====================================================
// 获取现金价值历史
//
// 返回：
// {
//     [policy_id]: {
//         cash_value,
//         date
//     }
// }
// =====================================================

async function getLatestCashValueMap() {

    const {
        data: history,
        error
    } = await supabase
        .from("insurance_history")
        .select(
            `
            policy_id,
            cash_value,
            date
            `
        )
        .order(
            "date",
            {
                ascending: false
            }
        );


    if (error) {

        console.error(
            "insurance history error:",
            error
        );

        return {};

    }


    const today =
        new Date();


    const latestCash:
        Record<string, AnyRecord> = {};


    // =================================================
    // 第一轮
    //
    // 找截至今天最近的一笔
    // =================================================

    (history || []).forEach(
        (row: AnyRecord) => {

            const key =
                normalizeId(
                    row.policy_id
                );


            const rowDate =
                toDate(
                    row.date
                );


            if (
                !key ||
                !rowDate
            ) {
                return;
            }


            // -----------------------------------------
            // 未来数据不使用
            // -----------------------------------------

            if (
                rowDate.getTime()
                >
                today.getTime()
            ) {
                return;
            }


            // -----------------------------------------
            // 因为已经按照 date DESC 排序
            // 第一笔就是最新
            // -----------------------------------------

            if (
                !latestCash[key]
            ) {

                latestCash[key] =
                    row;

            }

        }
    );


    // =================================================
    // 第二轮
    //
    // 如果某张保单没有截至今天的数据，
    // 再取历史里最近的一笔
    // =================================================

    (history || []).forEach(
        (row: AnyRecord) => {

            const key =
                normalizeId(
                    row.policy_id
                );


            if (!key) {
                return;
            }


            if (
                latestCash[key]
            ) {
                return;
            }


            latestCash[key] =
                row;

        }
    );


    console.log(
        "========================================"
    );

    console.log(
        "INSURANCE CASH VALUE MAP"
    );

    console.log(
        "========================================"
    );

    console.log(
        latestCash
    );

    console.log(
        "========================================"
    );


    return latestCash;

}


// =====================================================
// 获取保险列表
// =====================================================

export async function getInsurancePolicies() {

    const {
        data,
        error
    } = await supabase
        .from("insurance_policies")
        .select("*")
        .order(
            "created_at",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "insurance policies error:",
            error
        );

        return [];

    }


    console.log(
        "INSURANCE POLICIES:",
        data
    );


    return data || [];

}


// =====================================================
// 获取保单
//
// 包含：
// 1. 当前现金价值
// 2. 已缴年份
// 3. 剩余缴费年份
// 4. 缴费进度
// 5. 累计已缴金额
// 6. 今年是否已经缴费
// 7. 保单整体状态
// =====================================================

export async function getInsurancePoliciesWithCashValue() {

    const policies =
        await getInsurancePolicies();


    // =================================================
    // 现金价值
    // =================================================

    const latestCash =
        await getLatestCashValueMap();


    // =================================================
    // 缴费记录
    // =================================================

    const {
        data: records,
        error: recordError
    } = await supabase
        .from("insurance_premium_records")
        .select("*")
        .order(
            "payment_date",
            {
                ascending: true
            }
        );


    if (recordError) {

        console.error(
            "premium records error:",
            recordError
        );

    }


    console.log(
        "INSURANCE PREMIUM RECORDS:",
        records
    );


    const today =
        new Date();


    // =================================================
    // 返回保单
    // =================================================

    return policies.map(
        (policy: AnyRecord) => {

            const policyId =
                normalizeId(
                    policy.id
                );


            // =============================================
            // 当前保单全部缴费记录
            // =============================================

            const policyRecords =
                (records || []).filter(
                    (record: AnyRecord) => {

                        return (
                            normalizeId(
                                record.policy_id
                            )
                            ===
                            policyId
                        );

                    }
                );


            // =============================================
            // 缴费年限
            // =============================================

            const payYears =
                toNumber(
                    policy.pay_years
                );


            // =============================================
            // 已经发生的缴费
            // =============================================

            const validPaidRecords =
                policyRecords.filter(
                    (record: AnyRecord) => {

                        return isDateReached(
                            record.payment_date,
                            today
                        );

                    }
                );


            // =============================================
            // 已缴年份
            // =============================================

            const paidYearSet =
                new Set<number>();


            validPaidRecords.forEach(
                (record: AnyRecord) => {

                    const d =
                        toDate(
                            record.payment_date
                        );


                    if (!d) {
                        return;
                    }


                    paidYearSet.add(
                        d.getFullYear()
                    );

                }
            );


            const paidYears =
                Math.min(
                    paidYearSet.size,
                    payYears
                );


            // =============================================
            // 剩余年份
            // =============================================

            const remainYears =
                Math.max(
                    payYears -
                    paidYears,
                    0
                );


            // =============================================
            // 缴费进度
            // =============================================

            const progress =
                payYears > 0
                    ?
                    Math.min(
                        Math.round(
                            (
                                paidYears /
                                payYears
                            ) *
                            100
                        ),
                        100
                    )
                    :
                    0;


            // =============================================
            // 今年实际缴费
            // =============================================

            const currentPayment =
                validPaidRecords.find(
                    (record: AnyRecord) => {

                        return isThisYear(
                            record.payment_date,
                            today.getFullYear()
                        );

                    }
                );


            // =============================================
            // 当前现金价值
            // =============================================

            const cashHistory =
                latestCash[
                    policyId
                ];


            const cashValue =
                toNumber(
                    cashHistory?.cash_value
                );


            // =============================================
            // 当前保单累计已交金额
            //
            // ★ 这里使用实际缴费记录
            // =============================================

            const paidAmount =
                validPaidRecords.reduce(
                    (
                        sum: number,
                        record: AnyRecord
                    ) => {

                        return (
                            sum +
                            toNumber(
                                record.amount
                            )
                        );

                    },
                    0
                );


            // =============================================
            // 总保费
            // =============================================

            const premiumTotal =
                getPolicyPremiumTotal(
                    policy
                );


            // =============================================
            // 整张保单是否缴费完成
            // =============================================

            const totalPolicyPaid =
                payYears > 0
                    ?
                    paidYears >= payYears
                    :
                    false;


            // =============================================
            // 今年是否已缴
            // =============================================

            const currentPaid =
                !!currentPayment;


            // =============================================
            // 返回
            // =============================================

            return {

                ...policy,


                premium_total:
                    premiumTotal,


                cash_value:
                    cashValue,


                cash_value_date:
                    cashHistory?.date ||
                    null,


                paid_years:
                    paidYears,


                remain_years:
                    remainYears,


                progress,


                // ★ 实际累计已缴
                paid_amount:
                    paidAmount,


                current_paid:
                    currentPaid,


                current_payment:
                    currentPayment ||
                    null,


                payment_date:
                    currentPayment
                        ?
                        formatPaymentDate(
                            currentPayment.payment_date
                        )
                        :
                        null,


                status:
                    totalPolicyPaid
                        ?
                        "paid"
                        :
                        "unpaid",


                records:
                    policyRecords

            };

        }
    );

}


// =====================================================
// 保险总览
// =====================================================

export async function getInsuranceSummary() {

    const policies =
        await getInsurancePoliciesWithCashValue();


    const today =
        new Date();


    // =================================================
    // 总保费
    // =================================================

    let premiumTotal = 0;


    // =================================================
    // 年领取
    // =================================================

    let annualIncome = 0;


    // =================================================
    // 月领取
    // =================================================

    let monthlyIncome = 0;


    // =================================================
    // 当前现金价值
    // =================================================

    let todayCashValue = 0;


    // =================================================
    // 按家庭成员统计现金价值
    // =================================================

    const ownerCashValue:
        Record<string, number> = {};


    // =================================================
    // 遍历所有保单
    // =================================================

    policies.forEach(
        (policy: AnyRecord) => {

            premiumTotal +=
                getPolicyPremiumTotal(
                    policy
                );


            annualIncome +=
                toNumber(
                    policy.annual_pension
                );


            monthlyIncome +=
                toNumber(
                    policy.monthly_pension
                );


            const cash =
                toNumber(
                    policy.cash_value
                );


            todayCashValue +=
                cash;


            const owner =
                String(
                    policy.owner ||
                    "未知"
                ).trim();


            if (
                !ownerCashValue[owner]
            ) {

                ownerCashValue[owner] =
                    0;

            }


            ownerCashValue[owner] +=
                cash;

        }
    );


    // =================================================
    // 实际缴费记录
    // =================================================

    const {
        data: premiumRecords,
        error: premiumRecordError
    } = await supabase
        .from("insurance_premium_records")
        .select(
            `
            policy_id,
            amount,
            payment_date
            `
        )
        .order(
            "payment_date",
            {
                ascending: true
            }
        );


    if (premiumRecordError) {

        console.error(
            "summary premium records error:",
            premiumRecordError
        );

    }


    // =================================================
    // 截止今天累计已交
    //
    // ★ 以实际缴费记录为准
    // =================================================

    const paidPremium =
        (premiumRecords || [])
            .filter(
                (record: AnyRecord) => {

                    return isDateReached(
                        record.payment_date,
                        today
                    );

                }
            )
            .reduce(
                (
                    sum: number,
                    record: AnyRecord
                ) => {

                    return (
                        sum +
                        toNumber(
                            record.amount
                        )
                    );

                },
                0
            );


    // =================================================
    // 未交保费
    // =================================================

    const unpaidPremium =
        Math.max(
            premiumTotal -
            paidPremium,
            0
        );


    // =================================================
    // 完成率
    // =================================================

    const premiumProgress =
        premiumTotal > 0
            ?
            Math.min(
                Math.round(
                    (
                        paidPremium /
                        premiumTotal
                    ) *
                    10000
                ) / 100,
                100
            )
            :
            0;


    // =================================================
    // 调试日志
    // =================================================

    console.log(
        "========================================"
    );

    console.log(
        "INSURANCE SUMMARY"
    );

    console.log(
        "========================================"
    );

    console.log(
        "保单数量:",
        policies.length
    );

    console.log(
        "总保费:",
        premiumTotal
    );

    console.log(
        "累计已交:",
        paidPremium
    );

    console.log(
        "累计未交:",
        unpaidPremium
    );

    console.log(
        "完成率:",
        premiumProgress
    );

    console.log(
        "当前现金价值:",
        todayCashValue
    );

    console.log(
        "家庭现金价值:",
        ownerCashValue
    );

    console.log(
        "年领取:",
        annualIncome
    );

    console.log(
        "月领取:",
        monthlyIncome
    );

    console.log(
        "========================================"
    );


    return {

        count:
            policies.length,


        premiumTotal:
            premiumTotal,


        totalPremium:
            premiumTotal,


        paidPremium:
            paidPremium,


        unpaidPremium:
            unpaidPremium,


        premiumProgress:
            premiumProgress,


        cashValue:
            todayCashValue,


        todayCashValue:
            todayCashValue,


        ownerCashValue:
            ownerCashValue,


        annualIncome:
            annualIncome,


        monthlyIncome:
            monthlyIncome,


        totalAnnualPension:
            annualIncome,


        totalMonthlyPension:
            monthlyIncome

    };

}


// =====================================================
// 现金价值历史
// =====================================================

export async function getInsuranceCashValueHistory() {

    const {
        data,
        error
    } = await supabase
        .from("insurance_history")
        .select(
            `
            policy_id,
            cash_value,
            date
            `
        )
        .order(
            "date",
            {
                ascending: true
            }
        );


    if (error) {

        console.error(
            "insurance history error:",
            error
        );

        return [];

    }


    return data || [];

}


// =====================================================
// 年度保费计划
//
// 返回：
// 1. 今年总应缴
// 2. 今年已经缴
// 3. 今年未缴
// 4. 每张保单年度状态
// 5. 每张保单实际累计已缴金额
// 6. 每张保单当前现金价值
// =====================================================

export async function getInsurancePremiumPlan() {

    const today =
        new Date();


    const year =
        today.getFullYear();


    // =================================================
    // 保单
    // =================================================

    const {
        data: policies,
        error: policyError
    } = await supabase
        .from("insurance_policies")
        .select("*");


    if (policyError) {

        console.error(
            "insurance premium plan policies error:",
            policyError
        );

    }


    // =================================================
    // 缴费记录
    // =================================================

    const {
        data: records,
        error: recordError
    } = await supabase
        .from("insurance_premium_records")
        .select("*")
        .order(
            "payment_date",
            {
                ascending: true
            }
        );


    if (recordError) {

        console.error(
            "insurance premium plan records error:",
            recordError
        );

    }


    // =================================================
    // 当前现金价值
    // =================================================

    const latestCash =
        await getLatestCashValueMap();


    console.log(
        "PREMIUM PLAN CASH MAP:",
        latestCash
    );


    console.log(
        "PREMIUM PLAN YEAR:",
        year
    );


    let total = 0;

    let paid = 0;


    const items:
        AnyRecord[] = [];


    // =================================================
    // 遍历保单
    // =================================================

    (policies || []).forEach(
        (policy: AnyRecord) => {

            const premium =
                toNumber(
                    policy.annual_premium
                );


            const payYears =
                toNumber(
                    policy.pay_years
                );


            if (
                premium <= 0 ||
                payYears <= 0
            ) {

                return;

            }


            // =============================================
            // 当前保单缴费记录
            // =============================================

            const policyRecords =
                (records || []).filter(
                    (record: AnyRecord) => {

                        return (
                            normalizeId(
                                record.policy_id
                            )
                            ===
                            normalizeId(
                                policy.id
                            )
                        );

                    }
                );


            // =============================================
            // 已经发生的缴费
            // =============================================

            const validPaidRecords =
                policyRecords.filter(
                    (record: AnyRecord) => {

                        return isDateReached(
                            record.payment_date,
                            today
                        );

                    }
                );


            // =============================================
            // ★ 当前保单实际累计已缴金额
            //
            // 直接累加数据库 amount
            // =============================================

            const paidAmount =
                validPaidRecords.reduce(
                    (
                        sum: number,
                        record: AnyRecord
                    ) => {

                        return (
                            sum +
                            toNumber(
                                record.amount
                            )
                        );

                    },
                    0
                );


            // =============================================
            // 今年实际缴费
            // =============================================

            const currentPayment =
                validPaidRecords.find(
                    (record: AnyRecord) => {

                        return isThisYear(
                            record.payment_date,
                            year
                        );

                    }
                );


            const currentPaid =
                !!currentPayment;


            // =============================================
            // 今年是否存在记录
            //
            // 即使日期是未来，
            // 只要今年有计划也纳入
            // =============================================

            const hasCurrentYearRecord =
                policyRecords.some(
                    (record: AnyRecord) => {

                        return isThisYear(
                            record.payment_date,
                            year
                        );

                    }
                );


            // =============================================
            // 所有缴费年份
            // =============================================

            const allYears =
                policyRecords
                    .map(
                        (record: AnyRecord) => {

                            const d =
                                toDate(
                                    record.payment_date
                                );

                            return d
                                ?
                                d.getFullYear()
                                :
                                null;

                        }
                    )
                    .filter(
                        (
                            v
                        ): v is number =>
                            v !== null
                    );


            // =============================================
            // 开始日期
            // =============================================

            const startDate =
                toDate(
                    policy.start_date
                );


            let shouldInclude =
                false;


            // =============================================
            // 情况1：
            // 今年已经有缴费记录
            // =============================================

            if (
                hasCurrentYearRecord
            ) {

                shouldInclude =
                    true;

            }


            // =============================================
            // 情况2：
            // 有 start_date
            // =============================================

            else if (
                startDate
            ) {

                const startYear =
                    startDate.getFullYear();


                const payIndex =
                    year -
                    startYear +
                    1;


                if (
                    payIndex > 0 &&
                    payIndex <= payYears
                ) {

                    shouldInclude =
                        true;

                }

            }


            // =============================================
            // 情况3：
            // 没有 start_date
            // 使用第一笔缴费年份
            // =============================================

            else if (
                allYears.length > 0
            ) {

                const firstYear =
                    Math.min(
                        ...allYears
                    );


                const payIndex =
                    year -
                    firstYear +
                    1;


                if (
                    payIndex > 0 &&
                    payIndex <= payYears
                ) {

                    shouldInclude =
                        true;

                }

            }


            if (
                !shouldInclude
            ) {

                return;

            }


            // =============================================
            // 加入今年应缴
            // =============================================

            total +=
                premium;


            // =============================================
            // 已缴年份
            // =============================================

            const paidYearSet =
                new Set<number>();


            validPaidRecords.forEach(
                (record: AnyRecord) => {

                    const d =
                        toDate(
                            record.payment_date
                        );


                    if (!d) {
                        return;
                    }


                    paidYearSet.add(
                        d.getFullYear()
                    );

                }
            );


            const paidYears =
                Math.min(
                    paidYearSet.size,
                    payYears
                );


            // =============================================
            // 今年已经交
            // =============================================

            if (
                currentPaid
            ) {

                paid +=
                    premium;

            }


            // =============================================
            // 剩余年份
            // =============================================

            const remainYears =
                Math.max(
                    payYears -
                    paidYears,
                    0
                );


            // =============================================
            // 进度
            // =============================================

            const progress =
                payYears > 0
                    ?
                    Math.min(
                        Math.round(
                            (
                                paidYears /
                                payYears
                            ) *
                            100
                        ),
                        100
                    )
                    :
                    0;


            // =============================================
            // 整张保单是否完成
            // =============================================

            const totalPolicyPaid =
                paidYears >= payYears;


            // =============================================
            // 当前现金价值
            // =============================================

            const policyId =
                normalizeId(
                    policy.id
                );


            const cashHistory =
                latestCash[
                    policyId
                ];


            const cashValue =
                toNumber(
                    cashHistory?.cash_value
                );


            const cashValueDate =
                cashHistory?.date ||
                null;


            // =============================================
            // 调试
            // =============================================

            console.log(
                "PREMIUM PLAN POLICY:",
                {
                    id: policy.id,
                    owner: policy.owner,
                    company: policy.company,
                    product: policy.product,
                    annualPremium: premium,
                    payYears,
                    paidYears,
                    paidAmount,
                    remainYears,
                    cashValue,
                    cashValueDate
                }
            );


            // =============================================
            // 最终项目
            // =============================================

            items.push({

                id:
                    policy.id,


                owner:
                    policy.owner,


                company:
                    policy.company,


                product:
                    policy.product,


                annual_premium:
                    premium,


                pay_years:
                    payYears,


                paid_years:
                    paidYears,


                remain_years:
                    remainYears,


                // ★★★ 实际累计已缴金额 ★★★

                paid_amount:
                    paidAmount,


                progress,


                current_paid:
                    currentPaid,


                current_status:
                    currentPaid
                        ?
                        "paid"
                        :
                        "unpaid",


                status:
                    totalPolicyPaid
                        ?
                        "paid"
                        :
                        "unpaid",


                payment_date:
                    currentPayment
                        ?
                        formatPaymentDate(
                            currentPayment.payment_date
                        )
                        :
                        null,


                current_payment:
                    currentPayment ||
                    null,


                // =========================================
                // 当前现金价值
                // =========================================

                cash_value:
                    cashValue,


                cash_value_date:
                    cashValueDate

            });

        }
    );


    // =================================================
    // 最终
    // =================================================

    const unpaid =
        Math.max(
            total -
            paid,
            0
        );


    // =================================================
    // ★★★ 新增：全部保单实际累计已缴金额 ★★★
    //
    // 注意：
    // 这里不能只统计今年的 paid
    // 而是统计所有 items 的 paid_amount
    // =================================================

    const paidAmountTotal =
        items.reduce(
            (
                sum: number,
                item: AnyRecord
            ) => {

                return (
                    sum +
                    toNumber(
                        item.paid_amount
                    )
                );

            },
            0
        );


    console.log(
        "========================================"
    );

    console.log(
        "PREMIUM PLAN RESULT:"
    );

    console.log(
        {
            year,
            total,
            paid,
            unpaid,
            paidAmountTotal,
            items
        }
    );

    console.log(
        "========================================"
    );


    return {

        year,


        // 今年应缴
        total,


        // 今年已经缴
        paid,


        // 今年未缴
        unpaid,


        // ★ 截止今天全部保单实际累计已缴
        paidAmount:
            paidAmountTotal,


        // 兼容其他页面
        paidPremium:
            paidAmountTotal,


        items

    };

}