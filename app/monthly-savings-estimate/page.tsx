"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import { supabase } from "@/lib/supabase";

// =====================================================
// 类型
// =====================================================

type ItemType =
  | "income"
  | "expense";

type SavingsItem = {
  id: string;
  year: number;
  month: number;
  item_type: ItemType;
  item_name: string;
  amount: number;
  sort_order?: number | null;
  source?: string | null;
  editable?: boolean;
  copy_group_id?: string | null;
};

// =====================================================
// 常量
// =====================================================

const MONTHS = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9,
  10,
  11,
  12,
];

// =====================================================
// 页面
// =====================================================

export default function MonthlySavingsEstimatePage() {
  // ===================================================
  // 基础
  // ===================================================

  const currentYear =
    new Date().getFullYear();

  const currentMonth =
    new Date().getMonth() + 1;

  // ===================================================
  // 状态
  // ===================================================

  const [year, setYear] =
    useState(currentYear);

  const [activeMonth, setActiveMonth] =
    useState(currentMonth);

  const [items, setItems] =
    useState<SavingsItem[]>([]);

  const [creditCardAutoExpenseMap, setCreditCardAutoExpenseMap] =
    useState<Record<string, number>>({});

  const [creditCardLoading, setCreditCardLoading] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [savingKey, setSavingKey] =
    useState<string | null>(null);

  const [applyingKey, setApplyingKey] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  // ===================================================
  // 消息
  // ===================================================

  function showMessage(text: string) {
    setMessage(text);

    window.setTimeout(() => {
      setMessage("");
    }, 1800);
  }

  // ===================================================
  // 加载储蓄数据
  // ===================================================

  async function loadSavings() {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/monthly-savings?year=${year}`,
        {
          method: "GET",
          cache: "no-store",
        }
      );

      const data = await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "读取储蓄数据失败"
        );
      }

      setItems(
        Array.isArray(data.items)
          ? data.items
          : []
      );
    } catch (err) {
      console.error(
        "Load monthly savings error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setLoading(false);
    }
  }

  // ===================================================
  // 加载信用卡月度资金安排
  //
  // 核心规则：
  // monthly-savings-estimate 某个月的“信用卡支出”
  // 必须等于 /credit-card 同一个账单月份的：
  //
  // 预估账单资金安排 → 还需要自己拿
  //
  // /credit-card 的计算口径：
  // 预计账单 = 固定信用卡分期 + 当月信用卡预估账单
  // 还需要自己拿 = max(0, 预计账单 - LP给我 - 我自己现在有)
  //
  // 这里直接读取同一套月度表，按月份计算，
  // 不再读取 /api/credit-card 的“当前月份”汇总。
  // ===================================================

  async function loadCreditCardExpense() {
    try {
      setCreditCardLoading(true);

      const yearStart = `${year}-01-01`;
      const yearEnd = `${year}-12-01`;
      const currentMonthKey =
        `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

      const [
        monthlyBillsResult,
        monthlyFundingResult,
        loansResult,
        cardsResult,
      ] = await Promise.all([
        supabase
          .from("credit_card_monthly_bills")
          .select("credit_card_id, bill_month, monthly_estimate")
          .gte("bill_month", yearStart)
          .lte("bill_month", yearEnd),

        supabase
          .from("credit_card_monthly_funding")
          .select("bill_month, lp_estimate_amount, my_estimate_amount")
          .gte("bill_month", yearStart)
          .lte("bill_month", yearEnd),

        supabase
          .from("loans")
          .select("monthly_payment")
          .eq("type", "信用卡分期")
          .eq("status", "active"),

        supabase
          .from("credit_cards")
          .select("id, monthly_estimate, active")
          .eq("active", true),
      ]);

      if (monthlyBillsResult.error) {
        throw monthlyBillsResult.error;
      }

      if (monthlyFundingResult.error) {
        throw monthlyFundingResult.error;
      }

      if (loansResult.error) {
        throw loansResult.error;
      }

      if (cardsResult.error) {
        throw cardsResult.error;
      }

      // 固定信用卡分期：与 /credit-card 页面一致，
      // 所有 active + type=信用卡分期 的贷款月供都会进入预计账单。
      const installmentTotal = (loansResult.data || []).reduce(
        (sum, loan) =>
          sum + Number(loan.monthly_payment || 0),
        0
      );

      // 每个月信用卡预估账单。
      const estimateByMonth: Record<string, number> = {};
      const billCardIdsByMonth: Record<string, Set<string>> = {};

      (monthlyBillsResult.data || []).forEach(row => {
        const billMonth = String(row.bill_month || "").slice(0, 7);
        const cardId = String(row.credit_card_id || "");

        if (!billMonth) return;

        estimateByMonth[billMonth] =
          (estimateByMonth[billMonth] || 0) +
          Number(row.monthly_estimate || 0);

        if (!billCardIdsByMonth[billMonth]) {
          billCardIdsByMonth[billMonth] = new Set<string>();
        }

        if (cardId) {
          billCardIdsByMonth[billMonth].add(cardId);
        }
      });

      // 与 /credit-card 的月度账单加载规则保持一致：
      // 只有当前月份，如果月度账单表没有某张卡的记录，
      // 才回退到 credit_cards.monthly_estimate。
      // 其他月份没有记录就按 0 处理。
      if (year === currentYear) {
        const currentExistingIds =
          billCardIdsByMonth[currentMonthKey] ||
          new Set<string>();

        (cardsResult.data || []).forEach(card => {
          const cardId = String(card.id || "");

          if (!cardId || currentExistingIds.has(cardId)) {
            return;
          }

          estimateByMonth[currentMonthKey] =
            (estimateByMonth[currentMonthKey] || 0) +
            Number(card.monthly_estimate || 0);
        });
      }

      const fundingByMonth: Record<
        string,
        {
          lp: number;
          myself: number;
        }
      > = {};

      (monthlyFundingResult.data || []).forEach(row => {
        const billMonth = String(row.bill_month || "").slice(0, 7);
        if (!billMonth) return;

        fundingByMonth[billMonth] = {
          lp: Number(row.lp_estimate_amount || 0),
          myself: Number(row.my_estimate_amount || 0),
        };
      });

      const result: Record<string, number> = {};

      MONTHS.forEach(month => {
        const monthKey =
          `${year}-${String(month).padStart(2, "0")}`;

        const estimateTotal =
          Number(estimateByMonth[monthKey] || 0);

        const funding =
          fundingByMonth[monthKey] || {
            lp: 0,
            myself: 0,
          };

        const estimatedBillTotal =
          installmentTotal + estimateTotal;

        const fundingTotal =
          funding.lp + funding.myself;

        result[monthKey] = Math.max(
          0,
          estimatedBillTotal - fundingTotal
        );
      });

      setCreditCardAutoExpenseMap(result);
    } catch (err) {
      console.error(
        "Load monthly credit card funding error:",
        err
      );

      setCreditCardAutoExpenseMap({});
    } finally {
      setCreditCardLoading(false);
    }
  }

  // ===================================================
  // 初始加载
  // ===================================================

  useEffect(() => {
    loadSavings();
    loadCreditCardExpense();
  }, [year]);

  // ===================================================
  // 月份项目
  // ===================================================

  function getMonthItems(
    month: number
  ) {
    return items.filter(
      item =>
        item.year === year &&
        item.month === month
    );
  }

  function getMonthIncome(
    month: number
  ) {
    return getMonthItems(month)
      .filter(
        item =>
          item.item_type ===
          "income"
      )
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) -
          (b.sort_order ?? 0)
      );
  }

  function getMonthExpenses(
    month: number
  ) {
    return getMonthItems(month)
      .filter(
        item =>
          item.item_type ===
          "expense"
      )
      .sort(
        (a, b) =>
          (a.sort_order ?? 0) -
          (b.sort_order ?? 0)
      );
  }

  // ===================================================
  // 合计
  // ===================================================

  function getIncomeTotal(
    month: number
  ) {
    return getMonthIncome(month)
      .reduce(
        (total, item) =>
          total +
          Number(
            item.amount || 0
          ),
        0
      );
  }

  function getExpenseTotal(
    month: number
  ) {
    return getMonthExpenses(month)
      .reduce(
        (total, item) =>
          total +
          Number(
            item.amount || 0
          ),
        0
      );
  }

  // ===================================================
  // 信用卡
  // ===================================================

  function getCreditCardAutoExpense(
    month: number
  ) {
    const monthKey =
      `${year}-${String(month).padStart(2, "0")}`;

    return Math.max(
      0,
      Number(
        creditCardAutoExpenseMap[monthKey] ||
          0
      )
    );
  }

  // ===================================================
  // 年度统计
  // ===================================================

  const yearIncome = useMemo(
    () =>
      MONTHS.reduce(
        (total, month) =>
          total +
          getIncomeTotal(month),
        0
      ),
    [items, year]
  );

  const yearExpense = useMemo(
    () =>
      MONTHS.reduce(
        (total, month) =>
          total +
          getExpenseTotal(month),
        0
      ),
    [items, year]
  );

  const yearCreditCardExpense =
    MONTHS.reduce(
      (total, month) =>
        total +
        getCreditCardAutoExpense(month),
      0
    );

  const yearTotalExpense =
    yearExpense +
    yearCreditCardExpense;

  const yearSavings =
    yearIncome -
    yearTotalExpense;

  // ===================================================
  // 当前月份统计
  // ===================================================

  const activeIncome =
    getIncomeTotal(
      activeMonth
    );

  const activeExpense =
    getExpenseTotal(
      activeMonth
    );

  const activeCreditCardExpense =
    getCreditCardAutoExpense(
      activeMonth
    );

  const activeTotalExpense =
    activeExpense +
    activeCreditCardExpense;

  const activeSavings =
    activeIncome -
    activeTotalExpense;

  // ===================================================
  // 格式化
  // ===================================================

  function formatMoney(
    value: number
  ) {
    return Number(
      value || 0
    ).toLocaleString(
      "zh-CN",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    );
  }

  // ===================================================
  // 保存
  // ===================================================

  async function saveItem(
    item: SavingsItem
  ) {
    try {
      setSavingKey(item.id);
      setError(null);

      const response = await fetch(
        "/api/monthly-savings",
        {
          method: "PUT",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            id: item.id,
            year: item.year,
            month: item.month,
            item_type:
              item.item_type,
            item_name:
              item.item_name,
            amount: Number(
              item.amount || 0
            ),
            sort_order:
              item.sort_order ?? 0,
          }),
        }
      );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "保存失败"
        );
      }

      if (data.item) {
        setItems(current =>
          current.map(row =>
            row.id === item.id
              ? {
                  ...row,
                  ...data.item,
                }
              : row
          )
        );
      }

      showMessage("已自动保存");
    } catch (err) {
      console.error(
        "Save monthly savings error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setSavingKey(null);
    }
  }

  // ===================================================
  // 修改名称
  // ===================================================

  function updateItemName(
    id: string,
    value: string
  ) {
    setItems(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              item_name: value,
            }
          : item
      )
    );
  }

  // ===================================================
  // 修改金额
  // ===================================================

  function updateItemAmount(
    id: string,
    value: string
  ) {
    const amount =
      Number(
        value.replace(/,/g, "")
      );

    setItems(current =>
      current.map(item =>
        item.id === id
          ? {
              ...item,
              amount:
                Number.isFinite(
                  amount
                )
                  ? amount
                  : 0,
            }
          : item
      )
    );
  }

  // ===================================================
  // 新增
  // ===================================================

  async function addItem(
    month: number,
    itemType: ItemType
  ) {
    try {
      setError(null);

      const response =
        await fetch(
          "/api/monthly-savings",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              year,
              month,
              item_type:
                itemType,
              item_name:
                itemType ===
                "income"
                  ? "新增收入"
                  : "新增支出",
              amount: 0,
              source: "manual",
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "新增项目失败"
        );
      }

      if (data.item) {
        setItems(current => [
          ...current,
          data.item,
        ]);
      }
    } catch (err) {
      console.error(
        "Add monthly savings item error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    }
  }

  // ===================================================
  // 删除
  // ===================================================

  async function deleteItem(
    item: SavingsItem
  ) {
    if (
      !window.confirm(
        `确定删除「${item.item_name}」吗？`
      )
    ) {
      return;
    }

    try {
      setSavingKey(item.id);

      const response =
        await fetch(
          `/api/monthly-savings?id=${encodeURIComponent(
            item.id
          )}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "删除失败"
        );
      }

      setItems(current =>
        current.filter(
          row =>
            row.id !== item.id
        )
      );

      showMessage("已删除");
    } catch (err) {
      console.error(
        "Delete monthly savings item error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setSavingKey(null);
    }
  }

  // ===================================================
  // 应用到其他月份
  // ===================================================

  async function applyItemToOtherMonths(
    item: SavingsItem
  ) {
    if (applyingKey) {
      return;
    }

    if (
      !window.confirm(
        `确定把「${item.item_name}」和 ¥${formatMoney(
          item.amount
        )} 应用到其他月份吗？`
      )
    ) {
      return;
    }

    try {
      setApplyingKey(item.id);
      setError(null);

      const response =
        await fetch(
          "/api/monthly-savings",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "apply",
              source_id: item.id,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "应用到其他月份失败"
        );
      }

      if (
        Array.isArray(
          data.items
        )
      ) {
        setItems(data.items);
      } else {
        await loadSavings();
      }

      showMessage(
        "已应用到其他月份"
      );
    } catch (err) {
      console.error(
        "Apply monthly savings item error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setApplyingKey(null);
    }
  }

  // ===================================================
  // 撤销应用
  // ===================================================

  async function undoItemFromOtherMonths(
    item: SavingsItem
  ) {
    if (applyingKey) {
      return;
    }

    if (
      !item.copy_group_id
    ) {
      return;
    }

    if (
      !window.confirm(
        `确定撤销「${item.item_name}」应用到其他月份的设置吗？`
      )
    ) {
      return;
    }

    try {
      setApplyingKey(item.id);
      setError(null);

      const response =
        await fetch(
          "/api/monthly-savings",
          {
            method: "PATCH",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "undo",
              source_id: item.id,
              copy_group_id:
                item.copy_group_id,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "撤销应用失败"
        );
      }

      if (
        Array.isArray(
          data.items
        )
      ) {
        setItems(data.items);
      } else {
        await loadSavings();
      }

      showMessage("已撤销应用");
    } catch (err) {
      console.error(
        "Undo monthly savings item error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );
    } finally {
      setApplyingKey(null);
    }
  }

  // ===================================================
  // 项目复制按钮
  // ===================================================

  function renderCopyButton(
    item: SavingsItem
  ) {
    const isApplying =
      applyingKey === item.id;

    if (
      item.copy_group_id
    ) {
      return (
        <button
          type="button"
          disabled={isApplying}
          onClick={() =>
            undoItemFromOtherMonths(
              item
            )
          }
          className="
            whitespace-nowrap
            rounded-md
            px-2.5
            py-1.5
            text-xs
            font-medium
            text-orange-600
            hover:bg-orange-50
            disabled:cursor-not-allowed
            disabled:opacity-50
          "
        >
          {isApplying
            ? "处理中..."
            : "↩ 撤销应用"}
        </button>
      );
    }

    return (
      <button
        type="button"
        disabled={isApplying}
        onClick={() =>
          applyItemToOtherMonths(
            item
          )
        }
        className="
          whitespace-nowrap
          rounded-md
          px-2.5
          py-1.5
          text-xs
          font-medium
          text-blue-600
          hover:bg-blue-50
          disabled:cursor-not-allowed
          disabled:opacity-50
        "
      >
        {isApplying
          ? "处理中..."
          : "应用到其他月份"}
      </button>
    );
  }

  // ===================================================
  // 紧凑项目行
  // ===================================================

  function renderItemRow(
    item: SavingsItem
  ) {
    const saving =
      savingKey === item.id;

    return (
      <div
        key={item.id}
        className="
          group
          grid
          grid-cols-1
          gap-2
          border-t
          px-4
          py-2.5
          transition
          hover:bg-gray-50
          md:grid-cols-[minmax(0,1fr)_150px_auto_auto]
          md:items-center
          md:gap-3
        "
      >
        {/* 名称 */}

        <input
          value={item.item_name}
          onChange={event =>
            updateItemName(
              item.id,
              event.target.value
            )
          }
          onBlur={() =>
            saveItem(item)
          }
          className="
            min-w-0
            rounded-md
            border
            border-transparent
            bg-transparent
            px-2
            py-1.5
            text-sm
            text-gray-800
            outline-none
            transition
            hover:border-gray-200
            hover:bg-white
            focus:border-blue-400
            focus:bg-white
            focus:ring-2
            focus:ring-blue-50
          "
        />

        {/* 金额 */}

        <div className="relative">
          <span
            className="
              pointer-events-none
              absolute
              left-2
              top-1/2
              -translate-y-1/2
              text-xs
              text-gray-400
            "
          >
            ¥
          </span>

          <input
            type="number"
            value={item.amount}
            onChange={event =>
              updateItemAmount(
                item.id,
                event.target.value
              )
            }
            onBlur={() =>
              saveItem(item)
            }
            className="
              w-full
              rounded-md
              border
              border-transparent
              bg-transparent
              py-1.5
              pl-6
              pr-2
              text-right
              text-sm
              font-semibold
              text-gray-800
              outline-none
              transition
              hover:border-gray-200
              hover:bg-white
              focus:border-blue-400
              focus:bg-white
              focus:ring-2
              focus:ring-blue-50
            "
          />
        </div>

        {/* 应用 */}

        <div className="flex justify-start md:justify-end">
          {renderCopyButton(item)}
        </div>

        {/* 删除 */}

        <button
          type="button"
          disabled={saving}
          onClick={() =>
            deleteItem(item)
          }
          className="
            justify-self-start
            rounded-md
            px-2
            py-1.5
            text-xs
            text-gray-400
            transition
            hover:bg-red-50
            hover:text-red-600
            disabled:opacity-40
            md:justify-self-end
          "
        >
          删除
        </button>

        {/* 保存状态 */}

        {saving && (
          <div
            className="
              text-[10px]
              text-gray-400
              md:col-span-4
              md:-mt-1
              md:pl-2
            "
          >
            保存中...
          </div>
        )}
      </div>
    );
  }

  // ===================================================
  // 收入区
  // ===================================================

  function renderIncomeSection(
    month: number
  ) {
    const income =
      getMonthIncome(month);

    const total =
      getIncomeTotal(month);

    return (
      <section
        className="
          overflow-hidden
          rounded-xl
          border
          border-gray-200
          bg-white
          shadow-sm
        "
      >
        {/* 标题 */}

        <div
          className="
            flex
            items-center
            justify-between
            bg-gray-50
            px-4
            py-3
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <span
              className="
                text-sm
                font-bold
                text-gray-900
              "
            >
              收入
            </span>

            <span
              className="
                text-xs
                text-gray-400
              "
            >
              {income.length} 项
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              addItem(
                month,
                "income"
              )
            }
            className="
              rounded-md
              bg-blue-600
              px-2.5
              py-1.5
              text-xs
              font-medium
              text-white
              hover:bg-blue-700
            "
          >
            + 添加
          </button>
        </div>

        {/* 表头 */}

        {income.length > 0 && (
          <div
            className="
              hidden
              grid-cols-[minmax(0,1fr)_150px_auto_auto]
              gap-3
              border-t
              px-4
              py-2
              text-[11px]
              text-gray-400
              md:grid
            "
          >
          
            <span className="text-right">
              金额
            </span>
            <span className="text-right">
              操作
            </span>
            <span></span>
          </div>
        )}

        {/* 项目 */}

        {income.map(
          renderItemRow
        )}

        {income.length === 0 && (
          <div
            className="
              border-t
              px-4
              py-7
              text-center
              text-xs
              text-gray-400
            "
          >
            暂无收入
          </div>
        )}

        {/* 合计 */}

        <div
          className="
            flex
            items-center
            justify-between
            border-t
            bg-gray-50/70
            px-4
            py-3
          "
        >
          <span
            className="
              text-xs
              font-semibold
              text-gray-500
            "
          >
            收入合计
          </span>

          <span
            className="
              text-base
              font-bold
              text-green-600
            "
          >
            ¥{formatMoney(total)}
          </span>
        </div>
      </section>
    );
  }

  // ===================================================
  // 支出区
  // ===================================================

  function renderExpenseSection(
    month: number
  ) {
    const expenses =
      getMonthExpenses(month);

    const creditCardExpense =
      getCreditCardAutoExpense(
        month
      );

    const totalExpense =
      getExpenseTotal(month);

    const total =
      totalExpense +
      creditCardExpense;

    return (
      <section
        className="
          overflow-hidden
          rounded-xl
          border
          border-gray-200
          bg-white
          shadow-sm
        "
      >
        {/* 标题 */}

        <div
          className="
            flex
            items-center
            justify-between
            bg-gray-50
            px-4
            py-3
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
            "
          >
            <span
              className="
                text-sm
                font-bold
                text-gray-900
              "
            >
              支出
            </span>

            <span
              className="
                text-xs
                text-gray-400
              "
            >
              {expenses.length} 项
              {creditCardExpense > 0
                ? " + 信用卡"
                : ""}
            </span>
          </div>

          <button
            type="button"
            onClick={() =>
              addItem(
                month,
                "expense"
              )
            }
            className="
              rounded-md
              bg-blue-600
              px-2.5
              py-1.5
              text-xs
              font-medium
              text-white
              hover:bg-blue-700
            "
          >
            + 添加
          </button>
        </div>

        {/* 表头 */}

        {(expenses.length > 0 ||
          creditCardExpense > 0) && (
          <div
            className="
              hidden
              grid-cols-[minmax(0,1fr)_150px_auto_auto]
              gap-3
              border-t
              px-4
              py-2
              text-[11px]
              text-gray-400
              md:grid
            "
          >
          
            <span className="text-right">
              金额
            </span>
            <span className="text-right">
              操作
            </span>
            <span></span>
          </div>
        )}

        {/* 信用卡自动支出 */}

        {/* 信用卡自动支出 */}

{/* =================================================
    信用卡自动支出
================================================= */}


{creditCardExpense > 0 && (
  <div
    className="
      grid
      grid-cols-1
      gap-2
      border-t
      px-4
      py-2.5
      transition
      hover:bg-gray-50
      md:grid-cols-[minmax(0,1fr)_150px_auto_auto]
      md:items-center
      md:gap-3
    "
  >
    {/* 名称 */}
    <div
      className="
        min-w-0
        px-2
        py-1.5
      "
    >
      <div
        className="
          flex
          items-center
          gap-2
        "
      >
        <span
          className="
            text-sm
            text-gray-800
          "
        >
          信用卡支出
        </span>

        <span
          className="
            rounded-full
            bg-blue-50
            px-1.5
            py-0.5
            text-[10px]
            font-medium
            text-blue-600
          "
        >
          自动
        </span>
      </div>
    </div>

    {/* 金额 */}

<div>
  <div
    className="
      relative
      w-full
      -translate-x-14
    "
  >
    <span
      className="
        pointer-events-none
        absolute
        left-2
        top-1/2
        -translate-y-1/2
        text-xs
        text-gray-400
      "
    >
      ¥
    </span>

    <div
      className="
        w-full
        py-1.5
        pl-6
        pr-2
        text-right
        text-sm
        font-semibold
        text-gray-800
      "
    >
      {formatMoney(
        creditCardExpense
      )}
    </div>
  </div>
</div>

    {/* 自动计算 */}
    <div
      className="
        flex
        justify-start
        md:justify-end
      "
    >
      <span
        className="
          whitespace-nowrap
          rounded-md
          px-2.5
          py-1.5
          text-xs
          font-medium
          text-gray-400
        "
      >
        自动计算
      </span>
    </div>

    {/* 删除列占位 */}
    <div
      className="
        justify-self-start
        md:justify-self-end
      "
    />
  </div>
)}


        {/* 手工支出 */}

        {expenses.map(
          renderItemRow
        )}

        {expenses.length === 0 &&
          creditCardExpense <= 0 && (
            <div
              className="
                border-t
                px-4
                py-7
                text-center
                text-xs
                text-gray-400
              "
            >
              暂无支出
            </div>
          )}

        {/* 合计 */}

        <div
          className="
            flex
            items-center
            justify-between
            border-t
            bg-gray-50/70
            px-4
            py-3
          "
        >
          <div>
            <div
              className="
                text-xs
                font-semibold
                text-gray-500
              "
            >
              支出合计
            </div>

            {creditCardExpense > 0 && (
              <div
                className="
                  mt-0.5
                  text-[10px]
                  text-blue-600
                "
              >
                含信用卡 ¥
                {formatMoney(
                  creditCardExpense
                )}
              </div>
            )}
          </div>

          <span
            className="
              text-base
              font-bold
              text-red-600
            "
          >
            ¥{formatMoney(total)}
          </span>
        </div>
      </section>
    );
  }

  // ===================================================
  // 月份导航
  // ===================================================

  function renderMonthNavigation() {
    return (
      <div
        className="
          overflow-hidden
          rounded-xl
          border
          border-gray-200
          bg-white
          shadow-sm
        "
      >
        <div
          className="
            grid
            grid-cols-6
            md:grid-cols-12
          "
        >
          {MONTHS.map(month => {
            const income =
              getIncomeTotal(month);

            const expense =
              getExpenseTotal(month) +
              getCreditCardAutoExpense(
                month
              );

            const savings =
              income - expense;

            const active =
              activeMonth === month;

            const current =
              year === currentYear &&
              month === currentMonth;

            return (
              <button
                key={month}
                type="button"
                onClick={() =>
                  setActiveMonth(month)
                }
                className={`
                  border-r
                  border-b
                  px-2
                  py-2.5
                  transition
                  ${
                    active
                      ? "bg-blue-600 text-white"
                      : "bg-white text-gray-700 hover:bg-gray-50"
                  }
                `}
              >
                <div
                  className="
                    text-xs
                    font-semibold
                  "
                >
                  {month}月
                </div>

                <div
                  className={`
                    mt-0.5
                    text-[9px]
                    ${
                      active
                        ? "text-blue-100"
                        : current
                          ? "text-blue-600"
                          : savings >= 0
                            ? "text-green-600"
                            : "text-red-500"
                    }
                  `}
                >
                  {current
                    ? "本月"
                    : savings >= 0
                      ? `余 ¥${formatMoney(
                          savings
                        )}`
                      : `超 ¥${formatMoney(
                          Math.abs(
                            savings
                          )
                        )}`}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // ===================================================
  // 当前月份
  // ===================================================

  function renderActiveMonth() {
    const monthIsCurrent =
      year === currentYear &&
      activeMonth === currentMonth;

    return (
      <div className="space-y-4">
        {/* 月份顶部 */}

        <div
          className="
            rounded-xl
            border
            border-gray-200
            bg-white
            px-4
            py-4
            shadow-sm
          "
        >
          <div
            className="
              flex
              flex-col
              gap-4
              md:flex-row
              md:items-center
              md:justify-between
            "
          >
            <div>
              <div
                className="
                  flex
                  items-center
                  gap-2
                "
              >
                <h2
                  className="
                    text-lg
                    font-bold
                    text-gray-900
                  "
                >
                  {year}年
                  {activeMonth}月
                </h2>

                {monthIsCurrent && (
                  <span
                    className="
                      rounded-full
                      bg-blue-100
                      px-2
                      py-0.5
                      text-[10px]
                      font-medium
                      text-blue-700
                    "
                  >
                    当前
                  </span>
                )}
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  text-gray-400
                "
              >
                本月预计收入、支出与储蓄
              </div>
            </div>

            <div
              className="
                grid
                grid-cols-3
                gap-6
                md:min-w-[430px]
              "
            >
              <div>
                <div
                  className="
                    text-[10px]
                    text-gray-400
                  "
                >
                  收入
                </div>

                <div
                  className="
                    mt-1
                    text-sm
                    font-bold
                    text-green-600
                  "
                >
                  ¥
                  {formatMoney(
                    activeIncome
                  )}
                </div>
              </div>

              <div>
                <div
                  className="
                    text-[10px]
                    text-gray-400
                  "
                >
                  支出
                </div>

                <div
                  className="
                    mt-1
                    text-sm
                    font-bold
                    text-red-600
                  "
                >
                  ¥
                  {formatMoney(
                    activeTotalExpense
                  )}
                </div>
              </div>

              <div>
                <div
                  className="
                    text-[10px]
                    text-gray-400
                  "
                >
                  预计储蓄
                </div>

                <div
                  className={`
                    mt-1
                    text-sm
                    font-bold
                    ${
                      activeSavings >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  `}
                >
                  ¥
                  {formatMoney(
                    activeSavings
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 收入 */}

        {renderIncomeSection(
          activeMonth
        )}

        {/* 支出 */}

        {renderExpenseSection(
          activeMonth
        )}
      </div>
    );
  }

  // ===================================================
  // 页面
  // ===================================================

  return (
    <div
      className="
        min-h-screen
        bg-[#0f172a]
        text-gray-900
      "
    >
      <TopBar
        title="每月储蓄金预估"
      />

      <main
        className="
          mx-auto
          max-w-[1180px]
          px-4
          py-5
          md:px-6
          md:py-6
        "
      >
        {/* =============================================
            页面标题
        ============================================= */}

        <div
          className="
            mb-4
            flex
            flex-col
            gap-3
            md:flex-row
            md:items-center
            md:justify-between
          "
        >
          <div>
            <h1
              className="
                text-xl
                font-bold
                tracking-tight
                text-gray-900
              "
            >
              每月储蓄金预估
            </h1>

            <p
              className="
                mt-0.5
                text-xs
                text-gray-400
              "
            >
              管理每个月的收入、支出和预计储蓄。
            </p>
          </div>

          {/* 年份 */}

          <div
            className="
              flex
              items-center
              rounded-lg
              border
              border-gray-200
              bg-white
              p-1
              shadow-sm
            "
          >
            <button
              type="button"
              onClick={() => {
                setYear(
                  current =>
                    current - 1
                );
                setActiveMonth(1);
              }}
              className="
                rounded-md
                px-2.5
                py-1
                text-sm
                text-gray-500
                hover:bg-gray-100
              "
            >
              ←
            </button>

            <div
              className="
                min-w-[80px]
                text-center
                text-sm
                font-bold
              "
            >
              {year}年
            </div>

            <button
              type="button"
              onClick={() => {
                setYear(
                  current =>
                    current + 1
                );
                setActiveMonth(1);
              }}
              className="
                rounded-md
                px-2.5
                py-1
                text-sm
                text-gray-500
                hover:bg-gray-100
              "
            >
              →
            </button>
          </div>
        </div>

        {/* =============================================
            年度总览
        ============================================= */}

        <div
          className="
            mb-3
            grid
            grid-cols-1
            overflow-hidden
            rounded-xl
            border
            border-gray-200
            bg-white
            shadow-sm
            md:grid-cols-3
          "
        >
          <div
            className="
              border-b
              px-4
              py-3
              md:border-b-0
              md:border-r
            "
          >
            <div
              className="
                text-[10px]
                text-gray-400
              "
            >
              年度预计收入
            </div>

            <div
              className="
                mt-1
                text-lg
                font-bold
                text-green-600
              "
            >
              ¥{formatMoney(yearIncome)}
            </div>
          </div>

          <div
            className="
              border-b
              px-4
              py-3
              md:border-b-0
              md:border-r
            "
          >
            <div
              className="
                text-[10px]
                text-gray-400
              "
            >
              年度预计支出
            </div>

            <div
              className="
                mt-1
                text-lg
                font-bold
                text-red-600
              "
            >
              ¥
              {formatMoney(
                yearTotalExpense
              )}
            </div>
          </div>

          <div
            className="
              px-4
              py-3
            "
          >
            <div
              className="
                text-[10px]
                text-gray-400
              "
            >
              年度预计储蓄
            </div>

            <div
              className={`
                mt-1
                text-lg
                font-bold
                ${
                  yearSavings >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >
              ¥
              {formatMoney(
                yearSavings
              )}
            </div>
          </div>
        </div>

        {/* =============================================
            信用卡
        ============================================= */}

        <div
          className="
            mb-3
            flex
            items-center
            justify-between
            rounded-xl
            border
            border-blue-100
            bg-blue-50/70
            px-4
            py-2.5
          "
        >
          <div
            className="
              flex
              items-center
              gap-2
            "
          >
            <span className="text-sm">
              💳
            </span>

            <span
              className="
                text-xs
                font-semibold
                text-gray-700
              "
            >
              信用卡自动支出
            </span>

            <span
              className="
                rounded-full
                bg-blue-100
                px-1.5
                py-0.5
                text-[9px]
                font-medium
                text-blue-700
              "
            >
              自动
            </span>
          </div>

          <div
            className="
              pointer-events-none
              absolute
              left-2
              top-1/2
              -translate-y-1/2
              text-xs
              text-gray-400
            "
          >
            {creditCardLoading
              ? "读取中..."
              : `¥${formatMoney(
                  getCreditCardAutoExpense(activeMonth)
                )}`}
          </div>
        </div>

        {/* =============================================
            消息
        ============================================= */}

        {message && (
          <div
            className="
              mb-3
              rounded-lg
              border
              border-green-200
              bg-green-50
              px-3
              py-2
              text-xs
              text-green-700
            "
          >
            {message}
          </div>
        )}

        {error && (
          <div
            className="
              mb-3
              rounded-lg
              border
              border-red-200
              bg-red-50
              px-3
              py-2
              text-xs
              text-red-700
            "
          >
            {error}
          </div>
        )}

        {/* =============================================
            月份导航
        ============================================= */}

        <div className="mb-4">
          {renderMonthNavigation()}
        </div>

        {/* =============================================
            当前月份
        ============================================= */}

        {loading ? (
          <div
            className="
              rounded-xl
              border
              border-gray-200
              bg-white
              px-4
              py-16
              text-center
              text-sm
              text-gray-400
              shadow-sm
            "
          >
            正在加载储蓄数据...
          </div>
        ) : (
          renderActiveMonth()
        )}
      </main>
    </div>
  );
}