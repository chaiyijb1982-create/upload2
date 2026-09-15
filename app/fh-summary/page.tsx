"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const MONTH_NAMES = [
  "",
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
];

type Temple = {
  id: string;
  name: string;
};

type Event = {
  id: string;
  temple_id: string;
  name: string;
  event_year: number;
  start_date: string | null;
  end_date: string | null;
};

type Denomination = {
  denomination: number;
  quantity: number;
};

type RedPacket = {
  id: string;
  event_id: string;
  days: number[];
  item_name: string;
  packet_amount: number;
  denominations: Denomination[];
  note: string | null;
  sort_order: number;
};

type Cost = {
  id: string;
  temple_id: string;
  event_name: string;
  expense_year: number;
  expense_date: string;
  expense_end_date: string | null;
  amount: number;
  need_xibo: boolean;
  xibo_bags: number;
  xibo_price: number;
  note: string | null;
};

type MonthlyStat = {
  month: number;
  hongbao: number;
  cost: number;
  total: number;
  hongbaoCount: number;
  costCount: number;
};

type TempleStat = {
  templeId: string;
  templeName: string;
  hongbao: number;
  cost: number;
  total: number;
};

function money(value: number) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * Supabase 默认单次最多 1000 条。
 * 这里继续分页，避免以后数据超过 1000 条后汇总不完整。
 */
async function fetchAllRows(
  tableName: string,
  orderColumn?: string
) {
  const pageSize = 1000;
  let from = 0;
  const allRows: any[] = [];

  while (true) {
    let query: any = supabase
      .from(tableName)
      .select("*")
      .range(from, from + pageSize - 1);

    if (orderColumn) {
      query = query.order(orderColumn, {
        ascending: true,
        nullsFirst: false,
      });
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const rows = data || [];
    allRows.push(...rows);

    if (rows.length < pageSize) {
      break;
    }

    from += pageSize;
  }

  return allRows;
}

/**
 * 红包金额：
 * 以 fh_red_packets.packet_amount 为准。
 *
 * 如果数据库中 packet_amount 异常为 0，
 * 再尝试根据 denominations 重新计算。
 */
function getPacketAmount(packet: RedPacket) {
  const storedAmount = Number(packet.packet_amount || 0);

  if (storedAmount !== 0) {
    return storedAmount;
  }

  if (Array.isArray(packet.denominations)) {
    return packet.denominations.reduce(
      (sum, item) =>
        sum +
        Number(item.denomination || 0) *
          Number(item.quantity || 0),
      0
    );
  }

  return 0;
}

function getYearFromDate(
  date: string | null | undefined,
  fallbackYear: number
) {
  if (!date) return fallbackYear;

  const year = Number(date.slice(0, 4));

  return Number.isFinite(year) && year > 0
    ? year
    : fallbackYear;
}

function getMonthFromDate(
  date: string | null | undefined
) {
  if (!date) return 0;

  const month = Number(date.slice(5, 7));

  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return 0;
  }

  return month;
}

export default function FHSummaryPage() {
  const currentYear = new Date().getFullYear();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [temples, setTemples] = useState<Temple[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [packets, setPackets] = useState<RedPacket[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);

  const [selectedYear, setSelectedYear] =
    useState(currentYear);

  async function loadAll() {
    try {
      setLoading(true);
      setError("");

      const [
        templeRows,
        eventRows,
        packetRows,
        costRows,
      ] = await Promise.all([
        fetchAllRows("fh_temples", "name"),
        fetchAllRows("fh_events", "start_date"),
        fetchAllRows("fh_red_packets", "sort_order"),
        fetchAllRows("fh_costs", "expense_date"),
      ]);

      setTemples(
        (templeRows || []).map((row: any) => ({
          id: row.id,
          name: row.name,
        }))
      );

      setEvents(
        (eventRows || []).map((row: any) => ({
          ...row,
          event_year:
            Number(row.event_year) || currentYear,
        }))
      );

      setPackets(
        (packetRows || []).map((row: any) => ({
          ...row,
          packet_amount:
            Number(row.packet_amount) || 0,
          denominations:
            Array.isArray(row.denominations)
              ? row.denominations.map((d: any) => ({
                  denomination:
                    Number(d.denomination) || 0,
                  quantity:
                    Number(d.quantity) || 0,
                }))
              : [],
          sort_order:
            Number(row.sort_order) || 0,
        }))
      );

      setCosts(
        (costRows || []).map((row: any) => ({
          ...row,
          expense_year:
            Number(row.expense_year) || currentYear,
          amount: Number(row.amount) || 0,
          xibo_bags: Number(row.xibo_bags) || 0,
          xibo_price:
            row.xibo_price != null
              ? Number(row.xibo_price)
              : 18,
          need_xibo: Boolean(row.need_xibo),
        }))
      );
    } catch (e: any) {
      console.error(e);

      setError(
        e?.message ||
          "读取法会汇总数据失败"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  /**
   * eventId -> Event
   */
  const eventMap = useMemo(() => {
    return new Map(
      events.map((event) => [
        event.id,
        event,
      ])
    );
  }, [events]);

  /**
   * templeId -> Temple
   */
  const templeMap = useMemo(() => {
    return new Map(
      temples.map((temple) => [
        temple.id,
        temple,
      ])
    );
  }, [temples]);

  /**
   * 所有存在数据的年份。
   */
  const years = useMemo(() => {
    const yearSet = new Set<number>();

    yearSet.add(currentYear);

    events.forEach((event) => {
      if (event.event_year) {
        yearSet.add(Number(event.event_year));
      }

      const dateYear = getYearFromDate(
        event.start_date,
        Number(event.event_year)
      );

      if (dateYear) {
        yearSet.add(dateYear);
      }
    });

    costs.forEach((cost) => {
      if (cost.expense_year) {
        yearSet.add(Number(cost.expense_year));
      }

      const dateYear = getYearFromDate(
        cost.expense_date,
        Number(cost.expense_year)
      );

      if (dateYear) {
        yearSet.add(dateYear);
      }
    });

    return Array.from(yearSet).sort(
      (a, b) => b - a
    );
  }, [events, costs, currentYear]);

  /**
   * 红包：
   *
   * 一个红包属于一个 event。
   * event 的 start_date 决定该法会属于哪一年 / 哪个月。
   */
  const yearPackets = useMemo(() => {
    return packets.filter((packet) => {
      const event =
        eventMap.get(packet.event_id);

      if (!event) return false;

      const year = getYearFromDate(
        event.start_date,
        Number(event.event_year)
      );

      return year === selectedYear;
    });
  }, [
    packets,
    eventMap,
    selectedYear,
  ]);

  /**
   * 当前年度费用。
   */
  const yearCosts = useMemo(() => {
    return costs.filter((cost) => {
      const year = getYearFromDate(
        cost.expense_date,
        Number(cost.expense_year)
      );

      return year === selectedYear;
    });
  }, [costs, selectedYear]);

  /**
   * 红包总金额。
   */
  const yearHongbaoTotal = useMemo(() => {
    return yearPackets.reduce(
      (sum, packet) =>
        sum + getPacketAmount(packet),
      0
    );
  }, [yearPackets]);

  /**
   * 法会费用总金额。
   */
  const yearCostTotal = useMemo(() => {
    return yearCosts.reduce(
      (sum, cost) =>
        sum + Number(cost.amount || 0),
      0
    );
  }, [yearCosts]);

  /**
   * 当前年度全部支出。
   */
  const yearGrandTotal = useMemo(() => {
    return (
      yearHongbaoTotal +
      yearCostTotal
    );
  }, [
    yearHongbaoTotal,
    yearCostTotal,
  ]);

  /**
   * 全部年份红包。
   */
  const allHongbaoTotal = useMemo(() => {
    return packets.reduce(
      (sum, packet) =>
        sum + getPacketAmount(packet),
      0
    );
  }, [packets]);

  /**
   * 全部年份法会费用。
   */
  const allCostTotal = useMemo(() => {
    return costs.reduce(
      (sum, cost) =>
        sum + Number(cost.amount || 0),
      0
    );
  }, [costs]);

  /**
   * 全部法会支出。
   */
  const allGrandTotal = useMemo(() => {
    return (
      allHongbaoTotal +
      allCostTotal
    );
  }, [
    allHongbaoTotal,
    allCostTotal,
  ]);

  /**
   * 12个月统计。
   */
  const monthlyStats = useMemo(() => {
    const result: MonthlyStat[] =
      Array.from(
        { length: 12 },
        (_, index) => {
          const month = index + 1;

          return {
            month,
            hongbao: 0,
            cost: 0,
            total: 0,
            hongbaoCount: 0,
            costCount: 0,
          };
        }
      );

    /**
     * 红包按法会开始日期归属月份。
     */
    for (const packet of yearPackets) {
      const event =
        eventMap.get(packet.event_id);

      if (!event) continue;

      const month = getMonthFromDate(
        event.start_date
      );

      if (month < 1 || month > 12) {
        continue;
      }

      const amount =
        getPacketAmount(packet);

      result[month - 1].hongbao +=
        amount;

      result[month - 1].total +=
        amount;

      result[month - 1].hongbaoCount +=
        1;
    }

    /**
     * 法会费用按 expense_date 归属月份。
     */
    for (const cost of yearCosts) {
      const month = getMonthFromDate(
        cost.expense_date
      );

      if (month < 1 || month > 12) {
        continue;
      }

      const amount =
        Number(cost.amount || 0);

      result[month - 1].cost +=
        amount;

      result[month - 1].total +=
        amount;

      result[month - 1].costCount +=
        1;
    }

    return result;
  }, [
    yearPackets,
    yearCosts,
    eventMap,
  ]);

  /**
   * 最大月度金额，用于进度条。
   */
  const maxMonthlyTotal = useMemo(() => {
    return Math.max(
      ...monthlyStats.map(
        (item) => item.total
      ),
      1
    );
  }, [monthlyStats]);

  /**
   * 当前年度寺庙统计。
   *
   * 红包：
   * packet -> event -> temple
   *
   * 费用：
   * cost -> temple
   */
  const templeStats = useMemo(() => {
    const map = new Map<
      string,
      TempleStat
    >();

    for (const packet of yearPackets) {
      const event =
        eventMap.get(packet.event_id);

      if (!event) continue;

      const templeId =
        event.temple_id ||
        "__unknown__";

      const templeName =
        templeMap.get(templeId)?.name ||
        "未设置寺庙";

      const current =
        map.get(templeId) || {
          templeId,
          templeName,
          hongbao: 0,
          cost: 0,
          total: 0,
        };

      const amount =
        getPacketAmount(packet);

      current.hongbao += amount;
      current.total += amount;

      map.set(
        templeId,
        current
      );
    }

    for (const cost of yearCosts) {
      const templeId =
        cost.temple_id ||
        "__unknown__";

      const templeName =
        templeMap.get(templeId)?.name ||
        "未设置寺庙";

      const current =
        map.get(templeId) || {
          templeId,
          templeName,
          hongbao: 0,
          cost: 0,
          total: 0,
        };

      const amount =
        Number(cost.amount || 0);

      current.cost += amount;
      current.total += amount;

      map.set(
        templeId,
        current
      );
    }

    return Array.from(
      map.values()
    ).sort(
      (a, b) =>
        b.total - a.total
    );
  }, [
    yearPackets,
    yearCosts,
    eventMap,
    templeMap,
  ]);

  /**
   * 当前年度月度明细。
   *
   * 只显示有金额的月份。
   */
  const activeMonths = useMemo(() => {
    return monthlyStats.filter(
      (item) => item.total > 0
    );
  }, [monthlyStats]);

  /**
   * 最近月份。
   */
  const latestMonth = useMemo(() => {
    for (
      let i = monthlyStats.length - 1;
      i >= 0;
      i--
    ) {
      if (
        monthlyStats[i].total > 0
      ) {
        return monthlyStats[i];
      }
    }

    return null;
  }, [monthlyStats]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl rounded-2xl bg-white p-8 shadow-sm">
          <div className="text-gray-600">
            正在读取法会费用汇总……
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* =========================
            标题 + 两个页面入口
        ========================== */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-5">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              法会费用总览
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              汇总法会红包与法会费用，按年份、月份及寺庙查看支出情况。
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="/fh-hongbao"
              className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-white px-5 py-3 text-sm font-semibold text-rose-700 shadow-sm transition hover:bg-rose-50"
            >
              <span className="text-lg">
                🎁
              </span>

              <span>
                法会红包
              </span>

              <span className="text-gray-400">
                →
              </span>
            </a>

            <a
              href="/fh-cost"
              className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-white px-5 py-3 text-sm font-semibold text-sky-700 shadow-sm transition hover:bg-sky-50"
            >
              <span className="text-lg">
                💰
              </span>

              <span>
                法会费用
              </span>

              <span className="text-gray-400">
                →
              </span>
            </a>
          </div>
        </div>

        {/* =========================
            错误
        ========================== */}
        {error && (
          <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* =========================
            年份选择
        ========================== */}
        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">
                年度汇总
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                选择年份查看该年度红包与法会费用。
              </p>
            </div>

            <select
              value={selectedYear}
              onChange={(e) =>
                setSelectedYear(
                  Number(e.target.value)
                )
              }
              className="rounded-xl border bg-white px-4 py-2.5 text-sm font-semibold shadow-sm outline-none"
            >
              {years.map((year) => (
                <option
                  key={year}
                  value={year}
                >
                  {year}年
                </option>
              ))}
            </select>
          </div>
        </section>

        {/* =========================
            顶部四张统计卡
        ========================== */}
        <section className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              {selectedYear} 年全部支出
            </div>

            <div className="mt-2 text-3xl font-bold">
              {money(yearGrandTotal)}
            </div>

            <div className="mt-2 text-xs text-gray-400">
              红包 + 法会费用
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              {selectedYear} 年法会红包
            </div>

            <div className="mt-2 text-3xl font-bold text-rose-700">
              {money(yearHongbaoTotal)}
            </div>

            <div className="mt-2 text-xs text-gray-400">
              共 {yearPackets.length} 项红包
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              {selectedYear} 年法会费用
            </div>

            <div className="mt-2 text-3xl font-bold text-sky-700">
              {money(yearCostTotal)}
            </div>

            <div className="mt-2 text-xs text-gray-400">
              共 {yearCosts.length} 笔费用
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              全部年份累计
            </div>

            <div className="mt-2 text-3xl font-bold">
              {money(allGrandTotal)}
            </div>

            <div className="mt-2 text-xs text-gray-400">
              红包 {money(allHongbaoTotal)}
              {" · "}
              费用 {money(allCostTotal)}
            </div>
          </div>
        </section>

        {/* =========================
            两个入口卡片
        ========================== */}
        <section className="mb-6 grid gap-4 md:grid-cols-2">
          <a
            href="/fh-hongbao"
            className="group rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 to-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-rose-600">
                  红包管理
                </div>

                <div className="mt-1 text-2xl font-bold text-gray-900">
                  法会红包
                </div>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 text-2xl shadow-sm">
                🎁
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="text-xs text-gray-500">
                  全部年份累计
                </div>

                <div className="mt-1 text-xl font-bold text-rose-700">
                  {money(allHongbaoTotal)}
                </div>
              </div>

              <span className="text-sm font-semibold text-rose-600 transition group-hover:translate-x-1">
                进入红包明细 →
              </span>
            </div>
          </a>

          <a
            href="/fh-cost"
            className="group rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-sky-600">
                  费用管理
                </div>

                <div className="mt-1 text-2xl font-bold text-gray-900">
                  法会费用
                </div>
              </div>

              <div className="rounded-2xl bg-white px-4 py-3 text-2xl shadow-sm">
                💰
              </div>
            </div>

            <div className="mt-5 flex items-end justify-between">
              <div>
                <div className="text-xs text-gray-500">
                  全部年份累计
                </div>

                <div className="mt-1 text-xl font-bold text-sky-700">
                  {money(allCostTotal)}
                </div>
              </div>

              <span className="text-sm font-semibold text-sky-600 transition group-hover:translate-x-1">
                进入费用明细 →
              </span>
            </div>
          </a>
        </section>

        {/* =========================
            月度统计
        ========================== */}
        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                {selectedYear} 年月度支出
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                红包按法会开始日期统计，费用按费用日期统计。
              </p>
            </div>

            {latestMonth && (
              <div className="text-right">
                <div className="text-xs text-gray-400">
                  最近有支出的月份
                </div>

                <div className="mt-1 text-sm font-semibold">
                  {selectedYear}年
                  {latestMonth.month}月
                  {" · "}
                  {money(
                    latestMonth.total
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead>
                <tr className="border-b text-left text-gray-500">
                  <th className="px-3 py-3">
                    月份
                  </th>

                  <th className="px-3 py-3 text-right">
                    法会红包
                  </th>

                  <th className="px-3 py-3 text-right">
                    法会费用
                  </th>

                  <th className="px-3 py-3 text-right">
                    月合计
                  </th>

                  <th className="px-3 py-3">
                    支出比例
                  </th>
                </tr>
              </thead>

              <tbody>
                {monthlyStats.map(
                  (item) => {
                    const percent =
                      yearGrandTotal > 0
                        ? (item.total /
                            yearGrandTotal) *
                          100
                        : 0;

                    const barWidth =
                      (item.total /
                        maxMonthlyTotal) *
                      100;

                    return (
                      <tr
                        key={item.month}
                        className={`border-b last:border-0 ${
                          item.total > 0
                            ? "hover:bg-gray-50"
                            : "text-gray-400"
                        }`}
                      >
                        <td className="px-3 py-3 font-semibold">
                          {
                            MONTH_NAMES[
                              item.month
                            ]
                          }
                        </td>

                        <td className="px-3 py-3 text-right">
                          {item.hongbao >
                          0 ? (
                            <span className="font-medium text-rose-700">
                              {money(
                                item.hongbao
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="px-3 py-3 text-right">
                          {item.cost > 0 ? (
                            <span className="font-medium text-sky-700">
                              {money(
                                item.cost
                              )}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>

                        <td className="px-3 py-3 text-right font-bold text-gray-900">
                          {item.total > 0
                            ? money(
                                item.total
                              )
                            : "—"}
                        </td>

                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-2 min-w-[100px] flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-gray-900 transition-all"
                                style={{
                                  width: `${barWidth}%`,
                                }}
                              />
                            </div>

                            <span className="w-14 text-right text-xs text-gray-500">
                              {percent.toFixed(
                                1
                              )}
                              %
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>

              <tfoot>
                <tr className="border-t font-bold">
                  <td className="px-3 py-4">
                    全年合计
                  </td>

                  <td className="px-3 py-4 text-right text-rose-700">
                    {money(
                      yearHongbaoTotal
                    )}
                  </td>

                  <td className="px-3 py-4 text-right text-sky-700">
                    {money(
                      yearCostTotal
                    )}
                  </td>

                  <td className="px-3 py-4 text-right">
                    {money(
                      yearGrandTotal
                    )}
                  </td>

                  <td className="px-3 py-4 text-right">
                    100%
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* =========================
            月份卡片
        ========================== */}
        <section className="mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-bold">
              {selectedYear} 年逐月详情
            </h2>

            <p className="mt-1 text-xs text-gray-500">
              只显示实际发生支出的月份。
            </p>
          </div>

          {activeMonths.length === 0 ? (
            <div className="rounded-2xl border bg-white p-10 text-center text-gray-400 shadow-sm">
              {selectedYear} 年还没有法会支出记录
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {activeMonths.map(
                (item) => (
                  <div
                    key={item.month}
                    className="rounded-2xl border bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-lg font-bold">
                          {
                            MONTH_NAMES[
                              item.month
                            ]
                          }
                        </div>

                        <div className="mt-1 text-xs text-gray-400">
                          {item.hongbaoCount >
                          0
                            ? `红包 ${item.hongbaoCount} 项`
                            : ""}
                          {item.hongbaoCount >
                            0 &&
                          item.costCount >
                            0
                            ? " · "
                            : ""}
                          {item.costCount >
                          0
                            ? `费用 ${item.costCount} 笔`
                            : ""}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-xs text-gray-400">
                          本月合计
                        </div>

                        <div className="mt-1 text-xl font-bold">
                          {money(
                            item.total
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="flex items-center justify-between rounded-xl bg-rose-50 px-3 py-2.5">
                        <span className="text-sm text-rose-700">
                          法会红包
                        </span>

                        <span className="font-semibold text-rose-800">
                          {money(
                            item.hongbao
                          )}
                        </span>
                      </div>

                      <div className="flex items-center justify-between rounded-xl bg-sky-50 px-3 py-2.5">
                        <span className="text-sm text-sky-700">
                          法会费用
                        </span>

                        <span className="font-semibold text-sky-800">
                          {money(
                            item.cost
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-1 flex justify-between text-xs text-gray-400">
                        <span>
                          占全年
                        </span>

                        <span>
                          {yearGrandTotal >
                          0
                            ? (
                                (item.total /
                                  yearGrandTotal) *
                                100
                              ).toFixed(
                                1
                              )
                            : "0.0"}
                          %
                        </span>
                      </div>

                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className="h-full rounded-full bg-gray-900"
                          style={{
                            width: `${
                              yearGrandTotal >
                              0
                                ? Math.min(
                                    100,
                                    (item.total /
                                      yearGrandTotal) *
                                      100
                                  )
                                : 0
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )
              )}
            </div>
          )}
        </section>

        {/* =========================
            寺庙统计
        ========================== */}
        <section className="mb-6 rounded-2xl border bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">
                {selectedYear} 年寺庙支出统计
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                红包与法会费用合并统计。
              </p>
            </div>

            <div className="text-lg font-bold">
              合计 {money(yearGrandTotal)}
            </div>
          </div>

          {templeStats.length ===
          0 ? (
            <div className="rounded-xl bg-gray-50 p-8 text-center text-gray-400">
              {selectedYear} 年还没有寺庙支出记录
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b text-left text-gray-500">
                    <th className="px-3 py-3">
                      寺庙
                    </th>

                    <th className="px-3 py-3 text-right">
                      法会红包
                    </th>

                    <th className="px-3 py-3 text-right">
                      法会费用
                    </th>

                    <th className="px-3 py-3 text-right">
                      合计
                    </th>

                    <th className="px-3 py-3 text-right">
                      占全年
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {templeStats.map(
                    (item) => {
                      const percent =
                        yearGrandTotal >
                        0
                          ? (item.total /
                              yearGrandTotal) *
                            100
                          : 0;

                      return (
                        <tr
                          key={
                            item.templeId
                          }
                          className="border-b last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-3 py-3 font-semibold">
                            {
                              item.templeName
                            }
                          </td>

                          <td className="px-3 py-3 text-right text-rose-700">
                            {item.hongbao >
                            0
                              ? money(
                                  item.hongbao
                                )
                              : "—"}
                          </td>

                          <td className="px-3 py-3 text-right text-sky-700">
                            {item.cost >
                            0
                              ? money(
                                  item.cost
                                )
                              : "—"}
                          </td>

                          <td className="px-3 py-3 text-right font-bold">
                            {money(
                              item.total
                            )}
                          </td>

                          <td className="px-3 py-3 text-right text-gray-500">
                            {percent.toFixed(
                              1
                            )}
                            %
                          </td>
                        </tr>
                      );
                    }
                  )}
                </tbody>

                <tfoot>
                  <tr className="border-t font-bold">
                    <td className="px-3 py-4">
                      合计
                    </td>

                    <td className="px-3 py-4 text-right text-rose-700">
                      {money(
                        yearHongbaoTotal
                      )}
                    </td>

                    <td className="px-3 py-4 text-right text-sky-700">
                      {money(
                        yearCostTotal
                      )}
                    </td>

                    <td className="px-3 py-4 text-right">
                      {money(
                        yearGrandTotal
                      )}
                    </td>

                    <td className="px-3 py-4 text-right">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* =========================
            底部入口
        ========================== */}
        <section className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="font-semibold">
                需要查看具体记录？
              </div>

              <div className="mt-1 text-xs text-gray-500">
                汇总页只负责统计，具体法会及费用请进入对应页面编辑。
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/fh-hongbao"
                className="rounded-lg border border-rose-200 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50"
              >
                🎁 法会红包
              </a>

              <a
                href="/fh-cost"
                className="rounded-lg border border-sky-200 px-4 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50"
              >
                💰 法会费用
              </a>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}