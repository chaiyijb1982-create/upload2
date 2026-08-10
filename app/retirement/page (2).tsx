"use client";

import {
  useEffect,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import { supabase } from "@/lib/supabase";


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
  year_end_value: number;
  note?: string;
  created_at?: string;
  updated_at?: string;
};


// =====================================================
// 常量
// =====================================================

const PACIFIC_ANNUITY = "太平洋年金";

const PINGAN_WELFARE = "平安好福利";

const ASSET_TYPES = [
  PACIFIC_ANNUITY,
  PINGAN_WELFARE,
];


// =====================================================
// 数字
// =====================================================

function toNumber(
  value: any
): number {

  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}


// =====================================================
// 金额格式
// =====================================================

function money(
  value: number
): string {

  const n = toNumber(value);

  if (
    n >= 100000000
  ) {

    return (
      "¥" +
      (
        n / 100000000
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
        n / 10000
      ).toFixed(1) +
      " 万"
    );

  }

  return (
    "¥" +
    Math.round(n)
      .toLocaleString("zh-CN")
  );
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
  ] = useState<RetirementAsset[]>([]);


  // ===================================================
  // 年度历史
  // ===================================================

  const [
    history,
    setHistory,
  ] = useState<RetirementHistory[]>([]);


  // ===================================================
  // Loading
  // ===================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  // ===================================================
  // 保存中
  // ===================================================

  const [
    saving,
    setSaving,
  ] = useState(false);


  // ===================================================
  // 当前值编辑
  // ===================================================

  const [
    editingCurrent,
    setEditingCurrent,
  ] = useState<string | null>(null);


  const [
    currentEditValue,
    setCurrentEditValue,
  ] = useState("");


  // ===================================================
  // 当前值备注
  // ===================================================

  const [
    currentEditNote,
    setCurrentEditNote,
  ] = useState("");


  // ===================================================
  // 年度新增
  // ===================================================

  const [
    addingHistoryType,
    setAddingHistoryType,
  ] = useState<string | null>(null);


  const [
    newHistoryYear,
    setNewHistoryYear,
  ] = useState(
    String(
      new Date().getFullYear()
    )
  );


  const [
    newHistoryValue,
    setNewHistoryValue,
  ] = useState("");


  // ===================================================
  // 年度编辑
  // ===================================================

  const [
    editingHistoryId,
    setEditingHistoryId,
  ] = useState<string | null>(null);


  const [
    editHistoryYear,
    setEditHistoryYear,
  ] = useState("");


  const [
    editHistoryValue,
    setEditHistoryValue,
  ] = useState("");


  // ===================================================
  // 错误
  // ===================================================

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");


  // =====================================================
  // 获取数据
  // =====================================================

  async function loadData() {

    try {

      setLoading(true);

      setErrorMessage("");


      // =================================================
      // 当前资产
      // =================================================

      const {
        data: assetData,
        error: assetError,
      } = await supabase
        .from("retirement_assets")
        .select("*")
        .order(
          "created_at",
          {
            ascending: true,
          }
        );


      if (assetError) {

        console.error(
          "退休资产读取失败:",
          assetError
        );

        throw assetError;

      }


      // =================================================
      // 年度历史
      // =================================================

      const {
        data: historyData,
        error: historyError,
      } = await supabase
        .from("retirement_asset_history")
        .select("*")
        .order(
          "year",
          {
            ascending: true,
          }
        );


      if (historyError) {

        console.error(
          "退休年度历史读取失败:",
          historyError
        );

        // 历史表不存在时，
        // 不让整个页面崩掉
        setHistory([]);

      } else {

        setHistory(
          Array.isArray(historyData)
            ? historyData
            : []
        );

      }


      setAssets(
        Array.isArray(assetData)
          ? assetData
          : []
      );


    } catch (error) {

      console.error(
        "Retirement loading error:",
        error
      );

      setErrorMessage(
        "退休规划数据读取失败，请检查数据库或 RLS Policy。"
      );

    } finally {

      setLoading(false);

    }

  }


  // =====================================================
  // 初始加载
  // =====================================================

  useEffect(() => {

    loadData();

  }, []);


  // =====================================================
  // 获取当前资产
  // =====================================================

  function getAsset(
    type: string
  ): RetirementAsset | undefined {

    return assets.find(
      asset =>
        asset.asset_type === type
    );

  }


  // =====================================================
  // 当前资产总值
  //
  // 只有当前实际价值计入总值的资产
  // 才加入。
  //
  // 当前表没有 include_total 字段，
  // 所以暂时使用 note 中的标记：
  //
  // [计入总值]
  //
  // 后面数据库增加字段后可以直接改成字段。
  // =====================================================

  function isIncludedInTotal(
    asset: RetirementAsset
  ): boolean {

    return (
      asset.note === "[计入总值]"
    );

  }


  // =====================================================
  // 总值
  // =====================================================

  const totalValue =
    assets.reduce(
      (
        sum,
        asset
      ) => {

        if (
          !isIncludedInTotal(
            asset
          )
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


  // =====================================================
  // 开始编辑当前值
  // =====================================================

  function startEditCurrent(
    asset: RetirementAsset
  ) {

    setEditingCurrent(
      asset.id
    );

    setCurrentEditValue(
      String(
        asset.current_value ?? 0
      )
    );

    setCurrentEditNote(
      asset.note === "[计入总值]"
        ? ""
        : asset.note || ""
    );

  }


  // =====================================================
  // 取消编辑当前值
  // =====================================================

  function cancelEditCurrent() {

    setEditingCurrent(null);

    setCurrentEditValue("");

    setCurrentEditNote("");

  }


  // =====================================================
  // 保存当前值
  // =====================================================

  async function saveCurrentValue(
    asset: RetirementAsset
  ) {

    try {

      setSaving(true);

      setErrorMessage("");


      const value =
        toNumber(
          currentEditValue
        );


      const includeTotal =
        asset.note === "[计入总值]";


      const note =
        includeTotal
          ? "[计入总值]"
          : currentEditNote;


      const {
        data,
        error,
      } = await supabase
        .from("retirement_assets")
        .update({

          current_value:
            value,

          note:
            note,

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


      if (error) {

        console.error(
          "保存当前值失败:",
          error
        );

        throw error;

      }


      setAssets(
        previous =>
          previous.map(
            item =>
              item.id === asset.id
                ? data
                : item
          )
      );


      setEditingCurrent(null);

      setCurrentEditValue("");

      setCurrentEditNote("");


    } catch (error) {

      console.error(
        "保存当前值失败:",
        error
      );

      setErrorMessage(
        "当前值保存失败，请检查数据库或 RLS Policy。"
      );

    } finally {

      setSaving(false);

    }

  }


  // =====================================================
  // 切换是否计入总值
  // =====================================================

  async function toggleIncludeTotal(
    asset: RetirementAsset
  ) {

    try {

      setSaving(true);

      setErrorMessage("");


      const include =
        !isIncludedInTotal(
          asset
        );


      const newNote =
        include
          ? "[计入总值]"
          : "";


      const {
        data,
        error,
      } = await supabase
        .from("retirement_assets")
        .update({

          note:
            newNote,

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


      if (error) {

        console.error(
          "更新计入总值状态失败:",
          error
        );

        throw error;

      }


      setAssets(
        previous =>
          previous.map(
            item =>
              item.id === asset.id
                ? data
                : item
          )
      );


    } catch (error) {

      console.error(
        "toggle total error:",
        error
      );

      setErrorMessage(
        "更新总值状态失败，请检查数据库或 RLS Policy。"
      );

    } finally {

      setSaving(false);

    }

  }


  // =====================================================
  // 开始添加年度记录
  // =====================================================

  function startAddHistory(
    type: string
  ) {

    setAddingHistoryType(
      type
    );

    setNewHistoryYear(
      String(
        new Date().getFullYear()
      )
    );

    setNewHistoryValue("");

    setEditingHistoryId(null);

  }


  // =====================================================
  // 取消添加
  // =====================================================

  function cancelAddHistory() {

    setAddingHistoryType(null);

    setNewHistoryYear(
      String(
        new Date().getFullYear()
      )
    );

    setNewHistoryValue("");

  }


  // =====================================================
  // 保存年度历史
  // =====================================================

  async function saveHistory(
    type: string
  ) {

    try {

      setSaving(true);

      setErrorMessage("");


      const year =
        Number(
          newHistoryYear
        );


      const value =
        toNumber(
          newHistoryValue
        );


      if (
        !Number.isFinite(year) ||
        year < 1900 ||
        year > 2200
      ) {

        setErrorMessage(
          "请输入正确的年份。"
        );

        return;

      }


      // =================================================
      // 检查同一资产同一年
      // =================================================

      const exists =
        history.find(
          item =>
            item.asset_type === type &&
            Number(item.year) === year
        );


      if (exists) {

        setErrorMessage(
          `${type} ${year} 年已经存在年度记录，请直接编辑。`
        );

        return;

      }


      const {
        data,
        error,
      } = await supabase
        .from(
          "retirement_asset_history"
        )
        .insert({

          asset_type:
            type,

          year:
            year,

          year_end_value:
            value,

          note:
            "",

          created_at:
            new Date()
              .toISOString(),

          updated_at:
            new Date()
              .toISOString(),

        })
        .select()
        .single();


      if (error) {

        console.error(
          "新增年度历史失败:",
          error
        );

        throw error;

      }


      setHistory(
        previous =>
          [
            ...previous,
            data,
          ].sort(
            (
              a,
              b
            ) =>
              Number(a.year) -
              Number(b.year)
          )
      );


      cancelAddHistory();


    } catch (error) {

      console.error(
        "新增年度历史失败:",
        error
      );

      setErrorMessage(
        "年度记录保存失败，请检查年度历史表或 RLS Policy。"
      );

    } finally {

      setSaving(false);

    }

  }


  // =====================================================
  // 开始编辑年度记录
  // =====================================================

  function startEditHistory(
    item: RetirementHistory
  ) {

    setEditingHistoryId(
      item.id
    );

    setEditHistoryYear(
      String(
        item.year
      )
    );

    setEditHistoryValue(
      String(
        item.year_end_value
      )
    );

    setAddingHistoryType(null);

  }


  // =====================================================
  // 取消编辑年度记录
  // =====================================================

  function cancelEditHistory() {

    setEditingHistoryId(null);

    setEditHistoryYear("");

    setEditHistoryValue("");

  }


  // =====================================================
  // 保存年度编辑
  // =====================================================

  async function saveEditHistory(
    item: RetirementHistory
  ) {

    try {

      setSaving(true);

      setErrorMessage("");


      const year =
        Number(
          editHistoryYear
        );


      const value =
        toNumber(
          editHistoryValue
        );


      if (
        !Number.isFinite(year) ||
        year < 1900 ||
        year > 2200
      ) {

        setErrorMessage(
          "请输入正确的年份。"
        );

        return;

      }


      const duplicate =
        history.find(
          other =>
            other.id !== item.id &&
            other.asset_type ===
              item.asset_type &&
            Number(other.year) ===
              year
        );


      if (duplicate) {

        setErrorMessage(
          `${item.asset_type} ${year} 年已经存在记录。`
        );

        return;

      }


      const {
        data,
        error,
      } = await supabase
        .from(
          "retirement_asset_history"
        )
        .update({

          year:
            year,

          year_end_value:
            value,

          updated_at:
            new Date()
              .toISOString(),

        })
        .eq(
          "id",
          item.id
        )
        .select()
        .single();


      if (error) {

        console.error(
          "编辑年度历史失败:",
          error
        );

        throw error;

      }


      setHistory(
        previous =>
          previous
            .map(
              row =>
                row.id === item.id
                  ? data
                  : row
            )
            .sort(
              (
                a,
                b
              ) =>
                Number(a.year) -
                Number(b.year)
            )
      );


      cancelEditHistory();


    } catch (error) {

      console.error(
        "编辑年度历史失败:",
        error
      );

      setErrorMessage(
        "年度记录修改失败，请检查数据库或 RLS Policy。"
      );

    } finally {

      setSaving(false);

    }

  }


  // =====================================================
  // 删除年度记录
  // =====================================================

  async function deleteHistory(
    item: RetirementHistory
  ) {

    const confirmed =
      window.confirm(
        `确定删除 ${item.asset_type} ${item.year} 年度记录吗？`
      );


    if (!confirmed) {

      return;

    }


    try {

      setSaving(true);

      setErrorMessage("");


      const {
        error,
      } = await supabase
        .from(
          "retirement_asset_history"
        )
        .delete()
        .eq(
          "id",
          item.id
        );


      if (error) {

        console.error(
          "删除年度历史失败:",
          error
        );

        throw error;

      }


      setHistory(
        previous =>
          previous.filter(
            row =>
              row.id !== item.id
          )
      );


    } catch (error) {

      console.error(
        "删除年度历史失败:",
        error
      );

      setErrorMessage(
        "年度记录删除失败，请检查数据库或 RLS Policy。"
      );

    } finally {

      setSaving(false);

    }

  }


  // =====================================================
  // 获取某个资产的历史
  // =====================================================

  function getHistory(
    type: string
  ) {

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
          Number(a.year) -
          Number(b.year)
      );

  }


  // =====================================================
  // Loading
  // =====================================================

  if (loading) {

    return (

      <>

        <TopBar
          title="Retirement"
        />

        <main
          className="
            p-10
          "
        >

          <div
            className="
              text-gray-500
            "
          >

            正在加载退休规划...

          </div>

        </main>

      </>

    );

  }


  // =====================================================
  // 页面
  // =====================================================

  return (

    <>

      <TopBar
        title="Retirement"
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

            管理退休年金、退休福利及年度12月底资产历史

          </p>

        </div>


        {/* =================================================
            错误
            ================================================= */}

        {
          errorMessage && (

            <div
              className="
                rounded-xl
                border
                border-red-200
                bg-red-50
                px-5
                py-4
                text-red-700
              "
            >

              {errorMessage}

            </div>

          )
        }


        {/* =================================================
            总值
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
                  text-sm
                  text-gray-500
                "
              >

                当前退休资产总值

              </p>


              <h2
                className="
                  mt-2
                  text-5xl
                  font-bold
                  text-blue-700
                "
              >

                {money(
                  totalValue
                )}

              </h2>


              <p
                className="
                  mt-3
                  text-sm
                  text-gray-400
                "
              >

                只统计勾选「计入总值」的当前实际价值

              </p>

            </div>


            <div
              className="
                rounded-xl
                bg-blue-50
                px-6
                py-5
              "
            >

              <p
                className="
                  text-sm
                  text-gray-500
                "
              >

                当前管理资产

              </p>


              <p
                className="
                  mt-2
                  text-2xl
                  font-bold
                  text-blue-700
                "
              >

                {
                  assets.length
                }

                {" "}
                项

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
              mb-5
            "
          >

            <h2
              className="
                text-2xl
                font-bold
                text-gray-900
              "
            >

              当前实际价值

            </h2>


            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >

              当前实际价值可以随时修改，并可选择是否计入退休资产总值

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
                type => {

                  const asset =
                    getAsset(
                      type
                    );


                  if (!asset) {

                    return (

                      <div
                        key={type}
                        className="
                          bg-white
                          border
                          rounded-2xl
                          p-7
                          shadow-sm
                        "
                      >

                        <h3
                          className="
                            text-xl
                            font-bold
                            text-gray-900
                          "
                        >

                          {type}

                        </h3>


                        <p
                          className="
                            mt-4
                            text-gray-500
                          "
                        >

                          数据不存在，请先在数据库建立该资产。

                        </p>

                      </div>

                    );

                  }


                  const included =
                    isIncludedInTotal(
                      asset
                    );


                  const editing =
                    editingCurrent ===
                    asset.id;


                  return (

                    <div
                      key={asset.id}
                      className="
                        bg-white
                        border
                        rounded-2xl
                        p-7
                        shadow-sm
                      "
                    >

                      {/* 标题 */}

                      <div
                        className="
                          flex
                          items-start
                          justify-between
                          gap-4
                        "
                      >

                        <div>

                          <h3
                            className="
                              text-xl
                              font-bold
                              text-gray-900
                            "
                          >

                            {type}

                          </h3>


                          <p
                            className="
                              mt-1
                              text-sm
                              text-gray-400
                            "
                          >

                            当前实际价值

                          </p>

                        </div>


                        {
                          included && (

                            <span
                              className="
                                rounded-full
                                bg-green-100
                                px-3
                                py-1
                                text-xs
                                font-semibold
                                text-green-700
                              "
                            >

                              已计入总值

                            </span>

                          )
                        }

                      </div>


                      {/* 当前金额 */}

                      {
                        !editing ? (

                          <>

                            <div
                              className="
                                mt-6
                              "
                            >

                              <p
                                className="
                                  text-4xl
                                  font-bold
                                  text-gray-900
                                "
                              >

                                {
                                  money(
                                    asset.current_value
                                  )
                                }

                              </p>

                            </div>


                            {/* 操作 */}

                            <div
                              className="
                                mt-6
                                flex
                                flex-wrap
                                items-center
                                gap-3
                              "
                            >

                              <button
                                type="button"
                                onClick={() =>
                                  startEditCurrent(
                                    asset
                                  )
                                }
                                className="
                                  rounded-lg
                                  bg-gray-900
                                  px-4
                                  py-2
                                  text-sm
                                  font-semibold
                                  text-white
                                  hover:bg-gray-700
                                "
                              >

                                编辑当前值

                              </button>


                              <button
                                type="button"
                                disabled={saving}
                                onClick={() =>
                                  toggleIncludeTotal(
                                    asset
                                  )
                                }
                                className={`
                                  rounded-lg
                                  px-4
                                  py-2
                                  text-sm
                                  font-semibold
                                  ${
                                    included
                                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                  }
                                `}
                              >

                                {
                                  included
                                    ? "✓ 计入总值"
                                    : "○ 不计入总值"
                                }

                              </button>

                            </div>

                          </>

                        ) : (

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
                                  font-medium
                                  text-gray-600
                                  mb-2
                                "
                              >

                                当前实际价值

                              </label>


                              <input
                                type="number"
                                value={
                                  currentEditValue
                                }
                                onChange={event =>
                                  setCurrentEditValue(
                                    event.target.value
                                  )
                                }
                                className="
                                  w-full
                                  rounded-lg
                                  border
                                  border-gray-300
                                  px-4
                                  py-3
                                  text-lg
                                  outline-none
                                  focus:border-blue-500
                                "
                              />

                            </div>


                            <div>

                              <label
                                className="
                                  block
                                  text-sm
                                  font-medium
                                  text-gray-600
                                  mb-2
                                "
                              >

                                备注

                              </label>


                              <input
                                type="text"
                                value={
                                  currentEditNote
                                }
                                onChange={event =>
                                  setCurrentEditNote(
                                    event.target.value
                                  )
                                }
                                placeholder="备注"
                                className="
                                  w-full
                                  rounded-lg
                                  border
                                  border-gray-300
                                  px-4
                                  py-3
                                  outline-none
                                  focus:border-blue-500
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
                                disabled={saving}
                                onClick={() =>
                                  saveCurrentValue(
                                    asset
                                  )
                                }
                                className="
                                  rounded-lg
                                  bg-blue-600
                                  px-5
                                  py-2.5
                                  text-sm
                                  font-semibold
                                  text-white
                                  hover:bg-blue-700
                                "
                              >

                                保存

                              </button>


                              <button
                                type="button"
                                disabled={saving}
                                onClick={
                                  cancelEditCurrent
                                }
                                className="
                                  rounded-lg
                                  bg-gray-100
                                  px-5
                                  py-2.5
                                  text-sm
                                  font-semibold
                                  text-gray-700
                                  hover:bg-gray-200
                                "
                              >

                                取消

                              </button>

                            </div>

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
              mb-5
            "
          >

            <h2
              className="
                text-2xl
                font-bold
                text-gray-900
              "
            >

              年度历史

            </h2>


            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >

              每年12月底记录一次实际价值，两个资产分别独立管理

            </p>

          </div>


          <div
            className="
              grid
              grid-cols-1
              lg:grid-cols-2
              gap-6
            "
          >

            {
              ASSET_TYPES.map(
                type => {

                  const rows =
                    getHistory(
                      type
                    );


                  const adding =
                    addingHistoryType ===
                    type;


                  return (

                    <div
                      key={type}
                      className="
                        bg-white
                        border
                        rounded-2xl
                        shadow-sm
                        overflow-hidden
                      "
                    >

                      {/* 标题 */}

                      <div
                        className="
                          px-6
                          py-5
                          border-b
                          flex
                          items-center
                          justify-between
                          gap-4
                        "
                      >

                        <div>

                          <h3
                            className="
                              text-xl
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

                            每年12月底

                          </p>

                        </div>


                        <button
                          type="button"
                          onClick={() =>
                            adding
                              ? cancelAddHistory()
                              : startAddHistory(
                                  type
                                )
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
                            adding
                              ? "取消"
                              : "+ 添加年度"
                          }

                        </button>

                      </div>


                      {/* 添加 */}

                      {
                        adding && (

                          <div
                            className="
                              border-b
                              bg-blue-50
                              p-5
                            "
                          >

                            <div
                              className="
                                grid
                                grid-cols-1
                                sm:grid-cols-2
                                gap-4
                              "
                            >

                              <div>

                                <label
                                  className="
                                    block
                                    text-sm
                                    font-medium
                                    text-gray-600
                                    mb-2
                                  "
                                >

                                  年份

                                </label>


                                <input
                                  type="number"
                                  value={
                                    newHistoryYear
                                  }
                                  onChange={event =>
                                    setNewHistoryYear(
                                      event.target.value
                                    )
                                  }
                                  className="
                                    w-full
                                    rounded-lg
                                    border
                                    border-gray-300
                                    bg-white
                                    px-4
                                    py-2.5
                                    outline-none
                                  "
                                />

                              </div>


                              <div>

                                <label
                                  className="
                                    block
                                    text-sm
                                    font-medium
                                    text-gray-600
                                    mb-2
                                  "
                                >

                                  12月底金额

                                </label>


                                <input
                                  type="number"
                                  value={
                                    newHistoryValue
                                  }
                                  onChange={event =>
                                    setNewHistoryValue(
                                      event.target.value
                                    )
                                  }
                                  placeholder="请输入金额"
                                  className="
                                    w-full
                                    rounded-lg
                                    border
                                    border-gray-300
                                    bg-white
                                    px-4
                                    py-2.5
                                    outline-none
                                  "
                                />

                              </div>

                            </div>


                            <button
                              type="button"
                              disabled={saving}
                              onClick={() =>
                                saveHistory(
                                  type
                                )
                              }
                              className="
                                mt-4
                                rounded-lg
                                bg-green-600
                                px-5
                                py-2.5
                                text-sm
                                font-semibold
                                text-white
                                hover:bg-green-700
                              "
                            >

                              保存年度记录

                            </button>

                          </div>

                        )
                      }


                      {/* 表格 */}

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
                                  font-semibold
                                  text-gray-600
                                "
                              >

                                年份

                              </th>


                              <th
                                className="
                                  px-5
                                  py-4
                                  text-right
                                  font-semibold
                                  text-gray-600
                                "
                              >

                                12月底

                              </th>


                              <th
                                className="
                                  px-5
                                  py-4
                                  text-right
                                  font-semibold
                                  text-gray-600
                                "
                              >

                                操作

                              </th>

                            </tr>

                          </thead>


                          <tbody>

                            {
                              rows.length === 0 ? (

                                <tr>

                                  <td
                                    colSpan={3}
                                    className="
                                      px-5
                                      py-10
                                      text-center
                                      text-gray-400
                                    "
                                  >

                                    暂无年度记录

                                  </td>

                                </tr>

                              ) : (

                                rows.map(
                                  item => {

                                    const editing =
                                      editingHistoryId ===
                                      item.id;


                                    if (editing) {

                                      return (

                                        <tr
                                          key={item.id}
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
                                                editHistoryYear
                                              }
                                              onChange={
                                                event =>
                                                  setEditHistoryYear(
                                                    event.target.value
                                                  )
                                              }
                                              className="
                                                w-24
                                                rounded-lg
                                                border
                                                border-gray-300
                                                px-3
                                                py-2
                                              "
                                            />

                                          </td>


                                          <td
                                            className="
                                              px-5
                                              py-4
                                              text-right
                                            "
                                          >

                                            <input
                                              type="number"
                                              value={
                                                editHistoryValue
                                              }
                                              onChange={
                                                event =>
                                                  setEditHistoryValue(
                                                    event.target.value
                                                  )
                                              }
                                              className="
                                                w-40
                                                rounded-lg
                                                border
                                                border-gray-300
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
                                                  saveEditHistory(
                                                    item
                                                  )
                                                }
                                                className="
                                                  rounded-lg
                                                  bg-green-600
                                                  px-3
                                                  py-2
                                                  text-xs
                                                  font-semibold
                                                  text-white
                                                "
                                              >

                                                保存

                                              </button>


                                              <button
                                                type="button"
                                                disabled={
                                                  saving
                                                }
                                                onClick={
                                                  cancelEditHistory
                                                }
                                                className="
                                                  rounded-lg
                                                  bg-gray-100
                                                  px-3
                                                  py-2
                                                  text-xs
                                                  font-semibold
                                                  text-gray-700
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
                                        key={item.id}
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
                                            text-gray-800
                                          "
                                        >

                                          {item.year}

                                        </td>


                                        <td
                                          className="
                                            px-5
                                            py-4
                                            text-right
                                            font-semibold
                                            text-gray-900
                                          "
                                        >

                                          {
                                            money(
                                              item.year_end_value
                                            )
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
                                                startEditHistory(
                                                  item
                                                )
                                              }
                                              className="
                                                rounded-lg
                                                bg-gray-100
                                                px-3
                                                py-2
                                                text-xs
                                                font-semibold
                                                text-gray-700
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
                                                deleteHistory(
                                                  item
                                                )
                                              }
                                              className="
                                                rounded-lg
                                                bg-red-50
                                                px-3
                                                py-2
                                                text-xs
                                                font-semibold
                                                text-red-600
                                                hover:bg-red-100
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

                              )
                            }

                          </tbody>

                        </table>

                      </div>

                    </div>

                  );

                }
              )
            }

          </div>

        </section>


        {/* =================================================
            说明
            ================================================= */}

        <section
          className="
            rounded-2xl
            border
            border-blue-100
            bg-blue-50
            p-6
            text-sm
            text-blue-800
            leading-7
          "
        >

          <h3
            className="
              font-bold
              text-blue-900
            "
          >

            📐 退休规划数据规则

          </h3>


          <div
            className="
              mt-3
              space-y-1
            "
          >

            <p>

              <b>
                当前实际价值：
              </b>

              可以随时修改。

            </p>


            <p>

              <b>
                计入总值：
              </b>

              只有打开「计入总值」的当前实际价值才计入顶部退休资产总值。

            </p>


            <p>

              <b>
                年度历史：
              </b>

              太平洋年金和平安好福利分别记录每年12月底实际价值。

            </p>


            <p>

              <b>
                年度历史不会重复计入当前总值。
              </b>

            </p>

          </div>

        </section>


      </main>

    </>

  );

}