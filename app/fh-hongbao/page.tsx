"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Lunar, Solar } from "lunar-javascript";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "";

const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  "";

const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey
);

const DENOMINATIONS = [1, 5, 10, 20, 30, 50, 100];

const MONTH_NAMES = [
  "",
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月",
];

const DAY_NAMES = [
  "",
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十",
];

type Temple = {
  id: string;
  name: string;
  note: string | null;
  created_at: string;
};

type Event = {
  id: string;
  temple_id: string;
  name: string;

  event_year: number;

  start_date: string | null;
  end_date: string | null;

  lunar_start_year: number | null;
  lunar_start_month: number | null;
  lunar_start_day: number | null;
  lunar_start_leap: boolean;

  lunar_end_year: number | null;
  lunar_end_month: number | null;
  lunar_end_day: number | null;
  lunar_end_leap: boolean;

  same_lunar_date_each_year: boolean;

  note: string | null;
  comment: string | null;
  created_at: string;
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
  created_at: string;
};

type PacketDraft = {
  id?: string;
  days: number[];
  item_name: string;
  packet_amount: string;
  denominations: Denomination[];
  note: string;
  sort_order: number;
};

function money(value: number) {
  return `¥${Number(value || 0).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function dateText(value: string | null) {
  if (!value) return "";
  return value.replaceAll("-", "/");
}

function lunarText(
  year: number | null,
  month: number | null,
  day: number | null,
  leap = false
) {
  if (!year || !month || !day) return "";

  return `${year}年${leap ? "闰" : ""}${MONTH_NAMES[month] || `${month}月`}${
    DAY_NAMES[day] || `${day}日`
  }`;
}

function lunarMonthName(month: number) {
  return MONTH_NAMES[month] || `${month}月`;
}

function lunarDayName(day: number) {
  return DAY_NAMES[day] || `${day}日`;
}

function parseDays(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((v) => Number(v))
    .filter((v) => Number.isInteger(v) && v >= 1 && v <= 31)
    .sort((a, b) => a - b);
}

function getSplitTotal(denominations: Denomination[]) {
  return denominations.reduce(
    (sum, item) =>
      sum +
      Number(item.denomination) * Number(item.quantity),
    0
  );
}

function getDenominationSummary(
  packets: RedPacket[]
) {
  const result: Record<number, number> = {};

  for (const packet of packets) {
    for (const row of packet.denominations || []) {
      const denomination = Number(row.denomination);
      const quantity = Number(row.quantity);

      if (!denomination || !quantity) continue;

      result[denomination] =
        (result[denomination] || 0) + quantity;
    }
  }

  return Object.entries(result)
    .map(([denomination, quantity]) => ({
      denomination: Number(denomination),
      quantity,
    }))
    .sort((a, b) => a.denomination - b.denomination);
}

function getEventTotal(packets: RedPacket[]) {
  return packets.reduce(
    (sum, packet) =>
      sum + Number(packet.packet_amount || 0),
    0
  );
}

function getEventDenominationSummary(
  packets: RedPacket[]
) {
  return getDenominationSummary(packets)
    .map((row) => {
      const amount =
        Number(row.denomination) *
        Number(row.quantity);

      return `${row.denomination}元 × ${row.quantity}张 = ${money(amount)}`;
    })
    .join("  ");
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function solarToLunar(date: string) {
  if (!date) return null;

  try {
    const [y, m, d] = date
      .split("-")
      .map(Number);

    const solar = Solar.fromYmd(y, m, d);
    const lunar = solar.getLunar();

    return {
      year: Number(lunar.getYear()),
      month: Number(lunar.getMonth()),
      day: Number(lunar.getDay()),
      leap: false,
    };
  } catch {
    return null;
  }
}

function lunarToSolar(
  year: number,
  month: number,
  day: number
) {
  try {
    const lunar = Lunar.fromYmd(
      year,
      month,
      day
    );

    const solar = lunar.getSolar();

    const y = Number(solar.getYear());
    const m = Number(solar.getMonth());
    const d = Number(solar.getDay());

    return `${y}-${String(m).padStart(
      2,
      "0"
    )}-${String(d).padStart(2, "0")}`;
  } catch {
    return null;
  }
}

function makeEmptyPacket(
  sortOrder: number
): PacketDraft {
  return {
    days: [],
    item_name: "",
    packet_amount: "",
    denominations: [
      {
        denomination: 10,
        quantity: 1,
      },
    ],
    note: "",
    sort_order: sortOrder,
  };
}

export default function FHPage() {
  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const [temples, setTemples] =
    useState<Temple[]>([]);

  const [events, setEvents] =
    useState<Event[]>([]);

  const [packets, setPackets] =
    useState<RedPacket[]>([]);

  const [selectedTempleId, setSelectedTempleId] =
    useState("");

  const [selectedEventId, setSelectedEventId] =
    useState("");

  const [selectedYear, setSelectedYear] =
    useState<number>(
      new Date().getFullYear()
    );

  const [showTempleForm, setShowTempleForm] =
    useState(false);

  const [showEventForm, setShowEventForm] =
    useState(false);

  const [newTempleName, setNewTempleName] =
    useState("");

  const [newTempleNote, setNewTempleNote] =
    useState("");

  const [eventName, setEventName] =
    useState("");

  const [eventYear, setEventYear] =
    useState(
      new Date().getFullYear()
    );

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [lunarStartYear, setLunarStartYear] =
    useState(
      new Date().getFullYear()
    );

  const [lunarStartMonth, setLunarStartMonth] =
    useState(1);

  const [lunarStartDay, setLunarStartDay] =
    useState(1);

  const [lunarEndYear, setLunarEndYear] =
    useState(
      new Date().getFullYear()
    );

  const [lunarEndMonth, setLunarEndMonth] =
    useState(1);

  const [lunarEndDay, setLunarEndDay] =
    useState(1);

  const [sameLunar, setSameLunar] =
    useState(true);

  const [eventNote, setEventNote] =
    useState("");

  const [eventComment, setEventComment] =
    useState("");

  const [packetDrafts, setPacketDrafts] =
    useState<PacketDraft[]>([]);

  const [editingPackets, setEditingPackets] =
    useState(false);

  const [newEventYear, setNewEventYear] =
    useState(
      new Date().getFullYear() + 1
    );

  const selectedTemple = useMemo(
    () =>
      temples.find(
        (t) => t.id === selectedTempleId
      ) || null,
    [temples, selectedTempleId]
  );

  const selectedEvent = useMemo(
    () =>
      events.find(
        (e) => e.id === selectedEventId
      ) || null,
    [events, selectedEventId]
  );

  const selectedPackets = useMemo(
    () =>
      packets
        .filter(
          (p) =>
            p.event_id === selectedEventId
        )
        .sort(
          (a, b) =>
            a.sort_order - b.sort_order
        ),
    [packets, selectedEventId]
  );

  const years = useMemo(() => {
    const set = new Set<number>();

    for (const event of events) {
      if (event.event_year) {
        set.add(event.event_year);
      }
    }

    if (set.size === 0) {
      set.add(new Date().getFullYear());
    }

    return Array.from(set).sort(
      (a, b) => b - a
    );
  }, [events]);

  const yearEvents = useMemo(() => {
    return events
      .filter(
        (event) =>
          event.event_year === selectedYear
      )
      .sort((a, b) => {
        const ad =
          a.start_date ||
          `${a.event_year}-12-31`;

        const bd =
          b.start_date ||
          `${b.event_year}-12-31`;

        return ad.localeCompare(bd);
      });
  }, [events, selectedYear]);

  const allRedPacketStats = useMemo(() => {
    const eventMap = new Map(
      events.map((event) => [event.id, event])
    );

    const templeMap = new Map<
      string,
      {
        templeId: string;
        templeName: string;
        packetCount: number;
        totalAmount: number;
      }
    >();

    let totalAmount = 0;

    for (const packet of packets) {
      const amount = Number(packet.packet_amount || 0);
      totalAmount += amount;

      const event = eventMap.get(packet.event_id);
      const templeId = event?.temple_id || "__unknown__";
      const templeName =
        temples.find((temple) => temple.id === templeId)?.name ||
        "未设置寺庙";

      const current =
        templeMap.get(templeId) || {
          templeId,
          templeName,
          packetCount: 0,
          totalAmount: 0,
        };

      current.packetCount += 1;
      current.totalAmount += amount;
      templeMap.set(templeId, current);
    }

    return {
      packetCount: packets.length,
      totalAmount,
      temples: Array.from(templeMap.values()).sort(
        (a, b) => b.totalAmount - a.totalAmount
      ),
    };
  }, [packets, events, temples]);

  const selectedEventTotal = useMemo(
    () => getEventTotal(selectedPackets),
    [selectedPackets]
  );

  const selectedEventDenominations =
    useMemo(
      () =>
        getDenominationSummary(
          selectedPackets
        ),
      [selectedPackets]
    );

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

      if (error) throw error;

      const rows = data || [];
      allRows.push(...rows);

      if (rows.length < pageSize) {
        break;
      }

      from += pageSize;
    }

    return allRows;
  }

  async function loadAll() {
    try {
      setLoading(true);
      setError("");

      const [
        templeData,
        eventData,
        packetData,
      ] = await Promise.all([
        fetchAllRows("fh_temples", "name"),
        fetchAllRows("fh_events", "start_date"),
        fetchAllRows("fh_red_packets", "sort_order"),
      ]);

      const templeRows =
        (templeData || []) as Temple[];

      const eventRows =
        (eventData || []).map(
          (row: any) => ({
            ...row,
            event_year:
              Number(row.event_year) ||
              new Date().getFullYear(),
            lunar_start_leap:
              Boolean(
                row.lunar_start_leap
              ),
            lunar_end_leap:
              Boolean(
                row.lunar_end_leap
              ),
            same_lunar_date_each_year:
              row.same_lunar_date_each_year !==
              false,
          })
        ) as Event[];

      const packetRows =
        (packetData || []).map(
          (row: any) => ({
            ...row,
            days: parseDays(row.days),
            packet_amount:
              Number(row.packet_amount) || 0,
            denominations:
              Array.isArray(
                row.denominations
              )
                ? row.denominations.map(
                    (d: any) => ({
                      denomination:
                        Number(
                          d.denomination
                        ) || 0,
                      quantity:
                        Number(
                          d.quantity
                        ) || 0,
                    })
                  )
                : [],
            sort_order:
              Number(row.sort_order) || 0,
          })
        ) as RedPacket[];

      setTemples(templeRows);
      setEvents(eventRows);
      setPackets(packetRows);

      if (
        !selectedTempleId &&
        templeRows.length > 0
      ) {
        setSelectedTempleId(
          templeRows[0].id
        );
      }

      if (
        selectedTempleId &&
        !templeRows.some(
          (t) =>
            t.id === selectedTempleId
        )
      ) {
        setSelectedTempleId(
          templeRows[0]?.id || ""
        );
      }

      if (
        selectedEventId &&
        !eventRows.some(
          (e) =>
            e.id === selectedEventId
        )
      ) {
        setSelectedEventId("");
      }
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "读取法会数据失败"
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  useEffect(() => {
    if (!selectedEvent) return;

    setSelectedYear(
      selectedEvent.event_year
    );
  }, [selectedEvent]);

  function clearMessage() {
    setMessage("");
    setError("");
  }

  function resetEventForm() {
    const year =
      new Date().getFullYear();

    setEventName("");
    setEventYear(year);

    setStartDate("");
    setEndDate("");

    setLunarStartYear(year);
    setLunarStartMonth(1);
    setLunarStartDay(1);

    setLunarEndYear(year);
    setLunarEndMonth(1);
    setLunarEndDay(1);

    setSameLunar(true);
    setEventNote("");
    setEventComment("");
  }

  function openNewEvent() {
    clearMessage();

    if (!selectedTempleId) {
      setError("请先选择寺庙");
      return;
    }

    resetEventForm();

    const year =
      selectedYear ||
      new Date().getFullYear();

    setEventYear(year);
    setLunarStartYear(year);
    setLunarEndYear(year);

    setShowEventForm(true);
  }

  function openEditEvent(
    event: Event
  ) {
    clearMessage();

    setEventName(event.name);
    setEventYear(event.event_year);

    setStartDate(
      event.start_date || ""
    );

    setEndDate(
      event.end_date || ""
    );

    setLunarStartYear(
      event.lunar_start_year ||
        event.event_year
    );

    setLunarStartMonth(
      event.lunar_start_month || 1
    );

    setLunarStartDay(
      event.lunar_start_day || 1
    );

    setLunarEndYear(
      event.lunar_end_year ||
        event.event_year
    );

    setLunarEndMonth(
      event.lunar_end_month || 1
    );

    setLunarEndDay(
      event.lunar_end_day || 1
    );

    setSameLunar(
      event.same_lunar_date_each_year !==
        false
    );

    setEventNote(
      event.note || ""
    );

    setEventComment(
      event.comment || ""
    );

    setShowEventForm(true);
  }

  function applyStartSolarToLunar() {
    if (!startDate) return;

    const result =
      solarToLunar(startDate);

    if (!result) {
      setError(
        "阳历日期无法转换成农历"
      );
      return;
    }

    setLunarStartYear(
      result.year
    );

    setLunarStartMonth(
      result.month
    );

    setLunarStartDay(
      result.day
    );
  }

  function applyEndSolarToLunar() {
    if (!endDate) return;

    const result =
      solarToLunar(endDate);

    if (!result) {
      setError(
        "阳历日期无法转换成农历"
      );
      return;
    }

    setLunarEndYear(
      result.year
    );

    setLunarEndMonth(
      result.month
    );

    setLunarEndDay(
      result.day
    );
  }

  function applyStartLunarToSolar() {
    const solar =
      lunarToSolar(
        lunarStartYear,
        lunarStartMonth,
        lunarStartDay
      );

    if (!solar) {
      setError(
        "农历日期无法转换成阳历"
      );
      return;
    }

    setStartDate(solar);

    setEventYear(
      lunarStartYear
    );
  }

  function applyEndLunarToSolar() {
    const solar =
      lunarToSolar(
        lunarEndYear,
        lunarEndMonth,
        lunarEndDay
      );

    if (!solar) {
      setError(
        "农历日期无法转换成阳历"
      );
      return;
    }

    setEndDate(solar);
  }

  async function saveTemple() {
    clearMessage();

    const name =
      newTempleName.trim();

    if (!name) {
      setError("请输入寺庙名称");
      return;
    }

    try {
      setSaving(true);

      const { data, error } =
        await supabase
          .from("fh_temples")
          .insert({
            name,
            note:
              newTempleNote.trim() ||
              null,
          })
          .select()
          .single();

      if (error)
        throw error;

      const temple = data as Temple;

      setTemples((prev) =>
        [...prev, temple].sort(
          (a, b) =>
            a.name.localeCompare(
              b.name
            )
        )
      );

      setSelectedTempleId(
        temple.id
      );

      setNewTempleName("");
      setNewTempleNote("");
      setShowTempleForm(false);

      setMessage(
        "寺庙已保存"
      );
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "保存寺庙失败"
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveEvent() {
    clearMessage();

    if (!selectedTempleId) {
      setError("请先选择寺庙");
      return;
    }

    if (!eventName.trim()) {
      setError("请输入法会名称");
      return;
    }

    if (!startDate) {
      setError("请选择法会开始阳历日期");
      return;
    }

    if (!endDate) {
      setError("请选择法会结束阳历日期");
      return;
    }

    if (endDate < startDate) {
      setError(
        "结束日期不能早于开始日期"
      );
      return;
    }

    try {
      setSaving(true);

      const payload = {
        temple_id:
          selectedTempleId,

        name:
          eventName.trim(),

        event_year:
          Number(eventYear),

        start_date:
          startDate,

        end_date:
          endDate,

        lunar_start_year:
          Number(lunarStartYear),

        lunar_start_month:
          Number(lunarStartMonth),

        lunar_start_day:
          Number(lunarStartDay),

        lunar_start_leap:
          false,

        lunar_end_year:
          Number(lunarEndYear),

        lunar_end_month:
          Number(lunarEndMonth),

        lunar_end_day:
          Number(lunarEndDay),

        lunar_end_leap:
          false,

        same_lunar_date_each_year:
          sameLunar,

        note:
          eventNote.trim() ||
          null,

        comment:
          eventComment.trim() ||
          null,
      };

      if (selectedEvent) {
        const { data, error } =
          await supabase
            .from("fh_events")
            .update(payload)
            .eq(
              "id",
              selectedEvent.id
            )
            .select()
            .single();

        if (error)
          throw error;

        const updated =
          data as Event;

        setEvents((prev) =>
          prev.map((event) =>
            event.id ===
            updated.id
              ? updated
              : event
          )
        );

        setSelectedYear(
          updated.event_year
        );

        setMessage(
          "法会已更新"
        );
      } else {
        const { data, error } =
          await supabase
            .from("fh_events")
            .insert(payload)
            .select()
            .single();

        if (error)
          throw error;

        const created =
          data as Event;

        setEvents((prev) =>
          [...prev, created]
        );

        setSelectedEventId(
          created.id
        );

        setSelectedYear(
          created.event_year
        );

        setMessage(
          "法会已创建"
        );
      }

      setShowEventForm(false);
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "保存法会失败"
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteEvent(
    event: Event
  ) {
    if (
      !confirm(
        `确定删除「${event.name}」吗？\n\n该法会下面的红包项目也会一起删除。`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      clearMessage();

      const { error } =
        await supabase
          .from("fh_events")
          .delete()
          .eq(
            "id",
            event.id
          );

      if (error)
        throw error;

      setEvents((prev) =>
        prev.filter(
          (e) =>
            e.id !== event.id
        )
      );

      setPackets((prev) =>
        prev.filter(
          (p) =>
            p.event_id !==
            event.id
        )
      );

      if (
        selectedEventId ===
        event.id
      ) {
        setSelectedEventId("");
      }

      setMessage(
        "法会已删除"
      );
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "删除法会失败"
      );
    } finally {
      setSaving(false);
    }
  }

  function startPacketEditing() {
    const drafts =
      selectedPackets.map(
        (packet) => ({
          id: packet.id,
          days:
            packet.days || [],
          item_name:
            packet.item_name,
          packet_amount:
            String(
              packet.packet_amount
            ),
          denominations:
            packet.denominations?.length
              ? packet.denominations.map(
                  (d) => ({
                    denomination:
                      Number(
                        d.denomination
                      ),
                    quantity:
                      Number(
                        d.quantity
                      ),
                  })
                )
              : [
                  {
                    denomination: 10,
                    quantity: 1,
                  },
                ],
          note:
            packet.note || "",
          sort_order:
            packet.sort_order,
        })
      );

    setPacketDrafts(drafts);
    setEditingPackets(true);
  }

  function addPacketDraft() {
    setPacketDrafts((prev) => [
      ...prev,
      makeEmptyPacket(
        prev.length + 1
      ),
    ]);
  }

  function updatePacketDraft(
    index: number,
    patch: Partial<PacketDraft>
  ) {
    setPacketDrafts((prev) =>
      prev.map((draft, i) =>
        i === index
          ? {
              ...draft,
              ...patch,
            }
          : draft
      )
    );
  }

  function togglePacketDay(
    index: number,
    day: number
  ) {
    setPacketDrafts((prev) =>
      prev.map((draft, i) => {
        if (i !== index)
          return draft;

        const exists =
          draft.days.includes(day);

        const days = exists
          ? draft.days.filter(
              (d) => d !== day
            )
          : [
              ...draft.days,
              day,
            ].sort(
              (a, b) =>
                a - b
            );

        return {
          ...draft,
          days,
        };
      })
    );
  }

  function addDenomination(
    packetIndex: number
  ) {
    setPacketDrafts((prev) =>
      prev.map((draft, i) => {
        if (
          i !== packetIndex
        ) {
          return draft;
        }

        return {
          ...draft,
          denominations: [
            ...draft.denominations,
            {
              denomination: 10,
              quantity: 1,
            },
          ],
        };
      })
    );
  }

  function removeDenomination(
    packetIndex: number,
    denominationIndex: number
  ) {
    setPacketDrafts((prev) =>
      prev.map((draft, i) => {
        if (
          i !== packetIndex
        ) {
          return draft;
        }

        return {
          ...draft,
          denominations:
            draft.denominations.filter(
              (_, di) =>
                di !==
                denominationIndex
            ),
        };
      })
    );
  }

  function updateDenomination(
    packetIndex: number,
    denominationIndex: number,
    patch: Partial<Denomination>
  ) {
    setPacketDrafts((prev) =>
      prev.map((draft, i) => {
        if (
          i !== packetIndex
        ) {
          return draft;
        }

        return {
          ...draft,
          denominations:
            draft.denominations.map(
              (row, di) =>
                di ===
                denominationIndex
                  ? {
                      ...row,
                      ...patch,
                    }
                  : row
            ),
        };
      })
    );
  }

  function movePacket(
    index: number,
    direction: -1 | 1
  ) {
    const target =
      index + direction;

    if (
      target < 0 ||
      target >=
        packetDrafts.length
    ) {
      return;
    }

    setPacketDrafts((prev) => {
      const copy = [...prev];

      const temp =
        copy[index];

      copy[index] =
        copy[target];

      copy[target] = temp;

      return copy.map(
        (draft, i) => ({
          ...draft,
          sort_order:
            i + 1,
        })
      );
    });
  }

  function removePacketDraft(
    index: number
  ) {
    if (
      !confirm(
        "确定删除这个红包项目吗？"
      )
    ) {
      return;
    }

    setPacketDrafts((prev) =>
      prev
        .filter(
          (_, i) =>
            i !== index
        )
        .map(
          (draft, i) => ({
            ...draft,
            sort_order:
              i + 1,
          })
        )
    );
  }

  async function savePackets() {
    clearMessage();

    if (!selectedEventId) {
      setError("请先选择法会");
      return;
    }

    for (
      let i = 0;
      i < packetDrafts.length;
      i++
    ) {
      const draft =
        packetDrafts[i];

      if (
        !draft.item_name.trim()
      ) {
        setError(
          `第 ${i + 1} 个红包项目没有填写内容`
        );
        return;
      }

      const splitTotal =
        getSplitTotal(
          draft.denominations
        );

      if (
        !Number.isFinite(
          splitTotal
        ) ||
        splitTotal < 0
      ) {
        setError(
          `「${draft.item_name}」面值金额不正确`
        );
        return;
      }
    }

    try {
      setSaving(true);

      const oldPackets =
        selectedPackets;

      const oldIds =
        oldPackets.map(
          (p) => p.id
        );

      if (oldIds.length > 0) {
        const { error } =
          await supabase
            .from(
              "fh_red_packets"
            )
            .delete()
            .in(
              "id",
              oldIds
            );

        if (error)
          throw error;
      }

      if (
        packetDrafts.length > 0
      ) {
        const insertRows =
          packetDrafts.map(
            (draft, index) => ({
              event_id:
                selectedEventId,

              days:
                draft.days,

              item_name:
                draft.item_name.trim(),

              // 红包金额直接由下面的“面值 × 张数”计算，不再需要手工填写
              packet_amount:
                getSplitTotal(
                  draft.denominations
                ),

              denominations:
                draft.denominations.map(
                  (row) => ({
                    denomination:
                      Number(
                        row.denomination
                      ),
                    quantity:
                      Number(
                        row.quantity
                      ),
                  })
                ),

              note:
                draft.note.trim() ||
                null,

              sort_order:
                index + 1,
            })
          );

        const { data, error } =
          await supabase
            .from(
              "fh_red_packets"
            )
            .insert(
              insertRows
            )
            .select();

        if (error)
          throw error;

        const newRows =
          (data || []).map(
            (row: any) => ({
              ...row,
              days:
                parseDays(
                  row.days
                ),
              packet_amount:
                Number(
                  row.packet_amount
                ),
              denominations:
                Array.isArray(
                  row.denominations
                )
                  ? row.denominations
                  : [],
              sort_order:
                Number(
                  row.sort_order
                ) || 0,
            })
          ) as RedPacket[];

        setPackets((prev) => [
          ...prev.filter(
            (p) =>
              p.event_id !==
              selectedEventId
          ),
          ...newRows,
        ]);
      } else {
        setPackets((prev) =>
          prev.filter(
            (p) =>
              p.event_id !==
              selectedEventId
          )
        );
      }

      setEditingPackets(false);
      setMessage(
        "红包项目已保存"
      );
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "保存红包项目失败"
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyEventToNextYear(
    event: Event,
    targetYear?: number
  ) {
    const year =
      targetYear ||
      event.event_year + 1;

    clearMessage();

    try {
      setSaving(true);

      /*
       * 同名 + 同寺庙 + 同年份
       * 视为已经存在，避免重复复制
       */
      const { data: existing } =
        await supabase
          .from("fh_events")
          .select("id")
          .eq(
            "temple_id",
            event.temple_id
          )
          .eq(
            "event_year",
            year
          )
          .eq(
            "name",
            event.name
          )
          .limit(1);

      if (
        existing &&
        existing.length > 0
      ) {
        setError(
          `${year} 年已经存在「${event.name}」，没有重复复制。`
        );
        return;
      }

      let targetStart =
        "";
      let targetEnd =
        "";

      let targetLunarStart =
        solarToLunar(
          event.start_date || ""
        );

      let targetLunarEnd =
        solarToLunar(
          event.end_date || ""
        );

      if (
        event.same_lunar_date_each_year &&
        event.lunar_start_month &&
        event.lunar_start_day
      ) {
        targetLunarStart = {
          year,
          month:
            event.lunar_start_month,
          day:
            event.lunar_start_day,
          leap:
            event.lunar_start_leap,
        };

        targetLunarEnd =
          event.lunar_end_month &&
          event.lunar_end_day
            ? {
                year,
                month:
                  event.lunar_end_month,
                day:
                  event.lunar_end_day,
                leap:
                  event.lunar_end_leap,
              }
            : null;

        targetStart =
          lunarToSolar(
            year,
            event.lunar_start_month,
            event.lunar_start_day
          ) || "";

        if (
          event.lunar_end_month &&
          event.lunar_end_day
        ) {
          targetEnd =
            lunarToSolar(
              year,
              event.lunar_end_month,
              event.lunar_end_day
            ) || "";
        }
      } else {
        /*
         * 非“每年农历相同”：
         * 先使用原来的阳历日期，
         * 再根据目标年份的阳历重新计算农历。
         */
        if (
          event.start_date
        ) {
          const [, , dayPart] =
            event.start_date.split(
              "-"
            );

          const [, monthPart] =
            event.start_date.split(
              "-"
            );

          targetStart = `${year}-${monthPart}-${dayPart}`;
        }

        if (
          event.end_date
        ) {
          const [, , dayPart] =
            event.end_date.split(
              "-"
            );

          const [, monthPart] =
            event.end_date.split(
              "-"
            );

          targetEnd = `${year}-${monthPart}-${dayPart}`;
        }

        targetLunarStart =
          solarToLunar(
            targetStart
          );

        targetLunarEnd =
          solarToLunar(
            targetEnd
          );
      }

      const { data: newEventData, error: eventError } =
        await supabase
          .from("fh_events")
          .insert({
            temple_id:
              event.temple_id,

            name:
              event.name,

            event_year:
              year,

            start_date:
              targetStart ||
              null,

            end_date:
              targetEnd ||
              null,

            lunar_start_year:
              targetLunarStart?.year ||
              null,

            lunar_start_month:
              targetLunarStart?.month ||
              null,

            lunar_start_day:
              targetLunarStart?.day ||
              null,

            lunar_start_leap:
              targetLunarStart?.leap ||
              false,

            lunar_end_year:
              targetLunarEnd?.year ||
              null,

            lunar_end_month:
              targetLunarEnd?.month ||
              null,

            lunar_end_day:
              targetLunarEnd?.day ||
              null,

            lunar_end_leap:
              targetLunarEnd?.leap ||
              false,

            same_lunar_date_each_year:
              event.same_lunar_date_each_year,

            note:
              event.note ||
              null,

            comment:
              event.comment ||
              null,
          })
          .select()
          .single();

      if (eventError)
        throw eventError;

      const newEvent =
        newEventData as Event;

      const sourcePackets =
        packets
          .filter(
            (p) =>
              p.event_id ===
              event.id
          )
          .sort(
            (a, b) =>
              a.sort_order -
              b.sort_order
          );

      if (
        sourcePackets.length > 0
      ) {
        const packetRows =
          sourcePackets.map(
            (packet) => ({
              event_id:
                newEvent.id,

              days:
                packet.days ||
                [],

              item_name:
                packet.item_name,

              packet_amount:
                packet.packet_amount,

              denominations:
                packet.denominations,

              note:
                packet.note,

              sort_order:
                packet.sort_order,
            })
          );

        const {
          data: copiedPackets,
          error: packetError,
        } = await supabase
          .from(
            "fh_red_packets"
          )
          .insert(
            packetRows
          )
          .select();

        if (packetError)
          throw packetError;

        const normalized =
          (copiedPackets || []).map(
            (row: any) => ({
              ...row,
              days:
                parseDays(
                  row.days
                ),
              packet_amount:
                Number(
                  row.packet_amount
                ),
              denominations:
                row.denominations ||
                [],
              sort_order:
                Number(
                  row.sort_order
                ) || 0,
            })
          ) as RedPacket[];

        setPackets((prev) => [
          ...prev,
          ...normalized,
        ]);
      }

      setEvents((prev) => [
        ...prev,
        newEvent,
      ]);

      setSelectedYear(year);
      setSelectedEventId(
        newEvent.id
      );

      setMessage(
        `「${event.name}」已复制到 ${year} 年`
      );
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "复制法会失败"
      );
    } finally {
      setSaving(false);
    }
  }

  async function copyWholeYear() {
    clearMessage();

    const sourceEvents =
      yearEvents;

    if (
      sourceEvents.length === 0
    ) {
      setError(
        `${selectedYear} 年没有法会`
      );
      return;
    }

    const targetYear =
      selectedYear + 1;

    if (
      !confirm(
        `确定把 ${selectedYear} 年全部 ${sourceEvents.length} 个法会复制到 ${targetYear} 年吗？`
      )
    ) {
      return;
    }

    let successCount = 0;
    let skipCount = 0;

    for (const event of sourceEvents) {
      try {
        /*
         * 检查同寺庙 + 同名 + 目标年份
         */
        const { data: existing } =
          await supabase
            .from("fh_events")
            .select("id")
            .eq(
              "temple_id",
              event.temple_id
            )
            .eq(
              "event_year",
              targetYear
            )
            .eq(
              "name",
              event.name
            )
            .limit(1);

        if (
          existing &&
          existing.length > 0
        ) {
          skipCount++;
          continue;
        }

        let targetStart = "";
        let targetEnd = "";

        let targetLunarStart =
          solarToLunar(
            event.start_date || ""
          );

        let targetLunarEnd =
          solarToLunar(
            event.end_date || ""
          );

        if (
          event.same_lunar_date_each_year &&
          event.lunar_start_month &&
          event.lunar_start_day
        ) {
          targetStart =
            lunarToSolar(
              targetYear,
              event.lunar_start_month,
              event.lunar_start_day
            ) || "";

          if (
            event.lunar_end_month &&
            event.lunar_end_day
          ) {
            targetEnd =
              lunarToSolar(
                targetYear,
                event.lunar_end_month,
                event.lunar_end_day
              ) || "";
          }

          targetLunarStart = {
            year:
              targetYear,
            month:
              event.lunar_start_month,
            day:
              event.lunar_start_day,
            leap:
              event.lunar_start_leap,
          };

          targetLunarEnd =
            event.lunar_end_month &&
            event.lunar_end_day
              ? {
                  year:
                    targetYear,
                  month:
                    event.lunar_end_month,
                  day:
                    event.lunar_end_day,
                  leap:
                    event.lunar_end_leap,
                }
              : null;
        } else {
          /*
           * 非固定农历：
           * 保留原阳历月日，
           * 年份改为目标年，
           * 再重新计算农历。
           */
          if (
            event.start_date
          ) {
            const parts =
              event.start_date.split(
                "-"
              );

            targetStart = `${targetYear}-${parts[1]}-${parts[2]}`;
          }

          if (
            event.end_date
          ) {
            const parts =
              event.end_date.split(
                "-"
              );

            targetEnd = `${targetYear}-${parts[1]}-${parts[2]}`;
          }

          targetLunarStart =
            solarToLunar(
              targetStart
            );

          targetLunarEnd =
            solarToLunar(
              targetEnd
            );
        }

        const {
          data: newEventData,
          error: eventError,
        } = await supabase
          .from("fh_events")
          .insert({
            temple_id:
              event.temple_id,

            name:
              event.name,

            event_year:
              targetYear,

            start_date:
              targetStart ||
              null,

            end_date:
              targetEnd ||
              null,

            lunar_start_year:
              targetLunarStart?.year ||
              null,

            lunar_start_month:
              targetLunarStart?.month ||
              null,

            lunar_start_day:
              targetLunarStart?.day ||
              null,

            lunar_start_leap:
              targetLunarStart?.leap ||
              false,

            lunar_end_year:
              targetLunarEnd?.year ||
              null,

            lunar_end_month:
              targetLunarEnd?.month ||
              null,

            lunar_end_day:
              targetLunarEnd?.day ||
              null,

            lunar_end_leap:
              targetLunarEnd?.leap ||
              false,

            same_lunar_date_each_year:
              event.same_lunar_date_each_year,

            note:
              event.note ||
              null,

            comment:
              event.comment ||
              null,
          })
          .select()
          .single();

        if (eventError)
          throw eventError;

        const newEvent =
          newEventData as Event;

        const sourcePackets =
          packets
            .filter(
              (p) =>
                p.event_id ===
                event.id
            )
            .sort(
              (a, b) =>
                a.sort_order -
                b.sort_order
            );

        if (
          sourcePackets.length >
          0
        ) {
          const packetRows =
            sourcePackets.map(
              (packet) => ({
                event_id:
                  newEvent.id,

                days:
                  packet.days ||
                  [],

                item_name:
                  packet.item_name,

                packet_amount:
                  packet.packet_amount,

                denominations:
                  packet.denominations,

                note:
                  packet.note,

                sort_order:
                  packet.sort_order,
              })
            );

          const {
            data: copiedPackets,
            error: packetError,
          } = await supabase
            .from(
              "fh_red_packets"
            )
            .insert(
              packetRows
            )
            .select();

          if (packetError)
            throw packetError;

          const normalized =
            (copiedPackets || []).map(
              (row: any) => ({
                ...row,
                days:
                  parseDays(
                    row.days
                  ),
                packet_amount:
                  Number(
                    row.packet_amount
                  ),
                denominations:
                  row.denominations ||
                  [],
                sort_order:
                  Number(
                    row.sort_order
                  ) || 0,
              })
            ) as RedPacket[];

          setPackets((prev) => [
            ...prev,
            ...normalized,
          ]);
        }

        setEvents((prev) => [
          ...prev,
          newEvent,
        ]);

        successCount++;
      } catch (e) {
        console.error(
          "复制法会失败：",
          event.name,
          e
        );
      }
    }

    setSelectedYear(
      targetYear
    );

    setMessage(
      `已复制 ${successCount} 个法会到 ${targetYear} 年${
        skipCount
          ? `，${skipCount} 个因已存在而跳过`
          : ""
      }`
    );
  }

  async function deleteTemple(
    temple: Temple
  ) {
    const templeEvents =
      events.filter(
        (event) =>
          event.temple_id ===
          temple.id
      );

    if (
      !confirm(
        `确定删除「${temple.name}」吗？\n\n该寺庙下 ${templeEvents.length} 个法会也会删除。`
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      clearMessage();

      const { error } =
        await supabase
          .from("fh_temples")
          .delete()
          .eq(
            "id",
            temple.id
          );

      if (error)
        throw error;

      setTemples((prev) =>
        prev.filter(
          (t) =>
            t.id !== temple.id
        )
      );

      setEvents((prev) =>
        prev.filter(
          (e) =>
            e.temple_id !==
            temple.id
        )
      );

      setPackets((prev) =>
        prev.filter(
          (p) =>
            !events.some(
              (e) =>
                e.id ===
                  p.event_id &&
                e.temple_id ===
                  temple.id
            )
        )
      );

      if (
        selectedTempleId ===
        temple.id
      ) {
        const next =
          temples.find(
            (t) =>
              t.id !==
              temple.id
          );

        setSelectedTempleId(
          next?.id || ""
        );

        setSelectedEventId("");
      }

      setMessage(
        "寺庙已删除"
      );
    } catch (e: any) {
      console.error(e);
      setError(
        e?.message ||
          "删除寺庙失败"
      );
    } finally {
      setSaving(false);
    }
  }

  function renderDays(
    days: number[]
  ) {
    if (
      !days ||
      days.length === 0
    ) {
      return (
        <span className="text-gray-400">
          全程 / 未指定
        </span>
      );
    }

    return (
      <span>
        {days
          .map(
            (day) =>
              `第${day}天`
          )
          .join("、")}
      </span>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 p-8">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            正在读取法会数据……
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto max-w-7xl px-6 py-6">
        {/* ================================================== */}
        {/* Header */}
        {/* ================================================== */}

        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              法会红包管理
            </h1>

            <p className="mt-1 text-sm text-gray-500">
              寺庙 → 法会 → 红包项目 → 面值拆分 → 面值张数统计
            </p>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => {
                clearMessage();
                loadAll();
              }}
              className="rounded-lg border bg-white px-4 py-2 text-sm hover:bg-gray-50"
            >
              ↻ 刷新
            </button>

            <button
              onClick={() => {
                setShowTempleForm(
                  !showTempleForm
                );
                setShowEventForm(false);
              }}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white hover:bg-gray-800"
            >
              ＋ 新增寺庙
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            ✓ {message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* ================================================== */}
        {/* Temple */}
        {/* ================================================== */}

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                寺庙
              </h2>
            </div>

            <span className="text-sm text-gray-400">
              {temples.length} 个
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            {temples.map(
              (temple) => (
                <button
                  key={temple.id}
                  onClick={() => {
                    setSelectedTempleId(
                      temple.id
                    );
                    setSelectedEventId(
                      ""
                    );
                  }}
                  className={`group rounded-xl border px-5 py-3 text-left transition ${
                    selectedTempleId ===
                    temple.id
                      ? "border-gray-900 bg-gray-900 text-white"
                      : "border-gray-200 bg-white hover:border-gray-400"
                  }`}
                >
                  <div className="font-semibold">
                    {temple.name}
                  </div>

                  {temple.note && (
                    <div className="mt-1 text-xs opacity-70">
                      {temple.note}
                    </div>
                  )}
                </button>
              )
            )}

            {temples.length ===
              0 && (
              <div className="text-sm text-gray-400">
                暂无寺庙
              </div>
            )}
          </div>

          {selectedTemple && (
            <div className="mt-4 flex items-center gap-2">
              <span className="text-sm text-gray-500">
                当前寺庙：
                <strong className="text-gray-900">
                  {selectedTemple.name}
                </strong>
              </span>

              <button
                onClick={() =>
                  deleteTemple(
                    selectedTemple
                  )
                }
                className="text-xs text-red-500 hover:underline"
              >
                删除寺庙
              </button>
            </div>
          )}
        </section>

        {/* ================================================== */}
        {/* All Red Packet Statistics */}
        {/* ================================================== */}

        <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">
                全部红包统计
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                统计所有年份、所有寺庙、所有法会的红包项目
              </p>
            </div>

            <div className="rounded-xl bg-gray-900 px-5 py-3 text-right text-white">
              <div className="text-xs opacity-70">
                全部红包总金额
              </div>
              <div className="mt-1 text-2xl font-bold">
                {money(allRedPacketStats.totalAmount)}
              </div>
            </div>
          </div>

          <div className="mb-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border bg-gray-50 p-4">
              <div className="text-sm text-gray-500">
                红包项目总数
              </div>
              <div className="mt-1 text-2xl font-bold">
                {allRedPacketStats.packetCount}
                <span className="ml-1 text-sm font-normal text-gray-500">
                  个
                </span>
              </div>
            </div>

            <div className="rounded-xl border bg-gray-50 p-4">
              <div className="text-sm text-gray-500">
                全部寺庙数量
              </div>
              <div className="mt-1 text-2xl font-bold">
                {temples.length}
                <span className="ml-1 text-sm font-normal text-gray-500">
                  个
                </span>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border">
            <div className="border-b bg-gray-50 px-4 py-3 font-semibold">
              按寺庙统计
            </div>

            <div className="divide-y">
              {allRedPacketStats.temples.map((row) => (
                <div
                  key={row.templeId}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <div className="font-semibold">
                      🏯 {row.templeName}
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {row.packetCount} 个红包项目
                    </div>
                  </div>

                  <div className="text-lg font-bold">
                    {money(row.totalAmount)}
                  </div>
                </div>
              ))}

              {allRedPacketStats.temples.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-gray-400">
                  暂无红包数据
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-50 px-4 py-4">
                <div className="font-bold">
                  全部寺庙合计
                </div>
                <div className="text-xl font-bold">
                  {allRedPacketStats.packetCount} 个红包项目
                  {" · "}
                  {money(allRedPacketStats.totalAmount)}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ================================================== */}
        {/* Temple Form */}
        {/* ================================================== */}

        {showTempleForm && (
          <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-bold">
              新增寺庙
            </h2>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium">
                  寺庙名称
                </label>

                <input
                  value={
                    newTempleName
                  }
                  onChange={(e) =>
                    setNewTempleName(
                      e.target.value
                    )
                  }
                  placeholder="例如：法藏讲寺"
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:border-gray-900"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  备注
                </label>

                <input
                  value={
                    newTempleNote
                  }
                  onChange={(e) =>
                    setNewTempleNote(
                      e.target.value
                    )
                  }
                  className="w-full rounded-lg border px-3 py-2 outline-none focus:border-gray-900"
                />
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                disabled={saving}
                onClick={
                  saveTemple
                }
                className="rounded-lg bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-50"
              >
                保存
              </button>

              <button
                onClick={() =>
                  setShowTempleForm(
                    false
                  )
                }
                className="rounded-lg border px-5 py-2 text-sm"
              >
                取消
              </button>
            </div>
          </section>
        )}

        {/* ================================================== */}
        {/* Year */}
        {/* ================================================== */}

        {selectedTemple && (
          <section className="mb-6 rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg font-bold">
                  {selectedTemple.name}
                  {" "}法会
                </h2>

                <div className="mt-1 text-sm text-gray-500">
                  全年法会按照阳历日期排序
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={
                    selectedYear
                  }
                  onChange={(e) =>
                    setSelectedYear(
                      Number(
                        e.target.value
                      )
                    )
                  }
                  className="rounded-lg border bg-white px-4 py-2 text-sm"
                >
                  {years.map(
                    (year) => (
                      <option
                        key={year}
                        value={year}
                      >
                        {year}年
                      </option>
                    )
                  )}
                </select>

                <button
                  onClick={
                    openNewEvent
                  }
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white"
                >
                  ＋ 新增法会
                </button>

                <button
                  onClick={
                    copyWholeYear
                  }
                  disabled={
                    yearEvents.length ===
                      0 ||
                    saving
                  }
                  className="rounded-lg border border-gray-900 bg-white px-4 py-2 text-sm font-medium disabled:opacity-40"
                >
                  一键复制 {selectedYear}
                  年 →{" "}
                  {selectedYear +
                    1}
                  年
                </button>
              </div>
            </div>
          </section>
        )}

        {/* ================================================== */}
        {/* Event Form */}
        {/* ================================================== */}

        {showEventForm &&
          selectedTemple && (
            <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-xl font-bold">
                  {selectedEvent
                    ? "编辑法会"
                    : "新增法会"}
                </h2>

                <button
                  onClick={() =>
                    setShowEventForm(
                      false
                    )
                  }
                  className="text-gray-400 hover:text-gray-900"
                >
                  ✕
                </button>
              </div>

              <div className="grid gap-5">
                {/* Name / year */}

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      法会名称
                    </label>

                    <input
                      value={
                        eventName
                      }
                      onChange={(e) =>
                        setEventName(
                          e.target.value
                        )
                      }
                      placeholder="例如：秋季水陆法会"
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium">
                      年份
                    </label>

                    <input
                      type="number"
                      value={
                        eventYear
                      }
                      onChange={(e) =>
                        setEventYear(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="w-full rounded-lg border px-3 py-2"
                    />
                  </div>
                </div>

                {/* Solar */}

                <div>
                  <div className="mb-2 text-sm font-semibold">
                    阳历日期
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="date"
                      value={
                        startDate
                      }
                      onChange={(e) =>
                        setStartDate(
                          e.target.value
                        )
                      }
                      className="rounded-lg border px-3 py-2"
                    />

                    <span className="text-gray-400">
                      至
                    </span>

                    <input
                      type="date"
                      value={
                        endDate
                      }
                      onChange={(e) =>
                        setEndDate(
                          e.target.value
                        )
                      }
                      className="rounded-lg border px-3 py-2"
                    />

                    <button
                      type="button"
                      onClick={() => {
                        applyStartSolarToLunar();
                        applyEndSolarToLunar();
                      }}
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      阳历 → 农历
                    </button>
                  </div>
                </div>

                {/* Lunar */}

                <div>
                  <div className="mb-2 text-sm font-semibold">
                    农历日期
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={
                        lunarStartYear
                      }
                      onChange={(e) =>
                        setLunarStartYear(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="rounded-lg border px-3 py-2"
                    >
                      {Array.from(
                        {
                          length: 15,
                        },
                        (_, i) =>
                          new Date().getFullYear() -
                          5 +
                          i
                      ).map(
                        (year) => (
                          <option
                            key={
                              year
                            }
                            value={
                              year
                            }
                          >
                            {year}年
                          </option>
                        )
                      )}
                    </select>

                    <select
                      value={
                        lunarStartMonth
                      }
                      onChange={(e) =>
                        setLunarStartMonth(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="rounded-lg border px-3 py-2"
                    >
                      {Array.from(
                        {
                          length: 12,
                        },
                        (_, i) =>
                          i + 1
                      ).map(
                        (month) => (
                          <option
                            key={
                              month
                            }
                            value={
                              month
                            }
                          >
                            {lunarMonthName(
                              month
                            )}
                          </option>
                        )
                      )}
                    </select>

                    <select
                      value={
                        lunarStartDay
                      }
                      onChange={(e) =>
                        setLunarStartDay(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="rounded-lg border px-3 py-2"
                    >
                      {Array.from(
                        {
                          length: 30,
                        },
                        (_, i) =>
                          i + 1
                      ).map(
                        (day) => (
                          <option
                            key={day}
                            value={
                              day
                            }
                          >
                            {lunarDayName(
                              day
                            )}
                          </option>
                        )
                      )}
                    </select>

                    <span className="px-1 text-gray-400">
                      至
                    </span>

                    <select
                      value={
                        lunarEndYear
                      }
                      onChange={(e) =>
                        setLunarEndYear(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="rounded-lg border px-3 py-2"
                    >
                      {Array.from(
                        {
                          length: 15,
                        },
                        (_, i) =>
                          new Date().getFullYear() -
                          5 +
                          i
                      ).map(
                        (year) => (
                          <option
                            key={
                              year
                            }
                            value={
                              year
                            }
                          >
                            {year}年
                          </option>
                        )
                      )}
                    </select>

                    <select
                      value={
                        lunarEndMonth
                      }
                      onChange={(e) =>
                        setLunarEndMonth(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="rounded-lg border px-3 py-2"
                    >
                      {Array.from(
                        {
                          length: 12,
                        },
                        (_, i) =>
                          i + 1
                      ).map(
                        (month) => (
                          <option
                            key={
                              month
                            }
                            value={
                              month
                            }
                          >
                            {lunarMonthName(
                              month
                            )}
                          </option>
                        )
                      )}
                    </select>

                    <select
                      value={
                        lunarEndDay
                      }
                      onChange={(e) =>
                        setLunarEndDay(
                          Number(
                            e.target.value
                          )
                        )
                      }
                      className="rounded-lg border px-3 py-2"
                    >
                      {Array.from(
                        {
                          length: 30,
                        },
                        (_, i) =>
                          i + 1
                      ).map(
                        (day) => (
                          <option
                            key={day}
                            value={
                              day
                            }
                          >
                            {lunarDayName(
                              day
                            )}
                          </option>
                        )
                      )}
                    </select>

                    <button
                      type="button"
                      onClick={() => {
                        applyStartLunarToSolar();
                        applyEndLunarToSolar();
                      }}
                      className="ml-1 rounded-lg border px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      农历 → 阳历
                    </button>
                  </div>

                  <label className="mt-4 flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={
                        sameLunar
                      }
                      onChange={(e) =>
                        setSameLunar(
                          e.target.checked
                        )
                      }
                      className="h-4 w-4"
                    />

                    <span>
                      每年农历日期相同
                    </span>

                    <span className="text-gray-400">
                      （菩萨生日等每年固定农历日期建议勾选）
                    </span>
                  </label>
                </div>

                {/* Preview */}

                {(startDate ||
                  lunarStartMonth) && (
                  <div className="rounded-xl bg-gray-50 p-4 text-sm">
                    <div className="font-semibold">
                      日期预览
                    </div>

                    <div className="mt-2 text-gray-600">
                      阳历：
                      {dateText(
                        startDate
                      )}
                      {endDate &&
                        ` ～ ${dateText(
                          endDate
                        )}`}
                    </div>

                    <div className="mt-1 text-gray-600">
                      农历：
                      {lunarText(
                        lunarStartYear,
                        lunarStartMonth,
                        lunarStartDay
                      )}
                      {lunarEndMonth &&
                        lunarEndDay &&
                        ` ～ ${lunarText(
                          lunarEndYear,
                          lunarEndMonth,
                          lunarEndDay
                        )}`}
                    </div>
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    备注
                  </label>

                  <textarea
                    value={
                      eventNote
                    }
                    onChange={(e) =>
                      setEventNote(
                        e.target.value
                      )
                    }
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-bold">
                    COMMENT
                  </label>

                  <textarea
                    value={
                      eventComment
                    }
                    onChange={(e) =>
                      setEventComment(
                        e.target.value
                      )
                    }
                    rows={3}
                    placeholder="填写这个法会的 COMMENT，例如执行情况、特殊安排、下一年需要调整的内容等"
                    className="w-full rounded-lg border border-blue-200 bg-blue-50/30 px-3 py-2 outline-none focus:border-blue-500"
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    disabled={
                      saving
                    }
                    onClick={
                      saveEvent
                    }
                    className="rounded-lg bg-gray-900 px-6 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {saving
                      ? "保存中..."
                      : "保存法会"}
                  </button>

                  <button
                    onClick={() =>
                      setShowEventForm(
                        false
                      )
                    }
                    className="rounded-lg border px-6 py-2 text-sm"
                  >
                    取消
                  </button>
                </div>
              </div>
            </section>
          )}

        {/* ================================================== */}
        {/* Event Cards */}
        {/* ================================================== */}

        {selectedTemple && (
          <section className="mb-6">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">
                {selectedYear}年法会
              </h2>

              <span className="text-sm text-gray-500">
                共{" "}
                {
                  yearEvents.length
                }{" "}
                个
              </span>
            </div>

            {yearEvents.length ===
              0 ? (
              <div className="rounded-2xl bg-white p-10 text-center text-gray-400 shadow-sm">
                这一年还没有法会
              </div>
            ) : (
              <div className="space-y-8">
  {Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;

    const monthEvents = yearEvents
      .filter((event) => {
        if (!event.start_date) return false;

        const monthValue = Number(
          event.start_date.slice(5, 7)
        );

        return monthValue === month;
      })
      .sort((a, b) =>
        (a.start_date || "").localeCompare(
          b.start_date || ""
        )
      );

    if (monthEvents.length === 0) {
      return null;
    }

    return (
      <section key={month}>
        {/* ================= 月份标题 ================= */}
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-3xl font-bold tracking-tight">
            {month}月
          </h2>

          <div className="h-px flex-1 bg-gray-200" />
        </div>

       {/* ================= 该月份法会 ================= */}
<div className="grid gap-4">
  {monthEvents.map((event) => {
    const eventPackets = packets
      .filter((p) => p.event_id === event.id)
      .sort((a, b) => a.sort_order - b.sort_order);

    const total = getEventTotal(eventPackets);

    const denominationSummary = getDenominationSummary(eventPackets);

    const isSelected = selectedEventId === event.id;

    /* ================= 寺庙 ================= */

    const templeName =
      temples.find((t) => t.id === event.temple_id)?.name ||
      "未设置寺庙";

    let templeBg = "bg-gray-50";
    let templeText = "text-gray-700";
    let templeBorder = "border-gray-300";
    let templeBar = "bg-gray-500";

    if (templeName === "法藏讲寺") {
      templeBg = "bg-red-50";
      templeText = "text-red-700";
      templeBorder = "border-red-300";
      templeBar = "bg-red-500";
    } else if (templeName === "龙华寺") {
      templeBg = "bg-yellow-50";
      templeText = "text-yellow-700";
      templeBorder = "border-yellow-300";
      templeBar = "bg-yellow-500";
    } else if (templeName === "圆明讲堂") {
      templeBg = "bg-blue-50";
      templeText = "text-blue-700";
      templeBorder = "border-blue-300";
      templeBar = "bg-blue-500";
    }

    return (
      <div
        key={event.id}
        className={`relative overflow-hidden rounded-2xl border bg-white p-5 pl-6 shadow-sm transition ${
          isSelected
            ? "border-gray-900 ring-1 ring-gray-900"
            : "border-gray-200"
        }`}
      >
        {/* 寺庙颜色竖条 */}
        <div
          className={`absolute left-0 top-0 h-full w-1.5 ${templeBar}`}
        />

        {/* ================= 法会基本信息 ================= */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            {/* 寺庙名称 */}
            <div
              className={`mb-2 inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${templeBg} ${templeText} ${templeBorder}`}
            >
              🏯 {templeName}
            </div>

            {/* 法会名称 */}
            <button
              type="button"
              onClick={() => {
                if (isSelected) {
                  setSelectedEventId("");
                  setEditingPackets(false);
                } else {
                  setSelectedEventId(event.id);
                  setEditingPackets(false);
                }
              }}
              className="block text-left"
            >
              <h3 className="text-xl font-bold hover:underline">
                {event.name}
              </h3>
            </button>

            {/* 阳历 */}
            <div className="mt-2 text-sm text-gray-500">
              阳历：
              {dateText(event.start_date)}
              {event.end_date &&
                ` ～ ${dateText(event.end_date)}`}
            </div>

            {/* 农历 */}
            <div className="mt-1 text-sm text-gray-500">
              农历：
              {lunarText(
                event.lunar_start_year,
                event.lunar_start_month,
                event.lunar_start_day,
                event.lunar_start_leap
              )}

              {event.lunar_end_month &&
                event.lunar_end_day &&
                ` ～ ${lunarText(
                  event.lunar_end_year,
                  event.lunar_end_month,
                  event.lunar_end_day,
                  event.lunar_end_leap
                )}`}
            </div>

            {/* 每年农历相同 */}
            {event.same_lunar_date_each_year && (
              <div className="mt-2 inline-flex rounded-full bg-green-50 px-3 py-1 text-xs text-green-700">
                ✓ 每年农历日期相同
              </div>
            )}

            {event.comment && (
              <div className="mt-3 max-w-2xl rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                <div className="text-xs font-bold text-blue-700">
                  COMMENT
                </div>
                <div className="mt-1 whitespace-pre-wrap text-sm text-blue-900">
                  {event.comment}
                </div>
              </div>
            )}
          </div>

          {/* 金额 + 面值 */}
          <div className="text-right">
            <div className="text-2xl font-bold">
              {money(total)}
            </div>

            <div className="mt-2 space-y-1 text-sm text-gray-600">
              {denominationSummary.length > 0 ? (
                denominationSummary.map((row) => (
                  <div key={row.denomination}>
                    {row.denomination}元 × {row.quantity}张 = {money(row.denomination * row.quantity)}
                  </div>
                ))
              ) : (
                <div>暂无面值数据</div>
              )}
            </div>
          </div>
        </div>

        {/* ================= 操作按钮 ================= */}
        <div className="mt-5 flex flex-wrap gap-2 border-t pt-4">
          <button
            type="button"
            onClick={() => {
              if (isSelected) {
                setSelectedEventId("");
                setEditingPackets(false);
              } else {
                setSelectedEventId(event.id);
                setEditingPackets(false);
              }
            }}
            className={`rounded-lg px-4 py-2 text-sm ${
              isSelected
                ? "bg-gray-900 text-white"
                : "border bg-white"
            }`}
          >
            {isSelected ? "收起红包" : "查看红包"}
          </button>

          <button
            type="button"
            onClick={() => openEditEvent(event)}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            编辑
          </button>

          <button
            type="button"
            onClick={() => copyEventToNextYear(event)}
            disabled={saving}
            className="rounded-lg border px-4 py-2 text-sm"
          >
            复制到 {event.event_year + 1}年
          </button>

          <button
            type="button"
            onClick={() => deleteEvent(event)}
            disabled={saving}
            className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-500"
          >
            删除
          </button>
        </div>

        {/* ================= 当前法会红包详情 ================= */}
        {isSelected && (
          <div className="mt-4 border-t-2 border-gray-200 pt-4">
            <div className="rounded-xl bg-gray-50 p-4">
              {/* 标题 */}
              <div className="mb-3 flex items-center justify-between">
                <h4 className="text-lg font-bold">
                  红包明细
                </h4>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedEventId("");
                    setEditingPackets(false);
                  }}
                  className="rounded-lg border px-3 py-1.5 text-sm hover:bg-white"
                >
                  收起红包
                </button>
              </div>

              {/* ================= 红包列表 ================= */}
              <div className="space-y-2">
                {eventPackets.map((packet) => {
                  const splitTotal = getSplitTotal(
                    packet.denominations
                  );

                  return (
                    <div
                      key={packet.id}
                      className="rounded-lg border bg-white p-3"
                    >
                      <div className="flex flex-wrap items-center gap-3">
                        {/* 内容 */}
                        <span className="font-medium">
                          {packet.item_name || "未命名"}
                        </span>

                        {/* 第几天 */}
                        {packet.days?.length > 0 && (
                          <span className="text-sm text-gray-500">
                            第 {packet.days.join("、")} 天
                          </span>
                        )}

                        {/* 红包金额 */}
                        <span className="text-sm">
                          红包金额：
                          <b className="ml-1">
                            ¥{money(splitTotal)}
                          </b>
                        </span>

                        {/* 面值拆分 */}
                        <span className="text-sm">
                          {packet.denominations?.map(
                            (
                              d: Denomination,
                              index: number
                            ) => (
                              <span
                                key={index}
                                className="mr-2"
                              >
                                {d.denomination}元 ×{" "}
                                {d.quantity}张
                              </span>
                            )
                          )}
                        </span>

                        {/* 拆分合计 */}
                        <span className="font-bold">
                          = ¥{money(splitTotal)}
                        </span>

                        {/* 检查 */}
                        {Math.abs(
                          splitTotal -
                            Number(packet.packet_amount)
                        ) < 0.01 ? (
                          <span className="text-green-600">
                            ✓ 面值合计正确
                          </span>
                        ) : (
                          <span className="font-medium text-red-600">
                            ⚠ 面值合计不正确
                          </span>
                        )}
                      </div>

                      {/* 备注 */}
                      {packet.note && (
                        <div className="mt-1 text-sm text-gray-500">
                          备注：{packet.note}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

{/* ================= 面值统计 ================= */}
<div className="mt-4 rounded-lg border bg-white p-4">
  <div className="mb-2 font-bold">
    现金准备统计
  </div>

  <div className="space-y-1.5">
    {getDenominationSummary(eventPackets).map(
      (row) => (
        <div
          key={row.denomination}
          className="rounded-lg bg-gray-50 px-3 py-1.5 text-sm font-medium"
        >
          {row.denomination}元 × {row.quantity}张 = {money(row.denomination * row.quantity)}
        </div>
      )
    )}
  </div>
</div>
            </div>
          </div>
        )}
      </div>
    );
  })}
</div>
      </section>
    );
  })}
</div>
            )}
          </section>
        )}

        {/* ================================================== */}
        {/* Selected Event */}
        {/* ================================================== */}

        {selectedEvent && (
          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500">
                  {selectedTemple?.name}
                </div>

                <h2 className="mt-1 text-2xl font-bold">
                  {
                    selectedEvent.name
                  }
                </h2>

                <div className="mt-2 text-sm text-gray-500">
                  阳历：
                  {dateText(
                    selectedEvent.start_date
                  )}
                  {selectedEvent.end_date &&
                    ` ～ ${dateText(
                      selectedEvent.end_date
                    )}`}
                </div>

                <div className="mt-1 text-sm text-gray-500">
                  农历：
                  {lunarText(
                    selectedEvent.lunar_start_year,
                    selectedEvent.lunar_start_month,
                    selectedEvent.lunar_start_day,
                    selectedEvent.lunar_start_leap
                  )}
                  {selectedEvent.lunar_end_month &&
                    selectedEvent.lunar_end_day &&
                    ` ～ ${lunarText(
                      selectedEvent.lunar_end_year,
                      selectedEvent.lunar_end_month,
                      selectedEvent.lunar_end_day,
                      selectedEvent.lunar_end_leap
                    )}`}
                </div>

                {selectedEvent.comment && (
                  <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
                    <div className="text-xs font-bold text-blue-700">
                      COMMENT
                    </div>
                    <div className="mt-1 whitespace-pre-wrap text-sm text-blue-900">
                      {selectedEvent.comment}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {!editingPackets ? (
                  <button
                    onClick={
                      startPacketEditing
                    }
                    className="rounded-lg bg-gray-900 px-5 py-2 text-sm text-white"
                  >
                    编辑红包
                  </button>
                ) : (
                  <>
                    <button
                      disabled={
                        saving
                      }
                      onClick={
                        savePackets
                      }
                      className="rounded-lg bg-gray-900 px-5 py-2 text-sm text-white disabled:opacity-50"
                    >
                      {saving
                        ? "保存中..."
                        : "保存红包"}
                    </button>

                    <button
                      onClick={() =>
                        setEditingPackets(
                          false
                        )
                      }
                      className="rounded-lg border px-5 py-2 text-sm"
                    >
                      取消
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ================================================= */}
            {/* Packet Edit */}
            {/* ================================================= */}

            {editingPackets ? (
              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold">
                    红包项目
                  </h3>

                  <button
                    onClick={
                      addPacketDraft
                    }
                    className="rounded-lg border border-gray-900 px-4 py-2 text-sm"
                  >
                    ＋ 添加红包项目
                  </button>
                </div>

                <div className="space-y-4">
                  {packetDrafts.map(
                    (
                      draft,
                      index
                    ) => {
                      const splitTotal =
                        getSplitTotal(
                          draft.denominations
                        );

                      return (
                        <div
                          key={
                            draft.id ||
                            `new-${index}`
                          }
                          className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                        >
                          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="font-semibold">
                              内容
                              {index +
                                1}
                            </div>

                            <div className="flex gap-1">
                              <button
                                onClick={() =>
                                  movePacket(
                                    index,
                                    -1
                                  )
                                }
                                className="rounded border bg-white px-2 py-1 text-xs"
                              >
                                ↑
                              </button>

                              <button
                                onClick={() =>
                                  movePacket(
                                    index,
                                    1
                                  )
                                }
                                className="rounded border bg-white px-2 py-1 text-xs"
                              >
                                ↓
                              </button>

                              <button
                                onClick={() =>
                                  removePacketDraft(
                                    index
                                  )
                                }
                                className="rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-500"
                              >
                                删除
                              </button>
                            </div>
                          </div>

                          {/* Main line */}

                          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
                            <input
                              value={
                                draft.item_name
                              }
                              onChange={(
                                e
                              ) =>
                                updatePacketDraft(
                                  index,
                                  {
                                    item_name:
                                      e
                                        .target
                                        .value,
                                  }
                                )
                              }
                              placeholder="例如：第一天供养"
                              className="rounded-lg border bg-white px-3 py-2"
                            />



                            <div className="flex items-center gap-2 text-sm">
                              <span className="whitespace-nowrap text-gray-500">
                                使用天数
                              </span>

                              <div className="flex flex-wrap gap-1">
                                {Array.from(
                                  {
                                    length: 7,
                                  },
                                  (
                                    _,
                                    dayIndex
                                  ) =>
                                    dayIndex +
                                    1
                                ).map(
                                  (
                                    day
                                  ) => (
                                    <button
                                      key={
                                        day
                                      }
                                      type="button"
                                      onClick={() =>
                                        togglePacketDay(
                                          index,
                                          day
                                        )
                                      }
                                      className={`rounded px-2 py-1 text-xs ${
                                        draft.days.includes(
                                          day
                                        )
                                          ? "bg-gray-900 text-white"
                                          : "border bg-white text-gray-500"
                                      }`}
                                    >
                                      {day}
                                    </button>
                                  )
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Denominations */}

                          <div className="mt-4 rounded-lg border bg-white p-3">
                            <div className="mb-2 flex items-center justify-between">
                              <span className="text-sm font-semibold">
                                怎么换
                              </span>

                              <button
                                type="button"
                                onClick={() =>
                                  addDenomination(
                                    index
                                  )
                                }
                                className="text-sm text-blue-600 hover:underline"
                              >
                                ＋ 增加面值
                              </button>
                            </div>

                            <div className="space-y-2">
                              {draft.denominations.map(
                                (
                                  row,
                                  denominationIndex
                                ) => (
                                  <div
                                    key={
                                      denominationIndex
                                    }
                                    className="flex flex-wrap items-center gap-2"
                                  >
                                    <select
                                      value={
                                        row.denomination
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        updateDenomination(
                                          index,
                                          denominationIndex,
                                          {
                                            denomination:
                                              Number(
                                                e
                                                  .target
                                                  .value
                                              ),
                                          }
                                        )
                                      }
                                      className="rounded-lg border px-3 py-2"
                                    >
                                      {DENOMINATIONS.map(
                                        (
                                          denomination
                                        ) => (
                                          <option
                                            key={
                                              denomination
                                            }
                                            value={
                                              denomination
                                            }
                                          >
                                            {
                                              denomination
                                            }
                                            元
                                          </option>
                                        )
                                      )}
                                    </select>

                                    <span>
                                      ×
                                    </span>

                                    <input
                                      type="number"
                                      min="0"
                                      value={
                                        row.quantity
                                      }
                                      onChange={(
                                        e
                                      ) =>
                                        updateDenomination(
                                          index,
                                          denominationIndex,
                                          {
                                            quantity:
                                              Number(
                                                e
                                                  .target
                                                  .value
                                              ),
                                          }
                                        )
                                      }
                                      className="w-24 rounded-lg border px-3 py-2"
                                    />

                                    <span>
                                      张
                                    </span>

                                    <span className="text-sm text-gray-500">
                                      =
                                      {" "}
                                      {money(
                                        Number(
                                          row.denomination
                                        ) *
                                          Number(
                                            row.quantity
                                          )
                                      )}
                                    </span>

                                    {draft
                                      .denominations
                                      .length >
                                      1 && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          removeDenomination(
                                            index,
                                            denominationIndex
                                          )
                                        }
                                        className="text-xs text-red-500"
                                      >
                                        删除
                                      </button>
                                    )}
                                  </div>
                                )
                              )}
                            </div>

                            <div className="mt-3 text-sm font-medium text-green-600">
                              红包金额：{money(splitTotal)}（根据面值 × 张数自动计算）
                            </div>
                          </div>

                          <div className="mt-3">
                            <input
                              value={
                                draft.note
                              }
                              onChange={(
                                e
                              ) =>
                                updatePacketDraft(
                                  index,
                                  {
                                    note:
                                      e
                                        .target
                                        .value,
                                  }
                                )
                              }
                              placeholder="备注（可选）"
                              className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                            />
                          </div>
                        </div>
                      );
                    }
                  )}

                  {packetDrafts.length ===
                    0 && (
                    <div className="rounded-xl border border-dashed p-10 text-center text-gray-400">
                      暂无红包项目
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* ================================================= */
              /* Packet View */
              /* ================================================= */

              <div>
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="text-lg font-bold">
                    红包项目
                  </h3>

                  <div className="text-sm text-gray-500">
                    共{" "}
                    {
                      selectedPackets.length
                    }{" "}
                    项
                  </div>
                </div>

                {selectedPackets.length ===
                0 ? (
                  <div className="rounded-xl border border-dashed p-10 text-center text-gray-400">
                    暂无红包项目
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedPackets.map(
                      (
                        packet,
                        index
                      ) => {
                        const splitTotal =
                          getSplitTotal(
                            packet.denominations
                          );

                        const correct =
                          Math.abs(
                            splitTotal -
                              packet.packet_amount
                          ) <
                          0.001;

                        return (
                          <div
                            key={
                              packet.id
                            }
                            className="rounded-xl border border-gray-200 bg-white p-4"
                          >
                            <div className="flex flex-wrap items-center gap-4">
                              <div className="w-8 text-sm text-gray-400">
                                {index +
                                  1}
                              </div>

                              <div className="min-w-[180px] flex-1">
                                <div className="font-semibold">
                                  {
                                    packet.item_name
                                  }
                                </div>

                                {packet
                                  .note && (
                                  <div className="mt-1 text-xs text-gray-400">
                                    {
                                      packet.note
                                    }
                                  </div>
                                )}
                              </div>

                              <div className="text-sm text-gray-500">
                                {renderDays(
                                  packet.days
                                )}
                              </div>

                              <div className="font-semibold">
                                红包金额：
                                {money(
                                  packet.packet_amount
                                )}
                              </div>

                              <div className="flex flex-wrap items-center gap-2 text-sm">
                                <span className="text-gray-500">
                                  怎么换：
                                </span>

                                {packet.denominations.map(
                                  (
                                    row,
                                    i
                                  ) => (
                                    <span
                                      key={
                                        i
                                      }
                                      className="rounded-lg bg-gray-100 px-3 py-1.5"
                                    >
                                      {
                                        row.denomination
                                      }
                                      元 ×{" "}
                                      {
                                        row.quantity
                                      }
                                      张
                                    </span>
                                  )
                                )}
                              </div>

                              <div className="font-semibold">
                                =
                                {" "}
                                {money(
                                  packet.packet_amount
                                )}
                              </div>
                            </div>

                            <div
                              className={`mt-3 text-sm ${
                                correct
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {correct
                                ? "✓ 面值合计正确"
                                : `⚠ 面值合计 ${money(
                                    splitTotal
                                  )}，与红包金额不一致`}
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ================================================= */}
            {/* Denomination Summary */}
            {/* ================================================= */}

            <div className="mt-8 rounded-2xl border border-gray-200 bg-gray-50 p-5">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-bold">
                    实际现金准备统计
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    统计每个面值需要准备多少张
                  </p>
                </div>

                <div className="text-2xl font-bold">
                  {money(
                    selectedEventTotal
                  )}
                </div>
              </div>

              <div className="mt-5 space-y-2">
                {selectedEventDenominations.map(
                  (row) => (
                    <div
                      key={
                        row.denomination
                      }
                      className="flex items-center justify-between rounded-xl bg-white px-5 py-3 shadow-sm"
                    >
                      <div className="font-bold text-gray-900">
                        {row.denomination}元 × {row.quantity}张
                      </div>
                      <div className="font-semibold text-gray-700">
                        = {money(row.denomination * row.quantity)}
                      </div>
                    </div>
                  )
                )}

                {selectedEventDenominations.length ===
                  0 && (
                  <div className="rounded-xl bg-white p-6 text-center text-gray-400">
                    暂无面值统计
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap gap-6 border-t pt-4 text-sm">
                <div>
                  总金额：
                  <strong>
                    {money(
                      selectedEventTotal
                    )}
                  </strong>
                </div>

                <div>
                  总张数：
                  <strong>
                    {selectedEventDenominations.reduce(
                      (
                        sum,
                        row
                      ) =>
                        sum +
                        row.quantity,
                      0
                    )}
                    张
                  </strong>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}