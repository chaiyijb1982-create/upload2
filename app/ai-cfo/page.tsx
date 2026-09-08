"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

// =====================================================
// 类型
// =====================================================

type AnyObject = Record<string, any>;

type AiCfoData = {
  success?: boolean;
  generated_at?: string;

  summary?: AnyObject;

  financial_overview?: {
    raw_financial_assets?: number;
    fixed_income?: number;
    total_financial_assets?: number;
    total_debt?: number;
    mortgage_debt?: number;
    non_mortgage_debt?: number;
    financial_freedom_debt?: number;
    net_worth?: number;
    total_monthly_debt_payment?: number;
    mortgage_monthly_payment?: number;
    financial_freedom_monthly_debt_payment?: number;
  };

  portfolio?: {
    holdings_count?: number;
    holdings_amount?: number;
    holdings_cost?: number;
    holdings_profit?: number;
    categories?: Array<{
      category?: string;
      amount?: number;
      cost?: number;
      profit?: number;
      allocation?: number;
    }>;
  };

  debt?: {
    total?: number;
    mortgage?: number;
    non_mortgage?: number;
    financial_freedom?: number;
    monthly_payment?: number;
    mortgage_monthly_payment?: number;
    financial_freedom_monthly_payment?: number;
    loans?: Array<{
      id?: string;
      name?: string;
      type?: string;
      remaining_amount?: number;
      monthly_payment?: number;
      include_financial_freedom?: boolean;
      is_mortgage?: boolean;
    }>;
  };

  cash_flow?: AnyObject;

  financial_freedom?: {
    total_wealth?: number;
    ff_debt?: number;
    ff_net_wealth?: number;
    freedom_target?: number;
    freedom_gap?: number;
    freedom_rate?: number;
    database_record?: AnyObject;
    reconciliation?: AnyObject;
    rules?: AnyObject;
  };

  investment_analysis?: AnyObject;

  ai_context?: {
    currency?: string;
    as_of?: string;
    important_rules?: string[];
    current_position?: AnyObject;
    interpretation?: AnyObject;
  };

  table_status?: AnyObject;

  datasets?: AnyObject;

  [key: string]: any;
};

// =====================================================
// 工具函数
// =====================================================

function formatMoney(
  value: number | undefined | null
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return Number(value).toLocaleString(
    "zh-CN",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  );
}

function formatWan(
  value: number | undefined | null
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return `${(
    Number(value) / 10000
  ).toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} 万`;
}

function formatPercent(
  value: number | undefined | null
) {
  if (
    value === undefined ||
    value === null ||
    !Number.isFinite(Number(value))
  ) {
    return "—";
  }

  return `${Number(value).toFixed(2)}%`;
}

function formatDate(
  value?: string
) {
  if (!value) {
    return "—";
  }

  try {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return date.toLocaleString(
      "zh-CN",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
  } catch {
    return value;
  }
}

function categoryName(
  category?: string
) {
  switch (category) {
    case "global_stock":
      return "全球股票";

    case "fixed_income":
      return "固收";

    case "china_stock":
      return "中国股票";

    case "gold":
      return "黄金";

    default:
      return category || "其他";
  }
}

// =====================================================
// 页面
// =====================================================

export default function AiCfoPage() {
  const [data, setData] =
    useState<AiCfoData | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [copyMessage, setCopyMessage] =
    useState("");

  const [copying, setCopying] =
    useState(false);

  const [showLoans, setShowLoans] =
    useState(false);

  const [showTables, setShowTables] =
    useState(false);

  // ===================================================
  // 加载数据
  // ===================================================

  const loadData = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const response =
          await fetch(
            "/api/ai-cfo-page",
            {
              method: "GET",
              cache: "no-store",
            }
          );

        const result =
          await response.json();

        if (
          !response.ok ||
          !result?.success
        ) {
          throw new Error(
            result?.error ||
              `读取失败 (${response.status})`
          );
        }

        setData(result);
      } catch (err: any) {
        console.error(
          "AI CFO load error:",
          err
        );

        setError(
          err?.message ||
            "AI CFO 数据读取失败"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ===================================================
  // 核心数据
  // ===================================================

  const overview =
    data?.financial_overview;

  const portfolio =
    data?.portfolio;

  const debt =
    data?.debt;

  const freedom =
    data?.financial_freedom;

  const categories =
    portfolio?.categories || [];

  const loans =
    debt?.loans || [];

  // ===================================================
  // FF 百分比
  // ===================================================

  const freedomRate =
    freedom?.freedom_rate ?? 0;

  const freedomRateWidth =
    Math.max(
      0,
      Math.min(
        100,
        Number(freedomRate)
      )
    );

  // ===================================================
  // AI 分析专用 JSON
  //
  // 保留 AI 最需要的结构
  // ===================================================

  const aiAnalysisPayload =
    useMemo(() => {
      if (!data) {
        return null;
      }

      return {
        success: data.success,
        generated_at:
          data.generated_at,

        summary:
          data.summary,

        financial_overview:
          data.financial_overview,

        portfolio:
          data.portfolio,

        debt:
          data.debt,

        cash_flow:
          data.cash_flow,

        financial_freedom:
          data.financial_freedom,

        investment_analysis:
          data.investment_analysis,

        ai_context:
          data.ai_context,
      };
    }, [data]);

  // ===================================================
  // 复制 JSON
  // ===================================================

  async function copyText(
    text: string,
    message: string
  ) {
    if (!text) {
      return;
    }

    setCopying(true);
    setCopyMessage("");

    try {
      await navigator.clipboard.writeText(
        text
      );

      setCopyMessage(message);

      setTimeout(() => {
        setCopyMessage("");
      }, 2500);
    } catch (err) {
      console.error(
        "Clipboard error:",
        err
      );

      setCopyMessage(
        "复制失败，请检查浏览器权限"
      );

      setTimeout(() => {
        setCopyMessage("");
      }, 3000);
    } finally {
      setCopying(false);
    }
  }

  async function handleCopyAll() {
    if (!data) {
      return;
    }

    await copyText(
      JSON.stringify(
        data,
        null,
        2
      ),
      "完整 AI CFO 数据已复制"
    );
  }

  async function handleCopyAi() {
    if (!aiAnalysisPayload) {
      return;
    }

    await copyText(
      JSON.stringify(
        aiAnalysisPayload,
        null,
        2
      ),
      "AI 分析数据已复制"
    );
  }

  // ===================================================
  // Loading
  // ===================================================

  if (loading) {
    return (
      <main
        className="
          min-h-screen
          bg-gray-50
          p-6
          md:p-10
        "
      >
        <div
          className="
            max-w-7xl
            mx-auto
          "
        >
          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-200
              p-8
            "
          >
            <div
              className="
                flex
                items-center
                gap-3
                text-gray-600
              "
            >
              <span
                className="
                  inline-block
                  w-5
                  h-5
                  border-2
                  border-gray-300
                  border-t-blue-600
                  rounded-full
                  animate-spin
                "
              />

              <span>
                正在读取最新 AI CFO 数据...
              </span>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ===================================================
  // Error
  // ===================================================

  if (error || !data) {
    return (
      <main
        className="
          min-h-screen
          bg-gray-50
          p-6
          md:p-10
        "
      >
        <div
          className="
            max-w-7xl
            mx-auto
          "
        >
          <div
            className="
              bg-white
              rounded-2xl
              border
              border-red-200
              p-8
            "
          >
            <h1
              className="
                text-2xl
                font-bold
                text-gray-900
              "
            >
              AI CFO
            </h1>

            <div
              className="
                mt-5
                p-4
                rounded-xl
                bg-red-50
                text-red-600
              "
            >
              {error ||
                "无法读取 AI CFO 数据"}
            </div>

            <button
              type="button"
              onClick={loadData}
              className="
                mt-5
                px-5
                py-3
                rounded-xl
                bg-blue-600
                text-white
                font-medium
                hover:bg-blue-700
              "
            >
              重新读取
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ===================================================
  // 页面
  // ===================================================

  return (
    <main
      className="
        min-h-screen
        bg-gray-50
        p-4
        md:p-8
      "
    >
      <div
        className="
          max-w-7xl
          mx-auto
        "
      >
        {/* =============================================
            Header
        ============================================== */}

        <div
          className="
            flex
            flex-col
            md:flex-row
            md:items-center
            md:justify-between
            gap-4
            mb-6
          "
        >
          <div>
            <h1
              className="
                text-2xl
                md:text-3xl
                font-bold
                text-gray-900
              "
            >
              AI CFO 决策中心
            </h1>

            <p
              className="
                mt-2
                text-sm
                text-gray-500
              "
            >
              最新财务数据 ·
              AI 分析数据中心
            </p>

            <p
              className="
                mt-1
                text-xs
                text-gray-400
              "
            >
              数据时间：
              {formatDate(
                data.generated_at ||
                  data.ai_context?.as_of
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="
              self-start
              md:self-auto
              px-4
              py-2.5
              rounded-xl
              border
              border-gray-200
              bg-white
              text-gray-700
              font-medium
              hover:bg-gray-50
              transition
            "
          >
            🔄 刷新数据
          </button>
        </div>

        {/* =============================================
            核心指标
        ============================================== */}

        <section
          className="
            grid
            grid-cols-2
            lg:grid-cols-4
            gap-4
            mb-6
          "
        >
          {/* Total Wealth */}

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-200
              p-5
            "
          >
            <div
              className="
                text-sm
                text-gray-500
              "
            >
              Total Wealth
            </div>

            <div
              className="
                mt-2
                text-2xl
                font-bold
                text-gray-900
              "
            >
              {formatWan(
                overview?.total_financial_assets
              )}
            </div>

            <div
              className="
                mt-1
                text-xs
                text-gray-400
              "
            >
              ¥
              {formatMoney(
                overview?.total_financial_assets
              )}
            </div>
          </div>

          {/* Net Worth */}

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-200
              p-5
            "
          >
            <div
              className="
                text-sm
                text-gray-500
              "
            >
              真实净资产
            </div>

            <div
              className={`
                mt-2
                text-2xl
                font-bold
                ${
                  Number(
                    overview?.net_worth ?? 0
                  ) < 0
                    ? "text-red-600"
                    : "text-green-600"
                }
              `}
            >
              {formatWan(
                overview?.net_worth
              )}
            </div>

            <div
              className="
                mt-1
                text-xs
                text-gray-400
              "
            >
              ¥
              {formatMoney(
                overview?.net_worth
              )}
            </div>
          </div>

          {/* Debt */}

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-200
              p-5
            "
          >
            <div
              className="
                text-sm
                text-gray-500
              "
            >
              全部负债
            </div>

            <div
              className="
                mt-2
                text-2xl
                font-bold
                text-gray-900
              "
            >
              {formatWan(
                overview?.total_debt
              )}
            </div>

            <div
              className="
                mt-1
                text-xs
                text-gray-400
              "
            >
              房贷 +
              非房贷
            </div>
          </div>

          {/* FF */}

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-200
              p-5
            "
          >
            <div
              className="
                text-sm
                text-gray-500
              "
            >
              Financial Freedom
            </div>

            <div
              className="
                mt-2
                text-2xl
                font-bold
                text-blue-600
              "
            >
              {formatPercent(
                freedom?.freedom_rate
              )}
            </div>

            <div
              className="
                mt-1
                text-xs
                text-gray-400
              "
            >
              净财富：
              {formatWan(
                freedom?.ff_net_wealth
              )}
            </div>
          </div>
        </section>

        {/* =============================================
            Financial Freedom
        ============================================== */}

        <section
          className="
            bg-white
            rounded-2xl
            border
            border-gray-200
            p-5
            md:p-6
            mb-6
          "
        >
          <div
            className="
              flex
              flex-col
              md:flex-row
              md:items-center
              md:justify-between
              gap-3
            "
          >
            <div>
              <h2
                className="
                  text-lg
                  font-bold
                  text-gray-900
                "
              >
                Financial Freedom
              </h2>

              <p
                className="
                  mt-1
                  text-sm
                  text-gray-500
                "
              >
                当前财务自由完成度
              </p>
            </div>

            <div
              className="
                text-2xl
                font-bold
                text-blue-600
              "
            >
              {formatPercent(
                freedom?.freedom_rate
              )}
            </div>
          </div>

          <div
            className="
              mt-5
              h-3
              bg-gray-100
              rounded-full
              overflow-hidden
            "
          >
            <div
              className="
                h-full
                bg-blue-600
                rounded-full
                transition-all
              "
              style={{
                width: `${freedomRateWidth}%`,
              }}
            />
          </div>

          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-3
              gap-4
              mt-5
            "
          >
            <div
              className="
                rounded-xl
                bg-gray-50
                p-4
              "
            >
              <div
                className="
                  text-xs
                  text-gray-500
                "
              >
                当前 FF 净财富
              </div>

              <div
                className="
                  mt-1
                  font-bold
                  text-gray-900
                "
              >
                ¥
                {formatMoney(
                  freedom?.ff_net_wealth
                )}
              </div>
            </div>

            <div
              className="
                rounded-xl
                bg-gray-50
                p-4
              "
            >
              <div
                className="
                  text-xs
                  text-gray-500
                "
              >
                Financial Freedom Target
              </div>

              <div
                className="
                  mt-1
                  font-bold
                  text-gray-900
                "
              >
                ¥
                {formatMoney(
                  freedom?.freedom_target
                )}
              </div>
            </div>

            <div
              className="
                rounded-xl
                bg-gray-50
                p-4
              "
            >
              <div
                className="
                  text-xs
                  text-gray-500
                "
              >
                当前缺口
              </div>

              <div
                className="
                  mt-1
                  font-bold
                  text-red-600
                "
              >
                ¥
                {formatMoney(
                  freedom?.freedom_gap
                )}
              </div>
            </div>
          </div>
        </section>

        {/* =============================================
            资产 + 负债
        ============================================== */}

        <section
          className="
            grid
            grid-cols-1
            lg:grid-cols-2
            gap-6
            mb-6
          "
        >
          {/* Portfolio */}

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-200
              p-5
              md:p-6
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
              "
            >
              <div>
                <h2
                  className="
                    text-lg
                    font-bold
                    text-gray-900
                  "
                >
                  投资组合
                </h2>

                <p
                  className="
                    mt-1
                    text-xs
                    text-gray-400
                  "
                >
                  {portfolio?.holdings_count ??
                    0} 个 Holdings
                </p>
              </div>

              <div
                className="
                  text-right
                "
              >
                <div
                  className="
                    text-sm
                    text-gray-500
                  "
                >
                  盈亏
                </div>

                <div
                  className={`
                    font-bold
                    ${
                      Number(
                        portfolio?.holdings_profit ??
                          0
                      ) >= 0
                        ? "text-green-600"
                        : "text-red-600"
                    }
                  `}
                >
                  ¥
                  {formatMoney(
                    portfolio?.holdings_profit
                  )}
                </div>
              </div>
            </div>

            <div
              className="
                mt-5
                space-y-3
              "
            >
              {categories.map(
                (item) => (
                  <div
                    key={
                      item.category
                    }
                  >
                    <div
                      className="
                        flex
                        items-center
                        justify-between
                        text-sm
                      "
                    >
                      <span
                        className="
                          text-gray-700
                        "
                      >
                        {categoryName(
                          item.category
                        )}
                      </span>

                      <span
                        className="
                          font-medium
                          text-gray-900
                        "
                      >
                        {formatPercent(
                          item.allocation
                        )}
                      </span>
                    </div>

                    <div
                      className="
                        mt-1
                        h-2
                        bg-gray-100
                        rounded-full
                        overflow-hidden
                      "
                    >
                      <div
                        className="
                          h-full
                          bg-gray-700
                          rounded-full
                        "
                        style={{
                          width: `${Math.max(
                            0,
                            Math.min(
                              100,
                              Number(
                                item.allocation ??
                                  0
                              )
                            )
                          )}%`,
                        }}
                      />
                    </div>

                    <div
                      className="
                        mt-1
                        text-xs
                        text-gray-400
                      "
                    >
                      ¥
                      {formatMoney(
                        item.amount
                      )}
                    </div>
                  </div>
                )
              )}
            </div>
          </div>

          {/* Debt */}

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-200
              p-5
              md:p-6
            "
          >
            <div
              className="
                flex
                items-center
                justify-between
              "
            >
              <div>
                <h2
                  className="
                    text-lg
                    font-bold
                    text-gray-900
                  "
                >
                  负债
                </h2>

                <p
                  className="
                    mt-1
                    text-xs
                    text-gray-400
                  "
                >
                  每月债务支出
                </p>
              </div>

              <div
                className="
                  text-right
                "
              >
                <div
                  className="
                    text-sm
                    text-gray-500
                  "
                >
                  每月
                </div>

                <div
                  className="
                    font-bold
                    text-gray-900
                  "
                >
                  ¥
                  {formatMoney(
                    debt?.monthly_payment
                  )}
                </div>
              </div>
            </div>

            <div
              className="
                mt-5
                grid
                grid-cols-2
                gap-3
              "
            >
              <div
                className="
                  rounded-xl
                  bg-gray-50
                  p-4
                "
              >
                <div
                  className="
                    text-xs
                    text-gray-500
                  "
                >
                  房贷
                </div>

                <div
                  className="
                    mt-1
                    font-bold
                    text-gray-900
                  "
                >
                  ¥
                  {formatWan(
                    debt?.mortgage
                  )}
                </div>
              </div>

              <div
                className="
                  rounded-xl
                  bg-gray-50
                  p-4
                "
              >
                <div
                  className="
                    text-xs
                    text-gray-500
                  "
                >
                  非房贷
                </div>

                <div
                  className="
                    mt-1
                    font-bold
                    text-red-600
                  "
                >
                  ¥
                  {formatWan(
                    debt?.non_mortgage
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                setShowLoans(
                  !showLoans
                )
              }
              className="
                mt-5
                w-full
                text-left
                px-4
                py-3
                rounded-xl
                bg-gray-50
                hover:bg-gray-100
                text-sm
                font-medium
                text-gray-700
              "
            >
              {showLoans
                ? "▲ 收起贷款明细"
                : "▼ 查看贷款明细"}
            </button>

            {showLoans && (
              <div
                className="
                  mt-3
                  space-y-2
                  max-h-[420px]
                  overflow-y-auto
                "
              >
                {loans.map(
                  (loan) => (
                    <div
                      key={
                        loan.id ||
                        `${loan.name}-${loan.remaining_amount}`
                      }
                      className="
                        rounded-xl
                        border
                        border-gray-100
                        p-3
                      "
                    >
                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-3
                        "
                      >
                        <div>
                          <div
                            className="
                              text-sm
                              font-medium
                              text-gray-800
                            "
                          >
                            {loan.name ||
                              "未命名贷款"}
                          </div>

                          <div
                            className="
                              mt-1
                              text-xs
                              text-gray-400
                            "
                          >
                            {loan.type ||
                              "—"}
                          </div>
                        </div>

                        <div
                          className="
                            text-right
                          "
                        >
                          <div
                            className="
                              text-sm
                              font-bold
                              text-gray-900
                            "
                          >
                            ¥
                            {formatMoney(
                              loan.remaining_amount
                            )}
                          </div>

                          <div
                            className="
                              mt-1
                              text-xs
                              text-gray-400
                            "
                          >
                            ¥
                            {formatMoney(
                              loan.monthly_payment
                            )}
                            /月
                          </div>
                        </div>
                      </div>

                      <div
                        className="
                          mt-2
                          flex
                          gap-2
                          flex-wrap
                        "
                      >
                        {loan.is_mortgage && (
                          <span
                            className="
                              text-xs
                              px-2
                              py-1
                              rounded-lg
                              bg-gray-100
                              text-gray-600
                            "
                          >
                            房贷
                          </span>
                        )}

                        {loan.include_financial_freedom && (
                          <span
                            className="
                              text-xs
                              px-2
                              py-1
                              rounded-lg
                              bg-blue-50
                              text-blue-600
                            "
                          >
                            FF计入
                          </span>
                        )}
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </section>

        {/* =============================================
            复制中心
        ============================================== */}

        <section
          className="
            bg-white
            rounded-2xl
            border
            border-gray-200
            p-5
            md:p-6
            mb-6
          "
        >
          <h2
            className="
              text-lg
              font-bold
              text-gray-900
            "
          >
            AI CFO 数据
          </h2>

          <p
            className="
              mt-2
              text-sm
              text-gray-500
              leading-6
            "
          >
            这里的数据来自最新 AI CFO
            API。复制后可以直接粘贴到
            ChatGPT，让 AI 根据当前财务状态进行分析。
          </p>

          <div
            className="
              mt-5
              grid
              grid-cols-1
              md:grid-cols-2
              gap-3
            "
          >
            <button
              type="button"
              onClick={handleCopyAi}
              disabled={
                copying || !data
              }
              className="
                px-5
                py-4
                rounded-xl
                bg-blue-600
                text-white
                font-bold
                hover:bg-blue-700
                disabled:opacity-50
                transition
              "
            >
              📋 复制 AI 分析数据
            </button>

            <button
              type="button"
              onClick={handleCopyAll}
              disabled={
                copying || !data
              }
              className="
                px-5
                py-4
                rounded-xl
                border
                border-gray-200
                bg-gray-50
                text-gray-800
                font-bold
                hover:bg-gray-100
                disabled:opacity-50
                transition
              "
            >
              📄 复制完整数据
            </button>
          </div>

          {copyMessage && (
            <div
              className="
                mt-4
                text-center
                text-sm
                font-medium
                text-green-600
              "
            >
              ✓ {copyMessage}
            </div>
          )}

          <div
            className="
              mt-5
              rounded-xl
              bg-gray-50
              p-4
              text-xs
              text-gray-500
              leading-6
            "
          >
            <div
              className="
                font-medium
                text-gray-700
              "
            >
              推荐使用方式
            </div>

            <div className="mt-2">
              ① 点击「复制 AI 分析数据」
            </div>

            <div>
              ② 回到 ChatGPT
            </div>

            <div>
              ③ 粘贴数据
            </div>

            <div>
              ④ 再提出你的问题
            </div>

            <div className="mt-2">
              例如：
              「根据这份最新数据，我什么时候能达到150万？」
            </div>
          </div>
        </section>

        {/* =============================================
            数据状态
        ============================================== */}

        <section
          className="
            bg-white
            rounded-2xl
            border
            border-gray-200
            p-5
            md:p-6
          "
        >
          <button
            type="button"
            onClick={() =>
              setShowTables(
                !showTables
              )
            }
            className="
              w-full
              flex
              items-center
              justify-between
              text-left
            "
          >
            <div>
              <h2
                className="
                  text-lg
                  font-bold
                  text-gray-900
                "
              >
                数据表状态
              </h2>

              <p
                className="
                  mt-1
                  text-xs
                  text-gray-400
                "
              >
                AI CFO 当前读取的数据源
              </p>
            </div>

            <span
              className="
                text-gray-400
              "
            >
              {showTables
                ? "▲"
                : "▼"}
            </span>
          </button>

          {showTables && (
            <div
              className="
                mt-5
                grid
                grid-cols-1
                md:grid-cols-2
                lg:grid-cols-3
                gap-3
              "
            >
              {Object.entries(
                data.table_status || {}
              ).map(
                ([name, status]: [
                  string,
                  any
                ]) => {
                  const available =
                    Boolean(
                      status?.available
                    );

                  return (
                    <div
                      key={name}
                      className="
                        rounded-xl
                        border
                        border-gray-100
                        p-4
                      "
                    >
                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          gap-3
                        "
                      >
                        <span
                          className="
                            text-sm
                            text-gray-700
                            break-all
                          "
                        >
                          {name}
                        </span>

                        <span
                          className={`
                            shrink-0
                            text-xs
                            px-2
                            py-1
                            rounded-lg
                            ${
                              available
                                ? "bg-green-50 text-green-600"
                                : "bg-red-50 text-red-600"
                            }
                          `}
                        >
                          {available
                            ? "正常"
                            : "不可用"}
                        </span>
                      </div>

                      {status?.count !==
                        undefined && (
                        <div
                          className="
                            mt-2
                            text-xs
                            text-gray-400
                          "
                        >
                          {status.count} 条
                        </div>
                      )}

                      {status?.error && (
                        <div
                          className="
                            mt-2
                            text-xs
                            text-red-500
                            leading-5
                          "
                        >
                          {status.error}
                        </div>
                      )}
                    </div>
                  );
                }
              )}
            </div>
          )}
        </section>

        {/* =============================================
            Footer
        ============================================== */}

        <div
          className="
            py-8
            text-center
            text-xs
            text-gray-400
          "
        >
          AI Wealth OS · AI CFO
          · 数据以最新 API 快照为准
        </div>
      </div>
    </main>
  );
}