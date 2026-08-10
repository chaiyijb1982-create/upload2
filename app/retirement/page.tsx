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

type RetirementAsset = {
  id: string;
  asset_type: string;
  current_value: number;
  note: string;
  created_at?: string;
  updated_at?: string;
};


type RetirementHistory = {
  id: string;
  asset_type: string;
  year: number;
  value: number;
  note: string;
  include_total: boolean;
  created_at?: string;
  updated_at?: string;
};


// =====================================================
// 固定类型
// =====================================================

const PACIFIC = "太平洋年金";

const PINGAN = "平安好福利";

const ASSET_TYPES = [
  PACIFIC,
  PINGAN,
];


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


function money(
  value: any
): string {

  const n =
    toNumber(value);

  const abs =
    Math.abs(n);

  let result = "";

  if (
    abs >= 100000000
  ) {

    result =
      "¥" +
      (
        abs /
        100000000
      ).toFixed(2) +
      " 亿";

  }
  else if (
    abs >= 10000
  ) {

    result =
      "¥" +
      (
        abs /
        10000
      ).toFixed(1) +
      " 万";

  }
  else {

    result =
      "¥" +
      Math.round(abs)
        .toLocaleString(
          "zh-CN"
        );

  }


  if (
    n < 0
  ) {

    return "-" + result;

  }


  return result;

}


function inputMoney(
  value: any
): string {

  const n =
    toNumber(value);

  return String(n);

}


function currentYear(): number {

  return new Date()
    .getFullYear();

}


// =====================================================
// 页面
// =====================================================

export default function RetirementPage() {


  // ===================================================
  // 当前资产
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
    history,
    setHistory,
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
  // 保存状态
  // ===================================================

  const [
    saving,
    setSaving,
  ] = useState<string | null>(null);


  // ===================================================
  // 当前值编辑
  // ===================================================

  const [
    currentEditing,
    setCurrentEditing,
  ] = useState<string | null>(null);


  const [
    currentValueInput,
    setCurrentValueInput,
  ] = useState("");


  const [
    currentNoteInput,
    setCurrentNoteInput,
  ] = useState("");


  // ===================================================
  // 当前值是否计入总值
  // ===================================================

  const [
    includeCurrent,
    setIncludeCurrent,
  ] = useState<
    Record<string, boolean>
  >({});


  // ===================================================
  // 新增年度历史
  // ===================================================

  const [
    addingHistory,
    setAddingHistory,
  ] = useState<string | null>(null);


  const [
    newYear,
    setNewYear,
  ] = useState(
    String(
      currentYear()
    )
  );


  const [
    newValue,
    setNewValue,
  ] = useState("");


  const [
    newNote,
    setNewNote,
  ] = useState("");


  const [
    newIncludeTotal,
    setNewIncludeTotal,
  ] = useState(true);


  // ===================================================
  // 编辑年度历史
  // ===================================================

  const [
    editingHistory,
    setEditingHistory,
  ] = useState<string | null>(null);


  const [
    editYear,
    setEditYear,
  ] = useState("");


  const [
    editValue,
    setEditValue,
  ] = useState("");


  const [
    editNote,
    setEditNote,
  ] = useState("");


  const [
    editIncludeTotal,
    setEditIncludeTotal,
  ] = useState(true);


  // ===================================================
  // 消息
  // ===================================================

  const [
    message,
    setMessage,
  ] = useState("");


  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  // ===================================================
  // 获取资产
  // ===================================================

  function getAsset(
    type: string
  ): RetirementAsset | undefined {

    return assets.find(
      item =>
        item.asset_type === type
    );

  }


  // ===================================================
  // 获取历史
  // ===================================================

  function getHistory(
    type: string
  ): RetirementHistory[] {

    return history
      .filter(
        item =>
          item.asset_type === type
      )
      .sort(
        (
          a,
          b
        ) =>
          Number(b.year) -
          Number(a.year)
      );

  }


  // ===================================================
  // 加载数据
  // ===================================================

  async function loadData() {

    try {

      setLoading(true);

      setErrorMessage("");

      // ===============================================
      // 当前资产
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
            "asset_type",
            {
              ascending: true,
            }
          );


      if (
        assetError
      ) {

        console.error(
          "读取退休规划当前值失败:",
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
          "读取退休规划年度历史失败:",
          historyError
        );

        throw historyError;

      }


      const safeAssets =
        Array.isArray(
          assetData
        )
          ? assetData
          : [];


      const safeHistory =
        Array.isArray(
          historyData
        )
          ? historyData
          : [];


      setAssets(
        safeAssets.map(
          (
            item: any
          ) => ({

            ...item,

            current_value:
              toNumber(
                item.current_value
              ),

            note:
              item.note || "",

          })
        )
      );


      setHistory(
        safeHistory.map(
          (
            item: any
          ) => ({

            ...item,

            year:
              Number(
                item.year
              ),

            value:
              toNumber(
                item.value
              ),

            note:
              item.note || "",

            include_total:
              item.include_total !== false,

          })
        )
      );


      // ===============================================
      // 当前值计入总值
      //
      // 如果数据库没有这个字段，
      // 默认 true。
      // ===============================================

      const includeMap:
        Record<
          string,
          boolean
        > = {};


      for (
        const type of ASSET_TYPES
      ) {

        const asset =
          safeAssets.find(
            (
              item: any
            ) =>
              item.asset_type === type
          );


        includeMap[type] =
          asset?.include_total !== false;

      }


      setIncludeCurrent(
        includeMap
      );


    }
    catch (
      error: any
    ) {

      console.error(
        "退休规划加载失败:",
        error
      );


      setErrorMessage(
        "退休规划数据加载失败，请检查数据库或 RLS Policy。"
      );

    }
    finally {

      setLoading(false);

    }

  }


  // ===================================================
  // 初始化
  // ===================================================

  useEffect(
    () => {

      loadData();

    },
    []
  );


  // ===================================================
  // 总值
  //
  // 只计算：
  // 当前实际价值
  // +
  // include_total = true
  // ===================================================

  const totalValue =
    useMemo(
      () => {

        return ASSET_TYPES.reduce(
          (
            sum,
            type
          ) => {

            const asset =
              assets.find(
                item =>
                  item.asset_type === type
              );


            if (
              !asset
            ) {

              return sum;

            }


            if (
              includeCurrent[type] === false
            ) {

              return sum;

            }


            return (
              sum +
              toNumber(
                asset.current_value
              )
            );

          },
          0
        );

      },
      [
        assets,
        includeCurrent,
      ]
    );


  // ===================================================
  // 开始编辑当前值
  // ===================================================

  function startEditCurrent(
    type: string
  ) {

    const asset =
      getAsset(type);


    setCurrentEditing(
      type
    );


    setCurrentValueInput(
      inputMoney(
        asset?.current_value || 0
      )
    );


    setCurrentNoteInput(
      asset?.note || ""
    );


    setErrorMessage("");

    setMessage("");

  }


  // ===================================================
  // 取消编辑当前值
  // ===================================================

  function cancelEditCurrent() {

    setCurrentEditing(
      null
    );

    setCurrentValueInput("");

    setCurrentNoteInput("");

  }


  // ===================================================
  // 保存当前值
  // ===================================================

  async function saveCurrentValue(
    type: string
  ) {

    try {

      setSaving(
        `current-${type}`
      );

      setErrorMessage("");

      setMessage("");


      const value =
        toNumber(
          currentValueInput
        );


      const existing =
        getAsset(type);


      let response;


      // ===============================================
      // 已存在
      // ===============================================

      if (
        existing?.id
      ) {

        response =
          await supabase
            .from(
              "retirement_assets"
            )
            .update({

              current_value:
                value,

              note:
                currentNoteInput || "",

              include_total:
                includeCurrent[type] !== false,

              updated_at:
                new Date()
                  .toISOString(),

            })
            .eq(
              "id",
              existing.id
            )
            .select()
            .single();

      }

      // ===============================================
      // 不存在
      // ===============================================

      else {

        response =
          await supabase
            .from(
              "retirement_assets"
            )
            .insert({

              asset_type:
                type,

              current_value:
                value,

              note:
                currentNoteInput || "",

              include_total:
                includeCurrent[type] !== false,

            })
            .select()
            .single();

      }


      if (
        response.error
      ) {

        console.error(
          "保存当前值失败:",
          response.error
        );

        throw response.error;

      }


      setCurrentEditing(
        null
      );

      setCurrentValueInput("");

      setCurrentNoteInput("");

      setMessage(
        `${type} 当前实际价值已保存`
      );


      await loadData();

    }
    catch (
      error: any
    ) {

      console.error(
        "保存当前值失败:",
        error
      );


      setErrorMessage(
        "当前值保存失败，请检查数据库或 RLS Policy。"
      );

    }
    finally {

      setSaving(
        null
      );

    }

  }


  // ===================================================
  // 修改当前值是否计入总值
  // ===================================================

  async function toggleCurrentInclude(
    type: string,
    checked: boolean
  ) {

    try {

      setErrorMessage("");

      setMessage("");


      setIncludeCurrent(
        previous => ({

          ...previous,

          [type]:
            checked,

        })
      );


      const asset =
        getAsset(type);


      if (
        !asset?.id
      ) {

        return;

      }


      const {
        error,
      } =
        await supabase
          .from(
            "retirement_assets"
          )
          .update({

            include_total:
              checked,

            updated_at:
              new Date()
                .toISOString(),

          })
          .eq(
            "id",
            asset.id
          );


      if (
        error
      ) {

        console.error(
          "修改计入总值状态失败:",
          error
        );

        throw error;

      }


      setMessage(
        `${type} 已${checked ? "计入" : "取消计入"}退休规划总值`
      );

    }
    catch (
      error
    ) {

      console.error(
        error
      );


      setErrorMessage(
        "修改计入总值状态失败，请检查 RLS Policy。"
      );


      // 回滚
      setIncludeCurrent(
        previous => ({

          ...previous,

          [type]:
            !checked,

        })
      );

    }

  }


  // ===================================================
  // 开始新增历史
  // ===================================================

  function startAddHistory(
    type: string
  ) {

    setAddingHistory(
      type
    );


    setNewYear(
      String(
        currentYear()
      )
    );


    setNewValue("");

    setNewNote("");

    setNewIncludeTotal(true);

    setErrorMessage("");

    setMessage("");

  }


  // ===================================================
  // 取消新增
  // ===================================================

  function cancelAddHistory() {

    setAddingHistory(
      null
    );

    setNewYear(
      String(
        currentYear()
      )
    );

    setNewValue("");

    setNewNote("");

    setNewIncludeTotal(true);

  }


  // ===================================================
  // 保存年度历史
  // ===================================================

  async function saveHistory(
    type: string
  ) {

    try {

      setSaving(
        `history-add-${type}`
      );

      setErrorMessage("");

      setMessage("");


      const year =
        Number(
          newYear
        );


      const value =
        toNumber(
          newValue
        );


      if (
        !Number.isFinite(year)
        ||
        year < 1900
        ||
        year > 2100
      ) {

        setErrorMessage(
          "请输入正确的年份。"
        );

        return;

      }


      // ===============================================
      // 检查同类型同年份
      // ===============================================

      const {
        data: existing,
        error: existingError,
      } =
        await supabase
          .from(
            "retirement_asset_history"
          )
          .select("id")
          .eq(
            "asset_type",
            type
          )
          .eq(
            "year",
            year
          )
          .maybeSingle();


      if (
        existingError
      ) {

        throw existingError;

      }


      if (
        existing
      ) {

        setErrorMessage(
          `${type} ${year} 年已经有记录，请直接编辑。`
        );

        return;

      }


      const {
        error,
      } =
        await supabase
          .from(
            "retirement_asset_history"
          )
          .insert({

            asset_type:
              type,

            year:
              year,

            value:
              value,

            note:
              newNote || "",

            include_total:
              newIncludeTotal,

          });


      if (
        error
      ) {

        console.error(
          "新增年度历史失败:",
          error
        );

        throw error;

      }


      setAddingHistory(
        null
      );

      setNewValue("");

      setNewNote("");

      setNewIncludeTotal(true);


      setMessage(
        `${type} ${year} 年度历史已添加`
      );


      await loadData();

    }
    catch (
      error: any
    ) {

      console.error(
        "新增年度历史失败:",
        error
      );


      setErrorMessage(
        "新增年度历史失败，请检查数据库或 RLS Policy。"
      );

    }
    finally {

      setSaving(
        null
      );

    }

  }


  // ===================================================
  // 开始编辑历史
  // ===================================================

  function startEditHistory(
    item: RetirementHistory
  ) {

    setEditingHistory(
      item.id
    );


    setEditYear(
      String(
        item.year
      )
    );


    setEditValue(
      inputMoney(
        item.value
      )
    );


    setEditNote(
      item.note || ""
    );


    setEditIncludeTotal(
      item.include_total !== false
    );


    setErrorMessage("");

    setMessage("");

  }


  // ===================================================
  // 取消编辑历史
  // ===================================================

  function cancelEditHistory() {

    setEditingHistory(
      null
    );

    setEditYear("");

    setEditValue("");

    setEditNote("");

    setEditIncludeTotal(true);

  }


  // ===================================================
  // 保存历史编辑
  // ===================================================

  async function updateHistory(
    item: RetirementHistory
  ) {

    try {

      setSaving(
        `history-edit-${item.id}`
      );

      setErrorMessage("");

      setMessage("");


      const year =
        Number(
          editYear
        );


      const value =
        toNumber(
          editValue
        );


      if (
        !Number.isFinite(year)
        ||
        year < 1900
        ||
        year > 2100
      ) {

        setErrorMessage(
          "请输入正确的年份。"
        );

        return;

      }


      // ===============================================
      // 检查其他记录是否使用相同年份
      // ===============================================

      const {
        data: duplicate,
        error: duplicateError,
      } =
        await supabase
          .from(
            "retirement_asset_history"
          )
          .select("id")
          .eq(
            "asset_type",
            item.asset_type
          )
          .eq(
            "year",
            year
          )
          .neq(
            "id",
            item.id
          )
          .maybeSingle();


      if (
        duplicateError
      ) {

        throw duplicateError;

      }


      if (
        duplicate
      ) {

        setErrorMessage(
          `${item.asset_type} ${year} 年已经存在。`
        );

        return;

      }


      const {
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
              editNote || "",

            include_total:
              editIncludeTotal,

            updated_at:
              new Date()
                .toISOString(),

          })
          .eq(
            "id",
            item.id
          );


      if (
        error
      ) {

        console.error(
          "编辑年度历史失败:",
          error
        );

        throw error;

      }


      setEditingHistory(
        null
      );


      setMessage(
        `${item.asset_type} ${year} 年度历史已更新`
      );


      await loadData();

    }
    catch (
      error: any
    ) {

      console.error(
        "编辑年度历史失败:",
        error
      );


      setErrorMessage(
        "编辑年度历史失败，请检查数据库或 RLS Policy。"
      );

    }
    finally {

      setSaving(
        null
      );

    }

  }


  // ===================================================
  // 删除历史
  // ===================================================

  async function deleteHistory(
    item: RetirementHistory
  ) {

    const confirmed =
      window.confirm(
        `确定删除 ${item.asset_type} ${item.year} 年的年度记录吗？`
      );


    if (
      !confirmed
    ) {

      return;

    }


    try {

      setSaving(
        `history-delete-${item.id}`
      );

      setErrorMessage("");

      setMessage("");


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
            item.id
          );


      if (
        error
      ) {

        console.error(
          "删除年度历史失败:",
          error
        );

        throw error;

      }


      setMessage(
        `${item.asset_type} ${item.year} 年度记录已删除`
      );


      await loadData();

    }
    catch (
      error: any
    ) {

      console.error(
        "删除年度历史失败:",
        error
      );


      setErrorMessage(
        "删除年度历史失败，请检查数据库或 RLS Policy。"
      );

    }
    finally {

      setSaving(
        null
      );

    }

  }


  // ===================================================
  // 当前实际价值
  // ===================================================

  function renderCurrentValue(
    type: string
  ) {

    const asset =
      getAsset(type);


    const value =
      toNumber(
        asset?.current_value
      );


    const isEditing =
      currentEditing === type;


    const included =
      includeCurrent[type] !== false;


    return (

      <div
        className="
          rounded-xl
          border
          bg-gray-50
          p-5
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

              当前实际价值

            </p>


            {
              isEditing
                ? (

                  <div
                    className="
                      mt-3
                      flex
                      flex-wrap
                      items-center
                      gap-3
                    "
                  >

                    <div>

                      <input
                        type="number"
                        value={
                          currentValueInput
                        }
                        onChange={
                          e =>
                            setCurrentValueInput(
                              e.target.value
                            )
                        }
                        className="
                          w-48
                          rounded-lg
                          border
                          bg-white
                          px-3
                          py-2
                          text-lg
                          font-semibold
                          outline-none
                          focus:ring-2
                          focus:ring-blue-500
                        "
                        placeholder="输入当前价值"
                      />

                    </div>

                  </div>

                )
                : (

                  <p
                    className="
                      mt-2
                      text-3xl
                      font-bold
                      text-gray-900
                    "
                  >

                    {
                      money(value)
                    }

                  </p>

                )
            }

          </div>


          {
            !isEditing
              ? (

                <button
                  onClick={() =>
                    startEditCurrent(
                      type
                    )
                  }
                  className="
                    rounded-lg
                    border
                    bg-white
                    px-4
                    py-2
                    text-sm
                    font-medium
                    hover:bg-gray-100
                  "
                >

                  编辑

                </button>

              )
              : null
          }

        </div>


        {
          isEditing
            ? (

              <div
                className="
                  mt-4
                  space-y-3
                "
              >

                <input
                  type="text"
                  value={
                    currentNoteInput
                  }
                  onChange={
                    e =>
                      setCurrentNoteInput(
                        e.target.value
                      )
                  }
                  placeholder="备注（可选）"
                  className="
                    w-full
                    rounded-lg
                    border
                    bg-white
                    px-3
                    py-2
                    outline-none
                    focus:ring-2
                    focus:ring-blue-500
                  "
                />


                <div
                  className="
                    flex
                    flex-wrap
                    gap-3
                  "
                >

                  <button
                    disabled={
                      saving ===
                      `current-${type}`
                    }
                    onClick={() =>
                      saveCurrentValue(
                        type
                      )
                    }
                    className="
                      rounded-lg
                      bg-blue-600
                      px-5
                      py-2
                      text-sm
                      font-semibold
                      text-white
                      hover:bg-blue-700
                      disabled:opacity-50
                    "
                  >

                    {
                      saving ===
                      `current-${type}`
                        ? "保存中..."
                        : "保存"
                    }

                  </button>


                  <button
                    onClick={
                      cancelEditCurrent
                    }
                    className="
                      rounded-lg
                      border
                      bg-white
                      px-5
                      py-2
                      text-sm
                      font-medium
                      hover:bg-gray-100
                    "
                  >

                    取消

                  </button>

                </div>

              </div>

            )
            : null
        }


        <div
          className="
            mt-5
            flex
            items-center
            justify-between
            border-t
            pt-4
          "
        >

          <label
            className="
              flex
              cursor-pointer
              items-center
              gap-3
              text-sm
              font-medium
            "
          >

            <input
              type="checkbox"
              checked={
                included
              }
              onChange={
                e =>
                  toggleCurrentInclude(
                    type,
                    e.target.checked
                  )
              }
              className="
                h-5
                w-5
              "
            />

            计入退休规划总值

          </label>


          {
            included
              ? (

                <span
                  className="
                    rounded-full
                    bg-green-100
                    px-3
                    py-1
                    text-xs
                    font-medium
                    text-green-700
                  "
                >

                  已计入

                </span>

              )
              : (

                <span
                  className="
                    rounded-full
                    bg-gray-200
                    px-3
                    py-1
                    text-xs
                    font-medium
                    text-gray-500
                  "
                >

                  未计入

                </span>

              )
          }

        </div>


        {
          asset?.note
            ? (

              <p
                className="
                  mt-3
                  text-xs
                  text-gray-400
                "
              >

                备注：{asset.note}

              </p>

            )
            : null
        }

      </div>

    );

  }


  // ===================================================
  // 新增历史表单
  // ===================================================

  function renderAddHistory(
    type: string
  ) {

    if (
      addingHistory !== type
    ) {

      return null;

    }


    return (

      <div
        className="
          mt-5
          rounded-xl
          border-2
          border-dashed
          border-blue-200
          bg-blue-50
          p-5
        "
      >

        <div
          className="
            mb-4
            flex
            items-center
            justify-between
          "
        >

          <h4
            className="
              font-semibold
              text-blue-900
            "
          >

            ＋ 添加年度历史

          </h4>

        </div>


        <div
          className="
            grid
            grid-cols-1
            gap-4
            md:grid-cols-4
          "
        >

          <div>

            <label
              className="
                mb-1
                block
                text-xs
                text-gray-500
              "
            >

              年份

            </label>

            <input
              type="number"
              value={
                newYear
              }
              onChange={
                e =>
                  setNewYear(
                    e.target.value
                  )
              }
              className="
                w-full
                rounded-lg
                border
                bg-white
                px-3
                py-2
                outline-none
              "
            />

          </div>


          <div>

            <label
              className="
                mb-1
                block
                text-xs
                text-gray-500
              "
            >

              12月底金额

            </label>

            <input
              type="number"
              value={
                newValue
              }
              onChange={
                e =>
                  setNewValue(
                    e.target.value
                  )
              }
              className="
                w-full
                rounded-lg
                border
                bg-white
                px-3
                py-2
                outline-none
              "
              placeholder="0"
            />

          </div>


          <div>

            <label
              className="
                mb-1
                block
                text-xs
                text-gray-500
              "
            >

              备注

            </label>

            <input
              type="text"
              value={
                newNote
              }
              onChange={
                e =>
                  setNewNote(
                    e.target.value
                  )
              }
              className="
                w-full
                rounded-lg
                border
                bg-white
                px-3
                py-2
                outline-none
              "
              placeholder="可选"
            />

          </div>


          <div
            className="
              flex
              items-end
            "
          >

            <label
              className="
                flex
                items-center
                gap-2
                pb-2
                text-sm
                font-medium
              "
            >

              <input
                type="checkbox"
                checked={
                  newIncludeTotal
                }
                onChange={
                  e =>
                    setNewIncludeTotal(
                      e.target.checked
                    )
                }
                className="
                  h-4
                  w-4
                "
              />

              计入总值

            </label>

          </div>

        </div>


        <div
          className="
            mt-4
            flex
            gap-3
          "
        >

          <button
            disabled={
              saving ===
              `history-add-${type}`
            }
            onClick={() =>
              saveHistory(
                type
              )
            }
            className="
              rounded-lg
              bg-blue-600
              px-5
              py-2
              text-sm
              font-semibold
              text-white
              hover:bg-blue-700
              disabled:opacity-50
            "
          >

            {
              saving ===
              `history-add-${type}`
                ? "保存中..."
                : "保存年度记录"
            }

          </button>


          <button
            onClick={
              cancelAddHistory
            }
            className="
              rounded-lg
              border
              bg-white
              px-5
              py-2
              text-sm
              hover:bg-gray-100
            "
          >

            取消

          </button>

        </div>

      </div>

    );

  }


  // ===================================================
  // 历史列表
  // ===================================================

  function renderHistory(
    type: string
  ) {

    const rows =
      getHistory(type);


    return (

      <div
        className="
          mt-6
        "
      >

        <div
          className="
            flex
            items-center
            justify-between
            border-b
            pb-3
          "
        >

          <div>

            <h3
              className="
                text-lg
                font-bold
                text-gray-900
              "
            >

              {type}｜年度历史

            </h3>


            <p
              className="
                mt-1
                text-xs
                text-gray-400
              "
            >

              每年 12 月底记录

            </p>

          </div>


          <button
            onClick={() =>
              addingHistory === type
                ? cancelAddHistory()
                : startAddHistory(type)
            }
            className="
              rounded-lg
              bg-blue-600
              px-4
              py-2
              text-sm
              font-semibold
              text-white
              hover:bg-blue-700
            "
          >

            {
              addingHistory === type
                ? "取消添加"
                : "＋ 添加年度记录"
            }

          </button>

        </div>


        {
          renderAddHistory(
            type
          )
        }


        <div
          className="
            mt-4
            overflow-x-auto
          "
        >

          {
            rows.length === 0
              ? (

                <div
                  className="
                    rounded-xl
                    border
                    border-dashed
                    p-8
                    text-center
                    text-sm
                    text-gray-400
                  "
                >

                  暂无年度历史记录

                </div>

              )
              : (

                <table
                  className="
                    w-full
                    min-w-[720px]
                    text-sm
                  "
                >

                  <thead>

                    <tr
                      className="
                        border-b
                        bg-gray-50
                      "
                    >

                      <th
                        className="
                          px-4
                          py-3
                          text-left
                        "
                      >

                        年份

                      </th>


                      <th
                        className="
                          px-4
                          py-3
                          text-right
                        "
                      >

                        12月底金额

                      </th>


                      <th
                        className="
                          px-4
                          py-3
                          text-center
                        "
                      >

                        计入总值

                      </th>


                      <th
                        className="
                          px-4
                          py-3
                          text-left
                        "
                      >

                        备注

                      </th>


                      <th
                        className="
                          px-4
                          py-3
                          text-right
                        "
                      >

                        操作

                      </th>

                    </tr>

                  </thead>


                  <tbody>

                    {
                      rows.map(
                        (
                          item
                        ) => {

                          const editing =
                            editingHistory ===
                            item.id;


                          return (

                            <tr
                              key={
                                item.id
                              }
                              className="
                                border-b
                                last:border-b-0
                              "
                            >

                              {
                                editing
                                  ? (

                                    <>

                                      <td
                                        className="
                                          px-4
                                          py-3
                                        "
                                      >

                                        <input
                                          type="number"
                                          value={
                                            editYear
                                          }
                                          onChange={
                                            e =>
                                              setEditYear(
                                                e.target.value
                                              )
                                          }
                                          className="
                                            w-28
                                            rounded-lg
                                            border
                                            px-2
                                            py-2
                                          "
                                        />

                                      </td>


                                      <td
                                        className="
                                          px-4
                                          py-3
                                        "
                                      >

                                        <input
                                          type="number"
                                          value={
                                            editValue
                                          }
                                          onChange={
                                            e =>
                                              setEditValue(
                                                e.target.value
                                              )
                                          }
                                          className="
                                            w-40
                                            rounded-lg
                                            border
                                            px-2
                                            py-2
                                            text-right
                                          "
                                        />

                                      </td>


                                      <td
                                        className="
                                          px-4
                                          py-3
                                          text-center
                                        "
                                      >

                                        <input
                                          type="checkbox"
                                          checked={
                                            editIncludeTotal
                                          }
                                          onChange={
                                            e =>
                                              setEditIncludeTotal(
                                                e.target.checked
                                              )
                                          }
                                          className="
                                            h-5
                                            w-5
                                          "
                                        />

                                      </td>


                                      <td
                                        className="
                                          px-4
                                          py-3
                                        "
                                      >

                                        <input
                                          type="text"
                                          value={
                                            editNote
                                          }
                                          onChange={
                                            e =>
                                              setEditNote(
                                                e.target.value
                                              )
                                          }
                                          className="
                                            w-full
                                            rounded-lg
                                            border
                                            px-2
                                            py-2
                                          "
                                        />

                                      </td>


                                      <td
                                        className="
                                          px-4
                                          py-3
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
                                            disabled={
                                              saving ===
                                              `history-edit-${item.id}`
                                            }
                                            onClick={() =>
                                              updateHistory(
                                                item
                                              )
                                            }
                                            className="
                                              rounded-lg
                                              bg-blue-600
                                              px-3
                                              py-2
                                              text-xs
                                              font-semibold
                                              text-white
                                              disabled:opacity-50
                                            "
                                          >

                                            {
                                              saving ===
                                              `history-edit-${item.id}`
                                                ? "保存中"
                                                : "保存"
                                            }

                                          </button>


                                          <button
                                            onClick={
                                              cancelEditHistory
                                            }
                                            className="
                                              rounded-lg
                                              border
                                              px-3
                                              py-2
                                              text-xs
                                            "
                                          >

                                            取消

                                          </button>

                                        </div>

                                      </td>

                                    </>

                                  )
                                  : (

                                    <>

                                      <td
                                        className="
                                          px-4
                                          py-4
                                          font-semibold
                                        "
                                      >

                                        {item.year}

                                      </td>


                                      <td
                                        className="
                                          px-4
                                          py-4
                                          text-right
                                          font-semibold
                                        "
                                      >

                                        {
                                          money(
                                            item.value
                                          )
                                        }

                                      </td>


                                      <td
                                        className="
                                          px-4
                                          py-4
                                          text-center
                                        "
                                      >

                                        {
                                          item.include_total
                                            ? (

                                              <span
                                                className="
                                                  rounded-full
                                                  bg-green-100
                                                  px-3
                                                  py-1
                                                  text-xs
                                                  font-medium
                                                  text-green-700
                                                "
                                              >

                                                是

                                              </span>

                                            )
                                            : (

                                              <span
                                                className="
                                                  rounded-full
                                                  bg-gray-100
                                                  px-3
                                                  py-1
                                                  text-xs
                                                  font-medium
                                                  text-gray-500
                                                "
                                              >

                                                否

                                              </span>

                                            )
                                        }

                                      </td>


                                      <td
                                        className="
                                          px-4
                                          py-4
                                          text-gray-500
                                        "
                                      >

                                        {
                                          item.note ||
                                          "—"
                                        }

                                      </td>


                                      <td
                                        className="
                                          px-4
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
                                            onClick={() =>
                                              startEditHistory(
                                                item
                                              )
                                            }
                                            className="
                                              rounded-lg
                                              border
                                              px-3
                                              py-2
                                              text-xs
                                              font-medium
                                              hover:bg-gray-50
                                            "
                                          >

                                            编辑

                                          </button>


                                          <button
                                            disabled={
                                              saving ===
                                              `history-delete-${item.id}`
                                            }
                                            onClick={() =>
                                              deleteHistory(
                                                item
                                              )
                                            }
                                            className="
                                              rounded-lg
                                              border
                                              border-red-200
                                              px-3
                                              py-2
                                              text-xs
                                              font-medium
                                              text-red-600
                                              hover:bg-red-50
                                              disabled:opacity-50
                                            "
                                          >

                                            删除

                                          </button>

                                        </div>

                                      </td>

                                    </>

                                  )
                              }

                            </tr>

                          );

                        }
                      )
                    }

                  </tbody>

                </table>

              )
          }

        </div>

      </div>

    );

  }


  // ===================================================
  // 单个资产卡片
  // ===================================================

function renderAssetCard(
  type: string
) {

  return (

    <section
      key={type}
      className="
        rounded-2xl
        border
        bg-white
        p-6
        shadow-sm
      "
    >
        {/* =============================================
            标题
            ============================================= */}

        <div
          className="
            flex
            items-center
            justify-between
            border-b
            pb-5
          "
        >

          <div>

            <h2
              className="
                text-2xl
                font-bold
                text-gray-900
              "
            >

              {type}

            </h2>


            <p
              className="
                mt-1
                text-sm
                text-gray-400
              "
            >

              当前实际价值 + 每年12月底历史

            </p>

          </div>


          <div
            className="
              rounded-full
              bg-blue-50
              px-4
              py-2
              text-sm
              font-medium
              text-blue-700
            "
          >

            独立管理

          </div>

        </div>


        {/* =============================================
            当前实际价值
            ============================================= */}

        <div
          className="
            mt-6
          "
        >

          {
            renderCurrentValue(
              type
            )
          }

        </div>


        {/* =============================================
            年度历史
            ============================================= */}

        {
          renderHistory(
            type
          )
        }

      </section>

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
            mx-auto
            max-w-[1600px]
            p-8
          "
        >

          <div
            className="
              rounded-2xl
              border
              bg-white
              p-10
              text-center
              text-gray-500
            "
          >

            正在加载退休规划数据...

          </div>

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
          mx-auto
          max-w-[1600px]
          space-y-8
          p-8
        "
      >

        {/* =============================================
            页面标题
            ============================================= */}

        <div>

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

            管理太平洋年金、平安好福利的当前实际价值及每年12月底历史数据

          </p>

        </div>


        {/* =============================================
            错误
            ============================================= */}

        {
          errorMessage
            ? (

              <div
                className="
                  rounded-xl
                  border
                  border-red-200
                  bg-red-50
                  p-4
                  text-sm
                  text-red-700
                "
              >

                {errorMessage}

              </div>

            )
            : null
        }


        {/* =============================================
            成功消息
            ============================================= */}

        {
          message
            ? (

              <div
                className="
                  rounded-xl
                  border
                  border-green-200
                  bg-green-50
                  p-4
                  text-sm
                  text-green-700
                "
              >

                {message}

              </div>

            )
            : null
        }


        {/* =============================================
            退休规划总值
            ============================================= */}

        <section
          className="
            rounded-2xl
            border
            bg-white
            p-7
            shadow-sm
          "
        >

          <div
            className="
              flex
              flex-col
              gap-6
              md:flex-row
              md:items-center
              md:justify-between
            "
          >

            <div>

              <p
                className="
                  text-sm
                  font-medium
                  text-gray-500
                "
              >

                退休规划总值

              </p>


              <h2
                className="
                  mt-2
                  text-5xl
                  font-bold
                  text-blue-700
                "
              >

                {
                  money(
                    totalValue
                  )
                }

              </h2>


              <p
                className="
                  mt-3
                  text-sm
                  text-gray-400
                "
              >

                只统计「当前实际价值」中勾选「计入退休规划总值」的资产

              </p>

            </div>


            <div
              className="
                grid
                grid-cols-1
                gap-3
                sm:grid-cols-2
              "
            >

              {
                ASSET_TYPES.map(
                  type => {

                    const asset =
                      getAsset(type);


                    const included =
                      includeCurrent[type] !== false;


                    return (

                      <div
                        key={
                          type
                        }
                        className="
                          min-w-[220px]
                          rounded-xl
                          bg-gray-50
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
                              text-gray-500
                            "
                          >

                            {type}

                          </span>


                          {
                            included
                              ? (

                                <span
                                  className="
                                    text-xs
                                    text-green-600
                                  "
                                >

                                  ✓ 计入

                                </span>

                              )
                              : (

                                <span
                                  className="
                                    text-xs
                                    text-gray-400
                                  "
                                >

                                  未计入

                                </span>

                              )
                          }

                        </div>


                        <p
                          className="
                            mt-2
                            text-xl
                            font-bold
                            text-gray-900
                          "
                        >

                          {
                            money(
                              asset?.current_value
                            )
                          }

                        </p>

                      </div>

                    );

                  }
                )
              }

            </div>

          </div>

        </section>


        {/* =============================================
            两个资产平行
            ============================================= */}

        <section
          className="
            grid
            grid-cols-1
            gap-8
            xl:grid-cols-2
          "
        >
        {
  ASSET_TYPES.map(
    type => (
      <div key={type}>
        {renderAssetCard(type)}
      </div>
    )
  )
}

        </section>


        {/* =============================================
            计算说明
            ============================================= */}

        <section
          className="
            rounded-2xl
            border
            border-blue-100
            bg-blue-50
            p-6
          "
        >

          <h2
            className="
              text-lg
              font-bold
              text-blue-900
            "
          >

            📐 退休规划数据规则

          </h2>


          <div
            className="
              mt-4
              space-y-2
              text-sm
              leading-7
              text-blue-800
            "
          >

            <p>

              <b>
                当前实际价值：
              </b>

              手动维护，可以随时编辑修改。

            </p>


            <p>

              <b>
                退休规划总值：
              </b>

              只统计当前实际价值中勾选「计入退休规划总值」的资产。

            </p>


            <p>

              <b>
                年度历史：
              </b>

              每年记录一次 12 月底的实际金额。

            </p>


            <p>

              <b>
                年度历史独立管理：
              </b>

              太平洋年金和平安好福利分别建立自己的年度历史，不互相混合。

            </p>


            <p>

              <b>
                编辑 / 删除：
              </b>

              每一条年度历史都可以单独编辑或删除。

            </p>


            <p>

              <b>
                年度历史「计入总值」：
              </b>

              用于标记该年度记录是否需要纳入后续退休规划统计。

            </p>

          </div>

        </section>


      </main>

    </>

  );

}