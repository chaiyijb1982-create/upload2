"use client";

import {
useEffect,
useMemo,
useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
supabase,
} from "@/lib/supabase";

// =====================================================
// 类型
// =====================================================

type Period =
| "weekly"
| "monthly"
| "yearly";

type HistoryRow = {

snapshot_date: string;

total_asset: number;

freedom_target: number;

freedom_gap: number;

freedom_rate: number;

};

type PeriodRow = {

periodKey: string;

periodLabel: string;

startDate: string;

endDate: string;

current: HistoryRow;

previous: HistoryRow | null;

};

// =====================================================
// 工具
// =====================================================

function toNumber(
value: any
): number {

const n =
Number(value);

return Number.isFinite(n)
? n
: 0;

}

// =====================================================
// 日期
// =====================================================

function parseDate(
value: string
): Date {

const parts =
value
.split("-")
.map(Number);

return new Date(
parts[0],
parts[1] - 1,
parts[2]
);

}

function formatDate(
date: Date
): string {

const year =
date.getFullYear();

const month =
String(
date.getMonth() + 1
).padStart(
2,
"0"
);

const day =
String(
date.getDate()
).padStart(
2,
"0"
);

return (
`${year}-${month}-${day}`
);

}

// =====================================================
// 获取周一
// =====================================================

function getMonday(
date: Date
): Date {

const result =
new Date(
date
);

const day =
result.getDay();

const diff =
day === 0
? -6
: 1 - day;

result.setDate(
result.getDate() + diff
);

result.setHours(
0,
0,
0,
0
);

return result;

}

// =====================================================
// 获取周日
// =====================================================

function getSunday(
date: Date
): Date {

const result =
new Date(
date
);

result.setDate(
result.getDate() + 6
);

result.setHours(
0,
0,
0,
0
);

return result;

}

// =====================================================
// 月初
// =====================================================

function getMonthStart(
date: Date
): Date {

return new Date(
date.getFullYear(),
date.getMonth(),
1
);

}

// =====================================================
// 月末
// =====================================================

function getMonthEnd(
date: Date
): Date {

return new Date(
date.getFullYear(),
date.getMonth() + 1,
0
);

}

// =====================================================
// 年初
// =====================================================

function getYearStart(
date: Date
): Date {

return new Date(
date.getFullYear(),
0,
1
);

}

// =====================================================
// 年末
// =====================================================

function getYearEnd(
date: Date
): Date {

return new Date(
date.getFullYear(),
11,
31
);

}

// =====================================================
// 金额格式
// =====================================================

function money(
num: number
): string {

const value =
Math.round(
toNumber(num)
);

return (
"¥ " +
value.toLocaleString(
"zh-CN",
{
maximumFractionDigits:
0,
}
)
);

}

// =====================================================
// 金额变化
// =====================================================

function moneyChange(
value: number
): string {

const n =
Math.round(
toNumber(value)
);

if (
n > 0
) {

 
return (
  "+¥ " +
  n.toLocaleString(
    "zh-CN"
  )
);
 

}

if (
n < 0
) {

 
return (
  "-¥ " +
  Math.abs(n)
    .toLocaleString(
      "zh-CN"
    )
);
 

}

return "¥ 0";

}

// =====================================================
// 百分比
// =====================================================

function rate(
value: number
): string {

return (
toNumber(value)
.toFixed(1) +
"%"
);

}

// =====================================================
// 百分比变化
// =====================================================

function rateChange(
value: number
): string {

const n =
toNumber(value);

if (
n > 0
) {

 
return (
  "+" +
  n.toFixed(1) +
  "%"
);
 

}

if (
n < 0
) {

 
return (
  n.toFixed(1) +
  "%"
);
 

}

return "0.0%";

}

// =====================================================
// 变化颜色
// =====================================================

function changeClass(
value: number
): string {

if (
value > 0
) {

 
return "text-green-600";
 

}

if (
value < 0
) {

 
return "text-red-600";
 

}

return "text-gray-400";

}

// =====================================================
// 周期聚合
//
// 核心规则：
//
// 每个周期只取该周期最后一条记录。
// 例如：
//
// 周：取本周最后一个交易日
// 月：取本月最后一个交易日
// 年：取本年最后一个交易日
//
// 然后与上一个周期的最后记录比较。
// =====================================================

function buildPeriodHistory(
history: HistoryRow[],
period: Period
): PeriodRow[] {

if (
history.length === 0
) {

 
return [];
 

}

const groups =
new Map<
string,
HistoryRow[]
>();

history.forEach(
row => {

 
  const date =
    parseDate(
      row.snapshot_date
    );


  let key =
    "";


  if (
    period === "weekly"
  ) {

    const monday =
      getMonday(
        date
      );

    key =
      formatDate(
        monday
      );

  }
  else if (
    period === "monthly"
  ) {

    key =
      `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}`;

  }
  else {

    key =
      String(
        date.getFullYear()
      );

  }


  if (
    !groups.has(key)
  ) {

    groups.set(
      key,
      []
    );

  }


  groups
    .get(key)!
    .push(
      row
    );

}
 

);

const sortedGroups =
Array.from(
groups.entries()
)
.sort(
(
a,
b
) =>
a[0].localeCompare(
b[0]
)
);

const result:
PeriodRow[] = [];

sortedGroups.forEach(
(
[
periodKey,
rows,
],
index
) => {

 
  const sortedRows =
    [...rows]
      .sort(
        (
          a,
          b
        ) =>
          a.snapshot_date
            .localeCompare(
              b.snapshot_date
            )
      );


  // =================================================
  // 周期最后一天的数据
  // =================================================

  const current =
    sortedRows[
      sortedRows.length - 1
    ];


  // =================================================
  // 上一个周期
  // =================================================

  let previous:
    HistoryRow | null =
      null;


  if (
    index > 0
  ) {

    const previousRows =
      sortedGroups[
        index - 1
      ][1];


    const sortedPreviousRows =
      [...previousRows]
        .sort(
          (
            a,
            b
          ) =>
            a.snapshot_date
              .localeCompare(
                b.snapshot_date
              )
        );


    previous =
      sortedPreviousRows[
        sortedPreviousRows.length - 1
      ] ??
      null;

  }


  // =================================================
  // 周期显示
  // =================================================

  const currentDate =
    parseDate(
      current.snapshot_date
    );


  let startDate:
    Date;

  let endDate:
    Date;

  let periodLabel:
    string;


  if (
    period === "weekly"
  ) {

    startDate =
      getMonday(
        currentDate
      );

    endDate =
      getSunday(
        startDate
      );


    periodLabel =
      `${formatDate(
        startDate
      )} ~ ${formatDate(
        endDate
      )}`;

  }
  else if (
    period === "monthly"
  ) {

    startDate =
      getMonthStart(
        currentDate
      );

    endDate =
      getMonthEnd(
        currentDate
      );


    periodLabel =
      `${currentDate.getFullYear()}年${
        currentDate.getMonth() + 1
      }月`;

  }
  else {

    startDate =
      getYearStart(
        currentDate
      );

    endDate =
      getYearEnd(
        currentDate
      );


    periodLabel =
      `${currentDate.getFullYear()}年`;

  }


  result.push({

    periodKey,

    periodLabel,

    startDate:
      formatDate(
        startDate
      ),

    endDate:
      formatDate(
        endDate
      ),

    current,

    previous,

  });

}
 

);

return result;

}

// =====================================================
// 历史表格
// =====================================================

function HistoryTable({
rows,
}: {
rows: PeriodRow[];

}) {

return (

 
<div
  className="
    overflow-auto
  "
>

  <table
    className="
      w-full
      text-sm
      min-w-[1200px]
    "
  >

    <thead>

      <tr
        className="
          border-b
          text-gray-500
          bg-gray-50
        "
      >

        <th
          className="
            p-3
            text-left
          "
        >

          周期

        </th>


        <th
          className="
            p-3
            text-right
          "
        >

          家庭净资产

        </th>


        <th
          className="
            p-3
            text-right
          "
        >

          较上期

        </th>


        <th
          className="
            p-3
            text-right
          "
        >

          财务自由目标

        </th>


        <th
          className="
            p-3
            text-right
          "
        >

          较上期

        </th>


        <th
          className="
            p-3
            text-right
          "
        >

          缺口

        </th>


        <th
          className="
            p-3
            text-right
          "
        >

          较上期

        </th>


        <th
          className="
            p-3
            text-right
          "
        >

          完成率

        </th>


        <th
          className="
            p-3
            text-right
          "
        >

          较上期

        </th>

      </tr>

    </thead>


    <tbody>

      {
        rows.length === 0
          ? (

            <tr>

              <td
                colSpan={9}
                className="
                  p-10
                  text-center
                  text-gray-400
                "
              >

                暂无历史数据

              </td>

            </tr>

          )
          : (

            rows.map(
              row => {

                const current =
                  row.current;

                const previous =
                  row.previous;


                const assetChange =
                  previous
                    ? toNumber(
                        current.total_asset
                      ) -
                      toNumber(
                        previous.total_asset
                      )
                    : 0;


                const targetChange =
                  previous
                    ? toNumber(
                        current.freedom_target
                      ) -
                      toNumber(
                        previous.freedom_target
                      )
                    : 0;


                const gapChange =
                  previous
                    ? toNumber(
                        current.freedom_gap
                      ) -
                      toNumber(
                        previous.freedom_gap
                      )
                    : 0;


                const rateChangeValue =
                  previous
                    ? toNumber(
                        current.freedom_rate
                      ) -
                      toNumber(
                        previous.freedom_rate
                      )
                    : 0;


                return (

                  <tr
                    key={
                      row.periodKey
                    }
                    className="
                      border-b
                      hover:bg-gray-50
                    "
                  >

                    {/* =================================
                        周期
                    ================================= */}

                    <td
                      className="
                        p-3
                        font-medium
                        whitespace-nowrap
                      "
                    >

                      <div>

                        {
                          row.periodLabel
                        }

                      </div>


                      <div
                        className="
                          text-xs
                          text-gray-400
                          mt-1
                        "
                      >

                        实际数据：
                        {
                          current.snapshot_date
                        }

                      </div>

                    </td>


                    {/* =================================
                        家庭净资产
                    ================================= */}

                    <td
                      className="
                        p-3
                        text-right
                        font-medium
                      "
                    >

                      {
                        money(
                          current.total_asset
                        )
                      }

                    </td>


                    <td
                      className={`
                        p-3
                        text-right
                        font-medium
                        ${changeClass(
                          assetChange
                        )}
                      `}
                    >

                      {
                        previous
                          ? moneyChange(
                              assetChange
                            )
                          : "-"
                      }

                    </td>


                    {/* =================================
                        财务自由目标
                    ================================= */}

                    <td
                      className="
                        p-3
                        text-right
                      "
                    >

                      {
                        money(
                          current.freedom_target
                        )
                      }

                    </td>


                    <td
                      className={`
                        p-3
                        text-right
                        ${changeClass(
                          targetChange
                        )}
                      `}
                    >

                      {
                        previous
                          ? moneyChange(
                              targetChange
                            )
                          : "-"
                      }

                    </td>


                    {/* =================================
                        缺口
                    ================================= */}

                    <td
                      className="
                        p-3
                        text-right
                        text-orange-600
                      "
                    >

                      {
                        money(
                          current.freedom_gap
                        )
                      }

                    </td>


                    <td
                      className={`
                        p-3
                        text-right
                        ${changeClass(
                          -gapChange
                        )}
                      `}
                    >

                      {
                        previous
                          ? moneyChange(
                              gapChange
                            )
                          : "-"
                      }

                    </td>


                    {/* =================================
                        完成率
                    ================================= */}

                    <td
                      className="
                        p-3
                        text-right
                        font-medium
                      "
                    >

                      {
                        rate(
                          current.freedom_rate
                        )
                      }

                    </td>


                    <td
                      className={`
                        p-3
                        text-right
                        font-medium
                        ${changeClass(
                          rateChangeValue
                        )}
                      `}
                    >

                      {
                        previous
                          ? rateChange(
                              rateChangeValue
                            )
                          : "-"
                      }

                    </td>

                  </tr>

                );

              }
            )

          )
      }

    </tbody>

  </table>

</div>
 

);

}

// =====================================================
// 页面
// =====================================================

export default function FinancialFreedomHistoryPage() {

const [
history,
setHistory,
] =
useState<HistoryRow[]>([]);

const [
loading,
setLoading,
] =
useState(true);

// ===================================================
// 默认：周
// ===================================================

const [
period,
setPeriod,
] =
useState<Period>(
"weekly"
);

// ===================================================
// 加载历史
// ===================================================

useEffect(
() => {

 
  async function load() {

    try {

      const {
        data,
        error,
      } =
        await supabase
          .from(
            "financial_freedom_history"
          )
          .select(
            "*"
          )
          .order(
            "snapshot_date",
            {
              ascending:
                true,
            }
          );


      if (
        error
      ) {

        console.error(
          "Financial Freedom History error:",
          error
        );

      }


      setHistory(
        Array.isArray(data)
          ? data
          : []
      );

    }
    catch (
      error
    ) {

      console.error(
        "Financial Freedom History load error:",
        error
      );

      setHistory([]);

    }
    finally {

      setLoading(
        false
      );

    }

  }


  load();

},
[]
 

);

// ===================================================
// 最新状态
//
// 仍然使用数据库最新一条真实记录。
// 不受周/月/年切换影响。
// ===================================================

const latest =
history.length > 0
? history[
history.length - 1
]
: null;

// ===================================================
// 周 / 月 / 年数据
// ===================================================

const periodRows =
useMemo(
() => {

 
    return buildPeriodHistory(
      history,
      period
    );

  },
  [
    history,
    period,
  ]
);
 

// ===================================================
// 最近显示数量
//
// 周：12 周
// 月：12 月
// 年：5 年
// ===================================================

const displayLimit =
period === "weekly"
? 12
: period === "monthly"
? 12
: 5;

const displayRows =
[...periodRows]
.reverse()
.slice(
0,
displayLimit
);

// ===================================================
// Loading
// ===================================================

if (
loading
) {

 
return (

  <>

    <TopBar
      title="Financial Freedom History"
    />


    <main
      className="
        p-8
      "
    >

      Loading...

    </main>

  </>

);
 

}

// ===================================================
// Render
// ===================================================

return (

 
<>

  <TopBar
    title="Financial Freedom History"
  />


  <main
    className="
      max-w-[1400px]
      mx-auto
      p-8
      space-y-8
    "
  >

    {/* =================================================
        标题
    ================================================= */}

    <div>

      <h1
        className="
          text-3xl
          font-bold
        "
      >

        📈 财务自由历史

      </h1>


      <p
        className="
          text-gray-500
          mt-2
        "
      >

        查看家庭净资产与财务自由目标变化

      </p>

    </div>


    {/* =================================================
        最新状态
    ================================================= */}

    {
      latest && (

        <section
          className="
            grid
            grid-cols-1
            md:grid-cols-3
            gap-6
          "
        >

          {/* =========================================
              当前家庭净资产
          ========================================= */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <div
              className="
                text-gray-500
                text-sm
              "
            >

              当前家庭净资产

            </div>


            <div
              className="
                text-3xl
                font-bold
                mt-3
                text-green-700
              "
            >

              {
                money(
                  latest.total_asset
                )
              }

            </div>

          </div>


          {/* =========================================
              财务自由目标
          ========================================= */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <div
              className="
                text-gray-500
                text-sm
              "
            >

              财务自由目标

            </div>


            <div
              className="
                text-3xl
                font-bold
                mt-3
                text-blue-700
              "
            >

              {
                money(
                  latest.freedom_target
                )
              }

            </div>

          </div>


          {/* =========================================
              财务自由完成率
          ========================================= */}

          <div
            className="
              bg-white
              border
              rounded-2xl
              p-6
              shadow-sm
            "
          >

            <div
              className="
                text-gray-500
                text-sm
              "
            >

              财务自由完成率

            </div>


            <div
              className="
                text-3xl
                font-bold
                mt-3
                text-indigo-700
              "
            >

              {
                Number(
                  latest.freedom_rate || 0
                )
                  .toFixed(1)
              }

              %

            </div>

          </div>

        </section>

      )
    }


    {/* =================================================
        历史记录
    ================================================= */}

    <section
      className="
        bg-white
        border
        rounded-2xl
        p-6
        shadow-sm
      "
    >

      {/* ===============================================
          标题 + 周/月/年
      =============================================== */}

      <div
        className="
          flex
          items-center
          justify-between
          mb-5
          gap-4
        "
      >

        <div>

          <h2
            className="
              text-xl
              font-bold
            "
          >

            📊 历史记录

          </h2>


          <p
            className="
              text-xs
              text-gray-400
              mt-1
            "
          >

            每个周期取该周期最后一条数据，并与上一周期比较

          </p>

        </div>


        {/* =============================================
            周 / 月 / 年
        ============================================= */}

        <div
          className="
            inline-flex
            rounded-lg
            border
            bg-gray-50
            p-1
            shrink-0
          "
        >

          {[
            {
              key:
                "weekly" as Period,

              label:
                "周",
            },

            {
              key:
                "monthly" as Period,

              label:
                "月",
            },

            {
              key:
                "yearly" as Period,

              label:
                "年",
            },

          ].map(
            item => (

              <button
                key={
                  item.key
                }
                type="button"
                onClick={() =>
                  setPeriod(
                    item.key
                  )
                }
                className={`
                  rounded-md
                  px-5
                  py-2
                  text-sm
                  transition

                  ${
                    period ===
                    item.key
                      ? `
                        bg-black
                        text-white
                      `
                      : `
                        text-gray-600
                        hover:bg-gray-100
                      `
                  }
                `}
              >

                {
                  item.label
                }

              </button>

            )
          )}

        </div>

      </div>


      {/* ===============================================
          表格
      =============================================== */}

      <HistoryTable
        rows={
          displayRows
        }
      />


      {/* ===============================================
          显示数量
      =============================================== */}

      {
        periodRows.length >
          displayLimit && (

          <div
            className="
              mt-3
              text-right
              text-xs
              text-gray-400
            "
          >

            显示最近 {
              displayLimit
            }
            {
              period === "weekly"
                ? " 周"
                : period === "monthly"
                  ? " 个月"
                  : " 年"
            }

          </div>

        )
      }

    </section>

  </main>

</>
 

);

}
