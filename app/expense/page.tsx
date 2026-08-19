"use client";

import {
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import TopBar from "@/components/TopBar";

import {
  getExpenseOverview,
  getExpenseTransactions,
  type ExpenseTransaction,
} from "@/lib/expense-transactions";


// =====================================================
// 类型
// =====================================================

type UnresolvedAccount = {
  source_name: string;
  account_type: string | null;
  mapping_id: string | null;
  standard_name: string | null;
  confirmed: boolean;
};


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

  // ===================================================
  // 上传文件
  // ===================================================

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


  // ===================================================
  // 页面数据
  // ===================================================

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
  // ★ 新增
  //
  // 未确认账户
  // ===================================================

  const [
    unresolvedAccounts,
    setUnresolvedAccounts,
  ] =
    useState<
      UnresolvedAccount[]
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

      setUnresolvedAccounts([]);


      // =================================================
      // FormData
      // =================================================

      const formData =
        new FormData();


      formData.append(
        "file",
        file
      );


      // =================================================
      // 上传
      // =================================================

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


      // =================================================
      // ★ 重点
      //
      // 后端返回：
      //
      // needs_confirmation = true
      //
      // 说明：
      // 账户没有确认
      //
      // 此时不能认为是普通错误。
      // =================================================

      if (
        data?.needs_confirmation === true
      ) {

        const accounts =
          Array.isArray(
            data?.accounts
          )
            ? data.accounts
            : [];


        setUnresolvedAccounts(
          accounts
        );


        setMessage(
          data?.message ||
          "发现尚未确认的账户名称，请先完成账户名称对应。"
        );


        return;

      }


      // =================================================
      // 普通错误
      // =================================================

      if (
        !response.ok ||
        !data?.success
      ) {

        throw new Error(
          data?.error ||
          "Excel 导入失败"
        );

      }


      // =================================================
      // 导入成功
      // =================================================

      const result =
        data.result;


      setMessage(
        `导入完成 · 新增 ${
          result?.inserted ?? 0
        } 笔 · 重复 ${
          result?.duplicated ?? 0
        } 笔 · 失败 ${
          result?.failed ?? 0
        } 笔`
      );


      setFile(null);


      setUnresolvedAccounts(
        []
      );


      // =================================================
      // 重新读取数据库
      // =================================================

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


  // ===================================================
  // 清除上传状态
  // ===================================================

  function clearUploadState() {

    setMessage("");

    setError(null);

    setUnresolvedAccounts([]);

  }


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

          <div
            className="
              flex
              flex-wrap
              items-center
              justify-between
              gap-3
            "
          >

            <div>

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


            {/* ========================================
                账户映射入口
            ======================================== */}

            <Link
              href="/expense-account-mappings"
              className="
                inline-flex
                items-center
                gap-2
                rounded-lg
                border
                border-gray-300
                bg-white
                px-4
                py-2
                text-sm
                font-medium
                text-gray-700
                hover:bg-gray-50
              "
            >

              <span>
                🔗
              </span>

              <span>
                账户名称映射
              </span>

            </Link>

          </div>

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
              mb-4
              text-base
              font-semibold
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

                clearUploadState();

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
                ? "正在检查并导入..."
                : "上传并导入"}

            </button>

          </div>


          {/* ==========================================
              已选择文件
          ========================================== */}

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


          {/* ==========================================
              普通成功信息
          ========================================== */}

          {message &&
            unresolvedAccounts.length === 0 && (

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


          {/* ==========================================
              普通错误
          ========================================== */}

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
            ★ 未确认账户
        ============================================ */}

        {unresolvedAccounts.length > 0 && (

          <div
            className="
              mb-6
              overflow-hidden
              rounded-xl
              border
              border-orange-200
              bg-white
            "
          >

            {/* ========================================
                标题
            ======================================== */}

            <div
              className="
                border-b
                border-orange-200
                bg-orange-50
                px-5
                py-4
              "
            >

              <div
                className="
                  flex
                  flex-wrap
                  items-center
                  justify-between
                  gap-3
                "
              >

                <div>

                  <div
                    className="
                      text-base
                      font-semibold
                      text-orange-800
                    "
                  >
                    ⚠️ 发现尚未确认的账户名称
                  </div>


                  <div
                    className="
                      mt-1
                      text-sm
                      text-orange-700
                    "
                  >
                    本次 Excel 暂未导入。
                    请先完成账户名称对应，然后重新上传。
                  </div>

                </div>


                <Link
                  href="/expense-account-mappings"
                  className="
                    inline-flex
                    items-center
                    gap-2
                    rounded-lg
                    bg-orange-600
                    px-4
                    py-2
                    text-sm
                    font-medium
                    text-white
                    hover:bg-orange-700
                  "
                >

                  <span>
                    🔗
                  </span>

                  <span>
                    去账户名称映射
                  </span>

                </Link>

              </div>

            </div>


            {/* ========================================
                账户列表
            ======================================== */}

            <div
              className="
                divide-y
              "
            >

              {unresolvedAccounts.map(
                account => (

                  <div
                    key={
                      account.source_name
                    }
                    className="
                      flex
                      flex-wrap
                      items-center
                      justify-between
                      gap-4
                      px-5
                      py-4
                    "
                  >

                    {/* ==================================
                        Excel 原始名称
                    ================================== */}

                    <div
                      className="
                        min-w-[220px]
                      "
                    >

                      <div
                        className="
                          text-xs
                          text-gray-500
                        "
                      >
                        Excel 原始账户
                      </div>


                      <div
                        className="
                          mt-1
                          font-semibold
                          text-gray-900
                        "
                      >
                        {account.source_name}
                      </div>


                      {account.account_type && (

                        <div
                          className="
                            mt-1
                            text-xs
                            text-gray-500
                          "
                        >
                          资金类型：
                          {account.account_type}
                        </div>

                      )}

                    </div>


                    {/* ==================================
                        箭头
                    ================================== */}

                    <div
                      className="
                        text-xl
                        text-gray-400
                      "
                    >
                      →
                    </div>


                    {/* ==================================
                        当前标准名称
                    ================================== */}

                    <div
                      className="
                        min-w-[220px]
                        flex-1
                      "
                    >

                      <div
                        className="
                          text-xs
                          text-gray-500
                        "
                      >
                        标准账户名称
                      </div>


                      {account.standard_name ? (

                        <div
                          className="
                            mt-1
                            font-medium
                            text-gray-700
                          "
                        >
                          {account.standard_name}
                        </div>

                      ) : (

                        <div
                          className="
                            mt-1
                            text-sm
                            text-orange-600
                          "
                        >
                          尚未设置
                        </div>

                      )}

                    </div>


                    {/* ==================================
                        状态
                    ================================== */}

                    <div
                      className="
                        shrink-0
                      "
                    >

                      {account.confirmed ? (

                        <span
                          className="
                            inline-flex
                            rounded-full
                            bg-yellow-100
                            px-3
                            py-1
                            text-xs
                            font-medium
                            text-yellow-700
                          "
                        >
                          ⚠️ 未完成标准名称
                        </span>

                      ) : (

                        <span
                          className="
                            inline-flex
                            rounded-full
                            bg-red-100
                            px-3
                            py-1
                            text-xs
                            font-medium
                            text-red-700
                          "
                        >
                          ❌ 未确认
                        </span>

                      )}

                    </div>

                  </div>

                )
              )}

            </div>


            {/* ========================================
                底部提示
            ======================================== */}

            <div
              className="
                border-t
                border-orange-200
                bg-gray-50
                px-5
                py-4
                text-sm
                text-gray-600
              "
            >

              例如：

              <span
                className="
                  mx-1
                  font-medium
                  text-gray-900
                "
              >
                上行信用卡
              </span>

              →

              <span
                className="
                  mx-1
                  font-medium
                  text-blue-600
                "
              >
                上海银行信用卡
              </span>

              。

              确认后重新上传 Excel，
              系统才会正式写入消费流水。

            </div>

          </div>

        )}


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

          {/* ==========================================
              总流水
          ========================================== */}

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


          {/* ==========================================
              总支出
          ========================================== */}

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


          {/* ==========================================
              信用卡消费
          ========================================== */}

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


          {/* ==========================================
              非信用卡消费
          ========================================== */}

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


          {/* ==========================================
              平账
          ========================================== */}

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

          {/* ==========================================
              标题
          ========================================== */}

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


          {/* ==========================================
              表格
          ========================================== */}

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

                {/* ====================================
                    加载中
                ==================================== */}

                {loading && (

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
                      正在加载消费流水...
                    </td>

                  </tr>

                )}


                {/* ====================================
                    无数据
                ==================================== */}

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


                {/* ====================================
                    数据
                ==================================== */}

                {!loading &&
                  transactions.map(
                    item => (

                      <tr
                        key={item.id}
                        className="
                          hover:bg-gray-50
                        "
                      >

                        {/* 时间 */}

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


                        {/* 账户 */}

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


                        {/* 类型 */}

                        <td
                          className="
                            px-5
                            py-3
                          "
                        >
                          {item.account_type ||
                            "-"}
                        </td>


                        {/* 收支 */}

                        <td
                          className="
                            px-5
                            py-3
                          "
                        >
                          {item.income_expense_type ||
                            "-"}
                        </td>


                        {/* 分类 */}

                        <td
                          className="
                            px-5
                            py-3
                          "
                        >
                          {item.category ||
                            "-"}
                        </td>


                        {/* 金额 */}

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


                        {/* 成员 */}

                        <td
                          className="
                            px-5
                            py-3
                          "
                        >
                          {item.member ||
                            "-"}
                        </td>


                        {/* 备注 */}

                        <td
                          className="
                            px-5
                            py-3
                          "
                        >
                          {item.remark ||
                            "-"}
                        </td>


                        {/* 信用卡 */}

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


                        {/* 平账 */}

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
            ② 上传前系统会检查「资金账户名称」是否已经完成标准名称对应。
          </div>


          <div>
            ③ 如果发现未确认账户，本次 Excel 不会写入数据库，需要先完成账户名称映射。
          </div>


          <div>
            ④ 例如「上行信用卡」可以对应为标准名称「上海银行信用卡」。
          </div>


          <div>
            ⑤ 确认映射后重新上传，expense_transactions 保存标准账户名称。
          </div>


          <div>
            ⑥ 系统根据「资金类型」自动识别信用卡。
          </div>


          <div>
            ⑦ 明确包含「平账 / 平帐」的流水自动标记为平账。
          </div>


          <div>
            ⑧ 相同交易 Hash 自动去重，重复上传 Excel 不会重复计算。
          </div>


          <div>
            ⑨ /credit-card-from-yu 会直接读取这里保存的信用卡流水。
          </div>

        </div>


        {/* ============================================
            如果未确认账户，底部再次提示
        ============================================ */}

        {unresolvedAccounts.length > 0 && (

          <div
            className="
              mt-5
              flex
              flex-wrap
              items-center
              justify-between
              gap-3
              rounded-xl
              border
              border-blue-200
              bg-blue-50
              px-5
              py-4
            "
          >

            <div>

              <div
                className="
                  font-medium
                  text-blue-800
                "
              >
                完成账户映射后，请重新上传刚才的 Excel。
              </div>


              <div
                className="
                  mt-1
                  text-xs
                  text-blue-600
                "
              >
                系统不会保存本次未确认的 Excel 流水。
              </div>

            </div>


            <Link
              href="/expense-account-mappings"
              className="
                rounded-lg
                bg-blue-600
                px-4
                py-2
                text-sm
                font-medium
                text-white
                hover:bg-blue-700
              "
            >
              管理账户映射
            </Link>

          </div>

        )}

      </main>

    </div>

  );

}