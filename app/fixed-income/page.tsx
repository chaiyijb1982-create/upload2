"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getFixedIncomeAssets,
  createFixedIncomeAsset,
  updateFixedIncomeAsset,
  deleteFixedIncomeAsset,
} from "@/lib/fixed-income";

import TopBar from "@/components/TopBar";


// =====================================================
// 类型
// =====================================================

type FixedIncomeAsset = {

  id: string;

  type: string;

  name: string;

  institution?: string | null;

  amount: number;

  interest_rate?: number | null;

  auto_interest: boolean;

  interest_date?: string | null;

  updated_at?: string | null;

  note?: string | null;

  created_at?: string | null;

};


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


// =====================================================
// 金额
// =====================================================

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


// =====================================================
// 精确金额
// =====================================================

function moneyExact(
  value: number
): string {

  return (
    "¥" +
    Math.round(
      toNumber(value)
    ).toLocaleString(
      "zh-CN"
    )
  );

}


// =====================================================
// 日期
// =====================================================

function todayString(): string {

  const d =
    new Date();

  const year =
    d.getFullYear();

  const month =
    String(
      d.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      d.getDate()
    ).padStart(
      2,
      "0"
    );

  return (
    `${year}-${month}-${day}`
  );

}


// =====================================================
// 计算每日利息
// =====================================================

function getDailyInterest(
  asset: FixedIncomeAsset
): number {

  if (
    !asset.auto_interest
  ) {

    return 0;

  }

  const amount =
    toNumber(
      asset.amount
    );

  const rate =
    toNumber(
      asset.interest_rate
    );

  if (
    amount <= 0 ||
    rate <= 0
  ) {

    return 0;

  }

  return (
    amount *
    (
      rate /
      100
    ) /
    365
  );

}


// =====================================================
// 类型
// =====================================================

const assetTypes = [

  "万能险",

  "活期",

  "银行理财",

  "定期存款",

  "货币基金",

  "债券",

  "固收理财",

  "其他",

];


// =====================================================
// 页面
// =====================================================

export default function FixedIncomePage() {

  // ===================================================
  // 数据
  // ===================================================

  const [
    assets,
    setAssets
  ] = useState<
    FixedIncomeAsset[]
  >([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    deletingId,
    setDeletingId
  ] = useState<string | null>(
    null
  );


  // ===================================================
  // 编辑状态
  // ===================================================

  const [
    editingId,
    setEditingId
  ] = useState<string | null>(
    null
  );


  // ===================================================
  // 表单
  // ===================================================

  const [
    type,
    setType
  ] = useState(
    "活期"
  );

  const [
    name,
    setName
  ] = useState("");

  const [
    institution,
    setInstitution
  ] = useState("");

  const [
    amount,
    setAmount
  ] = useState("");

  const [
    interestRate,
    setInterestRate
  ] = useState("");

  const [
    autoInterest,
    setAutoInterest
  ] = useState(false);

  const [
    interestDate,
    setInterestDate
  ] = useState(
    todayString()
  );

  const [
    note,
    setNote
  ] = useState("");

  const [
    errorMessage,
    setErrorMessage
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage
  ] = useState("");


  // ===================================================
  // 读取数据
  // ===================================================

  async function loadAssets() {

    try {

      setLoading(true);

      const data =
        await getFixedIncomeAssets();

      setAssets(
        Array.isArray(data)
          ? data
          : []
      );

    } catch (error) {

      console.error(
        "Fixed Income loading error:",
        error
      );

      setErrorMessage(
        "读取固收数据失败，请检查 Supabase"
      );

    } finally {

      setLoading(false);

    }

  }


  useEffect(() => {

    loadAssets();

  }, []);


  // ===================================================
  // 总资产
  // ===================================================

  const totalAmount =
    useMemo(
      () => {

        return assets.reduce(
          (
            sum,
            asset
          ) => {

            return (
              sum +
              toNumber(
                asset.amount
              )
            );

          },
          0
        );

      },
      [assets]
    );


  // ===================================================
  // 自动计息资产
  // ===================================================

  const autoInterestAssets =
    useMemo(
      () => {

        return assets.filter(
          asset =>
            asset.auto_interest
        );

      },
      [assets]
    );


  // ===================================================
  // 今日预计利息
  // ===================================================

  const totalDailyInterest =
    useMemo(
      () => {

        return assets.reduce(
          (
            sum,
            asset
          ) => {

            return (
              sum +
              getDailyInterest(
                asset
              )
            );

          },
          0
        );

      },
      [assets]
    );


  // ===================================================
  // 年预计利息
  // ===================================================

  const totalAnnualInterest =
    useMemo(
      () => {

        return (
          totalDailyInterest *
          365
        );

      },
      [totalDailyInterest]
    );


  // ===================================================
  // 清空表单
  // ===================================================

  function resetForm() {

    setEditingId(
      null
    );

    setType(
      "活期"
    );

    setName("");

    setInstitution("");

    setAmount("");

    setInterestRate("");

    setAutoInterest(
      false
    );

    setInterestDate(
      todayString()
    );

    setNote("");

    setErrorMessage("");

  }


  // ===================================================
  // 编辑
  // ===================================================

  function handleEdit(
    asset: FixedIncomeAsset
  ) {

    setEditingId(
      asset.id
    );

    setType(
      asset.type ||
      "活期"
    );

    setName(
      asset.name ||
      ""
    );

    setInstitution(
      asset.institution ||
      ""
    );

    setAmount(
      String(
        asset.amount ??
        ""
      )
    );

    setInterestRate(
      asset.interest_rate ===
      null ||
      asset.interest_rate ===
      undefined
        ?
          ""
        :
          String(
            asset.interest_rate
          )
    );

    setAutoInterest(
      !!asset.auto_interest
    );

    setInterestDate(
      asset.interest_date ||
      todayString()
    );

    setNote(
      asset.note ||
      ""
    );

    setErrorMessage("");

    setSuccessMessage("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });

  }


  // ===================================================
  // 保存
  // ===================================================

  async function handleSave() {

    setErrorMessage("");

    setSuccessMessage("");


    // -----------------------------------------------
    // 基本检查
    // -----------------------------------------------

    if (
      !name.trim()
    ) {

      setErrorMessage(
        "请输入固收资产名称"
      );

      return;

    }


    const amountNumber =
      toNumber(
        amount
      );


    if (
      amountNumber < 0
    ) {

      setErrorMessage(
        "金额不能小于 0"
      );

      return;

    }


    const rateNumber =
      toNumber(
        interestRate
      );


    if (
      autoInterest &&
      rateNumber <= 0
    ) {

      setErrorMessage(
        "开启自动计息后，请填写年化利率"
      );

      return;

    }


    try {

      setSaving(true);


      const payload = {

        type:
          type.trim(),

        name:
          name.trim(),

        institution:
          institution.trim(),

        amount:
          amountNumber,

        interest_rate:
          autoInterest
            ? rateNumber
            : null,

        auto_interest:
          autoInterest,

        interest_date:
          interestDate ||
          todayString(),

        note:
          note.trim(),

      };


      // ---------------------------------------------
      // 编辑
      // ---------------------------------------------

      if (
        editingId
      ) {

        await updateFixedIncomeAsset(
          editingId,
          payload
        );

        setSuccessMessage(
          "固收资产已更新"
        );

      }

      // ---------------------------------------------
      // 新增
      // ---------------------------------------------

      else {

        await createFixedIncomeAsset(
          payload
        );

        setSuccessMessage(
          "固收资产已添加"
        );

      }


      resetForm();

      await loadAssets();

    } catch (error) {

      console.error(
        "Fixed Income save error:",
        error
      );

      setErrorMessage(
        "保存失败，请检查 Supabase"
      );

    } finally {

      setSaving(false);

    }

  }


  // ===================================================
  // 删除
  // ===================================================

  async function handleDelete(
    asset: FixedIncomeAsset
  ) {

    const confirmed =
      window.confirm(
        `确定要删除「${asset.name}」吗？`
      );


    if (
      !confirmed
    ) {

      return;

    }


    try {

      setDeletingId(
        asset.id
      );

      setErrorMessage("");

      setSuccessMessage("");


      await deleteFixedIncomeAsset(
        asset.id
      );


      setSuccessMessage(
        "固收资产已删除"
      );


      if (
        editingId ===
        asset.id
      ) {

        resetForm();

      }


      await loadAssets();

    } catch (error) {

      console.error(
        "Fixed Income delete error:",
        error
      );

      setErrorMessage(
        "删除失败，请检查 Supabase"
      );

    } finally {

      setDeletingId(
        null
      );

    }

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
          title="Fixed Income"
        />

        <main
          className="
            p-10
            max-w-[1600px]
            mx-auto
          "
        >

          <div
            className="
              bg-white
              rounded-2xl
              border
              border-gray-100
              p-8
              text-gray-500
            "
          >

            正在读取固收资产...

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
        title="Fixed Income"
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
            Header
            ================================================= */}

        <div>

          <h1
            className="
              text-3xl
              font-bold
              text-gray-900
            "
          >

            💰 Fixed Income

          </h1>

          <p
            className="
              mt-2
              text-gray-500
            "
          >

            管理万能险、活期、理财、定期及其他固收资产

          </p>

        </div>


        {/* =================================================
            Messages
            ================================================= */}

        {
          errorMessage && (

            <div
              className="
                rounded-xl
                bg-red-50
                border
                border-red-100
                px-5
                py-4
                text-sm
                text-red-700
              "
            >

              {errorMessage}

            </div>

          )
        }


        {
          successMessage && (

            <div
              className="
                rounded-xl
                bg-green-50
                border
                border-green-100
                px-5
                py-4
                text-sm
                text-green-700
              "
            >

              {successMessage}

            </div>

          )
        }


        {/* =================================================
            Summary
            ================================================= */}

        <div
          className="
            grid
            grid-cols-1
            md:grid-cols-2
            lg:grid-cols-4
            gap-5
          "
        >

          <SummaryCard
            title="固收总资产"
            value={money(totalAmount)}
            description="并入 Dashboard Total Wealth"
            blue
          />


          <SummaryCard
            title="自动计息资产"
            value={`${autoInterestAssets.length} 项`}
            description="开启每日自动计息"
          />


          <SummaryCard
            title="今日预计利息"
            value={moneyExact(
              totalDailyInterest
            )}
            description="按当前余额及年化利率"
            green
          />


          <SummaryCard
            title="年预计利息"
            value={money(
              totalAnnualInterest
            )}
            description="当前利率 × 365 天"
            green
          />

        </div>


        {/* =================================================
            Add / Edit
            ================================================= */}

        <section
          className="
            bg-white
            rounded-2xl
            border
            border-gray-100
            shadow-sm
            p-6
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              mb-6
            "
          >

            <div>

              <h2
                className="
                  text-xl
                  font-bold
                  text-gray-900
                "
              >

                {
                  editingId
                    ?
                      "✏️ 编辑固收资产"
                    :
                      "➕ 添加固收资产"
                }

              </h2>

              <p
                className="
                  text-sm
                  text-gray-400
                  mt-1
                "
              >

                万能险也在这里管理，不与保险保单混合

              </p>

            </div>


            {
              editingId && (

                <button
                  type="button"
                  onClick={
                    resetForm
                  }
                  className="
                    px-4
                    py-2
                    rounded-lg
                    bg-gray-100
                    text-gray-600
                    hover:bg-gray-200
                    transition
                  "
                >

                  取消编辑

                </button>

              )
            }

          </div>


          <div
            className="
              grid
              grid-cols-1
              md:grid-cols-2
              lg:grid-cols-4
              gap-5
            "
          >

            {/* 类型 */}

            <FormField
              label="资产类型"
            >

              <select
                value={type}
                onChange={
                  e =>
                    setType(
                      e.target.value
                    )
                }
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  px-4
                  py-3
                  outline-none
                  focus:ring-2
                  focus:ring-blue-200
                "
              >

                {
                  assetTypes.map(
                    item => (

                      <option
                        key={item}
                        value={item}
                      >

                        {item}

                      </option>

                    )
                  )
                }

              </select>

            </FormField>


            {/* 名称 */}

            <FormField
              label="资产名称"
            >

              <input
                value={name}
                onChange={
                  e =>
                    setName(
                      e.target.value
                    )
                }
                placeholder="例如：XX银行大额存单"
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  px-4
                  py-3
                  outline-none
                  focus:ring-2
                  focus:ring-blue-200
                "
              />

            </FormField>


            {/* 机构 */}

            <FormField
              label="机构"
            >

              <input
                value={institution}
                onChange={
                  e =>
                    setInstitution(
                      e.target.value
                    )
                }
                placeholder="例如：招商银行"
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  px-4
                  py-3
                  outline-none
                  focus:ring-2
                  focus:ring-blue-200
                "
              />

            </FormField>


            {/* 金额 */}

            <FormField
              label="当前金额"
            >

              <input
                type="number"
                value={amount}
                onChange={
                  e =>
                    setAmount(
                      e.target.value
                    )
                }
                placeholder="0"
                min="0"
                step="0.01"
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  px-4
                  py-3
                  outline-none
                  focus:ring-2
                  focus:ring-blue-200
                "
              />

            </FormField>


            {/* 自动计息 */}

            <FormField
              label="自动计息"
            >

              <div
                className="
                  flex
                  gap-3
                  h-[50px]
                "
              >

                <button
                  type="button"
                  onClick={() =>
                    setAutoInterest(
                      true
                    )
                  }
                  className={`
                    flex-1
                    rounded-xl
                    border
                    font-medium
                    transition
                    ${
                      autoInterest
                        ?
                          "bg-green-600 text-white border-green-600"
                        :
                          "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }
                  `}
                >

                  ✓ 是

                </button>


                <button
                  type="button"
                  onClick={() =>
                    setAutoInterest(
                      false
                    )
                  }
                  className={`
                    flex-1
                    rounded-xl
                    border
                    font-medium
                    transition
                    ${
                      !autoInterest
                        ?
                          "bg-gray-700 text-white border-gray-700"
                        :
                          "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    }
                  `}
                >

                  否

                </button>

              </div>

            </FormField>


            {/* 年化利率 */}

            <FormField
              label="年化利率 (%)"
            >

              <input
                type="number"
                value={interestRate}
                onChange={
                  e =>
                    setInterestRate(
                      e.target.value
                    )
                }
                disabled={
                  !autoInterest
                }
                placeholder={
                  autoInterest
                    ?
                      "例如 2.50"
                    :
                      "未开启自动计息"
                }
                min="0"
                step="0.01"
                className={`
                  w-full
                  rounded-xl
                  border
                  px-4
                  py-3
                  outline-none
                  ${
                    autoInterest
                      ?
                        "border-gray-200 bg-white focus:ring-2 focus:ring-blue-200"
                      :
                        "border-gray-100 bg-gray-50 text-gray-400"
                  }
                `}
              />

            </FormField>


            {/* 计息日期 */}

            <FormField
              label="已计息至"
            >

              <input
                type="date"
                value={
                  interestDate
                }
                onChange={
                  e =>
                    setInterestDate(
                      e.target.value
                    )
                }
                disabled={
                  !autoInterest
                }
                className={`
                  w-full
                  rounded-xl
                  border
                  px-4
                  py-3
                  outline-none
                  ${
                    autoInterest
                      ?
                        "border-gray-200 bg-white focus:ring-2 focus:ring-blue-200"
                      :
                        "border-gray-100 bg-gray-50 text-gray-400"
                  }
                `}
              />

            </FormField>


            {/* 备注 */}

            <FormField
              label="备注"
            >

              <input
                value={note}
                onChange={
                  e =>
                    setNote(
                      e.target.value
                    )
                }
                placeholder="可选"
                className="
                  w-full
                  rounded-xl
                  border
                  border-gray-200
                  px-4
                  py-3
                  outline-none
                  focus:ring-2
                  focus:ring-blue-200
                "
              />

            </FormField>

          </div>


          {/* 保存按钮 */}

          <div
            className="
              mt-6
              flex
              justify-end
              gap-3
            "
          >

            {
              editingId && (

                <button
                  type="button"
                  onClick={
                    resetForm
                  }
                  className="
                    px-6
                    py-3
                    rounded-xl
                    bg-gray-100
                    text-gray-700
                    font-semibold
                    hover:bg-gray-200
                  "
                >

                  取消

                </button>

              )
            }


            <button
              type="button"
              disabled={
                saving
              }
              onClick={
                handleSave
              }
              className="
                px-7
                py-3
                rounded-xl
                bg-blue-600
                text-white
                font-semibold
                hover:bg-blue-700
                disabled:opacity-50
                disabled:cursor-not-allowed
                transition
              "
            >

              {
                saving
                  ?
                    "保存中..."
                  :
                    editingId
                      ?
                        "保存修改"
                      :
                        "添加固收资产"
              }

            </button>

          </div>

        </section>


        {/* =================================================
            Assets
            ================================================= */}

        <section
          className="
            bg-white
            rounded-2xl
            border
            border-gray-100
            shadow-sm
            p-6
          "
        >

          <div
            className="
              flex
              items-center
              justify-between
              mb-6
            "
          >

            <div>

              <h2
                className="
                  text-xl
                  font-bold
                  text-gray-900
                "
              >

                📋 固收资产明细

              </h2>

              <p
                className="
                  text-sm
                  text-gray-400
                  mt-1
                "
              >

                共 {assets.length} 项资产

              </p>

            </div>


            <div
              className="
                text-right
              "
            >

              <p
                className="
                  text-xs
                  text-gray-400
                "
              >

                固收合计

              </p>

              <p
                className="
                  text-2xl
                  font-bold
                  text-blue-700
                "
              >

                {money(totalAmount)}

              </p>

            </div>

          </div>


          {
            assets.length === 0
              ?

                <div
                  className="
                    py-16
                    text-center
                    text-gray-400
                  "
                >

                  <div
                    className="
                      text-4xl
                      mb-3
                    "
                  >
                    💰
                  </div>

                  <p>

                    暂无固收资产

                  </p>

                  <p
                    className="
                      text-sm
                      mt-1
                    "
                  >

                    在上方添加第一项固收资产

                  </p>

                </div>

              :

                <div
                  className="
                    space-y-4
                  "
                >

                  {
                    assets.map(
                      asset => {

                        const dailyInterest =
                          getDailyInterest(
                            asset
                          );


                        return (

                          <div
                            key={
                              asset.id
                            }
                            className="
                              border
                              border-gray-100
                              rounded-2xl
                              p-5
                              hover:shadow-sm
                              transition
                            "
                          >

                            <div
                              className="
                                flex
                                flex-col
                                lg:flex-row
                                lg:items-center
                                gap-5
                              "
                            >

                              {/* 基础信息 */}

                              <div
                                className="
                                  flex-1
                                  min-w-0
                                "
                              >

                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-3
                                    flex-wrap
                                  "
                                >

                                  <h3
                                    className="
                                      text-lg
                                      font-bold
                                      text-gray-900
                                    "
                                  >

                                    {asset.name}

                                  </h3>


                                  <span
                                    className="
                                      px-2.5
                                      py-1
                                      rounded-full
                                      bg-gray-100
                                      text-gray-600
                                      text-xs
                                      font-medium
                                    "
                                  >

                                    {asset.type}

                                  </span>


                                  {
                                    asset.auto_interest && (

                                      <span
                                        className="
                                          px-2.5
                                          py-1
                                          rounded-full
                                          bg-green-50
                                          text-green-700
                                          text-xs
                                          font-medium
                                        "
                                      >

                                        ● 自动计息

                                      </span>

                                    )
                                  }

                                </div>


                                {
                                  asset.institution && (

                                    <p
                                      className="
                                        mt-2
                                        text-sm
                                        text-gray-500
                                      "
                                    >

                                      {asset.institution}

                                    </p>

                                  )
                                }


                                {
                                  asset.note && (

                                    <p
                                      className="
                                        mt-1
                                        text-xs
                                        text-gray-400
                                      "
                                    >

                                      {asset.note}

                                    </p>

                                  )
                                }

                              </div>


                              {/* 金额 */}

                              <div
                                className="
                                  lg:w-48
                                "
                              >

                                <p
                                  className="
                                    text-xs
                                    text-gray-400
                                  "
                                >

                                  当前资产

                                </p>

                                <p
                                  className="
                                    text-2xl
                                    font-bold
                                    text-gray-900
                                    mt-1
                                  "
                                >

                                  {money(
                                    toNumber(
                                      asset.amount
                                    )
                                  )}

                                </p>

                              </div>


                              {/* 利息 */}

                              <div
                                className="
                                  lg:w-56
                                "
                              >

                                {
                                  asset.auto_interest
                                    ?

                                      <>

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
                                                text-xs
                                                text-gray-400
                                              "
                                            >

                                              年化利率

                                            </p>

                                            <p
                                              className="
                                                text-lg
                                                font-bold
                                                text-green-700
                                                mt-1
                                              "
                                            >

                                              {
                                                toNumber(
                                                  asset.interest_rate
                                                ).toFixed(2)
                                              }%

                                            </p>

                                          </div>


                                          <div
                                            className="
                                              text-right
                                            "
                                          >

                                            <p
                                              className="
                                                text-xs
                                                text-gray-400
                                              "
                                            >

                                              今日预计利息

                                            </p>

                                            <p
                                              className="
                                                text-lg
                                                font-bold
                                                text-green-700
                                                mt-1
                                              "
                                            >

                                              +
                                              {moneyExact(
                                                dailyInterest
                                              )}

                                            </p>

                                          </div>

                                        </div>


                                        <p
                                          className="
                                            text-xs
                                            text-gray-400
                                            mt-2
                                          "
                                        >

                                          已计息至：
                                          {" "}
                                          {
                                            asset.interest_date ||
                                            "-"
                                          }

                                        </p>

                                      </>

                                    :

                                      <div>

                                        <p
                                          className="
                                            text-xs
                                            text-gray-400
                                          "
                                        >

                                          自动计息

                                        </p>

                                        <p
                                          className="
                                            text-lg
                                            font-semibold
                                            text-gray-500
                                            mt-1
                                          "
                                        >

                                          未开启

                                        </p>

                                      </div>

                                }

                              </div>


                              {/* 操作 */}

                              <div
                                className="
                                  flex
                                  lg:flex-col
                                  gap-2
                                "
                              >

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleEdit(
                                      asset
                                    )
                                  }
                                  className="
                                    px-4
                                    py-2
                                    rounded-lg
                                    bg-blue-50
                                    text-blue-700
                                    text-sm
                                    font-semibold
                                    hover:bg-blue-100
                                    transition
                                  "
                                >

                                  编辑

                                </button>


                                <button
                                  type="button"
                                  disabled={
                                    deletingId ===
                                    asset.id
                                  }
                                  onClick={() =>
                                    handleDelete(
                                      asset
                                    )
                                  }
                                  className="
                                    px-4
                                    py-2
                                    rounded-lg
                                    bg-red-50
                                    text-red-600
                                    text-sm
                                    font-semibold
                                    hover:bg-red-100
                                    disabled:opacity-50
                                    transition
                                  "
                                >

                                  {
                                    deletingId ===
                                    asset.id
                                      ?
                                        "删除中..."
                                      :
                                        "删除"
                                  }

                                </button>

                              </div>

                            </div>

                          </div>

                        );

                      }
                    )
                  }

                </div>

          }

        </section>


        {/* =================================================
            说明
            ================================================= */}

        <section
          className="
            bg-blue-50
            border
            border-blue-100
            rounded-2xl
            p-6
          "
        >

          <h3
            className="
              font-bold
              text-blue-900
              mb-3
            "
          >

            💡 自动计息说明

          </h3>


          <div
            className="
              text-sm
              text-blue-800
              leading-7
              space-y-1
            "
          >

            <p>

              • 开启「自动计息」后，系统按照年化利率 ÷ 365 计算每日利息。

            </p>

            <p>

              • 系统每次读取固收资产时，只计算「已计息至」之后尚未计算的天数。

            </p>

            <p>

              • 已经计算过的日期不会重复计息。

            </p>

            <p>

              • 关闭「自动计息」后，该资产不会自动增加利息。

            </p>

            <p>

              • 固收资产总额会作为家庭资产的一部分并入 Dashboard 的 Total Wealth。

            </p>

            <p>

              • 万能险在这里作为固收资产管理，不会与 Insurance 页面中的保单现金价值重复统计。

            </p>

          </div>

        </section>


      </main>

    </>

  );

}


// =====================================================
// Summary Card
// =====================================================

function SummaryCard({
  title,
  value,
  description,
  blue = false,
  green = false,
}: {
  title: string;
  value: string;
  description: string;
  blue?: boolean;
  green?: boolean;
}) {

  return (

    <div
      className={`
        rounded-2xl
        p-6
        ${
          blue
            ?
              "bg-blue-50"
            :
          green
            ?
              "bg-green-50"
            :
              "bg-gray-50"
        }
      `}
    >

      <p
        className="
          text-sm
          text-gray-500
        "
      >

        {title}

      </p>


      <p
        className={`
          text-2xl
          font-bold
          mt-2
          ${
            blue
              ?
                "text-blue-700"
              :
            green
              ?
                "text-green-700"
              :
                "text-gray-900"
          }
        `}
      >

        {value}

      </p>


      <p
        className="
          text-xs
          text-gray-400
          mt-2
        "
      >

        {description}

      </p>

    </div>

  );

}


// =====================================================
// Form Field
// =====================================================

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {

  return (

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

        {label}

      </label>

      {children}

    </div>

  );

}