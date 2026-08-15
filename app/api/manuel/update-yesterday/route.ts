// =====================================================
// app/api/update-market-manual/route.ts
//
// 手动全球资产更新
//
// 与 Cron 完全分离
//
// 功能：
// 1. 手动执行
// 2. target_date = 昨天
// 3. 不判断今天是不是交易日
// 4. 直接获取各资产最近可用市场数据
// 5. 更新 holdings
// 6. holdings_history.snapshot_date = 今天
// 7. asset_history.snapshot_date = 今天
// 8. holdings_history 使用 UPSERT
// 9. asset_history 使用 UPDATE / INSERT
// 10. WELAB_GOLD / HK_CASH 跳过
// 11. shares = 0 是合法状态
// 12. 写入 manual_logs
//
// 注意：
// 本文件是手动接口
// 不属于 Vercel Cron
//
// 手动地址：
// /api/update-market-manual
// =====================================================

import { NextResponse } from "next/server";

import {
  createClient,
} from "@supabase/supabase-js";

import {
  supabase,
} from "@/lib/supabase";

import {
  getMarketPrice,
  getUsdCny,
} from "@/lib/market-data";


// =====================================================
// Runtime
// =====================================================

export const runtime = "nodejs";


// =====================================================
// 防止缓存
// =====================================================

export const dynamic = "force-dynamic";


// =====================================================
// 类型
// =====================================================

type Holding = {

  id: number;

  code: string;

  name: string;

  market?: string | null;

  category?: string | null;

  amount?: number | null;

  cost?: number | null;

  profit?: number | null;

  profit_rate?: number | null;

  currency?: string | null;

  nav?: number | null;

  shares?: number | null;

  updated_at?: string | null;

  snapshot_date?: string | null;

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
// 日期
// =====================================================

function formatDate(
  date: Date
): string {

  return date
    .toISOString()
    .slice(0, 10);

}


// =====================================================
// 昨天
//
// 注意：
// 这里只是得到 target_date。
// 不判断交易日。
// 不回退日期。
// =====================================================

function getYesterdayDate(): string {

  const date =
    new Date();

  date.setUTCDate(
    date.getUTCDate() - 1
  );

  return formatDate(
    date
  );

}


// =====================================================
// Service Role Supabase
//
// 用于：
// - holdings_history
// - asset_history
// - manual_logs
//
// 服务器端使用
// =====================================================

function getAdminSupabase() {

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;


  if (!url) {

    throw new Error(
      "SUPABASE_URL 未配置"
    );

  }


  if (!serviceRoleKey) {

    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 未配置"
    );

  }


  return createClient(
    url,
    serviceRoleKey,
    {

      auth: {

        autoRefreshToken:
          false,

        persistSession:
          false,

      },

    }
  );

}


// =====================================================
// Manual Log
//
// 开始
// =====================================================

async function startManualLog() {

  try {

    const adminSupabase =
      getAdminSupabase();


    const {
      data,
      error,
    } =
      await adminSupabase

        .from(
          "manual_logs"
        )

        .insert({

          job_name:
            "update-market-manual",

          status:
            "running",

          started_at:
            new Date().toISOString(),

        })

        .select(
          "id"
        )

        .single();


    if (error) {

      console.error(
        "Manual log start failed:",
        error
      );

      return null;

    }


    return data?.id ?? null;

  } catch (
    error
  ) {

    console.error(
      "Manual log start exception:",
      error
    );

    return null;

  }

}


// =====================================================
// Manual Log
//
// 完成
// =====================================================

async function finishManualLog(
  logId: number | null,
  data: {

    status:
      "success" |
      "failed";

    startedAt:
      number;

    updated?:
      number;

    failed?:
      number;

    skipped?:
      number;

    message?:
      string;

    error?:
      string | null;

    details?:
      any;

  }
) {

  if (!logId) {

    return;

  }


  try {

    const adminSupabase =
      getAdminSupabase();


    const {
      error,
    } =
      await adminSupabase

        .from(
          "manual_logs"
        )

        .update({

          status:
            data.status,

          finished_at:
            new Date().toISOString(),

          duration_ms:
            Date.now() -
            data.startedAt,

          message:
            data.message ??
            null,

          updated_count:
            data.updated ??
            0,

          failed_count:
            data.failed ??
            0,

          skipped_count:
            data.skipped ??
            0,

          error:
            data.error ??
            null,

          details:
            data.details ??
            null,

        })

        .eq(
          "id",
          logId
        );


    if (error) {

      console.error(
        "Manual log finish failed:",
        error
      );

    }

  } catch (
    error
  ) {

    console.error(
      "Manual log finish exception:",
      error
    );

  }

}


// =====================================================
// holdings_history
//
// 非常重要：
//
// 不再：
// SELECT → INSERT / UPDATE
//
// 改成：
// UPSERT
//
// 唯一键：
// snapshot_date + code
//
// 所以：
//
// 今天已经存在
// → UPDATE
//
// 今天不存在
// → INSERT
//
// 不会再出现：
// duplicate key value violates unique constraint
// =====================================================

async function saveHoldingsHistory(
  holdings: Holding[],
  snapshotDate: string
) {

  let inserted = 0;

  let updated = 0;

  let failed = 0;


  let adminSupabase;

  try {

    adminSupabase =
      getAdminSupabase();

  } catch (
    error: any
  ) {

    return {

      inserted:
        0,

      updated:
        0,

      failed:
        holdings.length,

      error: [

        {

          operation:
            "config",

          message:
            error?.message ??
            String(error),

        },

      ],

    };

  }


  const errors:
    any[] = [];


  // ===================================================
  // 一个一个 UPSERT
  // ===================================================

  for (
    const holding of holdings
  ) {

    try {

      const code =
        String(
          holding?.code ??
          ""
        )
          .trim()
          .toUpperCase();


      if (!code) {

        continue;

      }


      const historyData = {

        code,

        name:
          holding.name ??
          null,

        market:
          holding.market ??
          null,

        category:
          holding.category ??
          null,

        amount:
          toNumber(
            holding.amount
          ),

        updated_at:
          new Date()
            .toISOString(),

        cost:
          Math.round(
            toNumber(
              holding.cost
            )
          ),

        profit:
          Math.round(
            toNumber(
              holding.profit
            )
          ),

        profit_rate:
          toNumber(
            holding.profit_rate
          ),

        currency:
          holding.currency ??
          "CNY",

        nav:
          toNumber(
            holding.nav
          ),

        shares:
          toNumber(
            holding.shares
          ),

        snapshot_date:
          snapshotDate,

      };


      // =================================================
      // UPSERT
      //
      // 数据库唯一约束：
      // snapshot_date + code
      // =================================================

      const {
        data: upsertedData,
        error:
          upsertError,
      } =
        await adminSupabase

          .from(
            "holdings_history"
          )

          .upsert(

            historyData,

            {

              onConflict:
                "snapshot_date,code",

              ignoreDuplicates:
                false,

            }

          )

          .select(
            "id"
          );


      if (upsertError) {

        failed++;

        errors.push({

          operation:
            "upsert",

          code,

          message:
            upsertError.message,

        });

        continue;

      }


      // =================================================
      // Supabase UPSERT 成功
      //
      // 这里不强行判断 insert/update。
      //
      // saved = 成功数量
      // =================================================

      if (
        Array.isArray(
          upsertedData
        )
      ) {

        updated++;

      }
      else {

        updated++;

      }

    } catch (
      error: any
    ) {

      failed++;

      errors.push({

        operation:
          "exception",

        code:
          holding?.code,

        message:
          error?.message ??
          String(error),

      });

    }

  }


  return {

    inserted,

    updated,

    failed,

    error:
      errors.length > 0
        ? errors
        : null,

  };

}


// =====================================================
// Asset History
//
// snapshot_date = 今天
//
// 注意：
// target_date 只是抓取目标
// 不用于历史快照日期
// =====================================================

async function saveAssetHistory(
  snapshotDate: string,
  usdCny: number
) {

  try {

    const adminSupabase =
      getAdminSupabase();


    const {
      data:
        holdings,
      error,
    } =
      await adminSupabase

        .from(
          "holdings"
        )

        .select(
          "*"
        );


    if (error) {

      return {

        success:
          false,

        action:
          "failed",

        error:
          error.message,

      };

    }


    const list =
      Array.isArray(
        holdings
      )
        ? holdings
        : [];


    let cnAsset = 0;

    let hkAsset = 0;

    let totalProfit = 0;

    let cnProfit = 0;

    let hkProfit = 0;


    for (
      const item of list
    ) {

      const amount =
        toNumber(
          item?.amount
        );


      const profit =
        toNumber(
          item?.profit
        );


      const market =
        String(
          item?.market ??
          ""
        )
          .trim()
          .toUpperCase();


      if (
        market === "CN"
      ) {

        cnAsset +=
          amount;

        cnProfit +=
          profit;

      }
      else {

        hkAsset +=
          amount;

        hkProfit +=
          profit;

      }


      totalProfit +=
        profit;

    }


    const totalAsset =
      cnAsset +
      hkAsset;


    const totalCost =
      totalAsset -
      totalProfit;


    const totalRate =
      totalCost > 0
        ? (
            totalProfit /
            totalCost
          ) *
          100
        : 0;


    const cnCost =
      cnAsset -
      cnProfit;


    const hkCost =
      hkAsset -
      hkProfit;


    const cnRate =
      cnCost > 0
        ? (
            cnProfit /
            cnCost
          ) *
          100
        : 0;


    const hkRate =
      hkCost > 0
        ? (
            hkProfit /
            hkCost
          ) *
          100
        : 0;


    const record = {

      snapshot_date:
        snapshotDate,

      usd_cny:
        usdCny,

      cn_asset:
        Math.round(
          cnAsset
        ),

      cn_rate:
        cnRate,

      cn_profit:
        Math.round(
          cnProfit
        ),

      hk_asset:
        Math.round(
          hkAsset
        ),

      hk_rate:
        hkRate,

      hk_profit:
        Math.round(
          hkProfit
        ),

      total_asset:
        Math.round(
          totalAsset
        ),

      total_profit:
        Math.round(
          totalProfit
        ),

    };


    // ===================================================
    // 查找今天
    // ===================================================

    const {
      data:
        existing,
      error:
        existingError,
    } =
      await adminSupabase

        .from(
          "asset_history"
        )

        .select(
          "id"
        )

        .eq(
          "snapshot_date",
          snapshotDate
        )

        .maybeSingle();


    if (existingError) {

      return {

        success:
          false,

        action:
          "failed",

        error:
          existingError.message,

      };

    }


    // ===================================================
    // UPDATE
    // ===================================================

    if (
      existing?.id
    ) {

      const {
        error:
          updateError,
      } =
        await adminSupabase

          .from(
            "asset_history"
          )

          .update(
            record
          )

          .eq(
            "id",
            existing.id
          );


      if (updateError) {

        return {

          success:
            false,

          action:
            "update",

          error:
            updateError.message,

        };

      }


      return {

        success:
          true,

        action:
          "update",

        error:
          null,

      };

    }


    // ===================================================
    // INSERT
    // ===================================================

    const {
      error:
        insertError,
    } =
      await adminSupabase

        .from(
          "asset_history"
        )

        .insert(
          record
        );


    if (insertError) {

      return {

        success:
          false,

        action:
          "insert",

        error:
          insertError.message,

      };

    }


    return {

      success:
        true,

      action:
        "insert",

      error:
        null,

    };

  } catch (
    error: any
  ) {

    return {

      success:
        false,

      action:
        "failed",

      error:
        error?.message ??
        String(error),

    };

  }

}


// =====================================================
// GET
//
// 手动执行
// =====================================================

export async function GET(
  request: Request
) {

  const startedAt =
    Date.now();


  let manualLogId:
    number | null = null;


  try {

    // ===================================================
    // Manual Secret
    //
    // 如果设置了 MANUAL_UPDATE_SECRET
    // 则要求：
    //
    // Authorization:
    // Bearer xxx
    //
    // 如果没有设置：
    // 不验证
    // ===================================================

    const manualSecret =
      process.env.MANUAL_UPDATE_SECRET;


    if (
      manualSecret
    ) {

      const auth =
        request.headers.get(
          "authorization"
        );


      if (
        auth !==
        `Bearer ${manualSecret}`
      ) {

        return NextResponse.json(

          {

            success:
              false,

            error:
              "Unauthorized",

          },

          {

            status:
              401,

          }

        );

      }

    }


    // ===================================================
    // 开始 Manual Log
    // ===================================================

    manualLogId =
      await startManualLog();


    // ===================================================
    // 今天
    //
    // snapshot_date = 今天
    // ===================================================

    const today =
      new Date();


    const todayStr =
      formatDate(
        today
      );


    // ===================================================
    // 昨天
    //
    // target_date = 昨天
    //
    // 注意：
    // 不判断交易日
    // 不回退
    // ===================================================

    const targetDate =
      getYesterdayDate();


    // ===================================================
    // USD/CNY
    // ===================================================

    const usdCny =
      await getUsdCny();


    if (
      !usdCny ||
      usdCny <= 0
    ) {

      await finishManualLog(

        manualLogId,

        {

          status:
            "failed",

          startedAt,

          message:
            "USD/CNY 获取失败",

          error:
            "USD/CNY 获取失败",

        }

      );


      return NextResponse.json(

        {

          success:
            false,

          today:
            todayStr,

          target_date:
            targetDate,

          snapshot_date:
            todayStr,

          error:
            "USD/CNY 获取失败",

        },

        {

          status:
            500,

        }

      );

    }


    // ===================================================
    // 获取 holdings
    //
    // 不判断市场交易日
    // ===================================================

    const {
      data:
        holdingsData,
      error:
        holdingsError,
    } =
      await supabase

        .from(
          "holdings"
        )

        .select(
          "*"
        );


    if (holdingsError) {

      await finishManualLog(

        manualLogId,

        {

          status:
            "failed",

          startedAt,

          message:
            "获取 holdings 失败",

          error:
            holdingsError.message,

        }

      );


      return NextResponse.json(

        {

          success:
            false,

          today:
            todayStr,

          target_date:
            targetDate,

          snapshot_date:
            todayStr,

          error:
            holdingsError.message,

        },

        {

          status:
            500,

        }

      );

    }


    const holdings =
      Array.isArray(
        holdingsData
      )
        ? (
            holdingsData as Holding[]
          )
        : [];


    // ===================================================
    // 统计
    // ===================================================

    let updated =
      0;

    let failed =
      0;

    let skipped =
      0;


    const results:
      any[] = [];


    // ===================================================
    // 一个一个更新
    //
    // 注意：
    //
    // 这里完全没有：
    //
    // checkTradingDay()
    //
    // 也没有：
    //
    // shouldUpdate
    //
    // ===================================================

    for (
      const holding of holdings
    ) {

      const code =
        String(
          holding?.code ??
          ""
        )
          .trim()
          .toUpperCase();


      // =================================================
      // 特殊资产
      // =================================================

      if (
        code ===
        "WELAB_GOLD" ||
        code ===
        "HK_CASH"
      ) {

        skipped++;


        results.push({

          id:
            holding.id,

          code,

          name:
            holding.name,

          source:
            "skip",

          status:
            "skipped",

          reason:
            "特殊资产，不自动更新",

          target_date:
            targetDate,

        });


        continue;

      }


      // =================================================
      // 获取最近可用价格
      //
      // 不判断交易日
      // 不判断 targetDate
      //
      // 直接调用 market-data
      // =================================================

      try {

        const {
          source,
          data,
        } =
          await getMarketPrice(
            code
          );


        // =================================================
        // 没有价格
        // =================================================

        if (
          !data ||
          !data.price ||
          data.price <= 0
        ) {

          failed++;


          results.push({

            id:
              holding.id,

            code,

            name:
              holding.name,

            source,

            status:
              "failed",

            reason:
              "市场价格获取失败",

            target_date:
              targetDate,

            source_date:
              data?.date ??
              null,

          });


          continue;

        }


        const nav =
          toNumber(
            data.price
          );


        const shares =
          toNumber(
            holding.shares
          );


        // =================================================
        // shares < 0 才非法
        //
        // shares = 0 合法
        // =================================================

        if (
          shares < 0
        ) {

          failed++;


          results.push({

            id:
              holding.id,

            code,

            name:
              holding.name,

            source,

            status:
              "failed",

            reason:
              "持仓数量无效",

            shares,

            nav,

            target_date:
              targetDate,

            source_date:
              data.date ??
              null,

          });


          continue;

        }


        // =================================================
        // 判断市场
        // =================================================

        const market =
          String(
            holding?.market ??
            ""
          )
            .trim()
            .toUpperCase();


        // =================================================
        // 计算 CNY 市值
        //
        // CN：
        // shares × NAV
        //
        // HK / US / LU：
        // shares × NAV × USD/CNY
        //
        // shares = 0：
        // amount = 0
        // 合法
        // =================================================

        let amount = 0;


        if (
          shares === 0
        ) {

          amount = 0;

        }
        else {

          const rawAmount =
            shares *
            nav;


          if (
            market === "CN"
          ) {

            amount =
              rawAmount;

          }
          else {

            amount =
              rawAmount *
              usdCny;

          }

        }


        // =================================================
        // 成本
        // =================================================

        const cost =
          toNumber(
            holding.cost
          );


        // =================================================
        // 收益
        // =================================================

        const profit =
          amount -
          cost;


        // =================================================
        // 收益率
        // =================================================

        const profitRate =
          cost > 0
            ? (
                profit /
                cost
              ) *
              100
            : 0;


        // =================================================
        // 更新 holdings
        // =================================================

        const {
          error:
            updateError,
        } =
          await supabase

            .from(
              "holdings"
            )

            .update({

              amount:
                Math.round(
                  amount
                ),

              profit:
                Math.round(
                  profit
                ),

              profit_rate:
                profitRate,

              nav,

              currency:
                "CNY",

              updated_at:
                new Date()
                  .toISOString(),

            })

            .eq(
              "id",
              holding.id
            );


        if (updateError) {

          failed++;


          results.push({

            id:
              holding.id,

            code,

            name:
              holding.name,

            source,

            market,

            status:
              "failed",

            reason:
              updateError.message,

            target_date:
              targetDate,

            source_date:
              data.date ??
              null,

          });


          continue;

        }


        updated++;


        // =================================================
        // 成功结果
        // =================================================

        results.push({

          id:
            holding.id,

          code,

          name:
            holding.name,

          source,

          market,

          status:
            "updated",

          target_date:
            targetDate,

          source_date:
            data.date ??
            null,

          nav,

          amount:
            Math.round(
              amount
            ),

          cost:
            Math.round(
              cost
            ),

          profit:
            Math.round(
              profit
            ),

          profit_rate:
            profitRate,

          currency:
            "CNY",

          shares,

          updated_at:
            new Date()
              .toISOString(),

        });

      } catch (
        error: any
      ) {

        failed++;


        results.push({

          id:
            holding.id,

          code,

          name:
            holding.name,

          status:
            "failed",

          reason:
            error?.message ??
            String(error),

          target_date:
            targetDate,

        });

      }

    }


    // ===================================================
    // 重新读取 holdings
    //
    // 获取刚刚更新后的最终数据
    // ===================================================

    const {
      data:
        updatedHoldingsData,
      error:
        updatedHoldingsError,
    } =
      await supabase

        .from(
          "holdings"
        )

        .select(
          "*"
        );


    if (updatedHoldingsError) {

      await finishManualLog(

        manualLogId,

        {

          status:
            "failed",

          startedAt,

          updated,

          failed,

          skipped,

          message:
            "重新读取 holdings 失败",

          error:
            updatedHoldingsError.message,

          details:
            results,

        }

      );


      return NextResponse.json(

        {

          success:
            false,

          today:
            todayStr,

          target_date:
            targetDate,

          snapshot_date:
            todayStr,

          updated,

          failed,

          skipped,

          error:
            updatedHoldingsError.message,

          results,

        },

        {

          status:
            500,

        }

      );

    }


    const updatedHoldings =
      Array.isArray(
        updatedHoldingsData
      )
        ? (
            updatedHoldingsData as Holding[]
          )
        : [];


    // ===================================================
    // Holdings History
    //
    // 重点：
    //
    // snapshot_date = 今天
    //
    // 不是 targetDate
    // ===================================================

    let holdingsHistorySaved =
      0;

    let holdingsHistoryInserted =
      0;

    let holdingsHistoryUpdated =
      0;

    let holdingsHistoryFailed =
      0;

    let holdingsHistoryError:
      any = null;


    if (
      updated > 0
    ) {

      const historyResult =
        await saveHoldingsHistory(

          updatedHoldings,

          todayStr

        );


      holdingsHistoryInserted =
        historyResult.inserted;

      holdingsHistoryUpdated =
        historyResult.updated;

      holdingsHistoryFailed =
        historyResult.failed;

      holdingsHistoryError =
        historyResult.error ??
        null;


      holdingsHistorySaved =
        holdingsHistoryUpdated +
        holdingsHistoryInserted;

    }


    // ===================================================
    // Asset History
    //
    // snapshot_date = 今天
    // ===================================================

    let assetHistoryResult:
      any = {

        success:
          false,

        action:
          "skip",

        error:
          null,

      };


    if (
      updated > 0
    ) {

      assetHistoryResult =
        await saveAssetHistory(

          todayStr,

          usdCny

        );

    }


    // ===================================================
    // 最终资产
    // ===================================================

    let totalAsset =
      0;

    let cnAsset =
      0;

    let hkAsset =
      0;


    for (
      const item of
      updatedHoldings
    ) {

      const amount =
        toNumber(
          item?.amount
        );


      totalAsset +=
        amount;


      const market =
        String(
          item?.market ??
          ""
        )
          .trim()
          .toUpperCase();


      if (
        market ===
        "CN"
      ) {

        cnAsset +=
          amount;

      }
      else {

        hkAsset +=
          amount;

      }

    }


    // ===================================================
    // 最终 Success
    // ===================================================

    const success =
      failed === 0 &&
      holdingsHistoryFailed === 0 &&
      assetHistoryResult.success;


    // ===================================================
    // 完成 Manual Log
    // ===================================================

    await finishManualLog(

      manualLogId,

      {

        status:
          success
            ? "success"
            : "failed",

        startedAt,

        updated,

        failed:
          failed +
          holdingsHistoryFailed,

        skipped,

        message:
          success
            ? "手动全球资产更新成功"
            : "手动全球资产更新存在失败",

        error:
          success
            ? null
            : (
                assetHistoryResult.error ??
                (
                  holdingsHistoryError
                    ? JSON.stringify(
                        holdingsHistoryError
                      )
                    : null
                ) ??
                null
              ),

        details: {

          today:
            todayStr,

          target_date:
            targetDate,

          snapshot_date:
            todayStr,

          usd_cny:
            usdCny,

          total:
            holdings.length,

          updated,

          failed,

          skipped,

          holdings_history_saved:
            holdingsHistorySaved,

          holdings_history_inserted:
            holdingsHistoryInserted,

          holdings_history_updated:
            holdingsHistoryUpdated,

          holdings_history_failed:
            holdingsHistoryFailed,

          asset_history_action:
            assetHistoryResult.action,

          asset_history_success:
            assetHistoryResult.success,

          total_asset:
            Math.round(
              totalAsset
            ),

          cn_asset:
            Math.round(
              cnAsset
            ),

          hk_asset:
            Math.round(
              hkAsset
            ),

          results,

        },

      }

    );


    // ===================================================
    // 最终 Response
    // ===================================================

    return NextResponse.json({

      success,

      // =================================================
      // 日期
      // =================================================

      today:
        todayStr,

      target_date:
        targetDate,

      snapshot_date:
        todayStr,

      // =================================================
      // 汇率
      // =================================================

      usd_cny:
        usdCny,

      // =================================================
      // 数量
      // =================================================

      total:
        holdings.length,

      updated,

      failed,

      skipped,

      // =================================================
      // Holdings History
      // =================================================

      holdings_history:
        updated > 0,

      holdings_history_saved:
        holdingsHistorySaved,

      holdings_history_inserted:
        holdingsHistoryInserted,

      holdings_history_updated:
        holdingsHistoryUpdated,

      holdings_history_failed:
        holdingsHistoryFailed,

      holdings_history_error:
        holdingsHistoryError,

      // =================================================
      // Asset History
      // =================================================

      asset_history:
        assetHistoryResult.success,

      asset_history_action:
        assetHistoryResult.action,

      asset_history_error:
        assetHistoryResult.error,

      // =================================================
      // Assets
      // =================================================

      total_asset:
        Math.round(
          totalAsset
        ),

      cn_asset:
        Math.round(
          cnAsset
        ),

      hk_asset:
        Math.round(
          hkAsset
        ),

      // =================================================
      // Manual Log
      // =================================================

      manual_log:
        manualLogId
          ? true
          : false,

      manual_log_id:
        manualLogId,

      duration_ms:
        Date.now() -
        startedAt,

      // =================================================
      // Results
      // =================================================

      results,

    });

  } catch (
    error: any
  ) {

    console.error(
      "update-market-manual fatal error:",
      error
    );


    // ===================================================
    // Fatal Error
    // ===================================================

    await finishManualLog(

      manualLogId,

      {

        status:
          "failed",

        startedAt,

        message:
          "手动 update-market 发生致命错误",

        error:
          error?.message ??
          String(error),

      }

    );


    return NextResponse.json(

      {

        success:
          false,

        today:
          formatDate(
            new Date()
          ),

        error:
          error?.message ??
          String(error),

        manual_log:
          manualLogId
            ? true
            : false,

        manual_log_id:
          manualLogId,

        duration_ms:
          Date.now() -
          startedAt,

      },

      {

        status:
          500,

      }

    );

  }

}