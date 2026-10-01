"use client";

interface Props {
  allocation: any;
}

export default function AssetAllocation({
  allocation,
}: Props) {
  console.log(
    "========== ASSET ALLOCATION START =========="
  );

  console.log(
    "allocation:",
    allocation
  );

  console.log(
    "allocation JSON:",
    JSON.stringify(
      allocation,
      null,
      2
    )
  );

  if (
    !allocation ||
    typeof allocation !== "object"
  ) {
    console.log(
      "AssetAllocation: 无数据"
    );

    return null;
  }

  const getValue = (
    value: any
  ) => {
    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;
  };

  // =========================
  // 原始资产
  // =========================

  const fixedIncome =
    getValue(
      allocation.fixed_income
    );

  const globalStock =
    getValue(
      allocation.global_stock
    );

  const chinaStock =
    getValue(
      allocation.china_stock
    );

  const gold =
    getValue(
      allocation.gold
    );

  // =========================
  // 新的资产配置规则
  //
  // 防守资产 = 固收 + 中国股票
  //
  // 目标：
  // 防守资产 55%
  // 全球股票 35%
  // 黄金 10%
  // =========================

  const defensive =
    fixedIncome +
    chinaStock;

  const data = [
    {
      id: "defensive",
      name: "防守资产（含中国股票）",
      value: defensive,
      target: 55,
    },
    {
      id: "global_stock",
      name: "全球股票",
      value: globalStock,
      target: 35,
    },
    {
      id: "gold",
      name: "黄金",
      value: gold,
      target: 10,
    },
  ];

  // =========================
  // 有资产的项目
  // =========================

  const validData =
    data.filter(
      item =>
        item.value > 0
    );

  // =========================
  // 总资产
  // =========================

  const total =
    validData.reduce(
      (
        sum,
        item
      ) =>
        sum + item.value,
      0
    );

  if (
    total <= 0
  ) {
    return null;
  }

  // =========================
  // 各资产占全部资产比例
  // =========================

  const chinaStockPercent =
    (
      chinaStock /
      total
    ) *
    100;

  const fixedIncomePercent =
    (
      fixedIncome /
      total
    ) *
    100;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">

      {/* =========================
          标题
      ========================= */}

      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">
          📊 投资资产 Allocation
        </h2>

        <p className="text-sm text-gray-400 mt-1">
          当前资产配置与目标配置
        </p>
      </div>

      {/* =========================
          资产配置
      ========================= */}

      <div className="space-y-6">

        {validData.map(
          item => {

            const current =
              (
                item.value /
                total
              ) *
              100;

            const difference =
              current -
              item.target;

            const isDefensive =
              item.id ===
              "defensive";

            return (
              <div
                key={item.id}
              >

                {/* =========================
                    名称 + 当前比例 / 目标
                    比例紧跟名称
                    全部橙色
                ========================= */}

                <div className="flex items-center gap-4 mb-2">

                  {/* 资产名称 */}

                  <span
                    className={
                      isDefensive
                        ? "font-bold text-gray-900"
                        : "font-semibold text-gray-800"
                    }
                  >
                    {item.name}
                  </span>

                  {/* 当前比例 / 目标 */}

                  <span className="text-base font-bold text-orange-600 whitespace-nowrap">
                    {current.toFixed(1)}%
                    {" / "}
                    目标 {item.target}%
                  </span>

                </div>

                {/* =========================
                    进度条
                ========================= */}

                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">

                  <div
                    className="h-full bg-blue-500 rounded-full"
                    style={{
                      width:
                        `${Math.min(
                          current,
                          100
                        )}%`,
                    }}
                  />

                </div>

                {/* =========================
                    偏离目标
                    数字保持黑色
                ========================= */}

                <div className="mt-2 text-xs text-gray-400">

                  当前{" "}
                  <span className="text-gray-900">
                    {current.toFixed(1)}%
                  </span>

                  {" · "}

                  偏离目标{" "}

                  <span className="text-gray-900 font-medium">
                    {difference >= 0
                      ? "+"
                      : ""}
                    {difference.toFixed(1)}%
                  </span>

                </div>

                {/* =========================
                    防守资产内部明细
                ========================= */}

                {isDefensive && (
                  <div className="mt-3 ml-1 space-y-1">

                    {/* 债券资产 */}

                    <div className="text-sm font-medium text-gray-500">
                      └─ 债券资产：
                      <span className="ml-1 font-bold text-gray-900">
                        {fixedIncomePercent.toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>

                    {/* 中国股票 */}

                    <div className="text-sm font-medium text-gray-500">
                      └─ 中国股票：
                      <span className="ml-1 font-bold text-gray-900">
                        {chinaStockPercent.toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>

                  </div>
                )}

              </div>
            );
          }
        )}

      </div>
    </div>
  );
}