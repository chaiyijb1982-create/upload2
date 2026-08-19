"use client";

import {
  useEffect,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

// =====================================================
// 类型
// =====================================================

type Mapping = {
  id: string;
  source_name: string;
  standard_name: string | null;
  account_type: string | null;
  confirmed: boolean;
  created_at: string;
  updated_at: string;
};


// =====================================================
// 建议标准名称
//
// 规则：
// 1. 如果 source_name 在这里 → 自动填入建议值
// 2. 如果不在这里 → 默认使用 source_name 本身
//
// 注意：
// 这里填入的是「实际输入框的值」
// 不是 placeholder
// 所以用户不需要重新打一遍。
// =====================================================

const STANDARD_NAME_SUGGESTIONS: Record<
  string,
  string
> = {

  // -------------------------------------------------
  // 信用卡
  // -------------------------------------------------

  "上行信用卡":
    "上海银行信用卡",

  "建行信用卡":
    "建设银行信用卡",

  "招商信用卡":
    "招商银行信用卡",

  "中信信用卡":
    "中信银行信用卡",

  "工行信用卡":
    "工商银行信用卡",

  "浦发信用卡":
    "浦发银行信用卡",

  "广发信用卡":
    "广发银行信用卡",

  "平安信用卡":
    "平安银行信用卡",

  "交行信用卡":
    "交通银行信用卡",

  "中行信用卡":
    "中国银行信用卡",

  "宁波信用卡":
    "宁波银行信用卡",

  "民生信用卡":
    "民生银行信用卡",

  // -------------------------------------------------
  // 现金
  // -------------------------------------------------

  "现金":
    "现金",

  "银行现金宝":
    "银行现金宝",
};


// =====================================================
// 获取建议值
// =====================================================

function getSuggestedStandardName(
  sourceName: string
): string {

  const suggestion =
    STANDARD_NAME_SUGGESTIONS[
      sourceName
    ];

  if (suggestion) {
    return suggestion;
  }

  // -------------------------------------------------
  // 没有建议
  //
  // 直接使用原始名称
  // -------------------------------------------------

  return sourceName;
}


// =====================================================
// 页面
// =====================================================

export default function ExpenseAccountMappingsPage() {

  const [
    mappings,
    setMappings,
  ] = useState<Mapping[]>([]);


  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    savingId,
    setSavingId,
  ] = useState<string | null>(null);


  const [
    error,
    setError,
  ] = useState<string | null>(null);


  const [
    message,
    setMessage,
  ] = useState("");


  // ===================================================
  // 加载映射
  // ===================================================

  async function loadMappings() {

    try {

      setLoading(true);

      setError(null);

      const response =
        await fetch(
          "/api/expense/mappings",
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
          "读取账户映射失败"
        );

      }


      const loadedMappings =
        Array.isArray(data.data)
          ? data.data
          : Array.isArray(data.mappings)
          ? data.mappings
          : [];


      // -------------------------------------------------
      // 加载时处理默认建议
      //
      // 重点：
      //
      // 如果：
      // standard_name = null
      //
      // 就直接把建议值写进前端 state。
      //
      // 这不是 placeholder。
      // input value 会真正显示这个值。
      // -------------------------------------------------

      const preparedMappings =
        loadedMappings.map(
          (
            item: Mapping
          ) => {

            if (
              item.standard_name &&
              item.standard_name.trim()
            ) {

              return item;

            }


            return {
              ...item,

              standard_name:
                getSuggestedStandardName(
                  item.source_name
                ),
            };

          }
        );


      setMappings(
        preparedMappings
      );

    } catch (err) {

      console.error(
        "Load expense mappings error:",
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
  // 初始加载
  // ===================================================

  useEffect(() => {

    loadMappings();

  }, []);


  // ===================================================
  // 修改标准名称
  // ===================================================

  function updateStandardName(
    id: string,
    value: string
  ) {

    setMappings(
      current =>
        current.map(
          item =>
            item.id === id
              ? {
                  ...item,

                  standard_name:
                    value,
                }
              : item
        )
    );

  }


  // ===================================================
  // 保存
  // ===================================================

  async function saveMapping(
    mapping: Mapping
  ) {

    const standardName =
      (
        mapping.standard_name ||
        ""
      ).trim();


    if (!standardName) {

      setError(
        `「${mapping.source_name}」必须填写标准名称`
      );

      return;

    }


    try {

      setSavingId(
        mapping.id
      );

      setError(null);

      setMessage("");


      const response =
        await fetch(
          "/api/expense/mappings",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({

              id:
                mapping.id,

              source_name:
                mapping.source_name,

              standard_name:
                standardName,

              account_type:
                mapping.account_type,

              confirmed:
                true,

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


      setMappings(
        current =>
          current.map(
            item =>
              item.id ===
              mapping.id
                ? {
                    ...item,

                    standard_name:
                      standardName,

                    confirmed:
                      true,

                    updated_at:
                      new Date().toISOString(),

                  }
                : item
          )
      );


      setMessage(
        `「${mapping.source_name}」已保存为「${standardName}」`
      );

    } catch (err) {

      console.error(
        "Save expense mapping error:",
        err
      );


      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );

    } finally {

      setSavingId(null);

    }

  }


  // ===================================================
  // 取消确认
  // ===================================================

  async function unconfirmMapping(
    mapping: Mapping
  ) {

    try {

      setSavingId(
        mapping.id
      );

      setError(null);

      setMessage("");


      const response =
        await fetch(
          "/api/expense/mappings",
          {
            method: "PUT",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({

              id:
                mapping.id,

              source_name:
                mapping.source_name,

              standard_name:
                mapping.standard_name,

              account_type:
                mapping.account_type,

              confirmed:
                false,

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
          "取消确认失败"
        );

      }


      setMappings(
        current =>
          current.map(
            item =>
              item.id ===
              mapping.id
                ? {
                    ...item,

                    confirmed:
                      false,
                  }
                : item
          )
      );


      setMessage(
        `「${mapping.source_name}」已取消确认`
      );

    } catch (err) {

      console.error(
        "Unconfirm expense mapping error:",
        err
      );


      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );

    } finally {

      setSavingId(null);

    }

  }


  // ===================================================
  // 删除映射
  // ===================================================

  async function deleteMapping(
    mapping: Mapping
  ) {

    const confirmed =
      window.confirm(
        `确定删除「${mapping.source_name}」的映射吗？`
      );


    if (!confirmed) {

      return;

    }


    try {

      setSavingId(
        mapping.id
      );

      setError(null);

      setMessage("");


      const response =
        await fetch(
          `/api/expense/mappings?id=${encodeURIComponent(
            mapping.id
          )}`,
          {
            method: "DELETE",
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
          "删除失败"
        );

      }


      setMappings(
        current =>
          current.filter(
            item =>
              item.id !==
              mapping.id
          )
      );


      setMessage(
        `「${mapping.source_name}」映射已删除`
      );

    } catch (err) {

      console.error(
        "Delete expense mapping error:",
        err
      );


      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );

    } finally {

      setSavingId(null);

    }

  }


  // ===================================================
  // 统计
  // ===================================================

  const confirmedCount =
    mappings.filter(
      item =>
        item.confirmed
    ).length;


  const pendingCount =
    mappings.filter(
      item =>
        !item.confirmed
    ).length;


  // ===================================================
  // 页面
  // ===================================================

  return (

    <div
      className="
        min-h-screen
        bg-gray-50
        text-gray-900
      "
    >

      <TopBar
        title="消费账户映射"
      />


      <main
        className="
          mx-auto
          max-w-[1400px]
          px-6
          py-6
        "
      >

        {/* =================================================
            标题
        ================================================= */}

        <div
          className="
            mb-6
          "
        >

          <h1
            className="
              text-2xl
              font-bold
            "
          >
            消费账户映射
          </h1>


          <p
            className="
              mt-1
              text-sm
              text-gray-500
            "
          >
            将有鱼 Excel 中的账户名称转换为系统统一的标准账户名称。
          </p>

        </div>


        {/* =================================================
            统计
        ================================================= */}

        <div
          className="
            mb-6
            grid
            grid-cols-1
            gap-4
            md:grid-cols-3
          "
        >

          <div
            className="
              rounded-xl
              border
              bg-white
              p-5
            "
          >

            <div
              className="
                text-xs
                text-gray-500
              "
            >
              账户映射
            </div>


            <div
              className="
                mt-2
                text-2xl
                font-bold
              "
            >
              {mappings.length}
            </div>

          </div>


          <div
            className="
              rounded-xl
              border
              bg-white
              p-5
            "
          >

            <div
              className="
                text-xs
                text-gray-500
              "
            >
              已确认
            </div>


            <div
              className="
                mt-2
                text-2xl
                font-bold
                text-green-600
              "
            >
              {confirmedCount}
            </div>

          </div>


          <div
            className="
              rounded-xl
              border
              bg-white
              p-5
            "
          >

            <div
              className="
                text-xs
                text-gray-500
              "
            >
              待确认
            </div>


            <div
              className="
                mt-2
                text-2xl
                font-bold
                text-orange-600
              "
            >
              {pendingCount}
            </div>

          </div>

        </div>


        {/* =================================================
            消息
        ================================================= */}

        {message && (

          <div
            className="
              mb-5
              rounded-lg
              border
              border-green-200
              bg-green-50
              px-4
              py-3
              text-sm
              text-green-700
            "
          >
            {message}
          </div>

        )}


        {error && (

          <div
            className="
              mb-5
              rounded-lg
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              text-red-700
            "
          >
            {error}
          </div>

        )}


        {/* =================================================
            说明
        ================================================= */}

        <div
          className="
            mb-5
            rounded-xl
            border
            bg-blue-50
            px-5
            py-4
            text-sm
            text-blue-800
          "
        >

          <div
            className="
              font-semibold
            "
          >
            映射规则
          </div>


          <div
            className="
              mt-2
              leading-6
            "
          >
            系统会根据原始账户名称自动提供标准名称建议。
            建议值会直接填写在输入框里，你可以直接修改后保存。
          </div>


          <div
            className="
              mt-2
              leading-6
            "
          >
            如果没有预设建议，则直接使用原始账户名称作为默认值。
          </div>


          <div
            className="
              mt-2
              font-medium
            "
          >
            例如：上行信用卡 → 上海银行信用卡
          </div>

        </div>


        {/* =================================================
            表格
        ================================================= */}

        <div
          className="
            overflow-hidden
            rounded-xl
            border
            bg-white
          "
        >

          <div
            className="
              border-b
              px-5
              py-4
            "
          >

            <div
              className="
                font-semibold
              "
            >
              账户名称映射
            </div>


            <div
              className="
                mt-1
                text-xs
                text-gray-500
              "
            >
              建议值已经直接填入标准名称输入框，可直接修改并保存。
            </div>

          </div>


          <div
            className="
              overflow-x-auto
            "
          >

            <table
              className="
                w-full
                min-w-[900px]
                text-sm
              "
            >

              <thead
                className="
                  border-b
                  bg-gray-50
                  text-gray-600
                "
              >

                <tr>

                  <th
                    className="
                      px-5
                      py-3
                      text-left
                    "
                  >
                    有鱼原始名称
                  </th>


                  <th
                    className="
                      px-5
                      py-3
                      text-left
                    "
                  >
                    资金类型
                  </th>


                  <th
                    className="
                      px-5
                      py-3
                      text-left
                    "
                  >
                    标准名称
                  </th>


                  <th
                    className="
                      px-5
                      py-3
                      text-center
                    "
                  >
                    状态
                  </th>


                  <th
                    className="
                      px-5
                      py-3
                      text-center
                    "
                  >
                    操作
                  </th>

                </tr>

              </thead>


              <tbody
                className="
                  divide-y
                "
              >

                {loading && (

                  <tr>

                    <td
                      colSpan={5}
                      className="
                        px-5
                        py-12
                        text-center
                        text-gray-500
                      "
                    >
                      正在加载账户映射...
                    </td>

                  </tr>

                )}


                {!loading &&
                  mappings.length === 0 && (

                    <tr>

                      <td
                        colSpan={5}
                        className="
                          px-5
                          py-12
                          text-center
                          text-gray-500
                        "
                      >
                        暂无账户映射。
                        上传消费 Excel 后，如果发现新的账户名称，会自动出现在这里。
                      </td>

                    </tr>

                )}


                {!loading &&
                  mappings.map(
                    mapping => {

                      const isSaving =
                        savingId ===
                        mapping.id;


                      return (

                        <tr
                          key={
                            mapping.id
                          }
                          className={`
                            hover:bg-gray-50
                            ${
                              !mapping.confirmed
                                ? "bg-orange-50/40"
                                : ""
                            }
                          `}
                        >

                          {/* =================================================
                              原始名称
                          ================================================= */}

                          <td
                            className="
                              px-5
                              py-4
                              font-medium
                            "
                          >

                            {
                              mapping.source_name
                            }

                          </td>


                          {/* =================================================
                              资金类型
                          ================================================= */}

                          <td
                            className="
                              px-5
                              py-4
                            "
                          >

                            {
                              mapping.account_type ||
                              "-"
                            }

                          </td>


                          {/* =================================================
                              标准名称
                          ================================================= */}

                          <td
                            className="
                              px-5
                              py-4
                            "
                          >

                            <input
                              type="text"
                              value={
                                mapping.standard_name ??
                                ""
                              }
                              onChange={event =>
                                updateStandardName(
                                  mapping.id,
                                  event.target.value
                                )
                              }
                              className="
                                w-full
                                max-w-[360px]
                                rounded-lg
                                border
                                border-gray-300
                                bg-white
                                px-3
                                py-2
                                text-gray-900
                                outline-none
                                focus:border-blue-500
                                focus:ring-2
                                focus:ring-blue-100
                              "
                            />


                            {/* -------------------------------------------------
                                如果是自动建议，提示用户可以修改
                            ------------------------------------------------- */}

                            {!mapping.confirmed && (

                              <div
                                className="
                                  mt-1
                                  text-xs
                                  text-gray-400
                                "
                              >
                                可直接修改后保存
                              </div>

                            )}

                          </td>


                          {/* =================================================
                              状态
                          ================================================= */}

                          <td
                            className="
                              px-5
                              py-4
                              text-center
                            "
                          >

                            {mapping.confirmed ? (

                              <span
                                className="
                                  inline-flex
                                  rounded-full
                                  bg-green-100
                                  px-3
                                  py-1
                                  text-xs
                                  font-medium
                                  text-green-700
                                "
                              >
                                已确认
                              </span>

                            ) : (

                              <span
                                className="
                                  inline-flex
                                  rounded-full
                                  bg-orange-100
                                  px-3
                                  py-1
                                  text-xs
                                  font-medium
                                  text-orange-700
                                "
                              >
                                待确认
                              </span>

                            )}

                          </td>


                          {/* =================================================
                              操作
                          ================================================= */}

                          <td
                            className="
                              px-5
                              py-4
                              text-center
                            "
                          >

                            <div
                              className="
                                flex
                                items-center
                                justify-center
                                gap-2
                              "
                            >

                              <button
                                type="button"
                                disabled={
                                  isSaving
                                }
                                onClick={() =>
                                  saveMapping(
                                    mapping
                                  )
                                }
                                className="
                                  rounded-lg
                                  bg-blue-600
                                  px-4
                                  py-2
                                  text-xs
                                  font-medium
                                  text-white
                                  hover:bg-blue-700
                                  disabled:cursor-not-allowed
                                  disabled:bg-gray-400
                                "
                              >

                                {isSaving
                                  ? "保存中..."
                                  : "确认并保存"}

                              </button>


                              {mapping.confirmed && (

                                <button
                                  type="button"
                                  disabled={
                                    isSaving
                                  }
                                  onClick={() =>
                                    unconfirmMapping(
                                      mapping
                                    )
                                  }
                                  className="
                                    rounded-lg
                                    border
                                    px-3
                                    py-2
                                    text-xs
                                    text-gray-600
                                    hover:bg-gray-50
                                    disabled:cursor-not-allowed
                                  "
                                >
                                  取消确认
                                </button>

                              )}


                              <button
                                type="button"
                                disabled={
                                  isSaving
                                }
                                onClick={() =>
                                  deleteMapping(
                                    mapping
                                  )
                                }
                                className="
                                  rounded-lg
                                  border
                                  border-red-200
                                  px-3
                                  py-2
                                  text-xs
                                  text-red-600
                                  hover:bg-red-50
                                  disabled:cursor-not-allowed
                                "
                              >
                                删除
                              </button>

                            </div>

                          </td>

                        </tr>

                      );

                    }
                  )}

              </tbody>

            </table>

          </div>

        </div>


        {/* =================================================
            底部说明
        ================================================= */}

        <div
          className="
            mt-5
            rounded-xl
            border
            bg-white
            px-5
            py-4
            text-xs
            leading-6
            text-gray-500
          "
        >

          <div
            className="
              mb-1
              font-medium
              text-gray-700
            "
          >
            使用说明
          </div>


          <div>
            ①「有鱼原始名称」来自 Excel 的「资金账户名称」。
          </div>


          <div>
            ② 系统会自动提供常见账户的标准名称建议。
          </div>


          <div>
            ③ 建议名称会直接填写到输入框，不是灰色 placeholder。
          </div>


          <div>
            ④ 如果没有建议，则直接使用原始账户名称。
          </div>


          <div>
            ⑤ 你可以直接修改建议值，然后点击「确认并保存」。
          </div>


          <div>
            ⑥ 保存后，该账户以后再次上传 Excel 时会自动使用这个标准名称。
          </div>

        </div>

      </main>

    </div>

  );

}