import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);

type ItemType = "income" | "expense";

function jsonError(
  message: string,
  status = 500
) {
  return NextResponse.json(
    {
      success: false,
      error: message,
    },
    { status }
  );
}

// =====================================================
// GET
// /api/monthly-savings-actual?year=2026
// =====================================================

export async function GET(
  request: NextRequest
) {
  try {
    const yearParam =
      request.nextUrl.searchParams.get(
        "year"
      );

    const year = Number(yearParam);

    if (
      !Number.isInteger(year) ||
      year < 2000 ||
      year > 2100
    ) {
      return jsonError(
        "无效的年份",
        400
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        "monthly_savings_actual"
      )
      .select(
        `
        id,
        year,
        month,
        item_type,
        item_name,
        amount,
        sort_order,
        created_at,
        updated_at,
        copy_group_id
        `
      )
      .eq("year", year)
      .order("month", {
        ascending: true,
      })
      .order("sort_order", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      });

    if (error) {
      console.error(
        "GET monthly_savings_actual:",
        error
      );

      return jsonError(
        error.message
      );
    }

    return NextResponse.json({
      success: true,
      items: data ?? [],
    });
  } catch (error) {
    console.error(error);

    return jsonError(
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
}

// =====================================================
// POST
// 新增实际收入 / 实际支出
// =====================================================

export async function POST(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const year = Number(
      body.year
    );

    const month = Number(
      body.month
    );

    const itemType =
      body.item_type as ItemType;

    const itemName =
      String(
        body.item_name ??
          ""
      ).trim();

    const amount = Number(
      body.amount ?? 0
    );

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month)
    ) {
      return jsonError(
        "年份或月份无效",
        400
      );
    }

    if (
      month < 1 ||
      month > 12
    ) {
      return jsonError(
        "月份必须是 1-12",
        400
      );
    }

    if (
      itemType !== "income" &&
      itemType !== "expense"
    ) {
      return jsonError(
        "item_type 必须是 income 或 expense",
        400
      );
    }

    if (!itemName) {
      return jsonError(
        "项目名称不能为空",
        400
      );
    }

    if (
      !Number.isFinite(amount)
    ) {
      return jsonError(
        "金额无效",
        400
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        "monthly_savings_actual"
      )
      .insert({
        year,
        month,
        item_type: itemType,
        item_name: itemName,
        amount,
        sort_order: 0,
      })
      .select()
      .single();

    if (error) {
      console.error(
        "POST monthly_savings_actual:",
        error
      );

      return jsonError(
        error.message
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
    });
  } catch (error) {
    console.error(error);

    return jsonError(
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
}

// =====================================================
// PUT
// 修改实际收入 / 实际支出
// =====================================================

export async function PUT(
  request: NextRequest
) {
  try {
    const body =
      await request.json();

    const id =
      String(body.id ?? "");

    if (!id) {
      return jsonError(
        "缺少 id",
        400
      );
    }

    const year = Number(
      body.year
    );

    const month = Number(
      body.month
    );

    const itemType =
      body.item_type as ItemType;

    const itemName =
      String(
        body.item_name ??
          ""
      ).trim();

    const amount = Number(
      body.amount ?? 0
    );

    const sortOrder =
      Number(
        body.sort_order ?? 0
      );

    if (
      !Number.isInteger(year) ||
      !Number.isInteger(month)
    ) {
      return jsonError(
        "年份或月份无效",
        400
      );
    }

    if (
      month < 1 ||
      month > 12
    ) {
      return jsonError(
        "月份必须是 1-12",
        400
      );
    }

    if (
      itemType !== "income" &&
      itemType !== "expense"
    ) {
      return jsonError(
        "item_type 无效",
        400
      );
    }

    if (!itemName) {
      return jsonError(
        "项目名称不能为空",
        400
      );
    }

    if (
      !Number.isFinite(amount)
    ) {
      return jsonError(
        "金额无效",
        400
      );
    }

    const {
      data,
      error,
    } = await supabase
      .from(
        "monthly_savings_actual"
      )
      .update({
        year,
        month,
        item_type: itemType,
        item_name: itemName,
        amount,
        sort_order:
          Number.isFinite(
            sortOrder
          )
            ? sortOrder
            : 0,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error(
        "PUT monthly_savings_actual:",
        error
      );

      return jsonError(
        error.message
      );
    }

    return NextResponse.json({
      success: true,
      item: data,
    });
  } catch (error) {
    console.error(error);

    return jsonError(
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
}

// =====================================================
// DELETE
// =====================================================

export async function DELETE(
  request: NextRequest
) {
  try {
    const id =
      request.nextUrl.searchParams.get(
        "id"
      );

    if (!id) {
      return jsonError(
        "缺少 id",
        400
      );
    }

    const {
      error,
    } = await supabase
      .from(
        "monthly_savings_actual"
      )
      .delete()
      .eq("id", id);

    if (error) {
      console.error(
        "DELETE monthly_savings_actual:",
        error
      );

      return jsonError(
        error.message
      );
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error(error);

    return jsonError(
      error instanceof Error
        ? error.message
        : String(error)
    );
  }
}