// =====================================================
// lib/trading-calendar.ts
//
// 全球市场交易日判断
//
// 中国 / 美国 / 香港分别判断
//
// 注意：
// 这里判断的是“指定日期是否为该市场交易日”
//
// Cron：
// 中国时间每天 06:00
//
// 判断：
// 昨天各市场是否交易
// =====================================================


// =====================================================
// 类型
// =====================================================

export type TradingMarket =
  | "china"
  | "us"
  | "hongkong"
  | "luxembourg";


// =====================================================
// 工具
// =====================================================

function normalizeDate(
  date: Date
): Date {

  return new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate()
    )
  );

}


function dateKey(
  date: Date
): string {

  return normalizeDate(
    date
  )
    .toISOString()
    .slice(
      0,
      10
    );

}


function isWeekend(
  date: Date
): boolean {

  const day =
    date.getUTCDay();

  return (
    day === 0 ||
    day === 6
  );

}


// =====================================================
// 中国市场
//
// A 股 / 基金主要交易日
//
// 周末 +
// 中国主要法定节假日
//
// 注意：
// 中国存在调休工作日。
// 证券市场并不会因为“调休上班”而交易。
//
// 所以这里以证券市场实际休市日为准。
// =====================================================

const CHINA_HOLIDAYS =
  new Set<string>([

    // 2025
    "2025-01-01",

    "2025-01-28",
    "2025-01-29",
    "2025-01-30",
    "2025-01-31",
    "2025-02-03",
    "2025-02-04",

    "2025-04-04",

    "2025-05-01",
    "2025-05-02",

    "2025-05-31",

    "2025-10-01",
    "2025-10-02",
    "2025-10-03",
    "2025-10-06",
    "2025-10-07",
    "2025-10-08",

    // 2026
    "2026-01-01",

    "2026-02-16",
    "2026-02-17",
    "2026-02-18",
    "2026-02-19",
    "2026-02-20",

    "2026-04-06",

    "2026-05-01",

    "2026-06-19",

    "2026-09-25",

    "2026-10-01",
    "2026-10-02",
    "2026-10-05",
    "2026-10-06",
    "2026-10-07",

  ]);


// =====================================================
// 美国市场
//
// NYSE / NASDAQ 常规休市
//
// 这里处理主要交易所假期。
// =====================================================

const US_HOLIDAYS =
  new Set<string>([

    // 2025
    "2025-01-01",
    "2025-01-20",
    "2025-02-17",
    "2025-04-18",
    "2025-05-26",
    "2025-06-19",
    "2025-07-04",
    "2025-09-01",
    "2025-11-27",
    "2025-12-25",

    // 2026
    "2026-01-01",
    "2026-01-19",
    "2026-02-16",
    "2026-04-03",
    "2026-05-25",
    "2026-06-19",
    "2026-07-03",
    "2026-09-07",
    "2026-11-26",
    "2026-12-25",

  ]);


// =====================================================
// 香港市场
//
// HKEX 主要休市日
// =====================================================

const HONG_KONG_HOLIDAYS =
  new Set<string>([

    // 2025
    "2025-01-01",
    "2025-01-29",
    "2025-01-30",
    "2025-01-31",

    "2025-04-04",
    "2025-04-18",
    "2025-04-21",

    "2025-05-01",
    "2025-05-05",

    "2025-07-01",

    "2025-10-01",
    "2025-10-07",

    "2025-12-25",
    "2025-12-26",

    // 2026
    "2026-01-01",

    "2026-02-17",
    "2026-02-18",
    "2026-02-19",

    "2026-04-03",
    "2026-04-06",
    "2026-04-07",

    "2026-05-01",

    "2026-06-19",

    "2026-07-01",

    "2026-10-01",

    "2026-12-25",

  ]);


// =====================================================
// 判断中国市场
// =====================================================

export function isChinaTradingDay(
  date: Date
): boolean {

  const d =
    normalizeDate(
      date
    );

  if (
    isWeekend(d)
  ) {

    return false;

  }

  return !CHINA_HOLIDAYS.has(
    dateKey(d)
  );

}


// =====================================================
// 判断美国市场
// =====================================================

export function isUsTradingDay(
  date: Date
): boolean {

  const d =
    normalizeDate(
      date
    );

  if (
    isWeekend(d)
  ) {

    return false;

  }

  return !US_HOLIDAYS.has(
    dateKey(d)
  );

}


// =====================================================
// 判断香港市场
// =====================================================

export function isHongKongTradingDay(
  date: Date
): boolean {

  const d =
    normalizeDate(
      date
    );

  if (
    isWeekend(d)
  ) {

    return false;

  }

  return !HONG_KONG_HOLIDAYS.has(
    dateKey(d)
  );

}


// =====================================================
// 卢森堡
//
// 暂时按工作日处理。
// 因为 LU 基金的实际 NAV 发布日
// 本身可能滞后于交易日。
//
// 后面如果你需要，我可以再把
// Luxembourg / Euronext / 基金 NAV
// 日历独立出来。
// =====================================================

export function isLuxembourgTradingDay(
  date: Date
): boolean {

  const d =
    normalizeDate(
      date
    );

  return !isWeekend(
    d
  );

}


// =====================================================
// 统一入口
// =====================================================

export function isTradingDay(
  market: TradingMarket,
  date: Date
): boolean {

  switch (
    market
  ) {

    case "china":

      return isChinaTradingDay(
        date
      );


    case "us":

      return isUsTradingDay(
        date
      );


    case "hongkong":

      return isHongKongTradingDay(
        date
      );


    case "luxembourg":

      return isLuxembourgTradingDay(
        date
      );


    default:

      return false;

  }

}


// =====================================================
// 获取昨天
// =====================================================

export function getYesterday(): Date {

  const now =
    new Date();

  return new Date(
    now.getTime() -
    24 *
    60 *
    60 *
    1000
  );

}


// =====================================================
// 获取市场昨天是否交易
// =====================================================

export function wasMarketOpenYesterday(
  market: TradingMarket
): boolean {

  return isTradingDay(
    market,
    getYesterday()
  );

}


// =====================================================
// Debug
// =====================================================

export function getTradingStatusYesterday() {

  const yesterday =
    getYesterday();

  return {

    date:
      dateKey(
        yesterday
      ),

    china:
      isChinaTradingDay(
        yesterday
      ),

    us:
      isUsTradingDay(
        yesterday
      ),

    hongkong:
      isHongKongTradingDay(
        yesterday
      ),

    luxembourg:
      isLuxembourgTradingDay(
        yesterday
      ),

  };

}