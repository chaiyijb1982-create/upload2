import { NextRequest, NextResponse } from "next/server";

import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

import {
  createExpenseTransactions,
  type ExpenseTransactionInput,
} from "@/lib/expense-transactions";


// =====================================================
// Supabase Admin
// =====================================================

function getSupabaseAdmin() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL"
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "缺少 SUPABASE_SERVICE_ROLE_KEY"
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}


// =====================================================
// 工具：数字转换
// =====================================================

function toNumber(
  value: unknown
): number {

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  if (
    typeof value === "number"
  ) {
    return Number.isFinite(value)
      ? value
      : 0;
  }

  const text =
    String(value)
      .replace(/,/g, "")
      .replace(/¥/g, "")
      .trim();

  const number =
    Number(text);

  return Number.isFinite(number)
    ? number
    : 0;
}


// =====================================================
// 工具：字符串
// =====================================================

function toStringOrNull(
  value: unknown
): string | null {

  if (
    value === null ||
    value === undefined
  ) {
    return null;
  }

  const text =
    String(value).trim();

  return text
    ? text
    : null;
}


// =====================================================
// 工具：账户名称标准化
//
// 这里只负责清理 Excel 中的账户名称。
// 真正的账户对应关系由
// expense_account_mappings 决定。
// =====================================================

function normalizeAccountName(
  value: unknown
): string | null {

  const text =
    toStringOrNull(value);

  if (!text) {
    return null;
  }

  return text.trim();
}


// =====================================================
// POST /api/expense
//
// Excel → expense_transactions
//
// 完整流程：
//
// 1. 上传 Excel
// 2. 读取「收入支出」Sheet
// 3. 找出所有资金账户名称
// 4. 查询 expense_account_mappings
//
// 5. 如果发现新账户：
//      自动创建映射
//      confirmed = false
//      standard_name = null
//      本次停止导入
//
// 6. 如果账户已经存在但没有确认：
//      本次停止导入
//
// 7. 所有账户 confirmed=true：
//      使用 standard_name
//      正式写入 expense_transactions
//
// 注意：
// 新账户第一次上传不会产生消费记录。
// 确认映射后，需要重新上传一次 Excel。
// =====================================================

export async function POST(
  request: NextRequest
) {

  try {

    // =================================================
    // 1. 获取上传文件
    // =================================================

    const formData =
      await request.formData();

    const file =
      formData.get("file");

    if (
      !(file instanceof File)
    ) {

      return NextResponse.json(
        {
          success: false,
          error:
            "没有找到 Excel 文件",
        },
        {
          status: 400,
        }
      );

    }


    const fileName =
      file.name ||
      "expense.xlsx";


    // =================================================
    // 2. 检查文件格式
    // =================================================

    const lowerFileName =
      fileName.toLowerCase();

    if (
      !lowerFileName.endsWith(".xlsx") &&
      !lowerFileName.endsWith(".xls")
    ) {

      return NextResponse.json(
        {
          success: false,

          error:
            "只支持 .xlsx 或 .xls Excel 文件",
        },
        {
          status: 400,
        }
      );

    }


    // =================================================
    // 3. 读取 Excel
    // =================================================

    const buffer =
      Buffer.from(
        await file.arrayBuffer()
      );

    const workbook =
      XLSX.read(
        buffer,
        {
          type: "buffer",
          cellDates: true,
        }
      );


    // =================================================
    // 4. 找到「收入支出」Sheet
    // =================================================

    let sheetName =
      workbook.SheetNames.find(
        name =>
          name.trim() ===
          "收入支出"
      );


    // 模糊匹配
    if (!sheetName) {

      sheetName =
        workbook.SheetNames.find(
          name =>
            name.includes(
              "收入支出"
            )
        );

    }


    if (!sheetName) {

      return NextResponse.json(
        {
          success: false,

          error:
            `Excel 中没有找到「收入支出」Sheet。当前 Sheet：${workbook.SheetNames.join(
              "、"
            )}`,
        },
        {
          status: 400,
        }
      );

    }


    const worksheet =
      workbook.Sheets[
        sheetName
      ];


    // =================================================
    // 5. Excel → JSON
    // =================================================

    const rows =
      XLSX.utils.sheet_to_json<
        Record<string, unknown>
      >(
        worksheet,
        {
          defval: null,
          raw: true,
        }
      );


    // =================================================
    // Excel 没有数据
    // =================================================

    if (
      !rows.length
    ) {

      return NextResponse.json(
        {
          success: true,

          result: {
            success: true,
            total: 0,
            inserted: 0,
            duplicated: 0,
            failed: 0,
            credit_card: 0,
            non_credit_card: 0,
            settlement: 0,
            errors: [],
          },

          message:
            "Excel「收入支出」Sheet 没有数据",
        }
      );

    }


    // =================================================
    // 6. 检查 Excel 字段
    // =================================================

    const requiredColumns = [

      "时间",

      "资金账户名称",

      "资金类型",

      "资金账户备注",

      "收支类型",

      "账目分类",

      "账目金额",

      "成员",

      "账目备注",

      "账本名称",

    ];


    const firstRow =
      rows[0];


    const missingColumns =
      requiredColumns.filter(
        column =>
          !Object.prototype.hasOwnProperty.call(
            firstRow,
            column
          )
      );


    if (
      missingColumns.length
    ) {

      return NextResponse.json(
        {
          success: false,

          error:
            `Excel 字段不完整，缺少：${missingColumns.join(
              "、"
            )}`,

          columns:
            Object.keys(
              firstRow
            ),
        },
        {
          status: 400,
        }
      );

    }


    // =================================================
    // 7. Supabase Admin
    // =================================================

    const supabase =
      getSupabaseAdmin();


    // =================================================
    // 8. 收集 Excel 中所有账户名称
    //
    // 一个名称只检查一次
    // =================================================

    const accountMap =
      new Map<
        string,
        {
          sourceName: string;
          accountType: string | null;
        }
      >();


    for (
      const row of rows
    ) {

      const sourceName =
        normalizeAccountName(
          row[
            "资金账户名称"
          ]
        );

      const accountType =
        toStringOrNull(
          row[
            "资金类型"
          ]
        );


      if (!sourceName) {
        continue;
      }


      // 同一个账户名称只保留第一次出现的资金类型
      if (
        !accountMap.has(
          sourceName
        )
      ) {

        accountMap.set(
          sourceName,
          {
            sourceName,
            accountType,
          }
        );

      }

    }


    const sourceNames =
      Array.from(
        accountMap.keys()
      );


    // =================================================
    // 9. 没有账户名称
    // =================================================

    if (
      sourceNames.length === 0
    ) {

      return NextResponse.json(
        {
          success: false,

          error:
            "Excel 中没有找到有效的「资金账户名称」",

        },
        {
          status: 400,
        }
      );

    }


    // =================================================
    // 10. 查询已有账户映射
    // =================================================

    const {
      data: mappings,
      error: mappingsError,
    } =
      await supabase
        .from(
          "expense_account_mappings"
        )
        .select(
          `
            id,
            source_name,
            standard_name,
            account_type,
            confirmed,
            created_at,
            updated_at
          `
        )
        .in(
          "source_name",
          sourceNames
        );


    if (
      mappingsError
    ) {

      console.error(
        "expense_account_mappings query error:",
        mappingsError
      );

      return NextResponse.json(
        {
          success: false,

          error:
            `读取账户名称映射失败：${mappingsError.message}`,
        },
        {
          status: 500,
        }
      );

    }


    // =================================================
    // 11. 建立映射 Map
    // =================================================

    const mappingMap =
      new Map<
        string,
        {
          id: string;
          source_name: string;
          standard_name: string | null;
          account_type: string | null;
          confirmed: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >();


    for (
      const mapping of
        mappings ?? []
    ) {

      if (
        !mapping.source_name
      ) {
        continue;
      }


      mappingMap.set(
        mapping.source_name,
        mapping
      );

    }


    // =================================================
    // 12. 找出未确认账户
    //
    // 包括：
    //
    // A. 数据库没有
    // B. confirmed=false
    // C. standard_name为空
    // =================================================

    const unresolvedAccounts:
      Array<{
        source_name: string;
        account_type: string | null;
        mapping_id: string | null;
        standard_name: string | null;
        confirmed: boolean;
      }> = [];


    for (
      const account of
        accountMap.values()
    ) {

      const mapping =
        mappingMap.get(
          account.sourceName
        );


      const isConfirmed =
        Boolean(
          mapping &&
          mapping.confirmed === true &&
          mapping.standard_name &&
          mapping.standard_name.trim()
        );


      if (!isConfirmed) {

        unresolvedAccounts.push({

          source_name:
            account.sourceName,

          account_type:
            account.accountType,

          mapping_id:
            mapping?.id ??
            null,

          standard_name:
            mapping?.standard_name ??
            null,

          confirmed:
            mapping?.confirmed ??
            false,

        });

      }

    }


    // =================================================
    // 13. ★ 自动创建新账户映射
    //
    // 这是本次最重要的逻辑。
    //
    // 如果 Excel 出现：
    //
    // 上行信用卡
    //
    // 数据库没有：
    //
    // 就自动创建：
    //
    // source_name   = 上行信用卡
    // standard_name = null
    // confirmed     = false
    //
    // 这样 /expense-account-mappings
    // 就可以看到这个账户。
    // =================================================

    const newMappings =
      unresolvedAccounts.filter(
        item =>
          !item.mapping_id
      );


    if (
      newMappings.length > 0
    ) {

      const insertRows =
        newMappings.map(
          item => ({

            source_name:
              item.source_name,

            standard_name:
              null,

            account_type:
              item.account_type,

            confirmed:
              false,

          })
        );


      // -------------------------------------------------
      // 使用 upsert
      //
      // 前提：
      // source_name 已经设置 UNIQUE
      // -------------------------------------------------

      const {
        error:
          insertMappingError,
      } =
        await supabase
          .from(
            "expense_account_mappings"
          )
          .upsert(
            insertRows,
            {
              onConflict:
                "source_name",

              ignoreDuplicates:
                true,
            }
          );


      if (
        insertMappingError
      ) {

        console.error(
          "Create expense account mappings error:",
          insertMappingError
        );

        return NextResponse.json(
          {
            success: false,

            error:
              `创建待确认账户映射失败：${insertMappingError.message}`,
          },
          {
            status: 500,
          }
        );

      }

    }


    // =================================================
    // 14. 如果存在未确认账户
    //
    // ★ 这里直接停止
    //
    // 不调用 createExpenseTransactions
    //
    // 所以：
    //
    // 新账户出现
    // ↓
    // 创建映射
    // ↓
    // 停止
    // ↓
    // 用户确认
    // ↓
    // 重新上传
    // ↓
    // 正式导入
    // =================================================

    if (
      unresolvedAccounts.length > 0
    ) {

      return NextResponse.json(
        {
          success: false,

          needs_confirmation:
            true,

          error:
            "发现尚未确认的账户名称，请先完成账户名称对应。",

          file_name:
            fileName,

          sheet_name:
            sheetName,

          total_rows:
            rows.length,

          accounts:
            unresolvedAccounts,

          new_accounts:
            newMappings.map(
              item =>
                item.source_name
            ),

          message:
            `发现 ${unresolvedAccounts.length} 个未确认账户，已自动加入账户映射，请先完成账户名称对应后重新上传。`,
        },
        {
          status: 409,
        }
      );

    }


    // =================================================
    // 15. 所有账户均已确认
    //
    // Excel 原始名称
    //      ↓
    // expense_account_mappings
    //      ↓
    // standard_name
    //
    // 最终：
    // expense_transactions.account_name
    // 使用 standard_name
    // =================================================

    const inputs:
      ExpenseTransactionInput[] =
      rows.map(
        row => {

          const sourceAccountName =
            normalizeAccountName(
              row[
                "资金账户名称"
              ]
            );


          const accountType =
            toStringOrNull(
              row[
                "资金类型"
              ]
            );


          const incomeExpenseType =
            toStringOrNull(
              row[
                "收支类型"
              ]
            );


          const amount =
            toNumber(
              row[
                "账目金额"
              ]
            );


          // =================================================
          // 获取标准账户名称
          // =================================================

          const mapping =
            sourceAccountName
              ? mappingMap.get(
                  sourceAccountName
                )
              : null;


          const standardAccountName =
            mapping?.standard_name?.trim() ||
            sourceAccountName;


          // =================================================
          // 信用卡判断
          // =================================================

          const isCreditCard =
            accountType ===
            "信用卡";


          // =================================================
          // 平账判断
          // =================================================

          const settlementText =
            [

              incomeExpenseType,

              toStringOrNull(
                row[
                  "账目分类"
                ]
              ),

              toStringOrNull(
                row[
                  "账目备注"
                ]
              ),

            ]
              .filter(Boolean)
              .join(" ");


          const isSettlement =
            settlementText.includes(
              "平账"
            ) ||
            settlementText.includes(
              "平帐"
            );


          return {

            // -------------------------------------------------
            // 时间
            // -------------------------------------------------

            transaction_time:
              row[
                "时间"
              ] as
                | string
                | Date
                | null,


            // -------------------------------------------------
            // ★ 标准账户名称
            // -------------------------------------------------

            account_name:
              standardAccountName,


            // -------------------------------------------------
            // 资金类型
            // -------------------------------------------------

            account_type:
              accountType,


            // -------------------------------------------------
            // 账户备注
            // -------------------------------------------------

            account_remark:
              toStringOrNull(
                row[
                  "资金账户备注"
                ]
              ),


            // -------------------------------------------------
            // 收支类型
            // -------------------------------------------------

            income_expense_type:
              incomeExpenseType,


            // -------------------------------------------------
            // 分类
            // -------------------------------------------------

            category:
              toStringOrNull(
                row[
                  "账目分类"
                ]
              ),


            // -------------------------------------------------
            // 金额
            // -------------------------------------------------

            amount,


            // -------------------------------------------------
            // 成员
            // -------------------------------------------------

            member:
              toStringOrNull(
                row[
                  "成员"
                ]
              ),


            // -------------------------------------------------
            // 备注
            // -------------------------------------------------

            remark:
              toStringOrNull(
                row[
                  "账目备注"
                ]
              ),


            // -------------------------------------------------
            // 账本
            // -------------------------------------------------

            book_name:
              toStringOrNull(
                row[
                  "账本名称"
                ]
              ),


            // -------------------------------------------------
            // 信用卡
            // -------------------------------------------------

            is_credit_card:
              isCreditCard,


            // -------------------------------------------------
            // 平账
            // -------------------------------------------------

            is_settlement:
              isSettlement,


            // -------------------------------------------------
            // 来源文件
            // -------------------------------------------------

            source_file:
              fileName,


            // -------------------------------------------------
            // 来源 Sheet
            // -------------------------------------------------

            source_sheet:
              sheetName,

          };

        }
      );


    // =================================================
    // 16. 统计
    // =================================================

    const creditCardCount =
      inputs.filter(
        item =>
          item.is_credit_card ===
          true
      ).length;


    const nonCreditCardCount =
      inputs.filter(
        item =>
          item.is_credit_card !==
          true
      ).length;


    const settlementCount =
      inputs.filter(
        item =>
          item.is_settlement ===
          true
      ).length;


    // =================================================
    // 17. 正式写入 expense_transactions
    //
    // ★ 只有所有账户确认后才执行
    // =================================================

    const result =
      await createExpenseTransactions(
        inputs
      );


    // =================================================
    // 18. 返回结果
    // =================================================

    return NextResponse.json(
      {
        success:
          result.success,

        needs_confirmation:
          false,

        result,

        file_name:
          fileName,

        sheet_name:
          sheetName,

        imported_rows:
          inputs.length,

        credit_card_rows:
          creditCardCount,

        non_credit_card_rows:
          nonCreditCardCount,

        settlement_rows:
          settlementCount,

        message:
          result.success
            ? `导入完成：新增 ${result.inserted} 笔，重复 ${result.duplicated} 笔`
            : `导入完成，但有 ${result.failed} 笔失败`,
      }
    );

  } catch (
    error
  ) {

    console.error(
      "POST /api/expense error:",
      error
    );


    return NextResponse.json(
      {
        success: false,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      {
        status: 500,
      }
    );

  }

}