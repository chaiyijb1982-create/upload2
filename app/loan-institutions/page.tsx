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

interface Loan {
  id: number;
  name: string;
  institution?: string | null;
  type?: string | null;
  remaining_amount?: number | null;
  monthly_payment?: number | null;
  housing_fund_monthly?: number | null;
  interest_rate?: number | null;
  loan_mode?: string | null;
}


interface FinancialInstitution {
  id: string;
  name: string;
  type?: string | null;
  active: boolean;
  created_at?: string | null;
}


interface Institution {
  id: string | null;
  name: string;
  type: string;
  active: boolean;

  count: number;

  balance: number;

  monthlyPayment: number;

  housingFund: number;

  actualPayment: number;

  loans: Loan[];
}


// =====================================================
// 工具函数
// =====================================================

function num(value: any): number {
  const n = Number(value);

  return Number.isFinite(n)
    ? n
    : 0;
}


function money(
  value: number,
  decimals = 0
): string {

  return `¥${Number(value || 0).toLocaleString(
    "zh-CN",
    {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }
  )}`;
}


function getHousingFundMonthly(
  loan: Loan
): number {

  if (
    loan.type !== "房贷"
  ) {
    return 0;
  }

  return Math.max(
    0,
    num(
      loan.housing_fund_monthly
    )
  );
}


function getActualMonthlyPayment(
  loan: Loan
): number {

  return Math.max(
    0,
    num(
      loan.monthly_payment
    ) -
      getHousingFundMonthly(
        loan
      )
  );
}


// =====================================================
// 页面
// =====================================================

export default function LoanInstitutionsPage() {

  // ===================================================
  // 数据
  // ===================================================

  const [
    loans,
    setLoans,
  ] = useState<Loan[]>([]);


  const [
    financialInstitutions,
    setFinancialInstitutions,
  ] = useState<
    FinancialInstitution[]
  >([]);


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


  // 展开的机构
  const [
    expanded,
    setExpanded,
  ] = useState<
    Record<string, boolean>
  >({});


  // 当前编辑机构
  const [
    editingInstitution,
    setEditingInstitution,
  ] = useState<string | null>(
    null
  );


  // 编辑名称
  const [
    editingName,
    setEditingName,
  ] = useState("");


  // 编辑类型
  const [
    editingType,
    setEditingType,
  ] = useState("银行");


  // 新增机构
  const [
    showAdd,
    setShowAdd,
  ] = useState(false);


  const [
    newName,
    setNewName,
  ] = useState("");


  const [
    newType,
    setNewType,
  ] = useState("银行");


  // ===================================================
  // 加载数据
  // ===================================================

  async function loadData() {

    try {

      setLoading(true);

      setError("");


      const [
        institutionsResult,
        loansResult,
      ] = await Promise.all([

        supabase
          .from(
            "financial_institutions"
          )
          .select(
            `
              id,
              name,
              type,
              active,
              created_at
            `
          )
          .eq(
            "active",
            true
          )
          .order(
            "created_at",
            {
              ascending: true,
            }
          ),

        supabase
          .from(
            "loans"
          )
          .select(
            `
              id,
              name,
              institution,
              type,
              remaining_amount,
              monthly_payment,
              housing_fund_monthly,
              interest_rate,
              loan_mode
            `
          )
          .order(
            "id",
            {
              ascending: true,
            }
          ),

      ]);


      if (
        institutionsResult.error
      ) {

        throw new Error(
          institutionsResult.error.message ||
            "读取金融机构失败"
        );

      }


      if (
        loansResult.error
      ) {

        throw new Error(
          loansResult.error.message ||
            "读取贷款失败"
        );

      }


      setFinancialInstitutions(
        (
          institutionsResult.data ||
          []
        ) as FinancialInstitution[]
      );


      setLoans(
        (
          loansResult.data ||
          []
        ) as Loan[]
      );

    } catch (err: any) {

      console.error(
        "loadData error:",
        err
      );

      setError(
        err?.message ||
          "加载数据失败"
      );

    } finally {

      setLoading(false);

    }

  }


  // ===================================================
  // 初始化
  // ===================================================

  useEffect(() => {

    loadData();

  }, []);


  // ===================================================
  // 构建机构数据
  // ===================================================

  const institutions =
    useMemo<Institution[]>(() => {

      const result: Institution[] =
        financialInstitutions.map(
          institution => {

            const institutionLoans =
              loans.filter(
                loan =>
                  (
                    loan.institution ||
                    ""
                  ).trim() ===
                  institution.name
              );


            let balance = 0;

            let monthlyPayment = 0;

            let housingFund = 0;

            let actualPayment = 0;


            institutionLoans.forEach(
              loan => {

                balance +=
                  num(
                    loan.remaining_amount
                  );

                monthlyPayment +=
                  num(
                    loan.monthly_payment
                  );

                housingFund +=
                  getHousingFundMonthly(
                    loan
                  );

                actualPayment +=
                  getActualMonthlyPayment(
                    loan
                  );

              }
            );


            return {

              id:
                institution.id,

              name:
                institution.name,

              type:
                institution.type ||
                "其他",

              active:
                institution.active,

              count:
                institutionLoans.length,

              balance,

              monthlyPayment,

              housingFund,

              actualPayment,

              loans:
                institutionLoans,

            };

          }
        );


      // =================================================
      // 未设置金融机构
      // =================================================

      const unassignedLoans =
        loans.filter(
          loan =>
            !(
              loan.institution &&
              loan.institution.trim()
            )
        );


      if (
        unassignedLoans.length > 0
      ) {

        let balance = 0;

        let monthlyPayment = 0;

        let housingFund = 0;

        let actualPayment = 0;


        unassignedLoans.forEach(
          loan => {

            balance +=
              num(
                loan.remaining_amount
              );

            monthlyPayment +=
              num(
                loan.monthly_payment
              );

            housingFund +=
              getHousingFundMonthly(
                loan
              );

            actualPayment +=
              getActualMonthlyPayment(
                loan
              );

          }
        );


        result.push({

          id: null,

          name:
            "未设置金融机构",

          type:
            "其他",

          active: true,

          count:
            unassignedLoans.length,

          balance,

          monthlyPayment,

          housingFund,

          actualPayment,

          loans:
            unassignedLoans,

        });

      }


      // =================================================
      // 排序
      //
      // 有贷款的机构优先
      // 贷款数量多的优先
      // 数量相同按本金余额
      // =================================================

      return result.sort(
        (a, b) => {

          if (
            a.count !==
            b.count
          ) {

            return (
              b.count -
              a.count
            );

          }

          return (
            b.balance -
            a.balance
          );

        }
      );

    }, [
      financialInstitutions,
      loans,
    ]);


  // ===================================================
  // 总统计
  // ===================================================

  const totalStats =
    useMemo(() => {

      return institutions.reduce(
        (
          total,
          item
        ) => {

          total.count +=
            item.count;

          total.balance +=
            item.balance;

          total.monthlyPayment +=
            item.monthlyPayment;

          total.housingFund +=
            item.housingFund;

          total.actualPayment +=
            item.actualPayment;

          return total;

        },
        {
          count: 0,
          balance: 0,
          monthlyPayment: 0,
          housingFund: 0,
          actualPayment: 0,
        }
      );

    }, [
      institutions,
    ]);


  // ===================================================
  // 金融机构统计
  // ===================================================

  const institutionCount =
    financialInstitutions.length;


  const usedInstitutionCount =
    institutions.filter(
      item =>
        item.id !== null &&
        item.count > 0
    ).length;


  const emptyInstitutionCount =
    institutions.filter(
      item =>
        item.id !== null &&
        item.count === 0
    ).length;


  // ===================================================
  // 展开 / 收起
  // ===================================================

  function toggleInstitution(
    name: string
  ) {

    setExpanded(
      prev => ({

        ...prev,

        [name]:
          !prev[name],

      })
    );

  }


  function expandAll() {

    const result:
      Record<string, boolean> =
      {};

    institutions.forEach(
      item => {

        result[item.name] = true;

      }
    );

    setExpanded(
      result
    );

  }


  function collapseAll() {

    const result:
      Record<string, boolean> =
      {};

    institutions.forEach(
      item => {

        result[item.name] = false;

      }
    );

    setExpanded(
      result
    );

  }


  // ===================================================
  // 编辑机构
  // ===================================================

  function startEdit(
    institution: Institution
  ) {

    if (
      !institution.id
    ) {

      return;

    }

    setEditingInstitution(
      institution.name
    );

    setEditingName(
      institution.name
    );

    setEditingType(
      institution.type ||
        "银行"
    );

  }


  function cancelEdit() {

    setEditingInstitution(
      null
    );

    setEditingName("");

    setEditingType(
      "银行"
    );

  }


  // ===================================================
  // 保存机构
  // ===================================================

  async function saveInstitution() {

    const oldName =
      editingInstitution;


    const newInstitutionName =
      editingName.trim();


    if (!oldName) {
      return;
    }


    if (
      !newInstitutionName
    ) {

      alert(
        "金融机构名称不能为空"
      );

      return;

    }


    const duplicated =
      financialInstitutions.some(
        institution =>
          institution.name ===
            newInstitutionName &&
          institution.name !==
            oldName
      );


    if (duplicated) {

      alert(
        "已经存在这个金融机构"
      );

      return;

    }


    try {

      setSaving(true);

      setError("");


      const currentInstitution =
        financialInstitutions.find(
          institution =>
            institution.name ===
            oldName
        );


      if (
        !currentInstitution
      ) {

        throw new Error(
          "找不到当前金融机构"
        );

      }


      // ===============================================
      // 更新金融机构
      // ===============================================

      const institutionResult =
        await supabase
          .from(
            "financial_institutions"
          )
          .update({

            name:
              newInstitutionName,

            type:
              editingType ||
              "其他",

          })
          .eq(
            "id",
            currentInstitution.id
          );


      if (
        institutionResult.error
      ) {

        throw new Error(
          institutionResult.error.message ||
            "更新金融机构失败"
        );

      }


      // ===============================================
      // 同步贷款
      // ===============================================

      if (
        oldName !==
        newInstitutionName
      ) {

        const loansResult =
          await supabase
            .from(
              "loans"
            )
            .update({

              institution:
                newInstitutionName,

            })
            .eq(
              "institution",
              oldName
            );


        if (
          loansResult.error
        ) {

          throw new Error(
            loansResult.error.message ||
              "同步贷款机构失败"
          );

        }

      }


      cancelEdit();

      await loadData();

    } catch (err: any) {

      console.error(
        "saveInstitution error:",
        err
      );

      setError(
        err?.message ||
          "保存金融机构失败"
      );

    } finally {

      setSaving(false);

    }

  }


  // ===================================================
  // 新增机构
  // ===================================================

  async function addInstitution() {

    const name =
      newName.trim();


    if (!name) {

      alert(
        "请输入银行 / 金融机构名称"
      );

      return;

    }


    try {

      setSaving(true);

      setError("");


      // ===============================================
      // 查询是否存在
      // ===============================================

      const existingResult =
        await supabase
          .from(
            "financial_institutions"
          )
          .select(
            `
              id,
              name,
              type,
              active
            `
          )
          .eq(
            "name",
            name
          )
          .maybeSingle();


      if (
        existingResult.error
      ) {

        throw new Error(
          existingResult.error.message ||
            "查询金融机构失败"
        );

      }


      const existing =
        existingResult.data;


      // ===============================================
      // 已存在且 active
      // ===============================================

      if (
        existing &&
        existing.active === true
      ) {

        alert(
          `「${name}」已经存在。`
        );

        return;

      }


      // ===============================================
      // 已存在但 inactive
      // 自动恢复
      // ===============================================

      if (
        existing &&
        existing.active === false
      ) {

        const restoreResult =
          await supabase
            .from(
              "financial_institutions"
            )
            .update({

              active: true,

              type:
                newType ||
                existing.type ||
                "银行",

            })
            .eq(
              "id",
              existing.id
            );


        if (
          restoreResult.error
        ) {

          throw new Error(
            restoreResult.error.message ||
              "恢复金融机构失败"
          );

        }


        setNewName("");

        setNewType(
          "银行"
        );

        setShowAdd(false);

        await loadData();

        alert(
          `「${name}」已恢复。`
        );

        return;

      }


      // ===============================================
      // 新增
      // ===============================================

      const insertResult =
        await supabase
          .from(
            "financial_institutions"
          )
          .insert({

            name,

            type:
              newType ||
              "银行",

            active:
              true,

          });


      if (
        insertResult.error
      ) {

        // =============================================
        // UNIQUE 双保险
        // =============================================

        if (
          insertResult.error.code ===
          "23505"
        ) {

          const retryResult =
            await supabase
              .from(
                "financial_institutions"
              )
              .select(
                `
                  id,
                  name,
                  type,
                  active
                `
              )
              .eq(
                "name",
                name
              )
              .maybeSingle();


          if (
            retryResult.data &&
            retryResult.data.active ===
              false
          ) {

            const restoreResult =
              await supabase
                .from(
                  "financial_institutions"
                )
                .update({

                  active: true,

                  type:
                    newType ||
                    retryResult.data.type ||
                    "银行",

                })
                .eq(
                  "id",
                  retryResult.data.id
                );


            if (
              restoreResult.error
            ) {

              throw new Error(
                restoreResult.error.message ||
                  "恢复金融机构失败"
              );

            }


            setNewName("");

            setNewType(
              "银行"
            );

            setShowAdd(false);

            await loadData();

            alert(
              `「${name}」已恢复。`
            );

            return;

          }

        }


        throw new Error(
          insertResult.error.message ||
            "新增金融机构失败"
        );

      }


      setNewName("");

      setNewType(
        "银行"
      );

      setShowAdd(false);

      await loadData();

      alert(
        `「${name}」已成功新增。`
      );

    } catch (err: any) {

      console.error(
        "addInstitution error:",
        err
      );

      setError(
        err?.message ||
          "新增金融机构失败"
      );

    } finally {

      setSaving(false);

    }

  }


  // ===================================================
  // 删除机构
  // ===================================================

  async function deleteInstitution(
    institution: Institution
  ) {

    if (
      !institution.id
    ) {

      alert(
        "「未设置金融机构」不能删除。"
      );

      return;

    }


    const confirmed =
      window.confirm(
        `确定要删除「${institution.name}」吗？

该机构目前有 ${institution.count} 笔贷款。

删除后：

1. 机构会从列表隐藏
2. 不会删除贷款
3. 贷款会变成「未设置金融机构」

以后重新新增「${institution.name}」时，
系统会自动恢复。`
      );


    if (!confirmed) {
      return;
    }


    try {

      setSaving(true);

      setError("");


      // ===============================================
      // inactive
      // ===============================================

      const institutionResult =
        await supabase
          .from(
            "financial_institutions"
          )
          .update({

            active: false,

          })
          .eq(
            "id",
            institution.id
          );


      if (
        institutionResult.error
      ) {

        throw new Error(
          institutionResult.error.message ||
            "删除金融机构失败"
        );

      }


      // ===============================================
      // 清空贷款机构
      // ===============================================

      const loansResult =
        await supabase
          .from(
            "loans"
          )
          .update({

            institution:
              null,

          })
          .eq(
            "institution",
            institution.name
          );


      if (
        loansResult.error
      ) {

        throw new Error(
          loansResult.error.message ||
            "清空贷款机构失败"
        );

      }


      await loadData();

    } catch (err: any) {

      console.error(
        "deleteInstitution error:",
        err
      );

      setError(
        err?.message ||
          "删除金融机构失败"
      );

    } finally {

      setSaving(false);

    }

  }


  // ===================================================
  // 页面
  // ===================================================

  return (

    <main
      className="
        min-h-screen
        bg-gray-50
        px-4
        py-5
        md:px-6
        md:py-6
        max-w‑5xl    /* 设置最大宽度，可以替换 max-w‑6xl / max-w‑5xl / max-w‑full */
        mx-auto      /* 水平居中，必须搭配 max‑w 使用 */
      "
    >

      {/* =================================================
          页面顶部
      ================================================= */}

      <section
        className="
          bg-white
          border
          border-gray-200
          rounded-xl
          overflow-hidden
        "
      >

        <div
          className="
            px-5
            py-4
            md:px-6
            md:py-5
            flex
            flex-col
            lg:flex-row
            lg:items-center
            lg:justify-between
            gap-4
          "
        >

          <div>

            <h1
              className="
                text-xl
                md:text-2xl
                font-bold
                text-gray-900
              "
            >
              银行 / 金融机构
            </h1>

            <p
              className="
                text-sm
                text-gray-500
                mt-1
              "
            >
              管理家庭贷款涉及的银行及金融机构
            </p>

          </div>


          <div
            className="
              flex
              items-center
              gap-2
            "
          >

            <button
              className="
                px-4
                py-2
                rounded-lg
                bg-blue-600
                text-white
                text-sm
                font-medium
                hover:bg-blue-700
                disabled:opacity-50
              "
              onClick={() =>
                setShowAdd(
                  !showAdd
                )
              }
              disabled={
                saving
              }
            >
              ＋ 新增金融机构
            </button>


            <button
              className="
                px-3
                py-2
                rounded-lg
                border
                border-gray-200
                bg-white
                text-gray-600
                text-sm
                hover:bg-gray-50
                disabled:opacity-50
              "
              onClick={
                loadData
              }
              disabled={
                loading ||
                saving
              }
            >
              ↻
            </button>

          </div>

        </div>

      </section>


      {/* =================================================
          新增金融机构
      ================================================= */}

      {showAdd && (

        <section
          className="
            mt-4
            bg-white
            border
            border-blue-200
            rounded-xl
            p-5
          "
        >

          <div
            className="
              text-base
              font-semibold
              text-gray-900
              mb-1
            "
          >
            新增金融机构
          </div>


          <div
            className="
              text-xs
              text-gray-500
              mb-4
            "
          >
            如果该机构以前删除过，系统会自动恢复。
          </div>


          <div
            className="
              flex
              flex-col
              md:flex-row
              gap-3
            "
          >

            <input
              className="
                flex-1
                border
                border-gray-200
                rounded-lg
                px-3
                py-2.5
                text-sm
                outline-none
                focus:border-blue-500
              "
              placeholder="例如：招商银行"
              value={
                newName
              }
              onChange={e =>
                setNewName(
                  e.target.value
                )
              }
              onKeyDown={e => {

                if (
                  e.key ===
                  "Enter"
                ) {

                  addInstitution();

                }

              }}
            />


            <select
              className="
                border
                border-gray-200
                rounded-lg
                px-3
                py-2.5
                text-sm
                md:w-36
              "
              value={
                newType
              }
              onChange={e =>
                setNewType(
                  e.target.value
                )
              }
            >

              <option value="银行">
                银行
              </option>

              <option value="保险">
                保险
              </option>

              <option value="证券">
                证券
              </option>

              <option value="基金">
                基金
              </option>

              <option value="其他">
                其他
              </option>

            </select>


            <button
              className="
                px-5
                py-2.5
                rounded-lg
                bg-blue-600
                text-white
                text-sm
                font-medium
                hover:bg-blue-700
                disabled:opacity-50
              "
              onClick={
                addInstitution
              }
              disabled={
                saving
              }
            >
              {saving
                ? "处理中..."
                : "确定"}
            </button>


            <button
              className="
                px-5
                py-2.5
                rounded-lg
                bg-gray-100
                text-gray-600
                text-sm
                hover:bg-gray-200
              "
              onClick={() => {

                setShowAdd(false);

                setNewName("");

                setNewType(
                  "银行"
                );

              }}
            >
              取消
            </button>

          </div>

        </section>

      )}


      {/* =================================================
          错误
      ================================================= */}

      {error && (

        <section
          className="
            mt-4
            bg-red-50
            border
            border-red-200
            rounded-xl
            px-5
            py-4
            text-red-600
          "
        >

          <div
            className="
              font-semibold
              text-sm
            "
          >
            数据操作失败
          </div>

          <div
            className="
              text-xs
              mt-1
              break-all
            "
          >
            {error}
          </div>

        </section>

      )}


      {/* =================================================
          家庭贷款总览
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
            px-5
            py-4
            border-b
            border-gray-100
            flex
            items-center
            justify-between
          "
        >

          <div>

            <div
              className="
                text-base
                font-semibold
                text-gray-900
              "
            >
              当前家庭总负债
            </div>

            <div
              className="
                text-xs
                text-gray-400
                mt-1
              "
            >
              所有贷款本金余额
            </div>

          </div>


          <div
            className="
              text-2xl
              md:text-3xl
              font-bold
              text-gray-900
            "
          >
            {money(
              totalStats.balance
            )}
          </div>

        </div>


        <div
          className="
            grid
            grid-cols-2
            md:grid-cols-5
            divide-x
            divide-gray-100
          "
        >

          {/* 贷款笔数 */}

          <div
            className="
              px-5
              py-4
            "
          >

            <div
              className="
                text-xs
                text-gray-400
              "
            >
              贷款笔数
            </div>

            <div
              className="
                text-xl
                font-bold
                text-gray-900
                mt-1
              "
            >
              {totalStats.count}
              <span
                className="
                  text-sm
                  font-normal
                  text-gray-400
                  ml-1
                "
              >
                笔
              </span>
            </div>

          </div>


          {/* 固定月供 */}

          <div
            className="
              px-5
              py-4
            "
          >

            <div
              className="
                text-xs
                text-gray-400
              "
            >
              固定月供
            </div>

            <div
              className="
                text-xl
                font-bold
                text-gray-900
                mt-1
              "
            >
              {money(
                totalStats.monthlyPayment
              )}
            </div>

          </div>


          {/* 公积金 */}

          <div
            className="
              px-5
              py-4
            "
          >

            <div
              className="
                text-xs
                text-gray-400
              "
            >
              公积金月冲
            </div>

            <div
              className="
                text-xl
                font-bold
                text-green-600
                mt-1
              "
            >
              {money(
                totalStats.housingFund
              )}
            </div>

          </div>


          {/* 实际月还 */}

          <div
            className="
              px-5
              py-4
            "
          >

            <div
              className="
                text-xs
                text-gray-400
              "
            >
              自己实际月还
            </div>

            <div
              className="
                text-xl
                font-bold
                text-blue-600
                mt-1
              "
            >
              {money(
                totalStats.actualPayment
              )}
            </div>

          </div>


          {/* 机构 */}

          <div
            className="
              px-5
              py-4
              col-span-2
              md:col-span-1
            "
          >

            <div
              className="
                text-xs
                text-gray-400
              "
            >
              金融机构
            </div>

            <div
              className="
                text-xl
                font-bold
                text-gray-900
                mt-1
              "
            >
              {institutionCount}
              <span
                className="
                  text-sm
                  font-normal
                  text-gray-400
                  ml-1
                "
              >
                家
              </span>
            </div>

          </div>

        </div>

      </section>


      {/* =================================================
          机构数量统计
      ================================================= */}

      <section
        className="
          mt-4
          grid
          grid-cols-3
          gap-3
        "
      >

        <div
          className="
            bg-white
            border
            border-gray-200
            rounded-xl
            px-4
            py-4
          "
        >

          <div
            className="
              text-xs
              text-gray-400
            "
          >
            金融机构
          </div>

          <div
            className="
              text-2xl
              font-bold
              mt-1
            "
          >
            {institutionCount}
          </div>

          <div
            className="
              text-xs
              text-gray-400
            "
          >
            家
          </div>

        </div>


        <div
          className="
            bg-white
            border
            border-gray-200
            rounded-xl
            px-4
            py-4
          "
        >

          <div
            className="
              text-xs
              text-gray-400
            "
          >
            有贷款机构
          </div>

          <div
            className="
              text-2xl
              font-bold
              mt-1
            "
          >
            {usedInstitutionCount}
          </div>

          <div
            className="
              text-xs
              text-gray-400
            "
          >
            家
          </div>

        </div>


        <div
          className="
            bg-white
            border
            border-gray-200
            rounded-xl
            px-4
            py-4
          "
        >

          <div
            className="
              text-xs
              text-gray-400
            "
          >
            暂无贷款
          </div>

          <div
            className="
              text-2xl
              font-bold
              mt-1
            "
          >
            {emptyInstitutionCount}
          </div>

          <div
            className="
              text-xs
              text-gray-400
            "
          >
            家
          </div>

        </div>

      </section>


      {/* =================================================
          金融机构列表
      ================================================= */}

      <section
        className="
          mt-4
          bg-white
          border
          border-gray-200
          rounded-xl
          overflow-hidden
        "
      >

        {/* =================================================
            表头
        ================================================= */}

        <div
          className="
            px-4
            md:px-5
            py-3
            border-b
            border-gray-200
            bg-white
            overflow-x-auto
          "
        >

          <div
            className="
              min-w-[860px]
                grid
                grid-cols-[minmax(180px,1.4fr)_70px_70px_110px_100px_110px_110px_110px]
                items-center
                gap-2
                text-xs
                text-gray-500
            "
          >

            <div>
              金融机构
            </div>

            <div>
              类型
            </div>

            <div>
              贷款笔数
            </div>

            <div>
              本金余额
            </div>

            <div>
              月供
            </div>

            <div>
              公积金月冲
            </div>

            <div>
              自己实际月还
            </div>

            <div>
              操作
            </div>

          </div>

        </div>


        {/* =================================================
            数据
        ================================================= */}

        {loading ? (

          <div
            className="
              py-16
              text-center
              text-sm
              text-gray-400
            "
          >
            正在加载金融机构数据...
          </div>

        ) : institutions.length === 0 ? (

          <div
            className="
              py-16
              text-center
              text-sm
              text-gray-400
            "
          >
            暂无金融机构
          </div>

        ) : (

          <div>

            {institutions.map(
              institution => {

                const isExpanded =
                  expanded[
                    institution.name
                  ] === true;


                const isEditing =
                  editingInstitution ===
                  institution.name;


                return (

                  <div
                    key={
                      institution.id ||
                      institution.name
                    }
                    className="
                      border-b
                      border-gray-100
                      last:border-b-0
                    "
                  >

                    {/* =================================
                        机构主行
                    ================================= */}

                    <div
                      className="
                        px-4
                        md:px-5
                        py-3
                        overflow-x-auto
                      "
                    >

                      <div
                          className="
                            min-w-[860px]
                            grid
                            grid-cols-[minmax(180px,1.4fr)_70px_70px_110px_100px_110px_110px_110px]
                            items-center
                            gap-2
                          "
                        >

                        {/* =================================
                            金融机构
                        ================================= */}

                        <div
                          className="
                            flex
                            items-center
                            gap-2
                          "
                        >

                          <button
                            className="
                              w-6
                              h-6
                              rounded-md
                              border
                              border-gray-300
                              flex
                              items-center
                              justify-center
                              text-gray-500
                              hover:bg-gray-50
                              flex-shrink-0
                            "
                            onClick={() =>
                              toggleInstitution(
                                institution.name
                              )
                            }
                          >
                            {isExpanded
                              ? "−"
                              : "+"}
                          </button>


                          {isEditing ? (

                            <div
                              className="
                                flex
                                items-center
                                gap-2
                              "
                            >

                              <input
                                autoFocus
                                className="
                                  w-40
                                  border
                                  border-blue-300
                                  rounded-md
                                  px-2
                                  py-1.5
                                  text-sm
                                  outline-none
                                "
                                value={
                                  editingName
                                }
                                onChange={e =>
                                  setEditingName(
                                    e.target.value
                                  )
                                }
                                onKeyDown={e => {

                                  if (
                                    e.key ===
                                    "Enter"
                                  ) {

                                    saveInstitution();

                                  }

                                  if (
                                    e.key ===
                                    "Escape"
                                  ) {

                                    cancelEdit();

                                  }

                                }}
                              />


                              <select
                                className="
                                  border
                                  border-gray-200
                                  rounded-md
                                  px-2
                                  py-1.5
                                  text-sm
                                "
                                value={
                                  editingType
                                }
                                onChange={e =>
                                  setEditingType(
                                    e.target.value
                                  )
                                }
                              >

                                <option value="银行">
                                  银行
                                </option>

                                <option value="保险">
                                  保险
                                </option>

                                <option value="证券">
                                  证券
                                </option>

                                <option value="基金">
                                  基金
                                </option>

                                <option value="其他">
                                  其他
                                </option>

                              </select>

                            </div>

                          ) : (

                            <div>

                              <div
                                className="
                                  flex
                                  items-center
                                  gap-2
                                "
                              >

                                <span
                                  className="
                                    text-sm
                                    font-semibold
                                    text-gray-900
                                  "
                                >
                                  {
                                    institution.name
                                  }
                                </span>


                                {institution.count >
                                  0 && (

                                  <span
                                    className="
                                      text-xs
                                      text-gray-400
                                    "
                                  >
                                    {
                                      institution.count
                                    }{" "}
                                    笔贷款
                                  </span>

                                )}

                              </div>


                              {institution.count ===
                                0 && (

                                <div
                                  className="
                                    text-xs
                                    text-gray-400
                                    mt-0.5
                                  "
                                >
                                  暂无贷款
                                </div>

                              )}

                            </div>

                          )}

                        </div>


                        {/* =================================
                            类型
                        ================================= */}

                        <div>

                          <span
                            className="
                              inline-flex
                              px-2.5
                              py-1
                              rounded-full
                              bg-gray-100
                              text-xs
                              text-gray-600
                            "
                          >
                            {
                              institution.type
                            }
                          </span>

                        </div>


                        {/* =================================
                            贷款笔数
                        ================================= */}

                        <div
                          className="
                            text-sm
                            text-gray-700
                          "
                        >
                          {institution.count}
                        </div>


                        {/* =================================
                            本金余额
                        ================================= */}

                        <div
                          className="
                            text-sm
                            font-medium
                            text-gray-900
                          "
                        >
                          {money(
                            institution.balance
                          )}
                        </div>


                        {/* =================================
                            月供
                        ================================= */}

                        <div
                          className="
                            text-sm
                            text-gray-700
                          "
                        >
                          {money(
                            institution.monthlyPayment
                          )}
                        </div>


                        {/* =================================
                            公积金
                        ================================= */}

                        <div
                          className="
                            text-sm
                            text-green-600
                          "
                        >
                          {institution.housingFund >
                          0
                            ? money(
                                institution.housingFund
                              )
                            : "-"}
                        </div>


                        {/* =================================
                            实际月还
                        ================================= */}

                        <div
                          className="
                            text-sm
                            font-medium
                            text-blue-600
                          "
                        >
                          {money(
                            institution.actualPayment
                          )}
                        </div>


                        {/* =================================
                            操作
                        ================================= */}

                        <div
                          className="
                            flex
                            items-center
                            gap-2
                          "
                        >

                          {isEditing ? (

                            <>

                              <button
                                className="
                                  text-xs
                                  text-white
                                  bg-blue-600
                                  hover:bg-blue-700
                                  rounded-md
                                  px-2.5
                                  py-1.5
                                  disabled:opacity-50
                                "
                                onClick={
                                  saveInstitution
                                }
                                disabled={
                                  saving
                                }
                              >
                                保存
                              </button>


                              <button
                                className="
                                  text-xs
                                  text-gray-500
                                  hover:text-gray-700
                                  px-1
                                "
                                onClick={
                                  cancelEdit
                                }
                              >
                                取消
                              </button>

                            </>

                          ) : institution.id !==
                            null ? (

                            <>

                              <button
                                className="
                                  text-xs
                                  text-blue-600
                                  hover:text-blue-800
                                "
                                onClick={() =>
                                  startEdit(
                                    institution
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                编辑
                              </button>


                              <button
                                className="
                                  text-xs
                                  text-red-500
                                  hover:text-red-700
                                "
                                onClick={() =>
                                  deleteInstitution(
                                    institution
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                删除
                              </button>

                            </>

                          ) : (

                            <span
                              className="
                                text-xs
                                text-gray-400
                              "
                            >
                              —
                            </span>

                          )}

                        </div>

                      </div>

                    </div>


                    {/* =================================
                        贷款明细
                    ================================= */}

                    {isExpanded && (

                      <div
                        className="
                          bg-gray-50
                          border-t
                          border-gray-100
                          px-4
                          md:px-8
                          py-3
                          overflow-x-auto
                        "
                      >

                        {institution.loans.length ===
                        0 ? (

                          <div
                            className="
                              py-6
                              text-center
                              text-xs
                              text-gray-400
                            "
                          >
                            该机构目前没有贷款记录
                          </div>

                        ) : (

                          <table
                            className="
                              w-full
                              min-w-[760px]
                              text-xs
                            "
                          >

                            <thead>

                              <tr
                                className="
                                  text-gray-400
                                  border-b
                                  border-gray-200
                                "
                              >

                                <th
                                  className="
                                    py-2
                                    px-3
                                    text-left
                                    font-normal
                                  "
                                >
                                  贷款名称
                                </th>

                                <th
                                  className="
                                    py-2
                                    px-3
                                    text-left
                                    font-normal
                                  "
                                >
                                  类型
                                </th>

                                <th
                                  className="
                                    py-2
                                    px-3
                                    text-left
                                    font-normal
                                  "
                                >
                                  模式
                                </th>

                                <th
                                  className="
                                    py-2
                                    px-3
                                    text-right
                                    font-normal
                                  "
                                >
                                  本金余额
                                </th>

                                <th
                                  className="
                                    py-2
                                    px-3
                                    text-right
                                    font-normal
                                  "
                                >
                                  利率
                                </th>

                                <th
                                  className="
                                    py-2
                                    px-3
                                    text-right
                                    font-normal
                                  "
                                >
                                  月供
                                </th>

                                <th
                                  className="
                                    py-2
                                    px-3
                                    text-right
                                    font-normal
                                  "
                                >
                                  公积金月冲
                                </th>

                                <th
                                  className="
                                    py-2
                                    px-3
                                    text-right
                                    font-normal
                                  "
                                >
                                  自己实际还贷
                                </th>

                              </tr>

                            </thead>


                            <tbody>

                              {institution.loans.map(
                                loan => (

                                  <tr
                                    key={
                                      loan.id
                                    }
                                    className="
                                      border-b
                                      border-gray-100
                                      last:border-0
                                    "
                                  >

                                    <td
                                      className="
                                        py-2.5
                                        px-3
                                        font-medium
                                        text-gray-700
                                      "
                                    >
                                      {
                                        loan.name
                                      }
                                    </td>


                                    <td
                                      className="
                                        py-2.5
                                        px-3
                                        text-gray-600
                                      "
                                    >
                                      {
                                        loan.type ||
                                        "其他"
                                      }
                                    </td>


                                    <td
                                      className="
                                        py-2.5
                                        px-3
                                        text-gray-600
                                      "
                                    >
                                      {
                                        loan.loan_mode ||
                                        "-"
                                      }
                                    </td>


                                    <td
                                      className="
                                        py-2.5
                                        px-3
                                        text-right
                                        font-medium
                                        text-gray-800
                                      "
                                    >
                                      {money(
                                        num(
                                          loan.remaining_amount
                                        )
                                      )}
                                    </td>


                                    <td
                                      className="
                                        py-2.5
                                        px-3
                                        text-right
                                        text-gray-600
                                      "
                                    >
                                      {num(
                                        loan.interest_rate
                                      )}
                                      %
                                    </td>


                                    <td
                                      className="
                                        py-2.5
                                        px-3
                                        text-right
                                        text-gray-600
                                      "
                                    >
                                      {money(
                                        num(
                                          loan.monthly_payment
                                        )
                                      )}
                                    </td>


                                    <td
                                      className="
                                        py-2.5
                                        px-3
                                        text-right
                                        text-green-600
                                      "
                                    >
                                      {loan.type ===
                                      "房贷"
                                        ? money(
                                            getHousingFundMonthly(
                                              loan
                                            )
                                          )
                                        : "-"}
                                    </td>


                                    <td
                                      className="
                                        py-2.5
                                        px-3
                                        text-right
                                        font-medium
                                        text-blue-600
                                      "
                                    >
                                      {money(
                                        getActualMonthlyPayment(
                                          loan
                                        )
                                      )}
                                    </td>

                                  </tr>

                                )
                              )}

                            </tbody>

                          </table>

                        )}

                      </div>

                    )}

                  </div>

                );

              }
            )}

          </div>

        )}

      </section>


      {/* =================================================
          底部操作
      ================================================= */}

      <section
        className="
          mt-3
          flex
          items-center
          justify-between
          px-1
        "
      >

        <div
          className="
            text-xs
            text-gray-400
          "
        >
          共 {institutionCount} 家金融机构，
          {usedInstitutionCount} 家有贷款，
          {emptyInstitutionCount} 家暂无贷款
        </div>


        <div
          className="
            flex
            items-center
            gap-3
          "
        >

          <button
            className="
              text-xs
              text-gray-500
              hover:text-blue-600
            "
            onClick={
              expandAll
            }
          >
            全部展开
          </button>


          <button
            className="
              text-xs
              text-gray-500
              hover:text-blue-600
            "
            onClick={
              collapseAll
            }
          >
            全部收起
          </button>

        </div>

      </section>


      {/* =================================================
          使用说明
      ================================================= */}

      <section
        className="
          mt-4
          bg-blue-50
          border
          border-blue-100
          rounded-xl
          px-5
          py-4
        "
      >

        <div
          className="
            text-sm
            font-semibold
            text-blue-800
            mb-2
          "
        >
          💡 使用说明
        </div>


        <div
          className="
            text-xs
            text-blue-700
            leading-6
          "
        >

          <p>
            • 所有金融机构来自 financial_institutions 表。
          </p>

          <p>
            • 即使没有贷款的机构，也会继续显示。
          </p>

          <p>
            • 贷款按照 loans.institution 自动归类。
          </p>

          <p>
            • 编辑机构名称会同步修改 loans.institution。
          </p>

          <p>
            • 删除机构不会删除贷款，只会将机构设为 inactive，并把贷款转为「未设置金融机构」。
          </p>

          <p>
            • 再次新增已经删除过的机构，会自动恢复原机构。
          </p>

          <p>
            • 公积金只计算 type =「房贷」的贷款。
          </p>

          <p>
            • 自己实际月还 = 月供 − 公积金月冲。
          </p>

        </div>

      </section>

    </main>

  );

}