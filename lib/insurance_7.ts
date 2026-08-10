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
// 优先使用 premium_total
//
// 如果没有：
// annual_premium × pay_years
//
// 一次性保单如果 premium_total 存在，
// 即使 annual_premium / pay_years 为 0，
// 也可以正常统计。
// =====================================================

function getPolicyPremiumTotal(
    policy: AnyRecord
): number {

    const premiumTotal =
        toNumber(
            policy.premium_total
        );

    if (premiumTotal > 0) {
        return premiumTotal;
    }

    const annualPremium =
        toNumber(
            policy.annual_premium
        );

    const payYears =
        toNumber(
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
// 获取全部保险历史
// =====================================================

async function getInsuranceHistory() {

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
                ascending: false
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
// 获取最新现金价值 Map
//
// 1. policy_id 全部 normalize
// 2. 每张保单独立寻找最新历史
// 3. 不因为 annual_premium/pay_years 为 0 排除
// 4. 允许一次性保单正常进入
// =====================================================

async function getLatestCashValueMap() {

    const history =
        await getInsuranceHistory();


    const today =
        new Date();


    const latestCash:
        Record<string, AnyRecord> = {};


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
            // 未来现金价值不使用
            // -----------------------------------------

            if (
                rowDate.getTime()
                >
                today.getTime()
            ) {
                return;
            }


            // -----------------------------------------
            // date DESC
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


    console.log(
        "========================================"
    );

    console.log(
        "INSURANCE CASH VALUE MAP"
    );

    console.log(
        "========================================"
    );

    Object.entries(
        latestCash
    ).forEach(
        (
            [
                policyId,
                row
            ]
        ) => {

            console.log(
                "policy:",
                policyId,
                "cash:",
                toNumber(
                    row.cash_value
                ),
                "date:",
                row.date
            );

        }
    );

    console.log(
        "========================================"
    );


    return latestCash;

}


// =====================================================
// 获取保单列表
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
// 获取保单 + 当前现金价值
// =====================================================

export async function getInsurancePoliciesWithCashValue() {

    const policies =
        await getInsurancePolicies();


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


    const today =
        new Date();


    return policies.map(
        (policy: AnyRecord) => {

            const policyId =
                normalizeId(
                    policy.id
                );


            // =========================================
            // 当前保单缴费记录
            // =========================================

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


            const payYears =
                toNumber(
                    policy.pay_years
                );


            // =========================================
            // 截止今天已经发生的缴费
            // =========================================

            const validPaidRecords =
                policyRecords.filter(
                    (record: AnyRecord) => {

                        return isDateReached(
                            record.payment_date,
                            today
                        );

                    }
                );


            // =========================================
            // 已缴年份
            // =========================================

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
                payYears > 0
                    ?
                    Math.min(
                        paidYearSet.size,
                        payYears
                    )
                    :
                    paidYearSet.size;


            // =========================================
            // 剩余年份
            // =========================================

            const remainYears =
                payYears > 0
                    ?
                    Math.max(
                        payYears -
                        paidYears,
                        0
                    )
                    :
                    0;


            // =========================================
            // 缴费进度
            // =========================================

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
                    100;


            // =========================================
            // 今年实际缴费
            // =========================================

            const currentPayment =
                validPaidRecords.find(
                    (record: AnyRecord) => {

                        return isThisYear(
                            record.payment_date,
                            today.getFullYear()
                        );

                    }
                );


            // =========================================
            // 当前现金价值
            // =========================================

            const cashHistory =
                latestCash[
                    policyId
                ];


            const cashValue =
                toNumber(
                    cashHistory?.cash_value
                );


            // =========================================
            // 实际累计已缴
            //
            // ★ 这里是单张保单实际历史缴费
            // =========================================

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


            // =========================================
            // 总保费
            // =========================================

            const premiumTotal =
                getPolicyPremiumTotal(
                    policy
                );


            // =========================================
            // 保单是否完成
            // =========================================

            const totalPolicyPaid =
                payYears > 0
                    ?
                    paidYears >= payYears
                    :
                    premiumTotal > 0 &&
                    paidAmount >= premiumTotal;


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

                paid_amount:
                    paidAmount,

                current_paid:
                    !!currentPayment,

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
//
// 这里的 paidPremium：
// ★ 全部历史实际缴费记录
// =====================================================

export async function getInsuranceSummary() {

    const policies =
        await getInsurancePoliciesWithCashValue();


    let premiumTotal =
        0;


    let annualIncome =
        0;


    let monthlyIncome =
        0;


    let todayCashValue =
        0;


    const ownerCashValue:
        Record<string, number> = {};


    // =================================================
    // 按每张保单逐张汇总
    // =================================================

    policies.forEach(
        (policy: AnyRecord) => {

            const policyPremium =
                getPolicyPremiumTotal(
                    policy
                );


            premiumTotal +=
                policyPremium;


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


            console.log(
                "INSURANCE POLICY SUMMARY:",
                {
                    id: policy.id,
                    owner: policy.owner,
                    company: policy.company,
                    product: policy.product,
                    premiumTotal:
                        policyPremium,
                    cashValue:
                        cash,
                    cashValueDate:
                        policy.cash_value_date
                }
            );

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


    const today =
        new Date();


    // =================================================
    // 截止今天实际已缴
    //
    // ★ 全部保单
    // ★ 全部历史缴费记录
    // ★ payment_date <= today
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
    // 未缴
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
    // 最终调试
    // =================================================

    console.log(
        "========================================"
    );

    console.log(
        "INSURANCE SUMMARY FINAL"
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
        "累计实际已缴:",
        paidPremium
    );

    console.log(
        "累计未缴:",
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
// 重要：
//
// items
// = 今年的缴费计划
//
// paidAmount
// = 全部历史实际已缴
//
// 两者彻底分开。
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


    // =================================================
    // 今年计划金额
    // =================================================

    let total =
        0;


    let paid =
        0;


    const items:
        AnyRecord[] = [];


    // =================================================
    // 遍历保单
    //
    // ★ items 只负责“今年缴费计划”
    // ★ 不负责计算历史累计已缴
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


            const policyId =
                normalizeId(
                    policy.id
                );


            // =========================================
            // 当前保单记录
            // =========================================

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


            // =========================================
            // 已发生缴费
            // =========================================

            const validPaidRecords =
                policyRecords.filter(
                    (record: AnyRecord) => {

                        return isDateReached(
                            record.payment_date,
                            today
                        );

                    }
                );


            // =========================================
            // 实际累计已缴
            //
            // ★ 单张保单历史实际已缴
            // =========================================

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


            // =========================================
            // 今年缴费
            // =========================================

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


            // =========================================
            // 今年是否存在计划
            // =========================================

            const hasCurrentYearRecord =
                policyRecords.some(
                    (record: AnyRecord) => {

                        return isThisYear(
                            record.payment_date,
                            year
                        );

                    }
                );


            // =========================================
            // 所有年份
            // =========================================

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


            // =========================================
            // 开始日期
            // =========================================

            const startDate =
                toDate(
                    policy.start_date
                );


            let shouldInclude =
                false;


            // =========================================
            // 有今年记录
            // =========================================

            if (
                hasCurrentYearRecord
            ) {

                shouldInclude =
                    true;

            }


            // =========================================
            // 有 start_date
            // =========================================

            else if (
                startDate &&
                payYears > 0
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


            // =========================================
            // 没有 start_date
            // =========================================

            else if (
                allYears.length > 0 &&
                payYears > 0
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


            // =========================================
            // 一次性保单
            //
            // 如果没有年度缴费逻辑，
            // 但今年确实发生实际缴费，
            // 也纳入计划。
            // =========================================

            if (
                payYears <= 0 &&
                currentPaid
            ) {

                shouldInclude =
                    true;

            }


            // =========================================
            // 不属于今年计划
            //
            // ★ 这里只影响 items
            //
            // ★ 绝对不能影响全部历史 paidAmount
            // =========================================

            if (
                !shouldInclude
            ) {

                return;

            }


            // =========================================
            // 今年应缴
            // =========================================

            total +=
                premium;


            // =========================================
            // 已缴年份
            // =========================================

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
                payYears > 0
                    ?
                    Math.min(
                        paidYearSet.size,
                        payYears
                    )
                    :
                    paidYearSet.size;


            // =========================================
            // 今年已缴
            // =========================================

            if (
                currentPaid
            ) {

                paid +=
                    premium;

            }


            // =========================================
            // 剩余年份
            // =========================================

            const remainYears =
                payYears > 0
                    ?
                    Math.max(
                        payYears -
                        paidYears,
                        0
                    )
                    :
                    0;


            // =========================================
            // 进度
            // =========================================

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
                    100;


            // =========================================
            // 是否完成
            // =========================================

            const premiumTotal =
                getPolicyPremiumTotal(
                    policy
                );


            const totalPolicyPaid =
                payYears > 0
                    ?
                    paidYears >= payYears
                    :
                    premiumTotal > 0 &&
                    paidAmount >= premiumTotal;


            // =========================================
            // 当前现金价值
            // =========================================

            const cashHistory =
                latestCash[
                    policyId
                ];


            const cashValue =
                toNumber(
                    cashHistory?.cash_value
                );


            // =========================================
            // 加入今年计划
            // =========================================

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

                cash_value:
                    cashValue,

                cash_value_date:
                    cashHistory?.date ||
                    null

            });

        }
    );


    // =================================================
    // 今年计划未缴
    // =================================================

    const unpaid =
        Math.max(
            total -
            paid,
            0
        );


    // =================================================
    // ★★★ 核心修复 ★★★
    //
    // 全部历史实际已缴
    //
    // 这里绝对不能使用 items
    //
    // 因为 items 只是今年缴费计划。
    //
    // 正确逻辑：
    //
    // 全部 insurance_premium_records
    // +
    // payment_date <= 今天
    // +
    // SUM(amount)
    //
    // = 到今天为止真实已经缴掉的钱
    // =================================================

    const paidAmountTotal =
        (records || [])
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
    // 全部保单总保费
    //
    // ★ 不使用 items
    // ★ 统计所有 insurance_policies
    // =================================================

    const totalPremium =
        (policies || [])
            .reduce(
                (
                    sum: number,
                    policy: AnyRecord
                ) => {

                    return (
                        sum +
                        getPolicyPremiumTotal(
                            policy
                        )
                    );

                },
                0
            );


    // =================================================
    // 全部未来待缴
    // =================================================

    const remainingPremium =
        Math.max(
            totalPremium -
            paidAmountTotal,
            0
        );


    // =================================================
    // 全部缴费完成率
    // =================================================

    const totalPremiumProgress =
        totalPremium > 0
            ?
            Math.min(
                Math.round(
                    (
                        paidAmountTotal /
                        totalPremium
                    ) *
                    10000
                ) / 100,
                100
            )
            :
            0;


    // =================================================
    // 最终调试
    // =================================================

    console.log(
        "========================================"
    );

    console.log(
        "INSURANCE PREMIUM PLAN FINAL"
    );

    console.log(
        "========================================"
    );

    console.log(
        "全部保单数量:",
        (policies || []).length
    );

    console.log(
        "今年计划保单数量:",
        items.length
    );

    console.log(
        "今年计划总额:",
        total
    );

    console.log(
        "今年已经缴:",
        paid
    );

    console.log(
        "今年未缴:",
        unpaid
    );

    console.log(
        "全部保单总保费:",
        totalPremium
    );

    console.log(
        "全部历史实际已缴:",
        paidAmountTotal
    );

    console.log(
        "全部未来待缴:",
        remainingPremium
    );

    console.log(
        "全部缴费完成率:",
        totalPremiumProgress
    );

    console.log(
        "========================================"
    );


    // =================================================
    // 返回
    // =================================================

    return {

        year,

        // ---------------------------------------------
        // 今年缴费计划
        // ---------------------------------------------

        total,

        paid,

        unpaid,

        // ---------------------------------------------
        // 全部保单总保费
        // ---------------------------------------------

        totalPremium,

        premiumTotal:
            totalPremium,

        // ---------------------------------------------
        // 全部历史实际已缴
        // ---------------------------------------------

        paidAmount:
            paidAmountTotal,

        paidPremium:
            paidAmountTotal,

        // ---------------------------------------------
        // 全部未来待缴
        // ---------------------------------------------

        remainingPremium,

        unpaidPremium:
            remainingPremium,

        // ---------------------------------------------
        // 全部缴费进度
        // ---------------------------------------------

        totalPremiumProgress,

        premiumProgress:
            totalPremiumProgress,

        // ---------------------------------------------
        // 今年缴费计划明细
        // ---------------------------------------------

        items

    };

}