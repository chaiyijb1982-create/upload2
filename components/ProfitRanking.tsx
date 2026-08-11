"use client";

interface Props {
  holdings?: any[];
}

export default function ProfitRanking({
  holdings = [],
}: Props) {
  // =====================================================
  // 按收益率从高到低
  // 注意：
  // 数据库 profit_rate 已经是百分数
  // 例如：
  // 4.299460176991136 = 4.30%
  // -7.246449471249992 = -7.25%
  // 所以这里绝对不能再 × 100
  // =====================================================

  const data = [...(holdings || [])].sort(
    (a, b) =>
      Number(b.profit_rate || 0) -
      Number(a.profit_rate || 0)
  );

  const winners = data.slice(0, 5);

  // =====================================================
  // 收益率最低的 5 个
  // =====================================================

  const losers = [...(holdings || [])]
    .sort(
      (a, b) =>
        Number(a.profit_rate || 0) -
        Number(b.profit_rate || 0)
    )
    .slice(0, 5);

  return (
    <div
      className="
      grid
      grid-cols-1
      md:grid-cols-2
      gap-6
      "
    >

      {/* =================================================
          Top Winners
          ================================================= */}

      <div
        className="
        bg-white
        rounded-2xl
        shadow
        p-8
        "
      >

        <h2
          className="
          text-2xl
          font-bold
          mb-6
          "
        >
          🏆 Top Winners
        </h2>

        <div className="space-y-4">

          {winners.length === 0 ? (

            <p className="text-gray-400">
              暂无数据
            </p>

          ) : (

            winners.map(
              (
                item: any,
                index: number
              ) => {

                const profitRate =
                  Number(
                    item.profit_rate || 0
                  );

                return (

                  <div
                    key={
                      item.id ??
                      `${item.code}-${index}`
                    }
                    className="
                    flex
                    justify-between
                    border-b
                    pb-3
                    "
                  >

                    <div>

                      <div className="font-bold">
                        {item.name}
                      </div>

                      <div className="text-sm text-gray-500">
                        {item.market}
                      </div>

                    </div>

                    <div
                      className="
                      font-bold
                      text-green-600
                      "
                    >
                      {profitRate >= 0 ? "+" : ""}
                      {profitRate.toFixed(2)}
                      %
                    </div>

                  </div>

                );
              }
            )

          )}

        </div>

      </div>


      {/* =================================================
          Needs Attention
          ================================================= */}

      <div
        className="
        bg-white
        rounded-2xl
        shadow
        p-8
        "
      >

        <h2
          className="
          text-2xl
          font-bold
          mb-6
          "
        >
          📉 Needs Attention
        </h2>

        <div className="space-y-4">

          {losers.length === 0 ? (

            <p className="text-gray-400">
              暂无数据
            </p>

          ) : (

            losers.map(
              (
                item: any,
                index: number
              ) => {

                const profitRate =
                  Number(
                    item.profit_rate || 0
                  );

                return (

                  <div
                    key={
                      item.id ??
                      `${item.code}-${index}`
                    }
                    className="
                    flex
                    justify-between
                    border-b
                    pb-3
                    "
                  >

                    <div>

                      <div className="font-bold">
                        {item.name}
                      </div>

                      <div className="text-sm text-gray-500">
                        {item.market}
                      </div>

                    </div>

                    <div
                      className={`
                        font-bold
                        ${
                          profitRate >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      `}
                    >

                      {profitRate >= 0
                        ? "+"
                        : ""}

                      {profitRate.toFixed(2)}
                      %

                    </div>

                  </div>

                );
              }
            )

          )}

        </div>

      </div>

    </div>
  );
}
