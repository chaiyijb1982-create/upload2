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
// 常量
// =====================================================

const IMPORT_SOURCE = "fish";

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
// 工具：Excel 日期
//
// 统一转换成 Date
// =====================================================

function parseTransactionDate(
  value: unknown
): Date | null {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  if (
    value instanceof Date
  ) {
    if (
      Number.isNaN(
        value.getTime()
      )
    ) {
      return null;
    }

    return value;
  }

  // Excel serial date
  if (
    typeof value === "number"
  ) {
    const excelEpoch =
      new Date(
        Date.UTC(
          1899,
          11,
          30
        )
      );

    const date =
      new Date(
        excelEpoch.getTime() +
        value * 86400000
      );

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return null;
    }

    return date;
  }

  const text =
    String(value).trim();

  if (!text) {
    return null;
  }

  const date =
    new Date(text);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date;
}

// =====================================================
// 获取上次成功导入截止时间
// =====================================================

async function getImportState(
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >
): Promise<string | null> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "expense_import_state"
      )
      .select(
        "last_transaction_time"
      )
      .eq(
        "source",
        IMPORT_SOURCE
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `读取消费导入进度失败：${error.message}`
    );
  }

  return (
    data?.last_transaction_time ??
    null
  );
}

// =====================================================
// 更新导入截止时间
// =====================================================

async function updateImportState(
  supabase: ReturnType<
    typeof getSupabaseAdmin
  >,
  lastTransactionTime: string
) {
  const {
    error,
  } =
    await supabase
      .from(
        "expense_import_state"
      )
      .upsert(
        {
          source:
            IMPORT_SOURCE,

          last_transaction_time:
            lastTransactionTime,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "source",
        }
      );

  if (error) {
    throw new Error(
      `更新消费导入进度失败：${error.message}`
    );
  }
}

// =====================================================
// POST /api/expense
//
// Excel → expense_transactions
//
// 增量导入规则：
//
// 第一次：
// last_transaction_time = null
// → 全部导入
//
// 后续：
// transaction_time > last_transaction_time
// → 才导入
//
// <= last_transaction_time
// → 全部跳过
//
// transaction_hash
// → 第二层重复保护
//
// -----------------------------------------------------
//
// 账户确认规则：
//
// 如果发现未确认账户：
//
// HTTP 409
// success = true
// needs_confirmation = true
//
// 这不是导入失败，而是正常业务状态：
// “需要用户完成账户映射后重新上传”
//
// 此时：
//
// 1. 不写入 expense_transactions
// 2. 不推进 import cursor
// 3. 自动创建不存在的账户映射
//
// 用户确认账户后重新上传 Excel。
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
          needs_confirmation:
            false,
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
      !lowerFileName.endsWith(
        ".xlsx"
      ) &&
      !lowerFileName.endsWith(
        ".xls"
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          needs_confirmation:
            false,
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
          needs_confirmation:
            false,
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

          needs_confirmation:
            false,

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

          file_name:
            fileName,

          sheet_name:
            sheetName,

          total_rows:
            0,

          new_rows:
            0,

          skipped_by_increment:
            0,

          invalid_date_rows:
            0,

          last_import_time:
            null,

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

          needs_confirmation:
            false,

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
    // 8. 获取上次成功导入截止时间
    // =================================================

    const lastImportTime =
      await getImportState(
        supabase
      );

    const lastImportDate =
      lastImportTime
        ? new Date(
            lastImportTime
          )
        : null;

    if (
      lastImportDate &&
      Number.isNaN(
        lastImportDate.getTime()
      )
    ) {
      throw new Error(
        `数据库中的消费导入截止时间无效：${lastImportTime}`
      );
    }

    // =================================================
    // 9. 增量筛选
    //
    // 只保留：
    //
    // transaction_time >
    // last_transaction_time
    //
    // 第一次上传：
    // 全部保留
    // =================================================

    const newRows:
      Record<string, unknown>[] =
      [];

    let skippedByIncrement =
      0;

    let invalidDateRows =
      0;

    for (
      const row of rows
    ) {
      const transactionDate =
        parseTransactionDate(
          row["时间"]
        );

      if (!transactionDate) {
        invalidDateRows++;
        continue;
      }

      if (
        lastImportDate &&
        transactionDate.getTime() <=
          lastImportDate.getTime()
      ) {
        skippedByIncrement++;
        continue;
      }

      newRows.push(
        row
      );
    }

    // =================================================
    // 10. 没有新数据
    // =================================================

    if (
      newRows.length === 0
    ) {
      return NextResponse.json(
        {
          success: true,

          needs_confirmation:
            false,

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

          file_name:
            fileName,

          sheet_name:
            sheetName,

          total_rows:
            rows.length,

          new_rows:
            0,

          skipped_by_increment:
            skippedByIncrement,

          invalid_date_rows:
            invalidDateRows,

          last_import_time:
            lastImportTime,

          message:
            lastImportTime
              ? `没有发现新数据。上次已经导入到 ${new Date(
                  lastImportTime
                ).toLocaleString(
                  "zh-CN"
                )}。`
              : "Excel 中没有可导入的新数据。",
        }
      );
    }

    // =================================================
    // 11. 收集「新数据」中的所有账户名称
    // =================================================

    const accountMap =
      new Map<
        string,
        {
          sourceName: string;
          accountType:
            | string
            | null;
        }
      >();

    for (
      const row of newRows
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
    // 12. 没有账户名称
    // =================================================

    if (
      sourceNames.length === 0
    ) {
      return NextResponse.json(
        {
          success: false,

          needs_confirmation:
            false,

          error:
            "新数据中没有找到有效的「资金账户名称」",
        },
        {
          status: 400,
        }
      );
    }

    // =================================================
    // 13. 查询已有账户映射
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

          needs_confirmation:
            false,

          error:
            `读取账户名称映射失败：${mappingsError.message}`,
        },
        {
          status: 500,
        }
      );
    }

    // =================================================
    // 14. 建立映射 Map
    // =================================================

    const mappingMap =
      new Map<
        string,
        {
          id: string;
          source_name: string;
          standard_name:
            | string
            | null;
          account_type:
            | string
            | null;
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
    // 15. 找出未确认账户
    // =================================================

    const unresolvedAccounts:
      Array<{
        source_name: string;
        account_type:
          | string
          | null;
        mapping_id:
          | string
          | null;
        standard_name:
          | string
          | null;
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
          mapping.confirmed ===
            true &&
          mapping.standard_name &&
          mapping.standard_name.trim()
        );

      if (!isConfirmed) {
        unresolvedAccounts.push(
          {
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
          }
        );
      }
    }

    // =================================================
    // 16. 自动创建新账户映射
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

            needs_confirmation:
              false,

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
    // 17. ★ 存在未确认账户
    //
    // 这是正常业务状态，不是导入失败。
    //
    // HTTP 409 表示：
    // Conflict / 需要用户完成前置确认
    //
    // 重要：
    //
    // 1. success = true
    // 2. needs_confirmation = true
    // 3. 不写 expense_transactions
    // 4. 不推进 import cursor
    // =================================================

    if (
      unresolvedAccounts.length >
      0
    ) {
      return NextResponse.json(
        {
          success: true,

          needs_confirmation:
            true,

          result: {
            success: true,

            total:
              newRows.length,

            inserted: 0,

            duplicated: 0,

            failed: 0,

            credit_card: 0,

            non_credit_card: 0,

            settlement: 0,

            errors: [],
          },

          file_name:
            fileName,

          sheet_name:
            sheetName,

          total_rows:
            rows.length,

          new_rows:
            newRows.length,

          skipped_by_increment:
            skippedByIncrement,

          invalid_date_rows:
            invalidDateRows,

          previous_import_time:
            lastImportTime,

          last_import_time:
            lastImportTime,

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
    // 18. 所有账户已经确认
    // =================================================

    const inputs:
      ExpenseTransactionInput[] =
      newRows.map(
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

          const mapping =
            sourceAccountName
              ? mappingMap.get(
                  sourceAccountName
                )
              : null;

          const standardAccountName =
            mapping?.standard_name?.trim() ||
            sourceAccountName;

          const isCreditCard =
            accountType ===
            "信用卡";

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
            transaction_time:
              row[
                "时间"
              ] as
                | string
                | Date
                | null,

            account_name:
              standardAccountName,

            account_type:
              accountType,

            account_remark:
              toStringOrNull(
                row[
                  "资金账户备注"
                ]
              ),

            income_expense_type:
              incomeExpenseType,

            category:
              toStringOrNull(
                row[
                  "账目分类"
                ]
              ),

            amount,

            member:
              toStringOrNull(
                row[
                  "成员"
                ]
              ),

            remark:
              toStringOrNull(
                row[
                  "账目备注"
                ]
              ),

            book_name:
              toStringOrNull(
                row[
                  "账本名称"
                ]
              ),

            is_credit_card:
              isCreditCard,

            is_settlement:
              isSettlement,

            source_file:
              fileName,

            source_sheet:
              sheetName,
          };
        }
      );

    // =================================================
    // 19. 统计
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
    // 20. 正式写入
    // =================================================

    const result =
      await createExpenseTransactions(
        inputs
      );

    // =================================================
    // 21. ★ 只有正式导入完全成功时才推进游标
    //
    // 注意：
    //
    // needs_confirmation 在前面已经 return，
    // 所以这里绝对不会因为账户未确认而推进。
    // =================================================

    let newLastImportTime =
      lastImportTime;

    if (
      result.failed === 0 &&
      result.success
    ) {
      const successfulDates =
        inputs
          .map(
            input =>
              parseTransactionDate(
                input.transaction_time
              )
          )
          .filter(
            (
              value
            ): value is Date =>
              value !== null
          );

      if (
        successfulDates.length >
        0
      ) {
        const maxDate =
          successfulDates.reduce(
            (
              max,
              current
            ) =>
              current.getTime() >
              max.getTime()
                ? current
                : max
          );

        newLastImportTime =
          maxDate.toISOString();

        await updateImportState(
          supabase,
          newLastImportTime
        );
      }
    }

    // =================================================
    // 22. 返回正式导入结果
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

        total_rows:
          rows.length,

        new_rows:
          newRows.length,

        skipped_by_increment:
          skippedByIncrement,

        invalid_date_rows:
          invalidDateRows,

        imported_rows:
          inputs.length,

        credit_card_rows:
          creditCardCount,

        non_credit_card_rows:
          nonCreditCardCount,

        settlement_rows:
          settlementCount,

        previous_import_time:
          lastImportTime,

        new_import_time:
          newLastImportTime,

        message:
          result.success
            ? `导入完成：新增 ${result.inserted} 笔，重复 ${result.duplicated} 笔，跳过历史数据 ${skippedByIncrement} 笔`
            : `导入完成，但有 ${result.failed} 笔失败；导入截止时间未推进`,
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

        needs_confirmation:
          false,

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