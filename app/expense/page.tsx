"use client";

import {
  useEffect,
  useState,
} from "react";

import TopBar from "@/components/TopBar";

import {
  getExpenseOverview,
  getExpenseTransactions,
  type ExpenseTransaction,
} from "@/lib/expense-transactions";


// =====================================================
// 工具
// =====================================================

function formatMoney(
  value: number
): string {

  return `¥${Math.round(
    Number(value || 0)
  ).toLocaleString(
    "zh-CN"
  )}`;

}


function formatDate(
  value: string | null
): string {

  if (!value) {
    return "-";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {

    return "-";

  }

  return (
    `${date.getFullYear()}-${String(
      date.getMonth() + 1
    ).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")} ` +
    `${String(
      date.getHours()
    ).padStart(2, "0")}:` +
    `${String(
      date.getMinutes()
    ).padStart(2, "0")}`
  );

}


// =====================================================
// 页面
// =====================================================

export default function ExpensePage() {

  const [
    file,
    setFile,
  ] =
    useState<File | null>(
      null
    );


  const [
    uploading,
    setUploading,
  ] =
    useState(false);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null
    );


  const [
    message,
    setMessage,
  ] =
    useState("");


  const [
    overview,
    setOverview,
  ] =
    useState<any>(null);


  const [
    transactions,
    setTransactions,
  ] =
    useState<
      ExpenseTransaction[]
    >([]);


  // ===================================================
  // 加载数据
  // ===================================================

  async function loadData() {

    try {

      setLoading(true);

      setError(null);


      const [
        overviewData,
        transactionData,
      ] =
        await Promise.all([

          getExpenseOverview(),

          getExpenseTransactions({
            limit: 100,
          }),

        ]);


      setOverview(
        overviewData
      );


      setTransactions(
        transactionData
      );

    } catch (
      err
    ) {

      console.error(
        "Expense load error:",
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

    loadData();

  }, []);


  // ===================================================
  // 上传
  // ===================================================

  async function handleUpload() {

    if (!file) {

      setError(
        "请先选择 Excel 文件"
      );

      return;

    }


    const name =
      file.name.toLowerCase();


    if (
      !name.endsWith(".xlsx") &&
      !name.endsWith(".xls")
    ) {

      setError(
        "只支持 .xlsx 或 .xls Excel 文件"
      );

      return;

    }


    try {

      setUploading(true);

      setError(null);

      setMessage("");


      const formData =
        new FormData();


      formData.append(
        "file",
        file
      );


      const response =
        await fetch(
          "/api/expense",
          {
            method: "POST",
            body: formData,
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
          "Excel 导入失败"
        );

      }


      const result =
        data.result;


      setMessage(
        `导入完成 · 新增 ${result.inserted} 笔 · 重复 ${result.duplicated} 笔 · 失败 ${result.failed} 笔`
      );


      setFile(null);


      // 重新读取数据库
      await loadData();

    } catch (
      err
    ) {

      console.error(
        "Expense upload error:",
        err
      );


      setError(
        err instanceof Error
          ? err.message
          : String(err)
      );

    } finally {

      setUploading(false);

    }

  }


  return (

    <div
      className="
        min-h-screen
        bg-gray-50
        text-gray-900
      "
    >

      <TopBar title="消费明细" />


      <main
        className="
          mx-auto
          max-w-[1500px]
          px-6
          py-6
        "
      >

        {/* ============================================
            标题
        ============================================ */}

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
            家庭消费
          </h1>

          <p
            className="
              mt-1
              text-sm
              text-gray-500
            "
          >
            上传有鱼 Excel「收入支出」数据，
            自动保存消费流水。
          </p>

        </div>


        {/* ============================================
            上传
        ============================================ */}

        <div
          className="
            mb-6
            rounded-xl
            border
            bg-white
            p-6
          "
        >

          <div
            className="
              text-base
              font-semibold
              mb-4
            "
          >
            上传有鱼 Excel
          </div>


          <div
            className="
              flex
              flex-wrap
              items-center
              gap-3
            "
          >

            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={event => {

                setFile(
                  event.target.files?.[0] ??
                  null
                );

                setMessage("");

                setError(null);

              }}
              className="
                block
                text-sm
              "
            />


            <button
              type="button"
              onClick={
                handleUpload
              }
              disabled={
                uploading ||
                !file
              }
              className={`
                rounded-lg
                px-5
                py-2.5
                text-sm
                font-medium
                text-white

                ${
                  uploading ||
                  !file
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700"
                }
              `}
            >
              {uploading
                ? "正在导入..."
                : "上传并导入"}
            </button>

          </div>


          {file && (

            <div
              className="
                mt-3
                text-sm
                text-gray-500
              "
            >
              已选择：
              <span
                className="
                  ml-1
                  font-medium
                  text-gray-700
                "
              >
                {file.name}
              </span>
            </div>

          )}


          {message && (

            <div
              className="
                mt-4
                rounded-lg
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
                mt-4
                rounded-lg
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

        </div>


        {/* ============================================
            概览
        ============================================ */}

        <div
          className="
            mb-6
            grid
            grid-cols-1
            gap-4
            md:grid-cols-5
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
              总流水
            </div>

            <div
              className="
                mt-2
                text-2xl
                font-bold
              "
            >
              {loading
                ? "-"
                : (
                  overview?.transaction_count ??
                  0
                ).toLocaleString(
                  "zh-CN"
                )}
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
              总支出
            </div>

            <div
              className="
                mt-2
                text-2xl
                font-bold
              "
            >
              {loading
                ? "-"
                : formatMoney(
                    overview?.expense ??
                    0
                  )}
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
              信用卡消费
            </div>

            <div
              className="
                mt-2
                text-2xl
                font-bold
              "
            >
              {loading
                ? "-"
                : formatMoney(
                    overview?.credit_card ??
                    0
                  )}
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
              非信用卡消费
            </div>

            <div
              className="
                mt-2
                text-2xl
                font-bold
              "
            >
              {loading
                ? "-"
                : formatMoney(
                    overview?.non_credit_card ??
                    0
                  )}
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
              平账
            </div>

            <div
              className="
                mt-2
                text-2xl
                font-bold
              "
            >
              {loading
                ? "-"
                : formatMoney(
                    overview?.settlement ??
                    0
                  )}
            </div>

          </div>

        </div>


        {/* ============================================
            最近流水
        ============================================ */}

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
              最近消费流水
            </div>

            <div
              className="
                mt-1
                text-xs
                text-gray-500
              "
            >
              最新 100 笔
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
                min-w-[1100px]
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
                    时间
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-left
                    "
                  >
                    账户
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-left
                    "
                  >
                    类型
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-left
                    "
                  >
                    收支
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-left
                    "
                  >
                    分类
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-right
                    "
                  >
                    金额
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-left
                    "
                  >
                    成员
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-left
                    "
                  >
                    备注
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-center
                    "
                  >
                    信用卡
                  </th>

                  <th
                    className="
                      px-5
                      py-3
                      text-center
                    "
                  >
                    平账
                  </th>

                </tr>

              </thead>


              <tbody
                className="
                  divide-y
                "
              >

                {!loading &&
                  transactions.length === 0 && (

                    <tr>

                      <td
                        colSpan={10}
                        className="
                          px-5
                          py-12
                          text-center
                          text-gray-500
                        "
                      >
                        暂无消费流水，请上传有鱼 Excel
                      </td>

                    </tr>

                  )}


                {transactions.map(
                  item => (

                    <tr
                      key={item.id}
                      className="
                        hover:bg-gray-50
                      "
                    >

                      <td
                        className="
                          px-5
                          py-3
                          whitespace-nowrap
                        "
                      >
                        {formatDate(
                          item.transaction_time
                        )}
                      </td>


                      <td
                        className="
                          px-5
                          py-3
                          font-medium
                        "
                      >
                        {item.account_name ||
                          "-"}
                      </td>


                      <td
                        className="
                          px-5
                          py-3
                        "
                      >
                        {item.account_type ||
                          "-"}
                      </td>


                      <td
                        className="
                          px-5
                          py-3
                        "
                      >
                        {item.income_expense_type ||
                          "-"}
                      </td>


                      <td
                        className="
                          px-5
                          py-3
                        "
                      >
                        {item.category ||
                          "-"}
                      </td>


                      <td
                        className={`
                          px-5
                          py-3
                          text-right
                          font-medium

                          ${
                            Number(
                              item.amount
                            ) < 0
                              ? "text-red-600"
                              : "text-green-600"
                          }
                        `}
                      >
                        {formatMoney(
                          item.amount
                        )}
                      </td>


                      <td
                        className="
                          px-5
                          py-3
                        "
                      >
                        {item.member ||
                          "-"}
                      </td>


                      <td
                        className="
                          px-5
                          py-3
                        "
                      >
                        {item.remark ||
                          "-"}
                      </td>


                      <td
                        className="
                          px-5
                          py-3
                          text-center
                        "
                      >
                        {item.is_credit_card
                          ? "✅"
                          : "-"}
                      </td>


                      <td
                        className="
                          px-5
                          py-3
                          text-center
                        "
                      >
                        {item.is_settlement
                          ? "✅"
                          : "-"}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        </div>


        {/* ============================================
            数据说明
        ============================================ */}

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
            数据说明
          </div>

          <div>
            ① Excel 来源：有鱼「收入支出」Sheet。
          </div>

          <div>
            ② 系统根据「资金类型 / 资金账户名称」自动识别信用卡。
          </div>

          <div>
            ③ 明确包含「平账 / 平帐」的流水自动标记为平账。
          </div>

          <div>
            ④ 相同交易 Hash 自动去重，重复上传 Excel 不会重复计算。
          </div>

          <div>
            ⑤ /credit-card-from-yu 会直接读取这里保存的信用卡流水。
          </div>

        </div>

      </main>

    </div>

  );

}