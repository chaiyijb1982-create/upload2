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

type AssetType =
  | "太平洋年金"
  | "平安好福利";


type RetirementAsset = {
  id: string;
  asset_type: AssetType;
  current_value: number;
  note: string;
  created_at?: string;
  updated_at?: string;
};


type RetirementHistory = {
  id: string;
  asset_type: AssetType;
  year: number;
  value: number;
  note: string;
  created_at?: string;
  updated_at?: string;
};


// =====================================================
// 常量
// =====================================================

const ASSET_TYPES: AssetType[] = [
  "太平洋年金",
  "平安好福利",
];


// =====================================================
// 工具函数
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


function money(
  value: number
): string {

  const n =
    toNumber(value);

  if (
    n >= 100000000
  ) {

    return (
      "¥" +
      (
        n /
        100000000
      ).toFixed(2) +
      " 亿"
    );

  }


  if (
    n >= 10000
  ) {

    return (
      "¥" +
      (
        n /
        10000
      ).toFixed(1) +
      " 万"
    );

  }


  return (
    "¥" +
    Math.round(n)
      .toLocaleString(
        "zh-CN"
      )
  );
}


function inputNumber(
  value: any
): string {

  const n =
    toNumber(value);

  return String(n);
}


// =====================================================
// 页面
// =====================================================

export default function RetirementPage() {


  // ===================================================
  // 当前实际价值
  // ===================================================

  const [
    assets,
    setAssets,
  ] = useState<
    RetirementAsset[]
  >([]);


  // ===================================================
  // 年度历史
  // ===================================================

  const [
    histories,
    setHistories,
  ] = useState<
    RetirementHistory[]
  >([]);


  // ===================================================
  // Loading
  // ===================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  // ===================================================
  // 当前资产编辑
  // ===================================================

  const [
    editingAssetId,
    setEditingAssetId,
  ] = useState<
    string | null
  >(null);


  const [
    editingAssetValue,
    setEditingAssetValue,
  ] = useState("");


  const [
    editingAssetNote,
    setEditingAssetNote,
  ] = useState("");


  // ===================================================
  // 年度历史新增
  // ===================================================

  const [
    historyType,
    setHistoryType,
  ] = useState<AssetType>(
    "太平洋年金"
  );


  const [
    historyYear,
    setHistoryYear,
  ] = useState(
    new Date().getFullYear()
  );


  const [
    historyValue,
    setHistoryValue,
  ] = useState("");


  const [
    historyNote,
    setHistoryNote,
  ] = useState("");


  // ===================================================
  // 年度历史编辑
  // ===================================================

  const [
    editingHistoryId,
    setEditingHistoryId,
  ] = useState<
    string | null
  >(null);


  const [
    editingHistoryYear,
    setEditingHistoryYear,
  ] = useState("");


  const [
    editingHistoryValue,
    setEditingHistoryValue,
  ] = useState("");


  const [
    editingHistoryNote,
    setEditingHistoryNote,
  ] = useState("");


  // ===================================================
  // 保存状态
  // ===================================================

  const [
    saving,
    setSaving,
  ] = useState(false);


  // ===================================================
  // 加载
  // ===================================================

  async function loadData() {

    try {

      setLoading(true);


      // ===============================================
      // 当前实际价值
      // ===============================================

      const {
        data: assetData,
        error: assetError,
      } =
        await supabase
          .from(
            "retirement_assets"
          )
          .select("*")
          .order(
            "created_at",
            {
              ascending: true,
            }
          );


      if (
        assetError
      ) {

        console.error(
          "读取 retirement_assets 失败:",
          assetError
        );

        throw assetError;

      }


      // ===============================================
      // 年度历史
      // ===============================================

      const {
        data: historyData,
        error: historyError,
      } =
        await supabase
          .from(
            "retirement_asset_history"
          )
          .select("*")
          .order(
            "year",
            {
              ascending: false,
            }
          );


      if (
        historyError
      ) {

        console.error(
          "读取 retirement_asset_history 失败:",
          historyError
        );

        throw historyError;

      }


      // ===============================================
      // 安全转换
      // ===============================================

      const safeAssets =
        (
          Array.isArray(
            assetData
          )
            ? assetData
            : []
        ).filter(
          (
            item: any
          ) =>
            ASSET_TYPES.includes(
              item?.asset_type
            )
        ).map(
          (
            item: any
          ) => ({

            ...item,

            current_value:
              toNumber(
                item?.current_value
              ),

            note:
              item?.note || "",

          })
        );


      const safeHistories =
        (
          Array.isArray(
            historyData
          )
            ? historyData
            : []
        ).filter(
          (
            item: any
          ) =>
            ASSET_TYPES.includes(
              item?.asset_type
            )
        ).map(
          (
            item: any
          ) => ({

            ...item,

            year:
              Number(
                item?.year
              ),

            value:
              toNumber(
                item?.value
              ),

            note:
              item?.note || "",

          })
        );


      setAssets(
        safeAssets
      );


      setHistories(
        safeHistories
      );


    }
    catch (
      error
    ) {

      console.error(
        "退休规划加载失败:",
        error
      );

    }
    finally {

      setLoading(false);

    }

  }


  // ===================================================
  // 首次加载
  // ===================================================

  useEffect(
    () => {

      loadData();

    },
    []
  );


  // ===================================================
  // 获取当前资产
  // ===================================================

  function getAsset(
    type: AssetType
  ) {

    return assets.find(
      (
        item
      ) =>
        item.asset_type === type
    );

  }


  // ===================================================
  // 当前实际价值总值
  //
  // 注意：
  // retirement_assets 表本身没有数据库字段记录
  // 是否计入总值。
  //
  // 所以这里使用 localStorage 保存勾选状态。
  // ===================================================

  const [
    includeInTotal,
    setIncludeInTotal,
  ] = useState<
    Record<
      AssetType,
      boolean
    >
  >({

    "太平洋年金":
      true,

    "平安好福利":
      true,

  });


  // ===================================================
  // 读取计入总值设置
  // ===================================================

  useEffect(
    () => {

      try {

        const saved =
          localStorage.getItem(
            "retirement_include_in_total"
          );


        if (
          saved
        ) {

          const parsed =
            JSON.parse(
              saved
            );


          if (
            parsed &&
            typeof parsed ===
            "object"
          ) {

            setIncludeInTotal({

              "太平洋年金":
                parsed[
                  "太平洋年金"
                ] !== false,

              "平安好福利":
                parsed[
                  "平安好福利"
                ] !== false,

            });

          }

        }

      }
      catch {

        // 忽略 localStorage 错误

      }

    },
    []
  );


  // ===================================================
  // 当前退休规划总值
  // ===================================================

  const retirementTotal =
    useMemo(
      () => {

        return ASSET_TYPES.reduce(
          (
            total,
            type
          ) => {

            if (
              !includeInTotal[
                type
              ]
            ) {

              return total;

            }


            const asset =
              assets.find(
                (
                  item
                ) =>
                  item.asset_type ===
                  type
              );


            return (
              total +
              toNumber(
                asset?.current_value
              )
            );

          },
          0
        );

      },
      [
        assets,
        includeInTotal,
      ]
    );


  // ===================================================
  // 切换计入总值
  // ===================================================

  function toggleInclude(
    type: AssetType
  ) {

    setIncludeInTotal(
      (
        previous
      ) => {

        const next = {

          ...previous,

          [type]:
            !previous[type],

        };


        try {

          localStorage.setItem(
            "retirement_include_in_total",
            JSON.stringify(
              next
            )
          );

        }
        catch {

          // ignore

        }


        return next;

      }
    );

  }


  // ===================================================
  // 开始编辑当前资产
  // ===================================================

  function startEditAsset(
    asset: RetirementAsset
  ) {

    setEditingAssetId(
      asset.id
    );


    setEditingAssetValue(
      inputNumber(
        asset.current_value
      )
    );


    setEditingAssetNote(
      asset.note || ""
    );

  }


  // ===================================================
  // 取消编辑当前资产
  // ===================================================

  function cancelEditAsset() {

    setEditingAssetId(
      null
    );


    setEditingAssetValue(
      ""
    );


    setEditingAssetNote(
      ""
    );

  }


  // ===================================================
  // 保存当前资产
  // ===================================================

  async function saveAsset(
    asset: RetirementAsset
  ) {

    try {

      setSaving(true);


      const value =
        toNumber(
          editingAssetValue
        );


      const {
        data,
        error,
      } =
        await supabase
          .from(
            "retirement_assets"
          )
          .update({

            current_value:
              value,

            note:
              editingAssetNote || "",

            updated_at:
              new Date()
                .toISOString(),

          })
          .eq(
            "id",
            asset.id
          )
          .select()
          .single();


      if (
        error
      ) {

        console.error(
          "保存当前实际价值失败:",
          error
        );

        alert(
          "当前值保存失败，请检查数据库或 RLS Policy。"
        );

        return;

      }


      setAssets(
        (
          previous
        ) =>
          previous.map(
            (
              item
            ) =>
              item.id === asset.id
                ? {

                    ...item,

                    ...data,

                    current_value:
                      toNumber(
                        data?.current_value
                      ),

                  }
                : item
          )
      );


      cancelEditAsset();


    }
    catch (
      error
    ) {

      console.error(
        "保存当前资产失败:",
        error
      );

      alert(
        "当前值保存失败，请检查数据库或 RLS Policy。"
      );

    }
    finally {

      setSaving(false);

    }

  }


  // ===================================================
  // 新增年度历史
  // ===================================================

  async function saveHistory() {

    try {

      setSaving(true);


      const year =
        Number(
          historyYear
        );


      const value =
        toNumber(
          historyValue
        );


      if (
        !Number.isFinite(
          year
        ) ||
        year < 1900 ||
        year > 2100
      ) {

        alert(
          "请输入正确的年份。"
        );

        return;

      }


      // ===============================================
      // 检查同一资产同一年是否已经存在
      // ===============================================

      const existing =
        histories.find(
          (
            item
          ) =>
            item.asset_type ===
              historyType &&
            item.year ===
              year
        );


      if (
        existing
      ) {

        alert(
          `${historyType} ${year} 年已经有记录，请直接编辑。`
        );

        return;

      }


      const {
        data,
        error,
      } =
        await supabase
          .from(
            "retirement_asset_history"
          )
          .insert({

            asset_type:
              historyType,

            year:
              year,

            value:
              value,

            note:
              historyNote || "",

            created_at:
              new Date()
                .toISOString(),

            updated_at:
              new Date()
                .toISOString(),

          })
          .select()
          .single();


      if (
        error
      ) {

        console.error(
          "新增年度历史失败:",
          error
        );

        alert(
          "新增年度历史失败，请检查数据库或 RLS Policy。"
        );

        return;

      }


      setHistories(
        (
          previous
        ) => [

          ...previous,

          {

            ...data,

            year:
              Number(
                data?.year
              ),

            value:
              toNumber(
                data?.value
              ),

            note:
              data?.note || "",

          },

        ].sort(
          (
            a,
            b
          ) =>
            b.year -
            a.year
        )
      );


      setHistoryValue(
        ""
      );


      setHistoryNote(
        ""
      );


    }
    catch (
      error
    ) {

      console.error(
        "新增年度历史异常:",
        error
      );

      alert(
        "新增年度历史失败，请检查数据库或 RLS Policy。"
      );

    }
    finally {

      setSaving(false);

    }

  }


  // ===================================================
  // 开始编辑历史
  // ===================================================

  function startEditHistory(
    history: RetirementHistory
  ) {

    setEditingHistoryId(
      history.id
    );


    setEditingHistoryYear(
      String(
        history.year
      )
    );


    setEditingHistoryValue(
      inputNumber(
        history.value
      )
    );


    setEditingHistoryNote(
      history.note || ""
    );

  }


  // ===================================================
  // 取消编辑历史
  // ===================================================

  function cancelEditHistory() {

    setEditingHistoryId(
      null
    );


    setEditingHistoryYear(
      ""
    );


    setEditingHistoryValue(
      ""
    );


    setEditingHistoryNote(
      ""
    );

  }


  // ===================================================
  // 保存历史编辑
  // ===================================================

  async function updateHistory(
    history: RetirementHistory
  ) {

    try {

      setSaving(true);


      const year =
        Number(
          editingHistoryYear
        );


      const value =
        toNumber(
          editingHistoryValue
        );


      if (
        !Number.isFinite(
          year
        ) ||
        year < 1900 ||
        year > 2100
      ) {

        alert(
          "请输入正确的年份。"
        );

        return;

      }


      // ===============================================
      // 检查重复
      // ===============================================

      const duplicate =
        histories.find(
          (
            item
          ) =>
            item.id !==
              history.id &&
            item.asset_type ===
              history.asset_type &&
            item.year ===
              year
        );


      if (
        duplicate
      ) {

        alert(
          `${history.asset_type} ${year} 年已经存在。`
        );

        return;

      }


      const {
        data,
        error,
      } =
        await supabase
          .from(
            "retirement_asset_history"
          )
          .update({

            year:
              year,

            value:
              value,

            note:
              editingHistoryNote || "",

            updated_at:
              new Date()
                .toISOString(),

          })
          .eq(
            "id",
            history.id
          )
          .select()
          .single();


      if (
        error
      ) {

        console.error(
          "编辑年度历史失败:",
          error
        );

        alert(
          "编辑年度历史失败，请检查数据库或 RLS Policy。"
        );

        return;

      }


      setHistories(
        (
          previous
        ) =>
          previous
            .map(
              (
                item
              ) =>
                item.id ===
                  history.id
                  ? {

                      ...item,

                      ...data,

                      year:
                        Number(
                          data?.year
                        ),

                      value:
                        toNumber(
                          data?.value
                        ),

                      note:
                        data?.note || "",

                    }
                  : item
            )
            .sort(
              (
                a,
                b
              ) =>
                b.year -
                a.year
            )
      );


      cancelEditHistory();


    }
    catch (
      error
    ) {

      console.error(
        "编辑年度历史异常:",
        error
      );

      alert(
        "编辑年度历史失败，请检查数据库或 RLS Policy。"
      );

    }
    finally {

      setSaving(false);

    }

  }


  // ===================================================
  // 删除年度历史
  // ===================================================

  async function deleteHistory(
    history: RetirementHistory
  ) {

    const confirmed =
      window.confirm(
        `确定删除 ${history.asset_type} ${history.year} 年底的记录吗？`
      );


    if (
      !confirmed
    ) {

      return;

    }


    try {

      setSaving(true);


      const {
        error,
      } =
        await supabase
          .from(
            "retirement_asset_history"
          )
          .delete()
          .eq(
            "id",
            history.id
          );


      if (
        error
      ) {

        console.error(
          "删除年度历史失败:",
          error
        );

        alert(
          "删除失败，请检查数据库或 RLS Policy。"
        );

        return;

      }


      setHistories(
        (
          previous
        ) =>
          previous.filter(
            (
              item
            ) =>
              item.id !==
              history.id
          )
      );


    }
    catch (
      error
    ) {

      console.error(
        "删除年度历史异常:",
        error
      );

      alert(
        "删除失败，请检查数据库或 RLS Policy。"
      );

    }
    finally {

      setSaving(false);

    }

  }


  // ===================================================
  // 根据类型获取历史
  // ===================================================

  function getHistories(
    type: AssetType
  ) {

    return histories
      .filter(
        (
          item
        ) =>
          item.asset_type ===
          type
      )
      .sort(
        (
          a,
          b
        ) =>
          b.year -
          a.year
      );

  }


  // ===================================================
  // Loading
  // ===================================================

  if (
    loading
  ) {

    return (

      <>

        <TopBar
          title="退休规划"
        />


        <main
          className="
            p-10
            max-w-[1600px]
            mx-auto
          "
        >

          正在加载退休规划...

        </main>

      </>

    );

  }


  // ===================================================
  // 页面
  // ===================================================

  return (

    <>

      <TopBar
        title="退休规划"
      />


      <main
        className="
          p-8
          max-w-[1600px]
          mx-auto
          space-y-8
        "
      >


        {/* =================================================
            标题
            ================================================= */}

        <section>

          <h1
            className="
              text-3xl
              font-bold
              text-gray-900
            "
          >

            🏖️ 退休规划

          </h1>


          <p
            className="
              mt-2
              text-gray-500
            "
          >

            太平洋年金与平安好福利当前价值及年度历史

          </p>

        </section>


        {/* =================================================
            当前总值
            ================================================= */}

        <section
          className="
            bg-white
            border
            rounded-2xl
            shadow-sm
            p-8
          "
        >

          <div
            className="
              flex
              flex-col
              md:flex-row
              md:items-center
              md:justify-between
              gap-6
            "
          >

            <div>

              <p
                className="
                  text-gray-500
                  text-sm
                "
              >

                退休规划当前计入总值

              </p>


              <h2
                className="
                  text-4xl
                  font-bold
                  text-blue-700
                  mt-2
                "
              >

                {
                  money(
                    retirementTotal
                  )
                }

              </h2>

            </div>


            <div
              className="
                text-sm
                text-gray-500
                leading-7
              "
            >

              <p>

                只计算勾选「计入总值」的当前实际价值。

              </p>


              <p>

                年度历史用于记录每年 12 月底的资产金额。

              </p>

            </div>

          </div>

        </section>


        {/* =================================================
            当前实际价值
            ================================================= */}

        <section>

          <div
            className="
              mb-4
            "
          >

            <h2
              className="
                text-xl
                font-bold
                text-gray-900
              "
            >

              💰 当前实际价值

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-1
              "
            >

              当前实际金额可以随时编辑，并可以选择是否计入退休规划总值。

            </p>

          </div>


          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              gap-6
            "
          >

            {
              ASSET_TYPES.map(
                (
                  type
                ) => {

                  const asset =
                    getAsset(
                      type
                    );


                  const isEditing =
                    editingAssetId ===
                    asset?.id;


                  return (

                    <div
                      key={
                        type
                      }
                      className="
                        bg-white
                        border
                        rounded-2xl
                        shadow-sm
                        p-7
                      "
                    >

                      <div
                        className="
                          flex
                          items-center
                          justify-between
                          gap-4
                        "
                      >

                        <div>

                          <p
                            className="
                              text-sm
                              text-gray-500
                            "
                          >

                            {type}

                          </p>


                          {
                            !isEditing && (

                              <h3
                                className="
                                  text-3xl
                                  font-bold
                                  mt-2
                                "
                              >

                                {
                                  money(
                                    asset?.current_value ||
                                    0
                                  )
                                }

                              </h3>

                            )
                          }

                        </div>


                        <label
                          className="
                            flex
                            items-center
                            gap-2
                            text-sm
                            cursor-pointer
                          "
                        >

                          <input
                            type="checkbox"
                            checked={
                              includeInTotal[
                                type
                              ]
                            }
                            onChange={() =>
                              toggleInclude(
                                type
                              )
                            }
                            className="
                              w-4
                              h-4
                            "
                          />


                          <span>

                            计入总值

                          </span>

                        </label>

                      </div>


                      {
                        isEditing && (

                          <div
                            className="
                              mt-6
                              space-y-4
                            "
                          >

                            <div>

                              <label
                                className="
                                  block
                                  text-sm
                                  text-gray-500
                                  mb-2
                                "
                              >

                                当前实际价值

                              </label>


                              <input
                                type="number"
                                value={
                                  editingAssetValue
                                }
                                onChange={
                                  (
                                    e
                                  ) =>
                                    setEditingAssetValue(
                                      e.target.value
                                    )
                                }
                                className="
                                  w-full
                                  border
                                  rounded-xl
                                  px-4
                                  py-3
                                  outline-none
                                  focus:ring-2
                                  focus:ring-blue-200
                                "
                              />

                            </div>


                            <div>

                              <label
                                className="
                                  block
                                  text-sm
                                  text-gray-500
                                  mb-2
                                "
                              >

                                备注

                              </label>


                              <input
                                type="text"
                                value={
                                  editingAssetNote
                                }
                                onChange={
                                  (
                                    e
                                  ) =>
                                    setEditingAssetNote(
                                      e.target.value
                                    )
                                }
                                className="
                                  w-full
                                  border
                                  rounded-xl
                                  px-4
                                  py-3
                                  outline-none
                                "
                              />

                            </div>


                            <div
                              className="
                                flex
                                gap-3
                              "
                            >

                              <button
                                type="button"
                                disabled={
                                  saving
                                }
                                onClick={() =>
                                  asset &&
                                  saveAsset(
                                    asset
                                  )
                                }
                                className="
                                  px-5
                                  py-2.5
                                  rounded-xl
                                  bg-blue-600
                                  text-white
                                  font-medium
                                  hover:bg-blue-700
                                  disabled:opacity-50
                                "
                              >

                                保存

                              </button>


                              <button
                                type="button"
                                onClick={
                                  cancelEditAsset
                                }
                                className="
                                  px-5
                                  py-2.5
                                  rounded-xl
                                  bg-gray-100
                                  text-gray-700
                                  font-medium
                                "
                              >

                                取消

                              </button>

                            </div>

                          </div>

                        )
                      }


                      {
                        !isEditing && (

                          <div
                            className="
                              mt-5
                              flex
                              items-center
                              justify-between
                              gap-4
                            "
                          >

                            <p
                              className="
                                text-xs
                                text-gray-400
                              "
                            >

                              {
                                asset?.note ||
                                "暂无备注"
                              }

                            </p>


                            <button
                              type="button"
                              onClick={() =>
                                asset &&
                                startEditAsset(
                                  asset
                                )
                              }
                              className="
                                px-4
                                py-2
                                rounded-lg
                                bg-gray-100
                                text-gray-700
                                text-sm
                                hover:bg-gray-200
                              "
                            >

                              编辑

                            </button>

                          </div>

                        )
                      }

                    </div>

                  );

                }
              )
            }

          </div>

        </section>


        {/* =================================================
            年度历史
            ================================================= */}

        <section>

          <div
            className="
              mb-4
            "
          >

            <h2
              className="
                text-xl
                font-bold
                text-gray-900
              "
            >

              📊 年度历史

            </h2>


            <p
              className="
                text-sm
                text-gray-400
                mt-1
              "
            >

              每年 12 月底记录一次，两个资产分别独立管理。

            </p>

          </div>


          <div
            className="
              grid
              grid-cols-1
              xl:grid-cols-2
              gap-6
            "
          >


            {/* =================================================
                太平洋年金
                ================================================= */}

            <div
              className="
                bg-white
                border
                rounded-2xl
                shadow-sm
                overflow-hidden
              "
            >

              <div
                className="
                  p-6
                  border-b
                  bg-blue-50
                "
              >

                <h3
                  className="
                    text-lg
                    font-bold
                    text-blue-900
                  "
                >

                  太平洋年金｜年度历史

                </h3>


                <p
                  className="
                    text-sm
                    text-blue-600
                    mt-1
                  "
                >

                  每年 12 月底的总价值

                </p>

              </div>


              <HistoryTable
                histories={
                  getHistories(
                    "太平洋年金"
                  )
                }
                editingHistoryId={
                  editingHistoryId
                }
                editingHistoryYear={
                  editingHistoryYear
                }
                editingHistoryValue={
                  editingHistoryValue
                }
                editingHistoryNote={
                  editingHistoryNote
                }
                saving={
                  saving
                }
                onEdit={
                  startEditHistory
                }
                onDelete={
                  deleteHistory
                }
                onSave={
                  updateHistory
                }
                onCancel={
                  cancelEditHistory
                }
                setYear={
                  setEditingHistoryYear
                }
                setValue={
                  setEditingHistoryValue
                }
                setNote={
                  setEditingHistoryNote
                }
              />

            </div>


            {/* =================================================
                平安好福利
                ================================================= */}

            <div
              className="
                bg-white
                border
                rounded-2xl
                shadow-sm
                overflow-hidden
              "
            >

              <div
                className="
                  p-6
                  border-b
                  bg-green-50
                "
              >

                <h3
                  className="
                    text-lg
                    font-bold
                    text-green-900
                  "
                >

                  平安好福利｜年度历史

                </h3>


                <p
                  className="
                    text-sm
                    text-green-600
                    mt-1
                  "
                >

                  每年 12 月底的总价值

                </p>

              </div>


              <HistoryTable
                histories={
                  getHistories(
                    "平安好福利"
                  )
                }
                editingHistoryId={
                  editingHistoryId
                }
                editingHistoryYear={
                  editingHistoryYear
                }
                editingHistoryValue={
                  editingHistoryValue
                }
                editingHistoryNote={
                  editingHistoryNote
                }
                saving={
                  saving
                }
                onEdit={
                  startEditHistory
                }
                onDelete={
                  deleteHistory
                }
                onSave={
                  updateHistory
                }
                onCancel={
                  cancelEditHistory
                }
                setYear={
                  setEditingHistoryYear
                }
                setValue={
                  setEditingHistoryValue
                }
                setNote={
                  setEditingHistoryNote
                }
              />

            </div>

          </div>

        </section>


        {/* =================================================
            新增年度历史
            ================================================= */}

        <section
          className="
            bg-white
            border
            rounded-2xl
            shadow-sm
            p-7
          "
        >

          <h2
            className="
              text-xl
              font-bold
            "
          >

            ➕ 新增年度历史

          </h2>


          <p
            className="
              text-sm
              text-gray-400
              mt-1
            "
          >

            记录某项资产某一年 12 月底的实际价值。

          </p>


          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-4
              gap-4
              mt-6
            "
          >

            {/* 资产 */}

            <div>

              <label
                className="
                  block
                  text-sm
                  text-gray-500
                  mb-2
                "
              >

                资产

              </label>


              <select
                value={
                  historyType
                }
                onChange={
                  (
                    e
                  ) =>
                    setHistoryType(
                      e.target.value as AssetType
                    )
                }
                className="
                  w-full
                  border
                  rounded-xl
                  px-4
                  py-3
                  bg-white
                "
              >

                {
                  ASSET_TYPES.map(
                    (
                      type
                    ) => (

                      <option
                        key={
                          type
                        }
                        value={
                          type
                        }
                      >

                        {type}

                      </option>

                    )
                  )
                }

              </select>

            </div>


            {/* 年份 */}

            <div>

              <label
                className="
                  block
                  text-sm
                  text-gray-500
                  mb-2
                "
              >

                年份

              </label>


              <input
                type="number"
                value={
                  historyYear
                }
                onChange={
                  (
                    e
                  ) =>
                    setHistoryYear(
                      Number(
                        e.target.value
                      )
                    )
                }
                className="
                  w-full
                  border
                  rounded-xl
                  px-4
                  py-3
                "
              />

            </div>


            {/* 金额 */}

            <div>

              <label
                className="
                  block
                  text-sm
                  text-gray-500
                  mb-2
                "
              >

                12 月底价值

              </label>


              <input
                type="number"
                value={
                  historyValue
                }
                onChange={
                  (
                    e
                  ) =>
                    setHistoryValue(
                      e.target.value
                    )
                }
                placeholder="例如 500000"
                className="
                  w-full
                  border
                  rounded-xl
                  px-4
                  py-3
                "
              />

            </div>


            {/* 按钮 */}

            <div
              className="
                flex
                items-end
              "
            >

              <button
                type="button"
                disabled={
                  saving
                }
                onClick={
                  saveHistory
                }
                className="
                  w-full
                  px-5
                  py-3
                  rounded-xl
                  bg-blue-600
                  text-white
                  font-medium
                  hover:bg-blue-700
                  disabled:opacity-50
                "
              >

                保存年度记录

              </button>

            </div>

          </div>


          <div
            className="
              mt-4
            "
          >

            <label
              className="
                block
                text-sm
                text-gray-500
                mb-2
              "
            >

              备注

            </label>


            <input
              type="text"
              value={
                historyNote
              }
              onChange={
                (
                  e
                ) =>
                  setHistoryNote(
                    e.target.value
                  )
              }
              placeholder="可选"
              className="
                w-full
                border
                rounded-xl
                px-4
                py-3
              "
            />

          </div>

        </section>


        {/* =================================================
            说明
            ================================================= */}

        <section
          className="
            bg-indigo-50
            border
            border-indigo-100
            rounded-2xl
            p-6
            text-sm
            text-indigo-800
            leading-7
          "
        >

          <h3
            className="
              font-bold
              mb-2
            "
          >

            📐 退休规划说明

          </h3>


          <p>

            <b>
              当前实际价值
            </b>
            ：记录目前实际可以拿到的资产价值。

          </p>


          <p>

            <b>
              计入总值
            </b>
            ：勾选后，该资产当前实际价值会计入上方「退休规划当前计入总值」。

          </p>


          <p>

            <b>
              年度历史
            </b>
            ：每年记录一次 12 月底的实际价值，用于以后观察退休资产增长趋势。

          </p>


          <p>

            太平洋年金和
            平安好福利的年度历史完全独立，不会互相覆盖。

          </p>

        </section>


      </main>

    </>

  );

}


// =====================================================
// 年度历史表格
// =====================================================

type HistoryTableProps = {

  histories:
    RetirementHistory[];

  editingHistoryId:
    string | null;

  editingHistoryYear:
    string;

  editingHistoryValue:
    string;

  editingHistoryNote:
    string;

  saving:
    boolean;

  onEdit:
    (
      history: RetirementHistory
    ) => void;

  onDelete:
    (
      history: RetirementHistory
    ) => void;

  onSave:
    (
      history: RetirementHistory
    ) => void;

  onCancel:
    () => void;

  setYear:
    (
      value: string
    ) => void;

  setValue:
    (
      value: string
    ) => void;

  setNote:
    (
      value: string
    ) => void;

};


function HistoryTable(
  props: HistoryTableProps
) {

  const {

    histories,

    editingHistoryId,

    editingHistoryYear,

    editingHistoryValue,

    editingHistoryNote,

    saving,

    onEdit,

    onDelete,

    onSave,

    onCancel,

    setYear,

    setValue,

    setNote,

  } = props;


  if (
    histories.length === 0
  ) {

    return (

      <div
        className="
          p-8
          text-center
          text-gray-400
        "
      >

        暂无年度历史记录

      </div>

    );

  }


  return (

    <div
      className="
        overflow-x-auto
      "
    >

      <table
        className="
          w-full
          text-sm
        "
      >

        <thead
          className="
            bg-gray-50
            border-b
          "
        >

          <tr>

            <th
              className="
                px-5
                py-4
                text-left
                whitespace-nowrap
              "
            >

              年份

            </th>


            <th
              className="
                px-5
                py-4
                text-right
                whitespace-nowrap
              "
            >

              12月底价值

            </th>


            <th
              className="
                px-5
                py-4
                text-left
                whitespace-nowrap
              "
            >

              备注

            </th>


            <th
              className="
                px-5
                py-4
                text-right
                whitespace-nowrap
              "
            >

              操作

            </th>

          </tr>

        </thead>


        <tbody>

          {
            histories.map(
              (
                history
              ) => {

                const editing =
                  editingHistoryId ===
                  history.id;


                if (
                  editing
                ) {

                  return (

                    <tr
                      key={
                        history.id
                      }
                      className="
                        border-b
                        bg-yellow-50
                      "
                    >

                      <td
                        className="
                          px-5
                          py-4
                        "
                      >

                        <input
                          type="number"
                          value={
                            editingHistoryYear
                          }
                          onChange={
                            (
                              e
                            ) =>
                              setYear(
                                e.target.value
                              )
                          }
                          className="
                            w-24
                            border
                            rounded-lg
                            px-3
                            py-2
                          "
                        />

                      </td>


                      <td
                        className="
                          px-5
                          py-4
                        "
                      >

                        <input
                          type="number"
                          value={
                            editingHistoryValue
                          }
                          onChange={
                            (
                              e
                            ) =>
                              setValue(
                                e.target.value
                              )
                          }
                          className="
                            w-36
                            border
                            rounded-lg
                            px-3
                            py-2
                            text-right
                          "
                        />

                      </td>


                      <td
                        className="
                          px-5
                          py-4
                        "
                      >

                        <input
                          type="text"
                          value={
                            editingHistoryNote
                          }
                          onChange={
                            (
                              e
                            ) =>
                              setNote(
                                e.target.value
                              )
                          }
                          className="
                            w-full
                            min-w-[160px]
                            border
                            rounded-lg
                            px-3
                            py-2
                          "
                        />

                      </td>


                      <td
                        className="
                          px-5
                          py-4
                        "
                      >

                        <div
                          className="
                            flex
                            justify-end
                            gap-2
                          "
                        >

                          <button
                            type="button"
                            disabled={
                              saving
                            }
                            onClick={() =>
                              onSave(
                                history
                              )
                            }
                            className="
                              px-3
                              py-2
                              rounded-lg
                              bg-blue-600
                              text-white
                              text-xs
                              disabled:opacity-50
                            "
                          >

                            保存

                          </button>


                          <button
                            type="button"
                            onClick={
                              onCancel
                            }
                            className="
                              px-3
                              py-2
                              rounded-lg
                              bg-gray-200
                              text-gray-700
                              text-xs
                            "
                          >

                            取消

                          </button>

                        </div>

                      </td>

                    </tr>

                  );

                }


                return (

                  <tr
                    key={
                      history.id
                    }
                    className="
                      border-b
                      last:border-b-0
                      hover:bg-gray-50
                    "
                  >

                    <td
                      className="
                        px-5
                        py-4
                        font-semibold
                      "
                    >

                      {history.year}

                    </td>


                    <td
                      className="
                        px-5
                        py-4
                        text-right
                        font-bold
                      "
                    >

                      {
                        money(
                          history.value
                        )
                      }

                    </td>


                    <td
                      className="
                        px-5
                        py-4
                        text-gray-500
                      "
                    >

                      {
                        history.note ||
                        "—"
                      }

                    </td>


                    <td
                      className="
                        px-5
                        py-4
                      "
                    >

                      <div
                        className="
                          flex
                          justify-end
                          gap-2
                        "
                      >

                        <button
                          type="button"
                          onClick={() =>
                            onEdit(
                              history
                            )
                          }
                          className="
                            px-3
                            py-2
                            rounded-lg
                            bg-gray-100
                            text-gray-700
                            text-xs
                            hover:bg-gray-200
                          "
                        >

                          编辑

                        </button>


                        <button
                          type="button"
                          disabled={
                            saving
                          }
                          onClick={() =>
                            onDelete(
                              history
                            )
                          }
                          className="
                            px-3
                            py-2
                            rounded-lg
                            bg-red-50
                            text-red-600
                            text-xs
                            hover:bg-red-100
                            disabled:opacity-50
                          "
                        >

                          删除

                        </button>

                      </div>

                    </td>

                  </tr>

                );

              }
            )
          }

        </tbody>

      </table>

    </div>

  );

}