"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

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
  created_at?: string | null;
  updated_at?: string | null;
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

export default function MonthlySavingsActualPage() {
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

  const [loading, setLoading] =
    useState(true);

  const [savingKey, setSavingKey] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  // ===================================================
  // 消息
  // ===================================================

  function showMessage(
    text: string
  ) {
    setMessage(text);

    window.setTimeout(() => {
      setMessage("");
    }, 1800);
  }

  // ===================================================
  // 加载
  // ===================================================

  async function loadSavings() {
    try {
      setLoading(true);
      setError(null);

      const response =
        await fetch(
          `/api/monthly-savings-actual?year=${year}`,
          {
            method: "GET",
            cache: "no-store",
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
            "读取实际储蓄数据失败"
        );
      }

      setItems(
        Array.isArray(data.items)
          ? data.items
          : []
      );
    } catch (err) {
      console.error(
        "Load monthly savings actual error:",
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

  useEffect(() => {
    loadSavings();
  }, [year]);

  // ===================================================
  // 月份数据
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
    return getMonthIncome(
      month
    ).reduce(
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
    return getMonthExpenses(
      month
    ).reduce(
      (total, item) =>
        total +
        Number(
          item.amount || 0
        ),
      0
    );
  }

  function getSavings(
    month: number
  ) {
    return (
      getIncomeTotal(month) -
      getExpenseTotal(month)
    );
  }

  function getSavingsRate(
    month: number
  ) {
    const income =
      getIncomeTotal(month);

    if (income <= 0) {
      return 0;
    }

    return (
      (getSavings(month) /
        income) *
      100
    );
  }

  // ===================================================
  // 年度统计
  // ===================================================

  const yearIncome =
    useMemo(
      () =>
        MONTHS.reduce(
          (total, month) =>
            total +
            getIncomeTotal(
              month
            ),
          0
        ),
      [items, year]
    );

  const yearExpense =
    useMemo(
      () =>
        MONTHS.reduce(
          (total, month) =>
            total +
            getExpenseTotal(
              month
            ),
          0
        ),
      [items, year]
    );

  const yearSavings =
    yearIncome -
    yearExpense;

  const yearSavingsRate =
    yearIncome > 0
      ? (yearSavings /
          yearIncome) *
        100
      : 0;

  // ===================================================
  // 当前月份
  // ===================================================

  const activeIncome =
    getIncomeTotal(
      activeMonth
    );

  const activeExpense =
    getExpenseTotal(
      activeMonth
    );

  const activeSavings =
    activeIncome -
    activeExpense;

  const activeSavingsRate =
    activeIncome > 0
      ? (activeSavings /
          activeIncome) *
        100
      : 0;

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

  function formatRate(
    value: number
  ) {
    return `${value.toFixed(1)}%`;
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

      const response =
        await fetch(
          "/api/monthly-savings-actual",
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

      showMessage(
        "已自动保存"
      );
    } catch (err) {
      console.error(
        "Save actual savings error:",
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

    // ===================================================
  // 新增
  // ===================================================

  async function addItem(
    month: number,
    itemType: ItemType
  ) {
    try {
      setError(null);

      // -------------------------------------------------
      // 根据当前月份 + 类型，自动生成不重复的名称
      // 避免触发：
      // monthly_savings_actual_unique_item
      // -------------------------------------------------

      const existingNames = new Set(
        items
          .filter(
            item =>
              item.year === year &&
              item.month === month &&
              item.item_type === itemType
          )
          .map(item =>
            item.item_name.trim()
          )
      );

      const baseName =
        itemType === "income"
          ? "新增收入"
          : "新增支出";

      let itemName = baseName;
      let counter = 2;

      while (
        existingNames.has(itemName)
      ) {
        itemName = `${baseName} ${counter}`;
        counter++;
      }

      // -------------------------------------------------
      // 自动计算 sort_order
      // -------------------------------------------------

      const currentItems =
        items.filter(
          item =>
            item.year === year &&
            item.month === month &&
            item.item_type === itemType
        );

      const maxSortOrder =
        currentItems.reduce(
          (max, item) =>
            Math.max(
              max,
              Number(
                item.sort_order ?? 0
              )
            ),
          -1
        );

      const sortOrder =
        maxSortOrder + 1;

      // -------------------------------------------------
      // POST
      // -------------------------------------------------

      const response =
        await fetch(
          "/api/monthly-savings-actual",
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
                itemName,
              amount: 0,
              sort_order:
                sortOrder,
            }),
          }
        );

      // -------------------------------------------------
      // 防止接口返回 HTML 时再次出现：
      // Unexpected token '<'
      // -------------------------------------------------

      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      let data: any = null;

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        data =
          await response.json();
      } else {
        const text =
          await response.text();

        throw new Error(
          `接口返回非 JSON 数据：${text.slice(
            0,
            200
          )}`
        );
      }

      // -------------------------------------------------
      // 检查 API
      // -------------------------------------------------

      if (
        !response.ok ||
        !data?.success
      ) {
        throw new Error(
          data?.error ||
            "新增项目失败"
        );
      }

      // -------------------------------------------------
      // 更新页面
      // -------------------------------------------------

      if (data.item) {
        setItems(current => [
          ...current,
          data.item,
        ]);

        showMessage(
          `已新增「${itemName}」`
        );
      }
    } catch (err) {
      console.error(
        "Add actual savings item error:",
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
      setError(null);

      const response =
        await fetch(
          `/api/monthly-savings-actual?id=${encodeURIComponent(
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

      showMessage(
        "已删除"
      );
    } catch (err) {
      console.error(
        "Delete actual savings item error:",
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
  // 项目行
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
          md:grid-cols-[minmax(0,1fr)_150px_auto]
          md:items-center
          md:gap-3
        "
      >
        {/* 名称 */}

        <input
          value={
            item.item_name
          }
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
            value={
              item.amount
            }
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

        {saving && (
          <div
            className="
              text-[10px]
              text-gray-400
              md:col-span-3
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
              实际收入
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

        {income.length > 0 && (
          <div
            className="
              hidden
              grid-cols-[minmax(0,1fr)_150px_auto]
              gap-3
              border-t
              px-4
              py-2
              text-[11px]
              text-gray-400
              md:grid
            "
          >
            <span></span>

            <span className="text-right">
              金额
            </span>

            <span className="text-right">
              操作
            </span>
          </div>
        )}

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
            ¥
            {formatMoney(total)}
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

    const total =
      getExpenseTotal(month);

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
              实际支出
            </span>

            <span
              className="
                text-xs
                text-gray-400
              "
            >
              {expenses.length} 项
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

        {expenses.length > 0 && (
          <div
            className="
              hidden
              grid-cols-[minmax(0,1fr)_150px_auto]
              gap-3
              border-t
              px-4
              py-2
              text-[11px]
              text-gray-400
              md:grid
            "
          >
            <span></span>

            <span className="text-right">
              金额
            </span>

            <span className="text-right">
              操作
            </span>
          </div>
        )}

        {expenses.map(
          renderItemRow
        )}

        {expenses.length === 0 && (
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
            支出合计
          </span>

          <span
            className="
              text-base
              font-bold
              text-red-600
            "
          >
            ¥
            {formatMoney(total)}
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
          {MONTHS.map(
            month => {
              const income =
                getIncomeTotal(
                  month
                );

              const expense =
                getExpenseTotal(
                  month
                );

              const savings =
                income - expense;

              const active =
                activeMonth ===
                month;

              const current =
                year ===
                  currentYear &&
                month ===
                  currentMonth;

              return (
                <button
                  key={month}
                  type="button"
                  onClick={() =>
                    setActiveMonth(
                      month
                    )
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
                      : savings >=
                          0
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
            }
          )}
        </div>
      </div>
    );
  }

  // ===================================================
  // 当前月份
  // ===================================================

  function renderActiveMonth() {
    const monthIsCurrent =
      year ===
        currentYear &&
      activeMonth ===
        currentMonth;

    return (
      <div className="space-y-4">
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
                本月实际收入、支出与储蓄
              </div>
            </div>

            <div
              className="
                grid
                grid-cols-4
                gap-5
                md:min-w-[540px]
              "
            >
              <div>
                <div
                  className="
                    text-[10px]
                    text-gray-400
                  "
                >
                  实际收入
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
                  实际支出
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
                    activeExpense
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
                  实际储蓄
                </div>

                <div
                  className={`
                    mt-1
                    text-sm
                    font-bold
                    ${
                      activeSavings >=
                      0
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

              <div>
                <div
                  className="
                    text-[10px]
                    text-gray-400
                  "
                >
                  储蓄率
                </div>

                <div
                  className={`
                    mt-1
                    text-sm
                    font-bold
                    ${
                      activeSavingsRate >=
                      0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  `}
                >
                  {formatRate(
                    activeSavingsRate
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {renderIncomeSection(
          activeMonth
        )}

        {renderExpenseSection(
          activeMonth
        )}
      </div>
    );
  }

  // ===================================================
  // 历史记录
  // ===================================================

  function renderHistory() {
    const history =
      MONTHS.map(
        month => ({
          month,
          income:
            getIncomeTotal(
              month
            ),
          expense:
            getExpenseTotal(
              month
            ),
          savings:
            getSavings(
              month
            ),
          rate:
            getSavingsRate(
              month
            ),
        })
      )
        .filter(
          row =>
            row.income !== 0 ||
            row.expense !== 0
        )
        .reverse();

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
        <div
          className="
            border-b
            bg-gray-50
            px-4
            py-3
          "
        >
          <div
            className="
              text-sm
              font-bold
              text-gray-900
            "
          >
            {year}年历史记录
          </div>

          <div
            className="
              mt-0.5
              text-xs
              text-gray-400
            "
          >
            已录入实际收入和支出的月份
          </div>
        </div>

        {history.length === 0 ? (
          <div
            className="
              px-4
              py-10
              text-center
              text-xs
              text-gray-400
            "
          >
            暂无历史实际数据
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="
                w-full
                min-w-[650px]
                text-sm
              "
            >
              <thead>
                <tr
                  className="
                    border-b
                    text-xs
                    text-gray-400
                  "
                >
                  <th className="px-4 py-3 text-left font-medium">
                    月份
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    实际收入
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    实际支出
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    实际储蓄
                  </th>

                  <th className="px-4 py-3 text-right font-medium">
                    储蓄率
                  </th>
                </tr>
              </thead>

              <tbody>
                {history.map(
                  row => (
                    <tr
                      key={
                        row.month
                      }
                      onClick={() =>
                        setActiveMonth(
                          row.month
                        )
                      }
                      className="
                        cursor-pointer
                        border-b
                        last:border-b-0
                        hover:bg-gray-50
                      "
                    >
                      <td className="px-4 py-3 font-medium text-gray-800">
                        {row.month}月
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-green-600">
                        ¥
                        {formatMoney(
                          row.income
                        )}
                      </td>

                      <td className="px-4 py-3 text-right font-semibold text-red-600">
                        ¥
                        {formatMoney(
                          row.expense
                        )}
                      </td>

                      <td
                        className={`
                          px-4
                          py-3
                          text-right
                          font-bold
                          ${
                            row.savings >=
                            0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        `}
                      >
                        ¥
                        {formatMoney(
                          row.savings
                        )}
                      </td>

                      <td
                        className={`
                          px-4
                          py-3
                          text-right
                          font-semibold
                          ${
                            row.rate >=
                            0
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        `}
                      >
                        {formatRate(
                          row.rate
                        )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>

              <tfoot>
                <tr
                  className="
                    border-t
                    bg-gray-50
                    font-bold
                  "
                >
                  <td className="px-4 py-3">
                    年度合计
                  </td>

                  <td className="px-4 py-3 text-right text-green-600">
                    ¥
                    {formatMoney(
                      yearIncome
                    )}
                  </td>

                  <td className="px-4 py-3 text-right text-red-600">
                    ¥
                    {formatMoney(
                      yearExpense
                    )}
                  </td>

                  <td
                    className={`
                      px-4
                      py-3
                      text-right
                      ${
                        yearSavings >=
                        0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    `}
                  >
                    ¥
                    {formatMoney(
                      yearSavings
                    )}
                  </td>

                  <td
                    className={`
                      px-4
                      py-3
                      text-right
                      ${
                        yearSavingsRate >=
                        0
                          ? "text-green-600"
                          : "text-red-600"
                      }
                    `}
                  >
                    {formatRate(
                      yearSavingsRate
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </section>
    );
  }

  // ===================================================
  // 页面
  // ===================================================

  return (
    <div
      className="
        min-h-screen
        bg-[#315a8a]
        text-gray-900
      "
    >
      <TopBar
        title="每月储蓄金实际"
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
        {/* 页面标题 */}

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
              每月储蓄金实际
            </h1>

            <p
              className="
                mt-0.5
                text-xs
                text-gray-400
              "
            >
              记录每个月实际发生的收入、支出和储蓄。
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

        {/* 年度总览 */}

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
            md:grid-cols-4
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
            <div className="text-[10px] text-gray-400">
              年度实际收入
            </div>

            <div
              className="
                mt-1
                text-lg
                font-bold
                text-green-600
              "
            >
              ¥
              {formatMoney(
                yearIncome
              )}
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
            <div className="text-[10px] text-gray-400">
              年度实际支出
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
                yearExpense
              )}
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
            <div className="text-[10px] text-gray-400">
              年度实际储蓄
            </div>

            <div
              className={`
                mt-1
                text-lg
                font-bold
                ${
                  yearSavings >=
                  0
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

          <div className="px-4 py-3">
            <div className="text-[10px] text-gray-400">
              年度储蓄率
            </div>

            <div
              className={`
                mt-1
                text-lg
                font-bold
                ${
                  yearSavingsRate >=
                  0
                    ? "text-green-600"
                    : "text-red-600"
                }
              `}
            >
              {formatRate(
                yearSavingsRate
              )}
            </div>
          </div>
        </div>

        {/* 消息 */}

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

        {/* 月份导航 */}

        <div className="mb-4">
          {renderMonthNavigation()}
        </div>

        {/* 当前月份 */}

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
            正在加载实际储蓄数据...
          </div>
        ) : (
          renderActiveMonth()
        )}

        {/* 历史 */}

        {!loading && (
          <div className="mt-6">
            {renderHistory()}
          </div>
        )}
      </main>
    </div>
  );
}