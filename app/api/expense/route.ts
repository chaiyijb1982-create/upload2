import { NextRequest, NextResponse } from "next/server";

import * as XLSX from "xlsx";

import {
  createExpenseTransactions,
  type ExpenseTransactionInput,
} from "@/lib/expense-transactions";


// =====================================================
// POST /api/expense
//
// Excel → expense_transactions
//
// Excel Sheet：收入支出
//
// 字段：
// 时间
// 资金账户名称
// 资金类型
// 资金账户备注
// 收支类型
// 账目分类
// 账目金额
// 成员
// 账目备注
// 账本名称
// =====================================================

export async function POST(
  request: NextRequest
) {

  try {

    // =================================================
    // 获取上传文件
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
          error: "没有找到 Excel 文件",
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
    // 读取文件
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
    // 找到「收入支出」Sheet
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
    // Excel → JSON
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
    // 检查 Excel 字段
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
    // 工具：数字转换
    // =================================================

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
        typeof value ===
        "number"
      ) {

        return Number.isFinite(
          value
        )
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


      return Number.isFinite(
        number
      )
        ? number
        : 0;

    }


    // =================================================
    // 工具：字符串
    // =================================================

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


    // =================================================
    // Excel → ExpenseTransactionInput
    // =================================================

    const inputs:
      ExpenseTransactionInput[] =
      rows.map(
        row => {

          const accountType =
            toStringOrNull(
              row["资金类型"]
            );


          const incomeExpenseType =
            toStringOrNull(
              row["收支类型"]
            );


          const accountName =
            toStringOrNull(
              row["资金账户名称"]
            );


          const amount =
            toNumber(
              row["账目金额"]
            );


          // =================================================
          // 信用卡判断
          //
          // Excel：
          // 资金类型 = 信用卡
          //
          // 直接写入 true
          // =================================================

          const isCreditCard =
            accountType ===
            "信用卡";


          // =================================================
          // 平账判断
          //
          // 自动识别：
          // 平账
          // 平帐
          //
          // 后续 credit-card-from-yu
          // 会自动排除
          // =================================================

          const settlementText =
            [
              incomeExpenseType,
              toStringOrNull(
                row["账目分类"]
              ),
              toStringOrNull(
                row["账目备注"]
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
              row["时间"] as
                | string
                | Date
                | null,


            // -------------------------------------------------
            // 账户
            // -------------------------------------------------

            account_name:
              accountName,


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
            //
            // 例如：
            // -715.70
            // -5400
            // -485.26
            //
            // 保留 Excel 原始正负号
            // -------------------------------------------------

            amount,


            // -------------------------------------------------
            // 成员
            // -------------------------------------------------

            member:
              toStringOrNull(
                row["成员"]
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


            // =================================================
            // 关键字段
            // =================================================

            is_credit_card:
              isCreditCard,


            is_settlement:
              isSettlement,


            // -------------------------------------------------
            // 来源
            // -------------------------------------------------

            source_file:
              fileName,


            source_sheet:
              sheetName,

          };

        }
      );


    // =================================================
    // 统计导入前数据
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
    // 批量写入
    // =================================================

    const result =
      await createExpenseTransactions(
        inputs
      );


    // =================================================
    // 返回结果
    // =================================================

    return NextResponse.json(
      {
        success:
          result.success,

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