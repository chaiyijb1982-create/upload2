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


  // =====================================================
  // 没有数据，不显示
  // =====================================================

  if (
    !allocation ||
    typeof allocation !== "object"
  ) {

    console.log(
      "AssetAllocation: 无数据"
    );

    return null;

  }


  // =====================================================
  // 读取数字
  // =====================================================

  const getValue = (
    value: any
  ) => {

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : 0;

  };


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


  console.log(
    "fixed_income:",
    fixedIncome
  );

  console.log(
    "global_stock:",
    globalStock
  );

  console.log(
    "china_stock:",
    chinaStock
  );

  console.log(
    "gold:",
    gold
  );


  // =====================================================
  // 配置数据
  // =====================================================

  const data = [

    {
      id: "fixed_income",
      name: "固收（债券，现金）",
      value: fixedIncome,
      target: 45,
    },

    {
      id: "global_stock",
      name: "全球股票",
      value: globalStock,
      target: 35,
    },

    {
      id: "china_stock",
      name: "中国股票",
      value: chinaStock,
      target: 5,
    },

    {
      id: "gold",
      name: "黄金",
      value: gold,
      target: 15,
    },

  ];


  // =====================================================
  // 删除 0 数据
  // =====================================================

  const validData =
    data.filter(
      item =>
        item.value > 0
    );


  console.log(
    "最终显示:",
    validData
  );


  // =====================================================
  // 如果全部为 0，不显示
  // =====================================================

  if (
    validData.length === 0
  ) {

    console.log(
      "AssetAllocation: 所有分类都是 0"
    );

    return null;

  }


  // =====================================================
  // 总金额
  // =====================================================

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


  // =====================================================
  // 页面
  // =====================================================

  return (

    <div
      className="
        bg-white
        rounded-2xl
        shadow-sm
        border
        border-gray-100
        p-8
      "
    >

      {/* =================================================
          Header
      ================================================= */}

      <div
        className="
          mb-6
        "
      >

        <h2
          className="
            text-2xl
            font-bold
            text-gray-900
          "
        >

          📊 投资资产 Allocation

        </h2>


        <p
          className="
            text-sm
            text-gray-400
            mt-1
          "
        >

          当前资产配置与目标配置

        </p>

      </div>


      {/* =================================================
          Allocation
      ================================================= */}

      <div
        className="
          space-y-6
        "
      >

        {
          validData.map(
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


              return (

                <div
                  key={item.id}
                >

                  <div
                    className="
                      flex
                      items-center
                      justify-between
                      mb-2
                    "
                  >

                    <span
                      className="
                        font-semibold
                        text-gray-800
                      "
                    >

                      {item.name}

                    </span>


                    <span
                      className="
                        text-sm
                        text-gray-500
                      "
                    >

                      {current.toFixed(1)}%

                      {" / "}

                      目标 {item.target}%

                    </span>

                  </div>


                  <div
                    className="
                      h-3
                      bg-gray-100
                      rounded-full
                      overflow-hidden
                    "
                  >

                    <div
                      className="
                        h-full
                        bg-blue-500
                        rounded-full
                      "
                      style={{
                        width:
                          `${Math.min(
                            current,
                            100
                          )}%`,
                      }}
                    />

                  </div>


                  <div
                    className="
                      mt-2
                      text-xs
                      text-gray-400
                    "
                  >

                    当前{" "}

                    {current.toFixed(1)}%

                    {" · "}

                    偏离目标{" "}

                    {
                      difference >= 0
                        ? "+"
                        : ""
                    }

                    {difference.toFixed(1)}%

                  </div>

                </div>

              );

            }
          )
        }

      </div>

    </div>

  );

}