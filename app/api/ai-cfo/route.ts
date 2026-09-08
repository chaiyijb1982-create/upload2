import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase-server";

// =====================================================
// AI CFO API
// GET /api/ai-cfo
//
// 鉴权：
// Authorization: Bearer <AI_CFO_API_KEY>
//
// 资产口径：
// asset_history.total_asset
//   = 基金 / 股票 / 债券等原始金融资产，不含固收
//
// fixed_income_assets.amount
//   = 固收
//
// total_financial_assets
//   = asset_history.total_asset + 固收
//
// 负债口径：
// total_debt
//   = 所有 loans.remaining_amount
//
// mortgage_debt
//   = type = 房贷
//   或 include_financial_freedom = false
//
// non_mortgage_debt
//   = include_financial_freedom = true
//
// Financial Freedom：
// ff_debt
//   = include_financial_freedom = true
//   = 不包含房贷
// =====================================================

const REQUIRED_TABLES = [
  "asset_history",
  "holdings",
  "fixed_income_assets",
  "loans",
  "expense_transactions",
] as const;

const OPTIONAL_TABLES = [
  "holding_native_currency",
  "insurance",
  "insurance_cash_value_history",
  "credit_card_monthly_bills",
  "credit_card_monthly_funding",
  "financial_freedom_history",
  "fx_exchanges",
] as const;

type TableName =
  | (typeof REQUIRED_TABLES)[number]
  | (typeof OPTIONAL_TABLES)[number];

type AnyRecord = Record<string, any>;

type DatasetResult = {
  table: string;
  available: boolean;
  count: number;
  data: AnyRecord[];
  error?: string;
};

type LoanInfo = {
  id: string | number | null;
  name: string | null;
  type: string | null;
  remaining_amount: number;
  monthly_payment: number;
  include_financial_freedom: boolean;
  raw: AnyRecord;
};

// =====================================================
// 基础工具
// =====================================================

function toNumber(value: unknown, fallback = 0): number {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return fallback;
  }

  return n;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function round4(value: number): number {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function sumBy(
  rows: AnyRecord[],
  fields: string[]
): number {
  return rows.reduce((sum, row) => {
    for (const field of fields) {
      const value = row?.[field];

      if (
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        const n = Number(value);

        if (Number.isFinite(n)) {
          return sum + n;
        }
      }
    }

    return sum;
  }, 0);
}

function getRowDate(row: AnyRecord): string | null {
  const value =
    row?.snapshot_date ??
    row?.date ??
    row?.transaction_date ??
    row?.expense_date ??
    row?.exchange_date ??
    row?.created_at ??
    row?.updated_at ??
    null;

  return value ? String(value) : null;
}

function getLoanName(row: AnyRecord): string | null {
  const value =
    row?.name ??
    row?.title ??
    row?.loan_name ??
    row?.product_name ??
    null;

  return value === null || value === undefined
    ? null
    : String(value);
}

function getLoanType(row: AnyRecord): string | null {
  const value =
    row?.type ??
    row?.loan_type ??
    row?.category ??
    null;

  return value === null || value === undefined
    ? null
    : String(value);
}

function isMortgageLoan(row: AnyRecord): boolean {
  const type = getLoanType(row)?.toLowerCase() ?? "";
  const name = getLoanName(row)?.toLowerCase() ?? "";

  return (
    type.includes("房贷") ||
    name.includes("房贷") ||
    name.includes("公积金贷") ||
    name.includes("商贷")
  );
}

function isIncludedInFinancialFreedom(
  row: AnyRecord
): boolean {
  return row?.include_financial_freedom === true;
}

function normalizeLoan(row: AnyRecord): LoanInfo {
  return {
    id: row?.id ?? null,
    name: getLoanName(row),
    type: getLoanType(row),
    remaining_amount: round2(
      toNumber(
        row?.remaining_amount ??
          row?.balance ??
          row?.amount ??
          0
      )
    ),
    monthly_payment: round2(
      toNumber(
        row?.monthly_payment ??
          row?.payment ??
          0
      )
    ),
    include_financial_freedom:
      isIncludedInFinancialFreedom(row),
    raw: row,
  };
}

function sortNewest(
  rows: AnyRecord[]
): AnyRecord[] {
  return [...rows].sort((a, b) => {
    const aTime = new Date(
      getRowDate(a) ?? 0
    ).getTime();

    const bTime = new Date(
      getRowDate(b) ?? 0
    ).getTime();

    return bTime - aTime;
  });
}

function uniqueById(
  rows: AnyRecord[]
): AnyRecord[] {
  const seen = new Set<string>();
  const result: AnyRecord[] = [];

  for (const row of rows) {
    const key =
      row?.id !== undefined &&
      row?.id !== null
        ? String(row.id)
        : JSON.stringify(row);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(row);
  }

  return result;
}

// =====================================================
// Supabase 数据读取
// =====================================================

async function loadTable(
  supabase: ReturnType<
    typeof createSupabaseServerClient
  >,
  table: TableName,
  required: boolean
): Promise<DatasetResult> {
  try {
    const { data, error } = await supabase
      .from(table)
      .select("*");

    if (error) {
      if (required) {
        throw new Error(
          `${table}: ${error.message}`
        );
      }

      return {
        table,
        available: false,
        count: 0,
        data: [],
        error: error.message,
      };
    }

    const rows = Array.isArray(data)
      ? data
      : [];

    return {
      table,
      available: true,
      count: rows.length,
      data: rows,
    };
  } catch (error) {
    if (required) {
      throw error;
    }

    return {
      table,
      available: false,
      count: 0,
      data: [],
      error:
        error instanceof Error
          ? error.message
          : String(error),
    };
  }
}

// =====================================================
// GET
// =====================================================

export async function GET(
  request: Request
) {
  try {
    // =================================================
    // 1. API Key 鉴权
    // =================================================

    const expectedApiKey =
      process.env.AI_CFO_API_KEY ?? "";

    if (!expectedApiKey) {
      return NextResponse.json(
        {
          success: false,
          error: "AI_CFO_API_KEY 未配置",
        },
        { status: 500 }
      );
    }

    const authorization =
      request.headers.get("authorization") ?? "";

    const match =
      authorization.match(
        /^Bearer\s+(.+)$/i
      );

    const providedApiKey =
      match?.[1]?.trim() ?? "";

    if (
      !providedApiKey ||
      providedApiKey !== expectedApiKey
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Unauthorized",
        },
        { status: 401 }
      );
    }

    // =================================================
    // 2. Supabase
    // =================================================

    const supabase =
      createSupabaseServerClient();

    // =================================================
    // 3. 加载必需数据
    // =================================================

    const requiredResults =
      await Promise.all(
        REQUIRED_TABLES.map((table) =>
          loadTable(
            supabase,
            table,
            true
          )
        )
      );

    // =================================================
    // 4. 加载可选数据
    // =================================================

    const optionalResults =
      await Promise.all(
        OPTIONAL_TABLES.map((table) =>
          loadTable(
            supabase,
            table,
            false
          )
        )
      );

    const allResults = [
      ...requiredResults,
      ...optionalResults,
    ];

    const datasets: Record<
      string,
      DatasetResult
    > = {};

    for (const result of allResults) {
      datasets[result.table] = result;
    }

    // =================================================
    // 5. 原始数据
    // =================================================

    const assetHistory =
      datasets.asset_history.data ?? [];

    const holdings =
      datasets.holdings.data ?? [];

    const fixedIncome =
      datasets.fixed_income_assets.data ?? [];

    const loansRaw =
      datasets.loans.data ?? [];

    const expenses =
      datasets.expense_transactions.data ?? [];

    const financialFreedomHistory =
      datasets.financial_freedom_history
        ?.data ?? [];

    // =================================================
    // 6. 最新 Asset History
    //
    // asset_history.total_asset
    // = 不含固收的原始金融资产
    // =================================================

    const latestAssetHistory =
      sortNewest(assetHistory)[0] ?? null;

    const rawFinancialAssets = round2(
      toNumber(
        latestAssetHistory?.total_asset ??
          latestAssetHistory?.amount ??
          0
      )
    );

    // =================================================
    // 7. 固收
    //
    // fixed_income_assets 是独立于
    // asset_history.total_asset 的资产类别
    // =================================================

    const fixedIncomeTotal = round2(
      sumBy(
        fixedIncome,
        [
          "amount",
          "balance",
          "current_amount",
        ]
      )
    );

    // =================================================
    // 8. Total Wealth
    //
    // 原始资产 + 固收
    // =================================================

    const totalFinancialAssets =
      round2(
        rawFinancialAssets +
          fixedIncomeTotal
      );

    // =================================================
    // 9. Holdings
    //
    // holdings.amount 应与
    // asset_history.total_asset 对应
    // =================================================

    const holdingsAmount = round2(
      sumBy(holdings, ["amount"])
    );

    const holdingsCost = round2(
      sumBy(holdings, ["cost"])
    );

    const holdingsProfit = round2(
      sumBy(holdings, ["profit"])
    );

    // =================================================
    // 10. Loans
    // =================================================

    const loans: LoanInfo[] =
      loansRaw.map(normalizeLoan);

    // 所有贷款
    const totalDebt = round2(
      loans.reduce(
        (sum, loan) =>
          sum + loan.remaining_amount,
        0
      )
    );

    // Financial Freedom 纳入的负债
    //
    // include_financial_freedom = true
    //
    // 这就是“不含房贷”的 FF 负债
    const ffDebt = round2(
      loans
        .filter(
          (loan) =>
            loan.include_financial_freedom
        )
        .reduce(
          (sum, loan) =>
            sum + loan.remaining_amount,
          0
        )
    );

    // 房贷
    //
    // 当前你的数据中：
    // 房贷 = include_financial_freedom false
    //
    // 同时增加 type/name 判断，
    // 避免以后数据字段变化导致房贷被漏掉。
    const mortgageDebt = round2(
      loans
        .filter((loan) =>
          isMortgageLoan(loan.raw)
        )
        .reduce(
          (sum, loan) =>
            sum + loan.remaining_amount,
          0
        )
    );

    // 非房贷
    const nonMortgageDebt = round2(
      totalDebt - mortgageDebt
    );

    // =================================================
    // 11. 净资产
    //
    // 真实家庭净资产：
    //
    // Total Wealth
    // - 全部负债
    // =================================================

    const netWorth = round2(
      totalFinancialAssets -
        totalDebt
    );

    // =================================================
    // 12. Financial Freedom
    //
    // Total Wealth
    // - 不含房贷的负债
    // =================================================

    const financialFreedomNetWealth =
      round2(
        totalFinancialAssets -
          ffDebt
      );

    // =================================================
    // 13. Financial Freedom 数据库最新记录
    // =================================================

    const latestFinancialFreedom =
      sortNewest(
        financialFreedomHistory
      )[0] ?? null;

    const freedomTarget = round2(
      toNumber(
        latestFinancialFreedom?.freedom_target ??
          5050000
      )
    );

    const freedomGap = round2(
      Math.max(
        freedomTarget -
          financialFreedomNetWealth,
        0
      )
    );

    const freedomRate =
      freedomTarget > 0
        ? round4(
            (financialFreedomNetWealth /
              freedomTarget) *
              100
          )
        : 0;

    // =================================================
    // 14. 用数据库 FF 记录进行核对
    //
    // 注意：
    // 数据库中的 total_asset 是 FF 自己保存的结果。
    // AI CFO 使用统一公式重新计算。
    // =================================================

    const ffDatabaseAsset =
      latestFinancialFreedom
        ? round2(
            toNumber(
              latestFinancialFreedom.total_asset
            )
          )
        : null;

    const ffReconciliationDifference =
      ffDatabaseAsset === null
        ? null
        : round2(
            financialFreedomNetWealth -
              ffDatabaseAsset
          );

    // =================================================
    // 15. 资产结构
    // =================================================

    const rawAssetBreakdown = {
      raw_financial_assets:
        rawFinancialAssets,

      fixed_income:
        fixedIncomeTotal,

      total_financial_assets:
        totalFinancialAssets,
    };

    // =================================================
    // 16. 负债结构
    // =================================================

    const debtBreakdown = {
      total_debt: totalDebt,

      mortgage_debt:
        mortgageDebt,

      non_mortgage_debt:
        nonMortgageDebt,

      financial_freedom_debt:
        ffDebt,
    };

    // =================================================
    // 17. 月度还款
    // =================================================

    const totalMonthlyDebtPayment =
      round2(
        loans.reduce(
          (sum, loan) =>
            sum + loan.monthly_payment,
          0
        )
      );

    const mortgageMonthlyPayment =
      round2(
        loans
          .filter((loan) =>
            isMortgageLoan(loan.raw)
          )
          .reduce(
            (sum, loan) =>
              sum + loan.monthly_payment,
            0
          )
      );

    const ffMonthlyDebtPayment =
      round2(
        loans
          .filter(
            (loan) =>
              loan.include_financial_freedom
          )
          .reduce(
            (sum, loan) =>
              sum + loan.monthly_payment,
            0
          )
      );

    // =================================================
    // 18. Expense 基础信息
    // =================================================

    const expenseAmounts =
      expenses
        .map((row) =>
          toNumber(
            row?.amount ??
              row?.total ??
              row?.value ??
              0
          )
        )
        .filter((value) =>
          Number.isFinite(value)
        );

    const expenseTotal = round2(
      expenseAmounts.reduce(
        (sum, value) =>
          sum + value,
        0
      )
    );

    // =================================================
    // 19. Holdings 按 Category 汇总
    // =================================================

    const categoryMap =
      new Map<
        string,
        {
          category: string;
          amount: number;
          cost: number;
          profit: number;
        }
      >();

    for (const holding of holdings) {
      const category =
        String(
          holding?.category ??
            "未分类"
        );

      const existing =
        categoryMap.get(category) ?? {
          category,
          amount: 0,
          cost: 0,
          profit: 0,
        };

      existing.amount += toNumber(
        holding?.amount
      );

      existing.cost += toNumber(
        holding?.cost
      );

      existing.profit += toNumber(
        holding?.profit
      );

      categoryMap.set(
        category,
        existing
      );
    }

    const portfolioByCategory =
      Array.from(
        categoryMap.values()
      ).map((item) => ({
        category: item.category,
        amount: round2(item.amount),
        cost: round2(item.cost),
        profit: round2(item.profit),
        allocation:
          rawFinancialAssets > 0
            ? round4(
                (item.amount /
                  rawFinancialAssets) *
                  100
              )
            : 0,
      }));

    portfolioByCategory.sort(
      (a, b) =>
        b.amount - a.amount
    );

    // =================================================
    // 20. Holding 明细
    // =================================================

    const portfolioHoldings =
      holdings.map((holding) => ({
        id: holding?.id ?? null,
        code: holding?.code ?? null,
        name: holding?.name ?? null,
        market:
          holding?.market ?? null,
        category:
          holding?.category ?? null,
        amount: round2(
          toNumber(
            holding?.amount
          )
        ),
        cost: round2(
          toNumber(
            holding?.cost
          )
        ),
        profit: round2(
          toNumber(
            holding?.profit
          )
        ),
        profit_rate:
          holding?.profit_rate ??
          null,
        currency:
          holding?.currency ?? null,
        shares:
          holding?.shares ?? null,
        nav:
          holding?.nav ?? null,
        snapshot_date:
          holding?.snapshot_date ??
          null,
        updated_at:
          holding?.updated_at ??
          null,
      }));

    // =================================================
    // 21. 固收明细
    // =================================================

    const fixedIncomeDetails =
      fixedIncome.map((item) => ({
        id: item?.id ?? null,

        name:
          item?.name ??
          item?.title ??
          item?.product_name ??
          null,

        amount: round2(
          toNumber(
            item?.amount ??
              item?.balance ??
              item?.current_amount ??
              0
          )
        ),

        category:
          item?.category ?? null,

        currency:
          item?.currency ?? null,

        rate:
          item?.rate ??
          item?.interest_rate ??
          null,

        maturity_date:
          item?.maturity_date ??
          null,

        updated_at:
          item?.updated_at ??
          null,
      }));

    // =================================================
    // 22. 贷款明细
    // =================================================

    const loanDetails =
      loans.map((loan) => ({
        id: loan.id,
        name: loan.name,
        type: loan.type,

        remaining_amount:
          loan.remaining_amount,

        monthly_payment:
          loan.monthly_payment,

        include_financial_freedom:
          loan.include_financial_freedom,

        is_mortgage:
          isMortgageLoan(
            loan.raw
          ),
      }));


// =====================================================
// AI CFO Decision Layer
//
// 注意：
// 这里只负责计算事实和风险指标。
// 不直接生成买卖建议。
// =====================================================

const debtToWealthRatio =
  totalFinancialAssets > 0
    ? round4(
        (totalDebt /
          totalFinancialAssets) *
          100
      )
    : 0;

const mortgageToWealthRatio =
  totalFinancialAssets > 0
    ? round4(
        (mortgageDebt /
          totalFinancialAssets) *
          100
      )
    : 0;

const nonMortgageToWealthRatio =
  totalFinancialAssets > 0
    ? round4(
        (nonMortgageDebt /
          totalFinancialAssets) *
          100
      )
    : 0;

const fixedIncomeRatio =
  totalFinancialAssets > 0
    ? round4(
        (fixedIncomeTotal /
          totalFinancialAssets) *
          100
      )
    : 0;

const rawPortfolioRatio =
  totalFinancialAssets > 0
    ? round4(
        (rawFinancialAssets /
          totalFinancialAssets) *
          100
      )
    : 0;

const financialFreedomProgress =
  freedomTarget > 0
    ? round4(
        (financialFreedomNetWealth /
          freedomTarget) *
          100
      )
    : 0;

const decisionLayer = {
  as_of:
    latestAssetHistory?.snapshot_date ??
    new Date()
      .toISOString()
      .slice(0, 10),

  // ===================================================
  // 资产健康
  // ===================================================

  asset_health: {
    raw_financial_assets:
      rawFinancialAssets,

    fixed_income:
      fixedIncomeTotal,

    total_financial_assets:
      totalFinancialAssets,

    raw_financial_assets_ratio:
      rawPortfolioRatio,

    fixed_income_ratio:
      fixedIncomeRatio,

    holdings_count:
      holdings.length,

    fixed_income_count:
      fixedIncome.length,

    holdings_profit:
      holdingsProfit,

    holdings_cost:
      holdingsCost,
  },

  // ===================================================
  // 负债健康
  // ===================================================

  debt_health: {
    total_debt:
      totalDebt,

    mortgage_debt:
      mortgageDebt,

    non_mortgage_debt:
      nonMortgageDebt,

    debt_to_wealth_ratio:
      debtToWealthRatio,

    mortgage_to_wealth_ratio:
      mortgageToWealthRatio,

    non_mortgage_to_wealth_ratio:
      nonMortgageToWealthRatio,

    total_monthly_payment:
      totalMonthlyDebtPayment,

    mortgage_monthly_payment:
      mortgageMonthlyPayment,

    financial_freedom_monthly_payment:
      ffMonthlyDebtPayment,

    real_net_worth:
      netWorth,
  },

  // ===================================================
  // Financial Freedom
  // ===================================================

  financial_freedom: {
    total_wealth:
      totalFinancialAssets,

    ff_debt:
      ffDebt,

    ff_net_wealth:
      financialFreedomNetWealth,

    target:
      freedomTarget,

    gap:
      freedomGap,

    progress:
      financialFreedomProgress,

    mortgage_excluded:
      true,

    database_reconciliation_difference:
      ffReconciliationDifference,
  },

  // ===================================================
  // Portfolio
  // ===================================================

  portfolio: {
    by_category:
      portfolioByCategory,

    holdings_count:
      holdings.length,

    holdings_cost:
      holdingsCost,

    holdings_profit:
      holdingsProfit,

    fixed_income:
      fixedIncomeDetails,
  },

  // ===================================================
  // CFO 当前应该关注什么
  //
  // 这里仍然是“事实型优先级”，
  // 暂时不生成买卖建议。
  // ===================================================

  priorities: [
    {
      priority: 1,
      area: "net_worth",
      metric: "real_net_worth",
      value: netWorth,
      description:
        "真实净资产按全部金融资产减全部负债计算。",
    },

    {
      priority: 2,
      area: "debt",
      metric: "non_mortgage_debt",
      value: nonMortgageDebt,
      description:
        "非房贷负债纳入 Financial Freedom 计算。",
    },

    {
      priority: 3,
      area: "financial_freedom",
      metric: "freedom_progress",
      value: financialFreedomProgress,
      description:
        "Financial Freedom 当前完成度。",
    },

    {
      priority: 4,
      area: "portfolio",
      metric: "fixed_income_ratio",
      value: fixedIncomeRatio,
      description:
        "固收占 Total Wealth 的比例。",
    },
  ],

  // ===================================================
  // AI 使用规则
  // ===================================================

  rules: {
    do_not_double_count_fixed_income:
      true,

    fixed_income_is_separate_asset:
      true,

    total_debt_includes_mortgage:
      true,

    financial_freedom_excludes_mortgage:
      true,

    real_net_worth_uses_all_debt:
      true,

    financial_freedom_uses_ff_debt_only:
      true,

    do_not_generate_trade_instruction_from_data_layer:
      true,
  },
};

    // =================================================
    // 23. AI Context
    //
    // 给未来 AI / ChatGPT 使用的简洁上下文。
    // =================================================

    const aiContext = {
      currency: "CNY",

      as_of:
        latestAssetHistory
          ?.snapshot_date ??
        new Date()
          .toISOString()
          .slice(0, 10),

      important_rules: [
        "asset_history.total_asset 是原始金融资产，不包含固收。",
        "fixed_income_assets 是独立固收资产。",
        "Total Wealth = 原始金融资产 + 固收。",
        "total_debt 包含所有贷款，包括房贷。",
        "Financial Freedom debt 只计算 include_financial_freedom = true 的贷款。",
        "房贷不计入 Financial Freedom 负债。",
        "真实净资产 = Total Wealth - 全部负债。",
        "Financial Freedom 净财富 = Total Wealth - Financial Freedom负债。",
      ],

      current_position: {
        raw_financial_assets:
          rawFinancialAssets,

        fixed_income:
          fixedIncomeTotal,

        total_financial_assets:
          totalFinancialAssets,

        total_debt:
          totalDebt,

        mortgage_debt:
          mortgageDebt,

        non_mortgage_debt:
          nonMortgageDebt,

        net_worth:
          netWorth,

        financial_freedom_debt:
          ffDebt,

        financial_freedom_net_wealth:
          financialFreedomNetWealth,

        financial_freedom_target:
          freedomTarget,

        financial_freedom_gap:
          freedomGap,

        financial_freedom_rate:
          freedomRate,
      },

      interpretation: {
        real_net_worth_status:
          netWorth < 0
            ? "negative"
            : "positive",

        financial_freedom_status:
          financialFreedomNetWealth >=
          freedomTarget
            ? "achieved"
            : "not_achieved",

        mortgage_excluded_from_ff:
          true,
      },
    };

    // =================================================
    // 24. Table Status
    // =================================================

    const tableStatus =
      Object.fromEntries(
        Object.entries(datasets).map(
          ([table, result]) => [
            table,
            {
              available:
                result.available,
              count:
                result.count,
              error:
                result.error ?? null,
            },
          ]
        )
      );

    // =================================================
    // 25. Summary
    // =================================================

    const summary = {
      raw_financial_assets:
        rawFinancialAssets,

      fixed_income:
        fixedIncomeTotal,

      total_financial_assets:
        totalFinancialAssets,

      total_debt:
        totalDebt,

      mortgage_debt:
        mortgageDebt,

      non_mortgage_debt:
        nonMortgageDebt,

      net_worth:
        netWorth,

      financial_freedom_debt:
        ffDebt,

      financial_freedom_net_wealth:
        financialFreedomNetWealth,

      financial_freedom_target:
        freedomTarget,

      financial_freedom_gap:
        freedomGap,

      financial_freedom_rate:
        freedomRate,

      holdings_count:
        holdings.length,

      loans_count:
        loans.length,

      fixed_income_count:
        fixedIncome.length,

      expense_transactions_count:
        expenses.length,
    };

    // =================================================
    // 26. 返回
    // =================================================

    return NextResponse.json({
      success: true,

      generated_at:
        new Date().toISOString(),

      summary,

      // =================================================
      // AI CFO 标准数据层
      // =================================================

      financial_overview: {
        ...rawAssetBreakdown,
        ...debtBreakdown,

        net_worth:
          netWorth,

        total_monthly_debt_payment:
          totalMonthlyDebtPayment,

        mortgage_monthly_payment:
          mortgageMonthlyPayment,

        financial_freedom_monthly_debt_payment:
          ffMonthlyDebtPayment,
      },

      portfolio: {
        holdings_count:
          holdings.length,

        holdings_amount:
          holdingsAmount,

        holdings_cost:
          holdingsCost,

        holdings_profit:
          holdingsProfit,

        by_category:
          portfolioByCategory,

        holdings:
          portfolioHoldings,

        fixed_income:
          fixedIncomeDetails,
      },

      debt: {
        total:
          totalDebt,

        mortgage:
          mortgageDebt,

        non_mortgage:
          nonMortgageDebt,

        financial_freedom:
          ffDebt,

        monthly_payment:
          totalMonthlyDebtPayment,

        mortgage_monthly_payment:
          mortgageMonthlyPayment,

        financial_freedom_monthly_payment:
          ffMonthlyDebtPayment,

        loans:
          loanDetails,
      },

      cash_flow: {
        expense_transactions_count:
          expenses.length,

        expense_total_loaded:
          expenseTotal,
      },

      financial_freedom: {
        total_wealth:
          totalFinancialAssets,

        ff_debt:
          ffDebt,

        ff_net_wealth:
          financialFreedomNetWealth,

        freedom_target:
          freedomTarget,

        freedom_gap:
          freedomGap,

        freedom_rate:
          freedomRate,

        database_record:
          latestFinancialFreedom,

        reconciliation: {
          database_total_asset:
            ffDatabaseAsset,

          calculated_total_asset:
            financialFreedomNetWealth,

          difference:
            ffReconciliationDifference,
        },

        rules: {
          mortgage_excluded:
            true,

          mortgage_debt:
            mortgageDebt,

          ff_debt:
            ffDebt,
        },
      },

      investment_analysis: {
        raw_financial_assets:
          rawFinancialAssets,

        fixed_income:
          fixedIncomeTotal,

        total_financial_assets:
          totalFinancialAssets,

        portfolio_allocation:
          portfolioByCategory,

        holdings_count:
          holdings.length,

        holdings_cost:
          holdingsCost,

        holdings_profit:
          holdingsProfit,
      },

      // =================================================
      // 给 AI / ChatGPT 的上下文
      // =================================================

      ai_context:
        aiContext,

        decision_layer: decisionLayer,
      // =================================================
      // 数据库状态
      // =================================================

      table_status:
        tableStatus,

      // =================================================
      // 原始数据
      //
      // 保留，方便以后 AI CFO 做深度分析。
      // =================================================

      datasets: Object.fromEntries(
        Object.entries(datasets).map(
          ([table, result]) => [
            table,
            {
              available:
                result.available,

              count:
                result.count,

              data:
                result.data,
            },
          ]
        )
      ),
    });
  } catch (error) {
    console.error(
      "AI CFO API error:",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "AI CFO API error",
      },
      { status: 500 }
    );
  }
}