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

interface CreditCard {
  id: string;
  institution_id?: string | null;
  bank_name: string;
  card_name: string;
  billing_day: number;
  payment_day?: number | null;
  active: boolean;
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

  creditCard?: CreditCard | null;
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
  return `¥${Number(
    value || 0
  ).toLocaleString(
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

  const [
    creditCards,
    setCreditCards,
  ] = useState<CreditCard[]>([]);

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

  // ===================================================
  // 展开
  // ===================================================

  const [
    expanded,
    setExpanded,
  ] = useState<
    Record<string, boolean>
  >({});

  // ===================================================
  // 编辑金融机构
  // ===================================================

  const [
    editingInstitution,
    setEditingInstitution,
  ] = useState<string | null>(
    null
  );

  const [
    editingName,
    setEditingName,
  ] = useState("");

  const [
    editingType,
    setEditingType,
  ] = useState("银行");

  // ===================================================
  // 新增机构
  // ===================================================

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
  // 新增信用卡
  // ===================================================

  const [
    newHasCreditCard,
    setNewHasCreditCard,
  ] = useState(false);

  const [
    newBillingDay,
    setNewBillingDay,
  ] = useState("");

  const [
    newPaymentDay,
    setNewPaymentDay,
  ] = useState("");

  // ===================================================
  // 编辑信用卡
  // ===================================================

  const [
    editingCreditCardId,
    setEditingCreditCardId,
  ] = useState<string | null>(
    null
  );

  const [
    editingBillingDay,
    setEditingBillingDay,
  ] = useState("");

  const [
    editingPaymentDay,
    setEditingPaymentDay,
  ] = useState("");

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
        creditCardsResult,
      ] = await Promise.all([

        // -----------------------------------------------
        // 金融机构
        // -----------------------------------------------

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

        // -----------------------------------------------
        // 贷款
        // -----------------------------------------------

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

        // -----------------------------------------------
        // 信用卡
        // -----------------------------------------------

        supabase
          .from(
            "credit_cards"
          )
          .select(
            `
              id,
              institution_id,
              bank_name,
              card_name,
              billing_day,
              payment_day,
              active
            `
          )
          .eq(
            "active",
            true
          )
          .order(
            "billing_day",
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

      if (
        creditCardsResult.error
      ) {

        throw new Error(
          creditCardsResult.error.message ||
            "读取信用卡失败"
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

      setCreditCards(
        (
          creditCardsResult.data ||
          []
        ) as CreditCard[]
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

            // -------------------------------------------
            // 找到对应信用卡
            // -------------------------------------------

            const institutionCreditCard =
              creditCards.find(
                card =>
                  card.institution_id ===
                  institution.id
              ) ||
              creditCards.find(
                card =>
                  card.bank_name ===
                  institution.name
              ) ||
              null;

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

              creditCard:
                institutionCreditCard,

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

          creditCard:
            null,

        });

      }

      // =================================================
      // 排序
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
      creditCards,
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

        result[item.name] =
          true;

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

        result[item.name] =
          false;

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

      // -----------------------------------------------
      // 更新金融机构
      // -----------------------------------------------

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

      // -----------------------------------------------
      // 同步贷款
      // -----------------------------------------------

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

        // ---------------------------------------------
        // 同步信用卡银行名称
        // ---------------------------------------------

        const creditCardResult =
          await supabase
            .from(
              "credit_cards"
            )
            .update({

              bank_name:
                newInstitutionName,

            })
            .eq(
              "institution_id",
              currentInstitution.id
            );

        if (
          creditCardResult.error
        ) {

          throw new Error(
            creditCardResult.error.message ||
              "同步信用卡机构失败"
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
  // 验证日期
  // ===================================================

  function validateDay(
    value: string,
    label: string
  ): number {

    const day =
      Number(value);

    if (
      !Number.isInteger(day) ||
      day < 1 ||
      day > 31
    ) {

      throw new Error(
        `${label}必须是 1-31`
      );

    }

    return day;

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

      // -----------------------------------------------
      // 如果有信用卡，必须验证账单日和还款日
      // -----------------------------------------------

      let billingDay:
        number | null = null;

      let paymentDay:
        number | null = null;

      if (
        newType === "银行" &&
        newHasCreditCard
      ) {

        billingDay =
          validateDay(
            newBillingDay,
            "信用卡账单日"
          );

        paymentDay =
          validateDay(
            newPaymentDay,
            "信用卡还款日"
          );

      }

      // -----------------------------------------------
      // 查询机构
      // -----------------------------------------------

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

      // =================================================
      // 已存在且 active
      // =================================================

      if (
        existing &&
        existing.active === true
      ) {

        alert(
          `「${name}」已经存在。`
        );

        return;

      }

      // =================================================
      // 已存在但 inactive
      // =================================================

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

              active:
                true,

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

        // ---------------------------------------------
        // 如果选择了信用卡
        // ---------------------------------------------

        if (
          newType === "银行" &&
          newHasCreditCard
        ) {

          const existingCard =
            await supabase
              .from(
                "credit_cards"
              )
              .select(
                "id"
              )
              .eq(
                "institution_id",
                existing.id
              )
              .maybeSingle();

          if (
            existingCard.error
          ) {

            throw new Error(
              existingCard.error.message ||
                "查询原信用卡失败"
            );

          }

          if (
            existingCard.data
          ) {

            const updateCardResult =
              await supabase
                .from(
                  "credit_cards"
                )
                .update({

                  bank_name:
                    name,

                  billing_day:
                    billingDay,

                  payment_day:
                    paymentDay,

                  active:
                    true,

                })
                .eq(
                  "id",
                  existingCard.data.id
                );

            if (
              updateCardResult.error
            ) {

              throw new Error(
                updateCardResult.error.message ||
                  "恢复信用卡失败"
              );

            }

          } else {

            const insertCardResult =
              await supabase
                .from(
                  "credit_cards"
                )
                .insert({

                  institution_id:
                    existing.id,

                  bank_name:
                    name,

                  card_name:
                    `${name}信用卡`,

                  billing_day:
                    billingDay,

                  payment_day:
                    paymentDay,

                  active:
                    true,

                });

            if (
              insertCardResult.error
            ) {

              throw new Error(
                insertCardResult.error.message ||
                  "新增信用卡失败"
              );

            }

          }

        }

        setNewName("");

        setNewType(
          "银行"
        );

        setNewHasCreditCard(
          false
        );

        setNewBillingDay(
          ""
        );

        setNewPaymentDay(
          ""
        );

        setShowAdd(false);

        await loadData();

        alert(
          `「${name}」已恢复。`
        );

        return;

      }

      // =================================================
      // 新增金融机构
      // =================================================

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

          })
          .select(
            `
              id,
              name,
              type,
              active
            `
          )
          .single();

      if (
        insertResult.error
      ) {

        throw new Error(
          insertResult.error.message ||
            "新增金融机构失败"
        );

      }

      const newInstitution =
        insertResult.data;

      // =================================================
      // 新增信用卡
      // =================================================

      if (
        newType === "银行" &&
        newHasCreditCard
      ) {

        const creditCardResult =
          await supabase
            .from(
              "credit_cards"
            )
            .insert({

              // 关键：
              // 这里必须关联刚刚创建的机构 ID
              institution_id:
                newInstitution.id,

              bank_name:
                name,

              card_name:
                `${name}信用卡`,

              billing_day:
                billingDay,

              payment_day:
                paymentDay,

              active:
                true,

            });

        if (
          creditCardResult.error
        ) {

          // 如果信用卡创建失败，
          // 删除刚刚创建的金融机构，
          // 避免留下半成品数据

          await supabase
            .from(
              "financial_institutions"
            )
            .delete()
            .eq(
              "id",
              newInstitution.id
            );

          throw new Error(
            creditCardResult.error.message ||
              "新增信用卡失败"
          );

        }

      }

      // =================================================
      // 清空表单
      // =================================================

      setNewName("");

      setNewType(
        "银行"
      );

      setNewHasCreditCard(
        false
      );

      setNewBillingDay(
        ""
      );

      setNewPaymentDay(
        ""
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
  // 停用机构
  // ===================================================

  async function disableInstitution(
    institution: Institution
  ) {

    if (
      !institution.id
    ) {

      return;

    }

    const confirmed =
      window.confirm(
        `确定要停用「${institution.name}」吗？

停用后：

1. 机构会从当前列表隐藏
2. 数据不会被删除
3. 贷款不会删除
4. 信用卡不会删除
5. 以后可以重新恢复`
      );

    if (!confirmed) {
      return;
    }

    try {

      setSaving(true);
      setError("");

      const result =
        await supabase
          .from(
            "financial_institutions"
          )
          .update({

            active:
              false,

          })
          .eq(
            "id",
            institution.id
          );

      if (
        result.error
      ) {

        throw new Error(
          result.error.message ||
            "停用金融机构失败"
        );

      }

      await loadData();

    } catch (err: any) {

      console.error(
        "disableInstitution error:",
        err
      );

      setError(
        err?.message ||
          "停用金融机构失败"
      );

    } finally {

      setSaving(false);

    }

  }

  // ===================================================
  // 真正删除机构
  // ===================================================

  async function permanentlyDeleteInstitution(
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
        `⚠️ 确定要真正删除「${institution.name}」吗？

这是永久删除，不是停用。

将会：

1. 永久删除 financial_institutions 记录
2. 删除该机构关联的信用卡
3. 贷款不会删除
4. 贷款机构会变成「未设置金融机构」

删除后不能通过“恢复”找回。`
      );

    if (!confirmed) {
      return;
    }

    try {

      setSaving(true);
      setError("");

      // -----------------------------------------------
      // 先清空贷款机构
      // -----------------------------------------------

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

      // -----------------------------------------------
      // 删除关联信用卡
      // -----------------------------------------------

      const creditCardResult =
        await supabase
          .from(
            "credit_cards"
          )
          .delete()
          .eq(
            "institution_id",
            institution.id
          );

      if (
        creditCardResult.error
      ) {

        throw new Error(
          creditCardResult.error.message ||
            "删除关联信用卡失败"
        );

      }

      // -----------------------------------------------
      // 真正删除金融机构
      // -----------------------------------------------

      const institutionResult =
        await supabase
          .from(
            "financial_institutions"
          )
          .delete()
          .eq(
            "id",
            institution.id
          );

      if (
        institutionResult.error
      ) {

        throw new Error(
          institutionResult.error.message ||
            "真正删除金融机构失败"
        );

      }

      await loadData();

      alert(
        `「${institution.name}」已经永久删除。`
      );

    } catch (err: any) {

      console.error(
        "permanentlyDeleteInstitution error:",
        err
      );

      setError(
        err?.message ||
          "真正删除金融机构失败"
      );

    } finally {

      setSaving(false);

    }

  }

  // ===================================================
  // 开始编辑信用卡
  // ===================================================

  function startEditCreditCard(
    card: CreditCard
  ) {

    setEditingCreditCardId(
      card.id
    );

    setEditingBillingDay(
      String(
        card.billing_day || ""
      )
    );

    setEditingPaymentDay(
      String(
        card.payment_day || ""
      )
    );

  }

  // ===================================================
  // 取消编辑信用卡
  // ===================================================

  function cancelEditCreditCard() {

    setEditingCreditCardId(
      null
    );

    setEditingBillingDay("");

    setEditingPaymentDay("");

  }

  // ===================================================
  // 保存信用卡
  // ===================================================

  async function saveCreditCard() {

    if (
      !editingCreditCardId
    ) {

      return;

    }

    try {

      setSaving(true);
      setError("");

      const billingDay =
        validateDay(
          editingBillingDay,
          "信用卡账单日"
        );

      const paymentDay =
        validateDay(
          editingPaymentDay,
          "信用卡还款日"
        );

      const result =
        await supabase
          .from(
            "credit_cards"
          )
          .update({

            billing_day:
              billingDay,

            payment_day:
              paymentDay,

          })
          .eq(
            "id",
            editingCreditCardId
          );

      if (
        result.error
      ) {

        throw new Error(
          result.error.message ||
            "保存信用卡失败"
        );

      }

      cancelEditCreditCard();

      await loadData();

    } catch (err: any) {

      console.error(
        "saveCreditCard error:",
        err
      );

      setError(
        err?.message ||
          "保存信用卡失败"
      );

    } finally {

      setSaving(false);

    }

  }

  // ===================================================
  // 删除信用卡
  // ===================================================

  async function deleteCreditCard(
    card: CreditCard
  ) {

    const confirmed =
      window.confirm(
        `确定删除「${card.card_name}」吗？`
      );

    if (!confirmed) {
      return;
    }

    try {

      setSaving(true);
      setError("");

      const result =
        await supabase
          .from(
            "credit_cards"
          )
          .delete()
          .eq(
            "id",
            card.id
          );

      if (
        result.error
      ) {

        throw new Error(
          result.error.message ||
            "删除信用卡失败"
        );

      }

      await loadData();

    } catch (err: any) {

      console.error(
        "deleteCreditCard error:",
        err
      );

      setError(
        err?.message ||
          "删除信用卡失败"
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
        max-w-7xl
        mx-auto
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
              管理家庭贷款及信用卡涉及的银行及金融机构
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
            如果该机构以前停用过，系统会自动恢复。
          </div>

          <div
            className="
              flex
              flex-col
              gap-3
            "
          >

            <div
              className="
                flex
                flex-col
                lg:flex-row
                gap-3
                items-start
                lg:items-center
              "
            >

              {/* ---------------------------------------
                  名称
              --------------------------------------- */}

              <input
                className="
                  flex-1
                  w-full
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

              {/* ---------------------------------------
                  类型
              --------------------------------------- */}

              <select
                className="
                  border
                  border-gray-200
                  rounded-lg
                  px-3
                  py-2.5
                  text-sm
                  lg:w-36
                "
                value={
                  newType
                }
                onChange={e => {

                  setNewType(
                    e.target.value
                  );

                  if (
                    e.target.value !==
                    "银行"
                  ) {

                    setNewHasCreditCard(
                      false
                    );

                    setNewBillingDay(
                      ""
                    );

                    setNewPaymentDay(
                      ""
                    );

                  }

                }}
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

            {/* =================================================
                信用卡设置
            ================================================= */}

            {newType === "银行" && (

              <div
                className="
                  border
                  border-gray-200
                  rounded-xl
                  p-4
                  bg-gray-50
                "
              >

                <label
                  className="
                    flex
                    items-center
                    gap-2
                    text-sm
                    font-medium
                    text-gray-700
                  "
                >

                  <input
                    type="checkbox"
                    checked={
                      newHasCreditCard
                    }
                    onChange={e =>
                      setNewHasCreditCard(
                        e.target.checked
                      )
                    }
                  />

                  有信用卡
                </label>

                {newHasCreditCard && (

                  <div
                    className="
                      mt-3
                      flex
                      flex-col
                      sm:flex-row
                      gap-3
                      items-start
                      sm:items-center
                    "
                  >

                    {/* -----------------------------------
                        账单日
                    ----------------------------------- */}

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
                          text-gray-500
                          whitespace-nowrap
                        "
                      >
                        账单日
                      </span>

                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="
                          w-20
                          border
                          border-gray-200
                          rounded-lg
                          px-3
                          py-2
                          text-sm
                          text-center
                          outline-none
                          focus:border-blue-500
                          bg-white
                        "
                        placeholder="1-31"
                        value={
                          newBillingDay
                        }
                        onChange={e =>
                          setNewBillingDay(
                            e.target.value
                          )
                        }
                      />

                      <span
                        className="
                          text-sm
                          text-gray-500
                        "
                      >
                        日
                      </span>

                    </div>

                    {/* -----------------------------------
                        还款日
                    ----------------------------------- */}

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
                          text-gray-500
                          whitespace-nowrap
                        "
                      >
                        还款日
                      </span>

                      <input
                        type="number"
                        min={1}
                        max={31}
                        className="
                          w-20
                          border
                          border-gray-200
                          rounded-lg
                          px-3
                          py-2
                          text-sm
                          text-center
                          outline-none
                          focus:border-blue-500
                          bg-white
                        "
                        placeholder="1-31"
                        value={
                          newPaymentDay
                        }
                        onChange={e =>
                          setNewPaymentDay(
                            e.target.value
                          )
                        }
                      />

                      <span
                        className="
                          text-sm
                          text-gray-500
                        "
                      >
                        日
                      </span>

                    </div>

                  </div>

                )}

              </div>

            )}

            {/* =================================================
                按钮
            ================================================= */}

            <div
              className="
                flex
                items-center
                justify-end
                gap-3
              "
            >

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

                  setShowAdd(
                    false
                  );

                  setNewName("");

                  setNewType(
                    "银行"
                  );

                  setNewHasCreditCard(
                    false
                  );

                  setNewBillingDay(
                    ""
                  );

                  setNewPaymentDay(
                    ""
                  );

                }}
              >
                取消
              </button>

            </div>

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
          mt-4
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
              min-w-[1100px]
              grid
              grid-cols-[minmax(220px,1.8fr)_80px_80px_130px_120px_130px_130px_190px]
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
                          min-w-[1100px]
                          grid
                          grid-cols-[minmax(220px,1.8fr)_80px_80px_130px_120px_130px_130px_190px]
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

                              {institution.creditCard && (

                                <div
                                  className="
                                    text-xs
                                    text-blue-600
                                    mt-1
                                  "
                                >
                                  💳{" "}
                                  {
                                    institution.creditCard.card_name
                                  }
                                  {" · 账单日 "}
                                  {
                                    institution.creditCard.billing_day
                                  }
                                  {" · 还款日 "}
                                  {
                                    institution.creditCard.payment_day ||
                                    "-"
                                  }
                                  {" 日"}
                                </div>

                              )}

                              {institution.count ===
                                0 &&
                                !institution.creditCard && (

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
                            gap-3
                            whitespace-nowrap
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
                                  text-orange-500
                                  hover:text-orange-700
                                "
                                onClick={() =>
                                  disableInstitution(
                                    institution
                                  )
                                }
                                disabled={
                                  saving
                                }
                              >
                                停用
                              </button>

                              <button
                                className="
                                  text-xs
                                  text-red-500
                                  hover:text-red-700
                                "
                                onClick={() =>
                                  permanentlyDeleteInstitution(
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
                        展开明细
                    ================================= */}

                    {isExpanded && (

                      <div
                        className="
                          bg-gray-50
                          border-t
                          border-gray-100
                          px-4
                          md:px-8
                          py-4
                        "
                      >

                        {/* =================================
                            信用卡
                        ================================= */}

                        {institution.creditCard && (

                          <div
                            className="
                              bg-white
                              border
                              border-blue-100
                              rounded-lg
                              p-4
                              mb-4
                            "
                          >

                            <div
                              className="
                                flex
                                items-center
                                justify-between
                                mb-3
                              "
                            >

                              <div
                                className="
                                  text-sm
                                  font-semibold
                                  text-gray-800
                                "
                              >
                                💳 信用卡
                              </div>

                            </div>

                            {editingCreditCardId ===
                            institution.creditCard.id ? (

                              <div
                                className="
                                  flex
                                  flex-wrap
                                  items-center
                                  gap-4
                                "
                              >

                                <div
                                  className="
                                    text-sm
                                    font-medium
                                    text-gray-700
                                  "
                                >
                                  {
                                    institution.creditCard.card_name
                                  }
                                </div>

                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-2
                                  "
                                >

                                  <span
                                    className="
                                      text-xs
                                      text-gray-500
                                    "
                                  >
                                    账单日
                                  </span>

                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    className="
                                      w-20
                                      border
                                      border-blue-300
                                      rounded-md
                                      px-2
                                      py-1.5
                                      text-sm
                                      text-center
                                      outline-none
                                    "
                                    value={
                                      editingBillingDay
                                    }
                                    onChange={e =>
                                      setEditingBillingDay(
                                        e.target.value
                                      )
                                    }
                                  />

                                  <span
                                    className="
                                      text-xs
                                      text-gray-500
                                    "
                                  >
                                    日
                                  </span>

                                </div>

                                <div
                                  className="
                                    flex
                                    items-center
                                    gap-2
                                  "
                                >

                                  <span
                                    className="
                                      text-xs
                                      text-gray-500
                                    "
                                  >
                                    还款日
                                  </span>

                                  <input
                                    type="number"
                                    min={1}
                                    max={31}
                                    className="
                                      w-20
                                      border
                                      border-blue-300
                                      rounded-md
                                      px-2
                                      py-1.5
                                      text-sm
                                      text-center
                                      outline-none
                                    "
                                    value={
                                      editingPaymentDay
                                    }
                                    onChange={e =>
                                      setEditingPaymentDay(
                                        e.target.value
                                      )
                                    }
                                  />

                                  <span
                                    className="
                                      text-xs
                                      text-gray-500
                                    "
                                  >
                                    日
                                  </span>

                                </div>

                                <button
                                  className="
                                    text-xs
                                    text-white
                                    bg-blue-600
                                    hover:bg-blue-700
                                    rounded-md
                                    px-3
                                    py-1.5
                                  "
                                  onClick={
                                    saveCreditCard
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
                                  "
                                  onClick={
                                    cancelEditCreditCard
                                  }
                                >
                                  取消
                                </button>

                              </div>

                            ) : (

                              <div
                                className="
                                  flex
                                  flex-wrap
                                  items-center
                                  gap-5
                                "
                              >

                                <div
                                  className="
                                    text-sm
                                    font-medium
                                    text-gray-700
                                  "
                                >
                                  {
                                    institution.creditCard.card_name
                                  }
                                </div>

                                <div
                                  className="
                                    text-sm
                                    text-gray-600
                                  "
                                >
                                  账单日：
                                  <span
                                    className="
                                      font-medium
                                      text-gray-900
                                    "
                                  >
                                    {
                                      institution.creditCard.billing_day
                                    }
                                    日
                                  </span>
                                </div>

                                <div
                                  className="
                                    text-sm
                                    text-gray-600
                                  "
                                >
                                  还款日：
                                  <span
                                    className="
                                      font-medium
                                      text-gray-900
                                    "
                                  >
                                    {
                                      institution.creditCard.payment_day ||
                                      "-"
                                    }
                                    日
                                  </span>
                                </div>

                                <button
                                  className="
                                    text-xs
                                    text-blue-600
                                    hover:text-blue-800
                                  "
                                  onClick={() =>
                                    startEditCreditCard(
                                      institution.creditCard!
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
                                    deleteCreditCard(
                                      institution.creditCard!
                                    )
                                  }
                                  disabled={
                                    saving
                                  }
                                >
                                  删除信用卡
                                </button>

                              </div>

                            )}

                          </div>

                        )}

                        {/* =================================
                            贷款明细
                        ================================= */}

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

                          <div
                            className="
                              overflow-x-auto
                            "
                          >

                            <table
                              className="
                                w-full
                                min-w-[900px]
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

                          </div>

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
            • 信用卡来自 credit_cards 表，并通过 institution_id 关联金融机构。
          </p>

          <p>
            • 新增银行时可以同时创建信用卡。
          </p>

          <p>
            • 信用卡可以设置账单日和还款日。
          </p>

          <p>
            • 信用卡账单日和还款日可以随时编辑。
          </p>

          <p>
            • 编辑机构名称会同步修改 loans.institution 和 credit_cards.bank_name。
          </p>

          <p>
            • 停用机构不会删除数据库记录。
          </p>

          <p>
            • 真正删除机构会删除金融机构及其关联信用卡，但不会删除贷款。
          </p>

          <p>
            • 删除机构后，原机构下的贷款会变成「未设置金融机构」。
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