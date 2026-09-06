// =====================================================
// Investment Category
//
// 统一管理 AI Wealth OS 投资资产分类
//
// Category:
// - fixed_income
// - global_stock
// - china_stock
// - gold
//
// 设计原则：
//
// 1. HOLDING 有 category 时，优先使用 Holding category
// 2. NEW 没有 Holding 时，根据资产代码 / Market 推导
// 3. 无法确定时返回 null
//
// 不在页面里重复维护分类规则
// =====================================================


export type InvestmentCategory =
  | "fixed_income"
  | "global_stock"
  | "china_stock"
  | "gold";


// =====================================================
// 标准化代码
// =====================================================

function normalizeCode(
  code: string | null | undefined
) {

  return String(code ?? "")
    .trim()
    .toUpperCase();

}


// =====================================================
// 黄金
// =====================================================

const GOLD_CODES = new Set([
  "GLDM",
  "GLD",
  "IAU",

  // 中国黄金 ETF
  "518880",
  "518800",
  "159934",
  "159937",
  "159937",
  "159934",
]);


// =====================================================
// 全球股票
// =====================================================

const GLOBAL_STOCK_CODES = new Set([
  "VOO",
  "QQQ",
  "QQQM",
  "SCHD",
  "VTI",
  "SPY",
  "IVV",
  "VT",
  "VEA",
  "VGT",
  "VXUS",
  "IEMG",
  "ACWI",
  "DIA",
  "RSP",
]);


// =====================================================
// 固定收益
//
// 这里主要放系统中已经明确知道的固定收益代码。
// 如果你的 holdings 中还有其他固定收益代码，
// 可以继续往这里增加。
// =====================================================

const FIXED_INCOME_CODES = new Set([
  "CASH",
  "CASH_CN",
  "CASH_HK",
  "CNY_CASH",
  "HK_CASH",
  "USD_CASH",

  "WELAB_CASH",
  "WELAB_FIXED",

  "WELAB_GOLD",
]);


// =====================================================
// 判断是否为大陆 6 位代码
// =====================================================

function isMainlandSecurityCode(
  code: string
) {

  return /^\d{6}$/.test(code);

}


// =====================================================
// 根据资产代码 / Market 推导 category
//
// 注意：
// 这里不是根据名称猜测。
// 优先使用明确的代码。
// =====================================================

export function inferInvestmentCategory(
  assetCode: string | null | undefined,
  market: string | null | undefined,
  existingCategory?: string | null
): InvestmentCategory | null {

  // ===================================================
  // 1. 已经存在 category
  //
  // Holding 的 category 是最高优先级
  // ===================================================

  if (
    existingCategory &&
    isInvestmentCategory(
      existingCategory
    )
  ) {

    return existingCategory as InvestmentCategory;

  }


  const code =
    normalizeCode(assetCode);


  const normalizedMarket =
    String(
      market ?? ""
    )
      .trim()
      .toUpperCase();


  // ===================================================
  // 2. 黄金
  // ===================================================

  if (
    GOLD_CODES.has(code)
  ) {

    return "gold";

  }


  // ===================================================
  // 3. 全球股票
  // ===================================================

  if (
    GLOBAL_STOCK_CODES.has(code)
  ) {

    return "global_stock";

  }


  // ===================================================
  // 4. 固定收益
  // ===================================================

  if (
    FIXED_INCOME_CODES.has(code)
  ) {

    return "fixed_income";

  }


  // ===================================================
  // 5. 中国大陆
  //
  // 对于大陆 6 位代码：
  // 默认归入 china_stock。
  //
  // 这是为了支持类似：
  //
  // 002849
  // ===================================================

  if (
    normalizedMarket === "CN" &&
    isMainlandSecurityCode(code)
  ) {

    return "china_stock";

  }


  // ===================================================
  // 6. 对于大陆市场其他资产
  //
  // 当前如果不是明确固定收益，
  // 也暂时归入 china_stock。
  //
  // 后续如果有明确的大陆固定收益代码，
  // 应加入 FIXED_INCOME_CODES。
  // ===================================================

  if (
    normalizedMarket === "CN" &&
    code
  ) {

    return "china_stock";

  }


  // ===================================================
  // 7. HK / 海外未知资产
  //
  // 不强行猜测
  // ===================================================

  return null;

}


// =====================================================
// 判断 category 是否属于系统标准 category
// =====================================================

export function isInvestmentCategory(
  value: string | null | undefined
): value is InvestmentCategory {

  return (
    value === "fixed_income" ||
    value === "global_stock" ||
    value === "china_stock" ||
    value === "gold"
  );

}


// =====================================================
// Category 中文名称
// =====================================================

export function getInvestmentCategoryLabel(
  category: string | null | undefined
) {

  switch (category) {

    case "fixed_income":
      return "固定收益";

    case "global_stock":
      return "全球股票";

    case "china_stock":
      return "中国股票";

    case "gold":
      return "黄金";

    default:
      return "-";

  }

}