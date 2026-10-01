import { supabase } from "./supabase";


// =====================================================
// 类型
// =====================================================

type AnyRecord = Record<string, any>;

export type InsuranceCashValueMatrixRow = {
    policyId: string;
    policyName: string;
    owner: string;
    company: string;
    product: string;
    values: {
        year: number;
        cashValue: number;
    }[];
    // 实际缴费
    paidByYear: {
        year: number;
        amount: number;
    }[];
    // 计划应缴（按 annual_premium × pay_years 从 start_date 推算）
    plannedByYear: {
        year: number;
        amount: number;
    }[];
};


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


            if (
                rowDate.getTime()
                >
                today.getTime()
            ) {
                return;
            }


            if (
                !latestCash[key]
            ) {

                latestCash[key] =
                    row;

            }

        }
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


            const validPaidRecords =
                policyRecords.filter(
                    (record: AnyRecord) => {

                        return isDateReached(
                            record.payment_date,
                            today
                        );

                    }
                );


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


            const currentPayment =
                validPaidRecords.find(
                    (record: AnyRecord) => {

                        return isThisYear(
                            record.payment_date,
                            today.getFullYear()
                        );

                    }
                );


            const cashHistory =
                latestCash[
                    policyId
                ];


            const cashValue =
                toNumber(
                    cashHistory?.cash_value
                );


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

        }
    );


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


    const unpaidPremium =
        Math.max(
            premiumTotal -
            paidPremium,
            0
        );


    const coupleUnpaidPremium =
        policies
            .filter(
                (policy: AnyRecord)=>{

                    const owner =
                        String(
                            policy.owner || ""
                        ).trim();


                    return (
                        owner !== "儿子"
                    );

                }
            )
            .reduce(
                (
                    sum:number,
                    policy:AnyRecord
                )=>{


                    const premiumTotal =
                        getPolicyPremiumTotal(
                            policy
                        );


                    const paid =
                        toNumber(
                            policy.paid_amount
                        );


                    return (
                        sum +
                        Math.max(
                            premiumTotal -
                            paid,
                            0
                        )
                    );

                },
                0
            );


    const sonCashValue =
        policies
            .filter(
                (policy:AnyRecord)=>{

                    return (
                        String(
                            policy.owner || ""
                        ).trim()
                        ===
                        "儿子"
                    );

                }
            )
            .reduce(
                (
                    sum:number,
                    policy:AnyRecord
                )=>{

                    return (
                        sum +
                        toNumber(
                            policy.cash_value
                        )
                    );

                },
                0
            );


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
            monthlyIncome,


        coupleUnpaidPremium:
            coupleUnpaidPremium,


        sonCashValue:
            sonCashValue

    };

}


// =====================================================
// 现金价值历史（扁平原样）
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
// 现金价值历史 -> 按保单 × 年份 的矩阵
//
// 包含：
// 1. 每年实际现金价值
// 2. 每年实际缴费
// 3. 每年计划应缴（未来年份）
// =====================================================

export async function getInsuranceCashValueMatrix(): Promise<InsuranceCashValueMatrixRow[]> {

    const [
        policies,
        history,
        premiumRes,
    ] = await Promise.all([
        getInsurancePolicies(),
        getInsuranceCashValueHistory(),
        supabase
            .from("insurance_premium_records")
            .select("policy_id, amount, payment_date"),
    ]);


    if (premiumRes.error) {

        console.error(
            "cash value matrix premium records error:",
            premiumRes.error
        );

    }


    const premiumRecords: AnyRecord[] =
        premiumRes.data ?? [];


    // -----------------------------------------
    // 按 policy_id -> year -> 最新一条
    // -----------------------------------------

    const grouped = new Map<
        string,
        Map<number, { year: number; cashValue: number; date: string }>
    >();


    (history || []).forEach((item: AnyRecord) => {

        const policyId = normalizeId(item.policy_id);

        if (!policyId) {
            return;
        }

        const d = toDate(item.date);

        if (!d) {
            return;
        }

        const year = d.getFullYear();

        if (!grouped.has(policyId)) {
            grouped.set(policyId, new Map());
        }

        const yearMap = grouped.get(policyId)!;

        const existing = yearMap.get(year);

        if (
            !existing ||
            new Date(item.date).getTime() >
            new Date(existing.date).getTime()
        ) {

            yearMap.set(year, {
                year,
                cashValue: Math.round(toNumber(item.cash_value)),
                date: item.date,
            });

        }

    });


    // -----------------------------------------
    // 缴费记录：按 policy_id -> year 聚合
    // -----------------------------------------

    const paidMap = new Map<
        string,
        Map<number, number>
    >();


    premiumRecords.forEach((r: AnyRecord) => {

        const policyId = normalizeId(r.policy_id);

        if (!policyId) {
            return;
        }

        const d = toDate(r.payment_date);

        if (!d) {
            return;
        }

        const year = d.getFullYear();

        if (!paidMap.has(policyId)) {
            paidMap.set(policyId, new Map());
        }

        const yearMap = paidMap.get(policyId)!;

        const prev = yearMap.get(year) ?? 0;

        yearMap.set(
            year,
            prev + toNumber(r.amount)
        );

    });


    // -----------------------------------------
    // join 保单信息
    // -----------------------------------------

    const policyMap = new Map(
        policies.map((p: AnyRecord) => [
            normalizeId(p.id),
            p,
        ])
    );


    const rows: InsuranceCashValueMatrixRow[] = [];


    grouped.forEach((yearMap, policyId) => {

        const policy = policyMap.get(policyId);

        if (!policy) {
            return;
        }


        const values = Array.from(yearMap.values())
            .sort((a, b) => a.year - b.year)
            .map(v => ({
                year: v.year,
                cashValue: v.cashValue,
            }));


        if (values.length === 0) {
            return;
        }


        // -------------------------------------
        // 该保单每年实际缴费
        // -------------------------------------

        const paidYearMap =
            paidMap.get(policyId);

        const paidByYear =
            paidYearMap
                ? Array.from(paidYearMap.entries())
                    .map(([year, amount]) => ({
                        year,
                        amount: Math.round(amount),
                    }))
                    .sort((a, b) => a.year - b.year)
                : [];


        // -------------------------------------
        // 该保单每年计划应缴
        //
        // annual_premium × pay_years
        // 从 start_date 年开始，每年一笔
        //
        // 如果 start_date 为空，用最早缴费年份
        // 如果最早缴费年份也没有，跳过
        // -------------------------------------

        const annualPremium = toNumber(policy.annual_premium);
        const payYears = toNumber(policy.pay_years);

        const plannedByYear: {
            year: number;
            amount: number;
        }[] = [];


        if (annualPremium > 0 && payYears > 0) {

            let startYear: number | null = null;

            const startDate = toDate(policy.start_date);

            if (startDate) {
                startYear = startDate.getFullYear();
            }
            else if (paidByYear.length > 0) {
                startYear = paidByYear[0].year;
            }

            if (startYear !== null) {

                for (let i = 0; i < payYears; i++) {
                    plannedByYear.push({
                        year: startYear + i,
                        amount: Math.round(annualPremium),
                    });
                }

            }

        }


        rows.push({

            policyId,

            policyName:
                String(
                    policy.product ??
                    policy.insured_name ??
                    policy.id ??
                    ""
                ).trim(),

            owner:
                String(policy.owner ?? "").trim(),

            company:
                String(policy.company ?? "").trim(),

            product:
                String(policy.product ?? "").trim(),

            values,

            paidByYear,

            plannedByYear,

        });

    });


    rows.sort((a, b) => {

        if (a.owner !== b.owner) {
            return a.owner.localeCompare(b.owner);
        }

        return a.policyName.localeCompare(b.policyName);

    });


    return rows;

}


// =====================================================
// 从矩阵里抽出年份列
//
// 覆盖：
// 1. 现金价值历史出现过的年份
// 2. 实际缴费出现过的年份
// 3. 计划应缴覆盖的年份
// =====================================================

export function getInsuranceCashValueYears(
    matrix: InsuranceCashValueMatrixRow[]
): number[] {

    const set = new Set<number>();

    matrix.forEach(row => {
        row.values.forEach(v => set.add(v.year));
        row.paidByYear.forEach(v => set.add(v.year));
        row.plannedByYear.forEach(v => set.add(v.year));
    });

    return Array.from(set).sort((a, b) => a - b);

}


// =====================================================
// 年度保费计划
// =====================================================

export async function getInsurancePremiumPlan() {

    const today =
        new Date();

    const year =
        today.getFullYear();


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


    const latestCash =
        await getLatestCashValueMap();


    const {
        data: paidRows,
        error: paidError
    } = await supabase
        .from("insurance_paid_this_year")
        .select("policy_id")
        .eq("year", year);

    if (paidError) {
        console.error(
            "insurance paid_this_year error:",
            paidError
        );
    }

    const paidThisYearSet =
        new Set<string>(
            (paidRows ?? []).map(
                (r: AnyRecord) =>
                    normalizeId(r.policy_id)
            )
        );

    let total =
        0;

    let paid =
        0;

    const items:
        AnyRecord[] = [];


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


            const validPaidRecords =
                policyRecords.filter(
                    (record: AnyRecord) => {

                        return isDateReached(
                            record.payment_date,
                            today
                        );

                    }
                );


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


            const hasCurrentYearRecord =
                policyRecords.some(
                    (record: AnyRecord) => {

                        return isThisYear(
                            record.payment_date,
                            year
                        );

                    }
                );


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


            const startDate =
                toDate(
                    policy.start_date
                );

            let shouldInclude =
                false;


            if (
                hasCurrentYearRecord
            ) {

                shouldInclude =
                    true;

            }

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

            if (
                payYears <= 0 &&
                currentPaid
            ) {

                shouldInclude =
                    true;

            }

            if (
                !shouldInclude
            ) {

                return;

            }


            total +=
                premium;


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


            const paidThisYear =
                paidThisYearSet.has(policyId);

            if (
                paidThisYear
            ) {

                paid +=
                    premium;

            }


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


            const cashHistory =
                latestCash[
                    policyId
                ];

            const cashValue =
                toNumber(
                    cashHistory?.cash_value
                );


            items.push({

                id:
                    policy.id,

                policy_id:
                    policyId,

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

                paid_this_year:
                    paidThisYear,

                cash_value:
                    cashValue,

                cash_value_date:
                    cashHistory?.date ||
                    null

            });

        }
    );

    const unpaid =
        Math.max(
            total -
            paid,
            0
        );

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

    return {

        year,

        total,

        paid,

        unpaid,

        paidAmount:
            paidAmountTotal,

        paidPremium:
            paidAmountTotal,

        items

    };

}


// =====================================================
// 天天向上年度保险预测
// =====================================================

export async function getInsuranceYearProjection(){

    const policies =
        await getInsurancePoliciesWithCashValue();


    const history =
        await getInsuranceCashValueHistory();


    const result:any[] = [];


    const startYear = 2026;

    const endYear = 2042;


    for(
        let year=startYear;
        year<=endYear;
        year++
    ){


        let totalFuturePremium = 0;


        let coupleFuturePremium = 0;


        let sonCashValue = 0;


        policies.forEach(
            (policy:any)=>{


                const annualPremium =
                    toNumber(
                        policy.annual_premium
                    );


                const payYears =
                    toNumber(
                        policy.pay_years
                    );


                const startDate =
                    toDate(
                        policy.start_date
                    );


                if(
                    !startDate ||
                    annualPremium<=0 ||
                    payYears<=0
                ){
                    return;
                }



                const start =
                    startDate.getFullYear();



                let futurePremium = 0;



                for(
                    let i=0;
                    i<payYears;
                    i++
                ){

                    const payYear =
                        start+i;


                    if(
                        payYear>year
                    ){

                        futurePremium +=
                            annualPremium;

                    }

                }



                totalFuturePremium +=
                    futurePremium;



                const owner =
                    String(
                        policy.owner||""
                    ).trim();



                if(
                    owner !== "儿子"
                ){

                    coupleFuturePremium +=
                        futurePremium;

                }


            }
        );


        history.forEach(
            (row:any)=>{


                const d =
                    toDate(
                        row.date
                    );


                if(!d){
                    return;
                }


                if(
                    d.getFullYear()
                    ===
                    year
                ){


                    const policy: any =
                        policies.find(
                            (p: any) =>
                                normalizeId(p.id)
                                ===
                                normalizeId(row.policy_id)
                        );


                    if(
                        policy &&
                        String(
                            policy.owner ?? ""
                        ).trim()
                        ===
                        "儿子"
                    ){

                        sonCashValue +=
                            toNumber(
                                row.cash_value
                            );

                    }


                }

            }
        );




        result.push({

            year,


            totalFuturePremium,


            coupleFuturePremium,


            sonCashValue,

        });


    }


    return result;

}