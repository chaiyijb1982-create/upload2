"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { supabase } from "@/lib/supabase";


// =====================================================
// 类型
// =====================================================

type Holding = {

  id: number;

  code: string;

  name: string;

  market: string;

  category: string;

  amount: number | null;

  updated_at?: string | null;

  cost: number | null;

  profit: number | null;

  profit_rate: number | null;

  currency: string;

  nav: number | null;

  shares: number | null;

  platform: string;

  active: boolean;

};


// =====================================================
// 空表单
// =====================================================

const emptyForm = {

  code: "",

  name: "",

  market: "",

  category: "",

  amount: "",

  cost: "",

  profit: "",

  profit_rate: "",

  currency: "",

  nav: "",

  shares: "",

  platform: "",

};


// =====================================================
// 下拉选项
// =====================================================

const MARKET_OPTIONS = [

  "CN",

  "HK",

  "US",

  "GLOBAL",

];


const CATEGORY_OPTIONS = [

  "fixed_income",

  "global_stock",

  "china_stock",

  "gold",

];


const CURRENCY_OPTIONS = [

  "CNY",

  "USD",

  "HKD",

  "EUR",

  "GBP",

  "JPY",

];


// =====================================================
// 工具
// =====================================================

function numberValue(
  value: any
) {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {

    return null;

  }

  const n =
    Number(value);

  return Number.isFinite(n)
    ? n
    : null;

}


function formatMoney(
  value: any
) {

  const n =
    Number(value);

  if (!Number.isFinite(n)) {

    return "—";

  }

  return n.toLocaleString(
    "zh-CN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }
  );

}


function formatNumber(
  value: any
) {

  const n =
    Number(value);

  if (!Number.isFinite(n)) {

    return "—";

  }

  return n.toLocaleString(
    "zh-CN",
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4,
    }
  );

}


function formatPercent(
  value: any
) {

  const n =
    Number(value);

  if (!Number.isFinite(n)) {

    return "—";

  }

  return `${n.toFixed(2)}%`;

}


function getProfitClass(
  value: any
) {

  const n =
    Number(value);

  if (n > 0) {

    return "text-emerald-600";

  }

  if (n < 0) {

    return "text-red-500";

  }

  return "text-gray-500";

}


// =====================================================
// 页面
// =====================================================

export default function AssetManagementPage() {


  // ===================================================
  // 数据
  // ===================================================

  const [
    holdings,
    setHoldings,
  ] = useState<Holding[]>([]);


  // ===================================================
  // 状态
  // ===================================================

  const [
    loading,
    setLoading,
  ] = useState(true);


  const [
    saving,
    setSaving,
  ] = useState(false);


  const [
    error,
    setError,
  ] = useState("");


  const [
    success,
    setSuccess,
  ] = useState("");


  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);


  const [
    editingId,
    setEditingId,
  ] = useState<number | null>(
    null
  );


  const [
    form,
    setForm,
  ] = useState<any>(
    emptyForm
  );


  const [
    search,
    setSearch,
  ] = useState("");


  // ===================================================
  // 加载 Holdings
  // ===================================================

  async function loadHoldings() {

    setLoading(true);

    setError("");

    const {
      data,
      error,
    } = await supabase

      .from("holdings")

      .select("*")

      .order(
        "active",
        {
          ascending: false,
        }
      )

      .order(
        "amount",
        {
          ascending: false,
          nullsFirst: false,
        }
      );


    if (error) {

      console.error(
        "load holdings error:",
        error
      );

      setError(
        `读取资产失败：${error.message}`
      );

      setHoldings([]);

      setLoading(false);

      return;

    }


    setHoldings(
      (data || []) as Holding[]
    );

    setLoading(false);

  }


  // ===================================================
  // 初始加载
  // ===================================================

  useEffect(() => {

    loadHoldings();

  }, []);


  // ===================================================
  // 当前资产
  // ===================================================

  const activeHoldings =
    useMemo(() => {

      const keyword =
        search
          .trim()
          .toLowerCase();


      return holdings

        .filter(
          item =>
            item.active === true
        )

        .filter(
          item => {

            if (!keyword) {

              return true;

            }


            return [

              item.code,

              item.name,

              item.market,

              item.category,

              item.platform,

              item.currency,

            ]

              .join(" ")

              .toLowerCase()

              .includes(keyword);

          }
        );

    }, [
      holdings,
      search,
    ]);


  // ===================================================
  // 已停用资产
  // ===================================================

  const inactiveHoldings =
    useMemo(() => {

      return holdings

        .filter(
          item =>
            item.active === false
        )

        .filter(
          item => {

            const keyword =
              search
                .trim()
                .toLowerCase();


            if (!keyword) {

              return true;

            }


            return [

              item.code,

              item.name,

              item.market,

              item.category,

              item.platform,

              item.currency,

            ]

              .join(" ")

              .toLowerCase()

              .includes(keyword);

          }
        );

    }, [
      holdings,
      search,
    ]);


  // ===================================================
  // 当前资产总市值
  // ===================================================

  const activeTotal =
    useMemo(() => {

      return activeHoldings.reduce(

        (
          total,
          item
        ) => {

          return (
            total +
            Number(
              item.amount ||
              0
            )
          );

        },

        0

      );

    }, [
      activeHoldings,
    ]);


  // ===================================================
  // 打开新增
  // ===================================================

  function openAdd() {

    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    setError("");

    setSuccess("");

    setModalOpen(true);

  }


  // ===================================================
  // 打开编辑
  // ===================================================

  function openEdit(
    item: Holding
  ) {

    setEditingId(
      item.id
    );


    setForm({

      code:
        item.code ?? "",

      name:
        item.name ?? "",

      market:
        item.market ?? "",

      category:
        item.category ?? "",

      amount:
        item.amount ?? "",

      cost:
        item.cost ?? "",

      profit:
        item.profit ?? "",

      profit_rate:
        item.profit_rate ?? "",

      currency:
        item.currency ?? "",

      nav:
        item.nav ?? "",

      shares:
        item.shares ?? "",

      platform:
        item.platform ?? "",

    });


    setError("");

    setSuccess("");

    setModalOpen(true);

  }


  // ===================================================
  // 表单修改
  // ===================================================

  function updateForm(
    field: string,
    value: string
  ) {

    setForm(
      (
        previous: any
      ) => ({

        ...previous,

        [field]:
          value,

      })
    );

  }


  // ===================================================
  // 保存
  // ===================================================

  async function handleSave(
    e: React.FormEvent
  ) {

    e.preventDefault();


    setError("");

    setSuccess("");


    // -----------------------------------------------
    // 基础检查
    // -----------------------------------------------

    if (
      !form.code.trim()
    ) {

      setError(
        "请输入资产 Code"
      );

      return;

    }


    if (
      !form.name.trim()
    ) {

      setError(
        "请输入资产名称"
      );

      return;

    }


    if (
      !form.market.trim()
    ) {

      setError(
        "请选择 Market"
      );

      return;

    }


    if (
      !form.category.trim()
    ) {

      setError(
        "请选择 Category"
      );

      return;

    }


    if (
      !form.platform.trim()
    ) {

      setError(
        "请输入 Platform"
      );

      return;

    }


    if (
      !form.currency.trim()
    ) {

      setError(
        "请选择 Currency"
      );

      return;

    }


    setSaving(true);


    // -----------------------------------------------
    // 数据
    // -----------------------------------------------

    const payload = {

      code:
        form.code
          .trim(),

      name:
        form.name
          .trim(),

      market:
        form.market
          .trim(),

      category:
        form.category
          .trim(),

      amount:
        numberValue(
          form.amount
        ),

      cost:
        numberValue(
          form.cost
        ),

      profit:
        numberValue(
          form.profit
        ),

      profit_rate:
        numberValue(
          form.profit_rate
        ),

      currency:
        form.currency
          .trim(),

      nav:
        numberValue(
          form.nav
        ),

      shares:
        numberValue(
          form.shares
        ),

      platform:
        form.platform
          .trim(),

    };


    try {


      // =================================================
      // 编辑
      // =================================================

      if (
        editingId !== null
      ) {

        const {
          error,
        } = await supabase

          .from("holdings")

          .update({

            ...payload,

            updated_at:
              new Date()
                .toISOString(),

          })

          .eq(
            "id",
            editingId
          );


        if (error) {

          console.error(
            "update holding error:",
            error
          );

          setError(
            `保存失败：${error.message}`
          );

          setSaving(false);

          return;

        }


        setSuccess(
          "资产修改成功"
        );

      }


      // =================================================
      // 新增
      // =================================================

      else {

        const {
          error,
        } = await supabase

          .from("holdings")

          .insert({

            ...payload,

            active: true,

            updated_at:
              new Date()
                .toISOString(),

          });


        if (error) {

          console.error(
            "insert holding error:",
            error
          );

          setError(
            `保存失败：${error.message}`
          );

          setSaving(false);

          return;

        }


        setSuccess(
          "资产添加成功"
        );

      }


      // =================================================
      // 重新读取
      // =================================================

      await loadHoldings();


      setModalOpen(false);

      setEditingId(null);

      setForm({
        ...emptyForm,
      });


    } catch (
      err: any
    ) {

      console.error(
        err
      );

      setError(
        `保存失败：${
          err?.message ||
          "未知错误"
        }`
      );

    }


    setSaving(false);

  }


  // ===================================================
  // 停用资产
  // ===================================================

  async function deactivateAsset(
    item: Holding
  ) {

    const confirmed =
      window.confirm(

        `确定要停用「${item.name}」吗？\n\n` +

        `停用后它将从当前持仓中消失，` +

        `但历史记录不会删除。`

      );


    if (!confirmed) {

      return;

    }


    setError("");

    setSuccess("");


    const {
      error,
    } = await supabase

      .from("holdings")

      .update({

        active: false,

        amount: 0,

        updated_at:
          new Date()
            .toISOString(),

      })

      .eq(
        "id",
        item.id
      );


    if (error) {

      console.error(
        "deactivate error:",
        error
      );

      setError(
        `停用失败：${error.message}`
      );

      return;

    }


    setSuccess(
      `${item.name} 已停用`
    );


    await loadHoldings();

  }


  // ===================================================
  // 重新买入
  // ===================================================

  async function reactivateAsset(
    item: Holding
  ) {

    const confirmed =
      window.confirm(

        `确定重新买入「${item.name}」吗？\n\n` +

        `该资产会重新出现在当前持仓中。`

      );


    if (!confirmed) {

      return;

    }


    setError("");

    setSuccess("");


    const {
      error,
    } = await supabase

      .from("holdings")

      .update({

        active: true,

        updated_at:
          new Date()
            .toISOString(),

      })

      .eq(
        "id",
        item.id
      );


    if (error) {

      console.error(
        "reactivate error:",
        error
      );

      setError(
        `重新买入失败：${error.message}`
      );

      return;

    }


    setSuccess(
      `${item.name} 已重新激活`
    );


    await loadHoldings();

  }


  // ===================================================
  // 删除
  // ===================================================

  async function deleteAsset(
    item: Holding
  ) {

    const confirmed =
      window.confirm(

        `⚠️ 确定要永久删除「${item.name}」吗？\n\n` +

        `删除后数据库中的这条 holdings 记录将永久消失。\n` +

        `如果只是卖出，请使用「停用」，不要删除。`

      );


    if (!confirmed) {

      return;

    }


    setError("");

    setSuccess("");


    const {
      error,
    } = await supabase

      .from("holdings")

      .delete()

      .eq(
        "id",
        item.id
      );


    if (error) {

      console.error(
        "delete holding error:",
        error
      );

      setError(
        `删除失败：${error.message}`
      );

      return;

    }


    setSuccess(
      `${item.name} 已删除`
    );


    await loadHoldings();

  }


  // ===================================================
  // 渲染
  // ===================================================

  return (

    <div
      className="
        min-h-screen
        bg-gray-50
        px-6
        py-6
      "
    >

      <div
        className="
          mx-auto
          max-w-[1500px]
        "
      >

        {/* =================================================
            页面标题
        ================================================= */}

        <div
          className="
            mb-6
            flex
            items-center
            justify-between
          "
        >

          <div>

            <h1
              className="
                text-2xl
                font-semibold
                text-gray-900
              "
            >
              Asset Management
            </h1>


            <p
              className="
                mt-1
                text-sm
                text-gray-500
              "
            >
              管理当前持仓、已停用资产以及重新买入
            </p>

          </div>


          <button
            onClick={openAdd}
            className="
              rounded-lg
              bg-gray-900
              px-5
              py-2.5
              text-sm
              font-medium
              text-white
              shadow-sm
              transition
              hover:bg-gray-800
            "
          >
            + Add Asset
          </button>

        </div>


        {/* =================================================
            提示
        ================================================= */}

        {error && (

          <div
            className="
              mb-4
              rounded-lg
              border
              border-red-200
              bg-red-50
              px-4
              py-3
              text-sm
              text-red-600
            "
          >
            {error}
          </div>

        )}


        {success && (

          <div
            className="
              mb-4
              rounded-lg
              border
              border-emerald-200
              bg-emerald-50
              px-4
              py-3
              text-sm
              text-emerald-600
            "
          >
            {success}
          </div>

        )}


        {/* =================================================
            搜索
        ================================================= */}

        <div
          className="
            mb-5
            flex
            items-center
            justify-between
            gap-4
          "
        >

          <div
            className="
              relative
              w-full
              max-w-md
            "
          >

            <input

              value={search}

              onChange={
                e =>
                  setSearch(
                    e.target.value
                  )
              }

              placeholder="Search code / name / platform..."

              className="
                w-full
                rounded-lg
                border
                border-gray-200
                bg-white
                px-4
                py-2.5
                text-sm
                outline-none
                transition
                focus:border-gray-400
                focus:ring-2
                focus:ring-gray-100
              "

            />

          </div>


          <div
            className="
              text-sm
              text-gray-500
            "
          >

            Current Assets：

            <span
              className="
                ml-1
                font-semibold
                text-gray-900
              "
            >
              {activeHoldings.length}
            </span>

            <span
              className="
                mx-2
                text-gray-300
              "
            >
              |
            </span>

            Total：

            <span
              className="
                ml-1
                font-semibold
                text-gray-900
              "
            >
              ¥{formatMoney(activeTotal)}
            </span>

          </div>

        </div>


        {/* =================================================
            CURRENT HOLDINGS
        ================================================= */}

        <section
          className="
            overflow-hidden
            rounded-xl
            border
            border-gray-200
            bg-white
            shadow-sm
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-gray-200
              px-5
              py-4
            "
          >

            <div>

              <h2
                className="
                  text-base
                  font-semibold
                  text-gray-900
                "
              >
                Current Holdings
              </h2>


              <p
                className="
                  mt-0.5
                  text-xs
                  text-gray-500
                "
              >
                当前正在持有的资产
              </p>

            </div>


            <span
              className="
                rounded-full
                bg-emerald-50
                px-3
                py-1
                text-xs
                font-medium
                text-emerald-600
              "
            >
              {activeHoldings.length} Assets
            </span>

          </div>


          {loading ? (

            <div
              className="
                px-5
                py-12
                text-center
                text-sm
                text-gray-400
              "
            >
              Loading...
            </div>

          ) : activeHoldings.length === 0 ? (

            <div
              className="
                px-5
                py-14
                text-center
              "
            >

              <div
                className="
                  text-3xl
                "
              >
                📊
              </div>

              <div
                className="
                  mt-3
                  text-sm
                  font-medium
                  text-gray-700
                "
              >
                暂无当前持仓
              </div>

              <div
                className="
                  mt-1
                  text-xs
                  text-gray-400
                "
              >
                点击右上角 Add Asset 添加第一项资产
              </div>

            </div>

          ) : (

            <div
              className="
                overflow-x-auto
              "
            >

              <table
                className="
                  min-w-[1350px]
                  w-full
                  text-sm
                "
              >

                <thead>

                  <tr
                    className="
                      border-b
                      border-gray-100
                      bg-gray-50/70
                      text-xs
                      text-gray-500
                    "
                  >

                    <th className="px-5 py-3 text-left font-medium">
                      Asset
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Market
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Category
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Platform
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Shares
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      NAV
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Amount
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Cost
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Profit
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Profit %
                    </th>

                    <th className="px-5 py-3 text-right font-medium">
                      Actions
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {activeHoldings.map(
                    item => (

                      <tr
                        key={item.id}
                        className="
                          border-b
                          border-gray-100
                          last:border-b-0
                          hover:bg-gray-50/60
                        "
                      >

                        <td className="px-5 py-4">

                          <div className="font-medium text-gray-900">
                            {item.name || "—"}
                          </div>

                          <div className="mt-0.5 text-xs text-gray-400">
                            {item.code || "—"}
                          </div>

                          <div className="mt-0.5 text-[11px] text-gray-400">
                            {item.currency || "—"}
                          </div>

                        </td>


                        <td className="px-4 py-4 text-gray-600">
                          {item.market || "—"}
                        </td>


                        <td className="px-4 py-4">

                          <span
                            className="
                              rounded-md
                              bg-gray-100
                              px-2
                              py-1
                              text-xs
                              text-gray-600
                            "
                          >
                            {item.category || "—"}
                          </span>

                        </td>


                        <td className="px-4 py-4 text-gray-600">
                          {item.platform || "—"}
                        </td>


                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            tabular-nums
                            text-gray-700
                          "
                        >
                          {formatNumber(item.shares)}
                        </td>


                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            tabular-nums
                            text-gray-700
                          "
                        >
                          {formatNumber(item.nav)}
                        </td>


                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            font-medium
                            tabular-nums
                            text-gray-900
                          "
                        >
                          ¥{formatMoney(item.amount)}
                        </td>


                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            tabular-nums
                            text-gray-600
                          "
                        >
                          ¥{formatMoney(item.cost)}
                        </td>


                        <td
                          className={`
                            px-4
                            py-4
                            text-right
                            font-medium
                            tabular-nums
                            ${getProfitClass(item.profit)}
                          `}
                        >
                          ¥{formatMoney(item.profit)}
                        </td>


                        <td
                          className={`
                            px-4
                            py-4
                            text-right
                            font-medium
                            tabular-nums
                            ${getProfitClass(item.profit_rate)}
                          `}
                        >
                          {formatPercent(item.profit_rate)}
                        </td>


                        <td className="px-5 py-4">

                          <div
                            className="
                              flex
                              justify-end
                              gap-2
                            "
                          >

                            <button
                              onClick={() =>
                                openEdit(item)
                              }
                              className="
                                rounded-md
                                border
                                border-gray-200
                                bg-white
                                px-3
                                py-1.5
                                text-xs
                                font-medium
                                text-gray-700
                                hover:bg-gray-50
                              "
                            >
                              编辑
                            </button>


                            <button
                              onClick={() =>
                                deactivateAsset(item)
                              }
                              className="
                                rounded-md
                                border
                                border-amber-200
                                bg-amber-50
                                px-3
                                py-1.5
                                text-xs
                                font-medium
                                text-amber-700
                                hover:bg-amber-100
                              "
                            >
                              停用
                            </button>

                          </div>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>


        {/* =================================================
            INACTIVE / SOLD ASSETS
        ================================================= */}

        <section
          className="
            mt-7
            overflow-hidden
            rounded-xl
            border
            border-gray-200
            bg-white
            shadow-sm
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              border-b
              border-gray-200
              px-5
              py-4
            "
          >

            <div>

              <h2
                className="
                  text-base
                  font-semibold
                  text-gray-900
                "
              >
                Inactive / Sold Assets
              </h2>


              <p
                className="
                  mt-0.5
                  text-xs
                  text-gray-500
                "
              >
                已卖出或暂时停用的历史资产
              </p>

            </div>


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
              {inactiveHoldings.length} Assets
            </span>

          </div>


          {inactiveHoldings.length === 0 ? (

            <div
              className="
                px-5
                py-12
                text-center
                text-sm
                text-gray-400
              "
            >
              暂无已停用资产
            </div>

          ) : (

            <div
              className="
                overflow-x-auto
              "
            >

              <table
                className="
                  min-w-[1100px]
                  w-full
                  text-sm
                "
              >

                <thead>

                  <tr
                    className="
                      border-b
                      border-gray-100
                      bg-gray-50/70
                      text-xs
                      text-gray-500
                    "
                  >

                    <th className="px-5 py-3 text-left font-medium">
                      Asset
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Market
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Category
                    </th>

                    <th className="px-4 py-3 text-left font-medium">
                      Platform
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Last Amount
                    </th>

                    <th className="px-4 py-3 text-right font-medium">
                      Profit
                    </th>

                    <th className="px-5 py-3 text-right font-medium">
                      Actions
                    </th>

                  </tr>

                </thead>


                <tbody>

                  {inactiveHoldings.map(
                    item => (

                      <tr
                        key={item.id}
                        className="
                          border-b
                          border-gray-100
                          last:border-b-0
                          hover:bg-gray-50/60
                        "
                      >

                        <td className="px-5 py-4">

                          <div
                            className="
                              font-medium
                              text-gray-700
                            "
                          >
                            {item.name || "—"}
                          </div>

                          <div
                            className="
                              mt-0.5
                              text-xs
                              text-gray-400
                            "
                          >
                            {item.code || "—"}
                          </div>

                        </td>


                        <td className="px-4 py-4 text-gray-500">
                          {item.market || "—"}
                        </td>


                        <td className="px-4 py-4">

                          <span
                            className="
                              rounded-md
                              bg-gray-100
                              px-2
                              py-1
                              text-xs
                              text-gray-500
                            "
                          >
                            {item.category || "—"}
                          </span>

                        </td>


                        <td className="px-4 py-4 text-gray-500">
                          {item.platform || "—"}
                        </td>


                        <td
                          className="
                            px-4
                            py-4
                            text-right
                            tabular-nums
                            text-gray-500
                          "
                        >
                          ¥{formatMoney(item.amount)}
                        </td>


                        <td
                          className={`
                            px-4
                            py-4
                            text-right
                            font-medium
                            tabular-nums
                            ${getProfitClass(item.profit)}
                          `}
                        >
                          ¥{formatMoney(item.profit)}
                        </td>


                        <td className="px-5 py-4">

                          <div
                            className="
                              flex
                              justify-end
                              gap-2
                            "
                          >

                            <button
                              onClick={() =>
                                reactivateAsset(item)
                              }
                              className="
                                rounded-md
                                border
                                border-emerald-200
                                bg-emerald-50
                                px-3
                                py-1.5
                                text-xs
                                font-medium
                                text-emerald-700
                                hover:bg-emerald-100
                              "
                            >
                              重新买入
                            </button>


                            <button
                              onClick={() =>
                                openEdit(item)
                              }
                              className="
                                rounded-md
                                border
                                border-gray-200
                                bg-white
                                px-3
                                py-1.5
                                text-xs
                                font-medium
                                text-gray-600
                                hover:bg-gray-50
                              "
                            >
                              编辑
                            </button>


                            <button
                              onClick={() =>
                                deleteAsset(item)
                              }
                              className="
                                rounded-md
                                border
                                border-red-200
                                bg-red-50
                                px-3
                                py-1.5
                                text-xs
                                font-medium
                                text-red-600
                                hover:bg-red-100
                              "
                            >
                              删除
                            </button>

                          </div>

                        </td>

                      </tr>

                    )
                  )}

                </tbody>

              </table>

            </div>

          )}

        </section>

      </div>


      {/* =================================================
          ADD / EDIT MODAL
      ================================================= */}

      {modalOpen && (

        <div
          className="
            fixed
            inset-0
            z-50
            flex
            items-center
            justify-center
            bg-black/40
            px-4
            py-8
          "
          onMouseDown={
            e => {

              if (
                e.target === e.currentTarget
              ) {

                setModalOpen(false);

              }

            }
          }
        >

          <div
            className="
              max-h-[90vh]
              w-full
              max-w-4xl
              overflow-y-auto
              rounded-2xl
              bg-white
              shadow-2xl
            "
          >

            {/* Modal Header */}

            <div
              className="
                sticky
                top-0
                z-10
                flex
                items-center
                justify-between
                border-b
                border-gray-200
                bg-white
                px-6
                py-4
              "
            >

              <div>

                <h2
                  className="
                    text-lg
                    font-semibold
                    text-gray-900
                  "
                >
                  {editingId !== null
                    ? "Edit Asset"
                    : "Add Asset"}
                </h2>


                <p
                  className="
                    mt-0.5
                    text-xs
                    text-gray-500
                  "
                >
                  {editingId !== null
                    ? "修改资产信息"
                    : "添加新的投资资产"}
                </p>

              </div>


              <button
                onClick={() =>
                  setModalOpen(false)
                }
                className="
                  flex
                  h-8
                  w-8
                  items-center
                  justify-center
                  rounded-full
                  text-gray-400
                  hover:bg-gray-100
                  hover:text-gray-700
                "
              >
                ×
              </button>

            </div>


            {/* Form */}

            <form
              onSubmit={handleSave}
              className="
                p-6
              "
            >

              {/* =================================================
                  Basic Information
              ================================================= */}

              <div
                className="
                  mb-6
                "
              >

                <h3
                  className="
                    mb-4
                    text-sm
                    font-semibold
                    text-gray-900
                  "
                >
                  Basic Information
                </h3>


                <div
                  className="
                    grid
                    grid-cols-1
                    gap-4
                    md:grid-cols-2
                    lg:grid-cols-3
                  "
                >

                  <FormInput
                    label="Code"
                    value={form.code}
                    onChange={
                      value =>
                        updateForm(
                          "code",
                          value
                        )
                    }
                    placeholder="例如 VOO / 015736"
                    required
                  />


                  <FormInput
                    label="Name"
                    value={form.name}
                    onChange={
                      value =>
                        updateForm(
                          "name",
                          value
                        )
                    }
                    placeholder="资产名称"
                    required
                  />


                  {/* Market 下拉 */}

                  <FormInput
                    label="Market"
                    value={form.market}
                    onChange={
                      value =>
                        updateForm(
                          "market",
                          value
                        )
                    }
                    options={MARKET_OPTIONS}
                    required
                  />


                  {/* Category 下拉 */}

                  <FormInput
                    label="Category"
                    value={form.category}
                    onChange={
                      value =>
                        updateForm(
                          "category",
                          value
                        )
                    }
                    options={CATEGORY_OPTIONS}
                    required
                  />


                  {/* Currency 下拉 */}

                  <FormInput
                    label="Currency"
                    value={form.currency}
                    onChange={
                      value =>
                        updateForm(
                          "currency",
                          value
                        )
                    }
                    options={CURRENCY_OPTIONS}
                    required
                  />


                  {/* Platform 手动输入 */}

                  <FormInput
                    label="Platform"
                    value={form.platform}
                    onChange={
                      value =>
                        updateForm(
                          "platform",
                          value
                        )
                    }
                    placeholder="券商 / 银行 / 平台"
                    required
                  />

                </div>

              </div>


              {/* =================================================
                  Position
              ================================================= */}

              <div
                className="
                  mb-6
                "
              >

                <h3
                  className="
                    mb-4
                    text-sm
                    font-semibold
                    text-gray-900
                  "
                >
                  Position
                </h3>


                <div
                  className="
                    grid
                    grid-cols-1
                    gap-4
                    md:grid-cols-2
                    lg:grid-cols-3
                  "
                >

                  <FormInput
                    label="Shares"
                    value={form.shares}
                    onChange={
                      value =>
                        updateForm(
                          "shares",
                          value
                        )
                    }
                    type="number"
                    step="0.000001"
                    placeholder="持有数量"
                  />


                  <FormInput
                    label="NAV / Price"
                    value={form.nav}
                    onChange={
                      value =>
                        updateForm(
                          "nav",
                          value
                        )
                    }
                    type="number"
                    step="0.000001"
                    placeholder="最新净值 / 价格"
                  />


                  <FormInput
                    label="Amount"
                    value={form.amount}
                    onChange={
                      value =>
                        updateForm(
                          "amount",
                          value
                        )
                    }
                    type="number"
                    step="0.01"
                    placeholder="当前市值"
                  />


                  <FormInput
                    label="Cost"
                    value={form.cost}
                    onChange={
                      value =>
                        updateForm(
                          "cost",
                          value
                        )
                    }
                    type="number"
                    step="0.01"
                    placeholder="持仓成本"
                  />


                  <FormInput
                    label="Profit"
                    value={form.profit}
                    onChange={
                      value =>
                        updateForm(
                          "profit",
                          value
                        )
                    }
                    type="number"
                    step="0.01"
                    placeholder="收益"
                  />


                  <FormInput
                    label="Profit Rate"
                    value={form.profit_rate}
                    onChange={
                      value =>
                        updateForm(
                          "profit_rate",
                          value
                        )
                    }
                    type="number"
                    step="0.0001"
                    placeholder="例如 12.35"
                  />

                </div>

              </div>


              {/* =================================================
                  Error
              ================================================= */}

              {error && (

                <div
                  className="
                    mb-4
                    rounded-lg
                    border
                    border-red-200
                    bg-red-50
                    px-4
                    py-3
                    text-sm
                    text-red-600
                  "
                >
                  {error}
                </div>

              )}


              {/* =================================================
                  Buttons
              ================================================= */}

              <div
                className="
                  flex
                  justify-end
                  gap-3
                  border-t
                  border-gray-100
                  pt-5
                "
              >

                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(false)
                  }
                  className="
                    rounded-lg
                    border
                    border-gray-200
                    bg-white
                    px-5
                    py-2.5
                    text-sm
                    font-medium
                    text-gray-600
                    hover:bg-gray-50
                  "
                >
                  Cancel
                </button>


                <button
                  type="submit"
                  disabled={saving}
                  className="
                    rounded-lg
                    bg-gray-900
                    px-6
                    py-2.5
                    text-sm
                    font-medium
                    text-white
                    disabled:cursor-not-allowed
                    disabled:opacity-50
                    hover:bg-gray-800
                  "
                >
                  {saving
                    ? "Saving..."
                    : editingId !== null
                      ? "Save Changes"
                      : "Add Asset"}
                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>

  );

}


// =====================================================
// Form Input
// 支持普通 Input + Select 下拉菜单
// =====================================================

function FormInput({

  label,

  value,

  onChange,

  type = "text",

  step,

  placeholder,

  required = false,

  options,

}: {

  label: string;

  value: any;

  onChange: (
    value: string
  ) => void;

  type?: string;

  step?: string;

  placeholder?: string;

  required?: boolean;

  options?: string[];

}) {

  return (

    <div>

      <label
        className="
          mb-1.5
          block
          text-xs
          font-medium
          text-gray-600
        "
      >

        {label}

        {required && (

          <span
            className="
              ml-1
              text-red-500
            "
          >
            *
          </span>

        )}

      </label>


      {options ? (

        <select

          value={
            value ?? ""
          }

          onChange={
            e =>
              onChange(
                e.target.value
              )
          }

          required={required}

          className="
            w-full
            rounded-lg
            border
            border-gray-200
            bg-white
            px-3.5
            py-2.5
            text-sm
            text-gray-900
            outline-none
            transition
            focus:border-gray-400
            focus:ring-2
            focus:ring-gray-100
          "
        >

          <option value="">
            请选择
          </option>

          {options.map(
            option => (

              <option
                key={option}
                value={option}
              >
                {option}
              </option>

            )
          )}

        </select>

      ) : (

        <input

          value={
            value ?? ""
          }

          onChange={
            e =>
              onChange(
                e.target.value
              )
          }

          type={type}

          step={step}

          required={required}

          placeholder={placeholder}

          className="
            w-full
            rounded-lg
            border
            border-gray-200
            bg-white
            px-3.5
            py-2.5
            text-sm
            text-gray-900
            outline-none
            transition
            placeholder:text-gray-300
            focus:border-gray-400
            focus:ring-2
            focus:ring-gray-100
          "

        />

      )}

    </div>

  );

}