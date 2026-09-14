import { supabase } from "@/lib/supabase";

/* =========================================================
   Types
========================================================= */

export type FixedIncomeType =
  | "万能险"
  | "活期"
  | "银行理财"
  | "定期存款"
  | "货币基金"
  | "债券"
  | "固收理财"
  | "其他";

export type FixedIncomeAsset = {
  id: string;

  name: string;
  code?: string | null;

  type: FixedIncomeType;

  amount: number;

  institution?: string | null;

  interest_rate?: number | null;

  auto_interest?: boolean | null;

  interest_date?: string | null;

  note?: string | null;

  group_id?: string | null;

  /*
   * 资产在所属分组中的排序。
   * 数字越小越靠前。
   */
  sort_order?: number | null;

  created_at?: string;
  updated_at?: string;
};

export type FixedIncomeGroup = {
  id: string;

  name: string;

  /*
   * 分组排序。
   * 数字越小越靠前。
   */
  sort_order: number;

  created_at?: string;
  updated_at?: string;
};

/* =========================================================
   Helpers
========================================================= */

function normalizeAsset(
  asset: FixedIncomeAsset
): FixedIncomeAsset {
  return {
    ...asset,

    amount: Number(
      asset.amount ?? 0
    ),

    interest_rate:
      asset.interest_rate == null
        ? null
        : Number(
            asset.interest_rate
          ),

    auto_interest:
      Boolean(
        asset.auto_interest
      ),

    sort_order:
      Number(
        asset.sort_order ?? 0
      ),
  };
}

function normalizeGroup(
  group: FixedIncomeGroup
): FixedIncomeGroup {
  return {
    ...group,

    sort_order:
      Number(
        group.sort_order ?? 0
      ),
  };
}

/* =========================================================
   Fixed Income Assets
========================================================= */

export async function getFixedIncomeAssets(): Promise<
  FixedIncomeAsset[]
> {
  const { data, error } =
    await supabase
      .from("fixed_income_assets")
      .select("*")
      .order("group_id", {
        ascending: true,
        nullsFirst: true,
      })
      .order("sort_order", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      });

  if (error) {
    console.error(
      "获取固收资产失败:",
      error
    );

    throw error;
  }

  return (
    (data ?? []) as FixedIncomeAsset[]
  ).map(
    normalizeAsset
  );
}

/* =========================================================
   Fixed Income Groups
========================================================= */

export async function getFixedIncomeGroups(): Promise<
  FixedIncomeGroup[]
> {
  const { data, error } =
    await supabase
      .from("fixed_income_groups")
      .select("*")
      .order("sort_order", {
        ascending: true,
      })
      .order("created_at", {
        ascending: true,
      });

  if (error) {
    console.error(
      "获取固收分组失败:",
      error
    );

    throw error;
  }

  return (
    (data ?? []) as FixedIncomeGroup[]
  ).map(
    normalizeGroup
  );
}

/* =========================================================
   Create Group
========================================================= */

export async function createFixedIncomeGroup(
  name: string
): Promise<FixedIncomeGroup> {
  const trimmedName =
    name.trim();

  if (!trimmedName) {
    throw new Error(
      "分组名称不能为空"
    );
  }

  /*
   * 新分组放到最后。
   */
  const {
    data: maxData,
    error: maxError,
  } = await supabase
    .from("fixed_income_groups")
    .select("sort_order")
    .order("sort_order", {
      ascending: false,
    })
    .limit(1);

  if (maxError) {
    console.error(
      "获取最大分组排序失败:",
      maxError
    );

    throw maxError;
  }

  const maxSortOrder =
    maxData &&
    maxData.length > 0
      ? Number(
          maxData[0]
            .sort_order ?? 0
        )
      : -1;

  const nextSortOrder =
    maxSortOrder + 1;

  const {
    data,
    error,
  } = await supabase
    .from("fixed_income_groups")
    .insert({
      name: trimmedName,
      sort_order:
        nextSortOrder,
    })
    .select("*")
    .single();

  if (error) {
    console.error(
      "创建固收分组失败:",
      error
    );

    throw error;
  }

  return normalizeGroup(
    data as FixedIncomeGroup
  );
}

/* =========================================================
   Update Group
========================================================= */

export async function updateFixedIncomeGroup(
  id: string,
  name: string
): Promise<FixedIncomeGroup> {
  const trimmedName =
    name.trim();

  if (!trimmedName) {
    throw new Error(
      "分组名称不能为空"
    );
  }

  const {
    data,
    error,
  } = await supabase
    .from("fixed_income_groups")
    .update({
      name: trimmedName,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error(
      "修改固收分组失败:",
      error
    );

    throw error;
  }

  return normalizeGroup(
    data as FixedIncomeGroup
  );
}

/* =========================================================
   Delete Group
========================================================= */

export async function deleteFixedIncomeGroup(
  id: string
): Promise<void> {
  /*
   * fixed_income_assets.group_id
   * 已经设置 on delete set null。
   *
   * 所以删除分组以后：
   * 资产不会删除；
   * 资产会自动进入未分组。
   */

  const { error } =
    await supabase
      .from("fixed_income_groups")
      .delete()
      .eq("id", id);

  if (error) {
    console.error(
      "删除固收分组失败:",
      error
    );

    throw error;
  }

  /*
   * 删除组后，未分组资产的排序重新整理。
   */
  await normalizeFixedIncomeAssetOrder();
}

/* =========================================================
   Update Group Order
========================================================= */

export async function updateFixedIncomeGroupOrder(
  groups: FixedIncomeGroup[]
): Promise<void> {
  if (!groups.length) {
    return;
  }

  /*
   * 每个组按照页面上的顺序重新编号。
   */
  const updates =
    groups.map(
      (
        group,
        index
      ) => ({
        id: group.id,
        sort_order:
          index,
      })
    );

  const results =
    await Promise.all(
      updates.map(
        async ({
          id,
          sort_order,
        }) => {
          const {
            error,
          } =
            await supabase
              .from(
                "fixed_income_groups"
              )
              .update({
                sort_order,
                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                id);

          return error;
        }
      )
    );

  const firstError =
    results.find(
      (
        item
      ) => item
    );

  if (firstError) {
    console.error(
      "保存固收分组排序失败:",
      firstError
    );

    throw firstError;
  }
}

/* =========================================================
   Update Asset Group
========================================================= */

export async function updateFixedIncomeAssetGroup(
  id: string,
  groupId: string | null
): Promise<FixedIncomeAsset> {
  /*
   * 移动到目标组以后，
   * 自动放到目标组最后。
   */

  let nextSortOrder = 0;

  const {
    data,
    error,
  } = groupId
    ? await supabase
        .from(
          "fixed_income_assets"
        )
        .select("sort_order")
        .eq(
          "group_id",
          groupId
        )
        .neq(
          "id",
          id
        )
        .order(
          "sort_order",
          {
            ascending:
              false,
          }
        )
        .limit(1)
    : await supabase
        .from(
          "fixed_income_assets"
        )
        .select("sort_order")
        .is(
          "group_id",
          null
        )
        .neq(
          "id",
          id
        )
        .order(
          "sort_order",
          {
            ascending:
              false,
          }
        )
        .limit(1);

  if (error) {
    console.error(
      "获取目标组资产排序失败:",
      error
    );

    throw error;
  }

  if (
    data &&
    data.length > 0
  ) {
    nextSortOrder =
      Number(
        data[0]
          .sort_order ?? 0
      ) + 1;
  }

  const {
    data: updated,
    error: updateError,
  } =
    await supabase
      .from(
        "fixed_income_assets"
      )
      .update({
        group_id:
          groupId,
        sort_order:
          nextSortOrder,
        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        id
      )
      .select("*")
      .single();

  if (updateError) {
    console.error(
      "移动固收资产失败:",
      updateError
    );

    throw updateError;
  }

  return normalizeAsset(
    updated as FixedIncomeAsset
  );
}

/* =========================================================
   Update Asset Order
========================================================= */

export async function updateFixedIncomeAssetOrder(
  assets: FixedIncomeAsset[]
): Promise<void> {
  if (!assets.length) {
    return;
  }

  /*
   * 每个分组单独从 0 开始排序。
   *
   * 未分组使用特殊 key。
   */
  const counters =
    new Map<string, number>();

  const updates =
    assets.map(
      (asset) => {
        const groupKey =
          asset.group_id ??
          "__ungrouped__";

        const current =
          counters.get(
            groupKey
          ) ?? 0;

        counters.set(
          groupKey,
          current + 1
        );

        return {
          id: asset.id,
          sort_order:
            current,
        };
      }
    );

  const results =
    await Promise.all(
      updates.map(
        async ({
          id,
          sort_order,
        }) => {
          const {
            error,
          } =
            await supabase
              .from(
                "fixed_income_assets"
              )
              .update({
                sort_order,
                updated_at:
                  new Date().toISOString(),
              })
              .eq(
                "id",
                id);

          return error;
        }
      )
    );

  const firstError =
    results.find(
      (
        item
      ) => item
    );

  if (firstError) {
    console.error(
      "保存固收资产排序失败:",
      firstError
    );

    throw firstError;
  }
}

/* =========================================================
   Update Single Asset
========================================================= */

export async function updateFixedIncomeAsset(
  id: string,
  payload: Partial<FixedIncomeAsset>
): Promise<FixedIncomeAsset> {
  const updatePayload: Record<
    string,
    unknown
  > = {
    ...payload,
    updated_at:
      new Date().toISOString(),
  };

  /*
   * id 不允许更新。
   */
  delete updatePayload.id;

  const {
    data,
    error,
  } =
    await supabase
      .from(
        "fixed_income_assets"
      )
      .update(
        updatePayload
      )
      .eq(
        "id",
        id
      )
      .select("*")
      .single();

  if (error) {
    console.error(
      "更新固收资产失败:",
      error
    );

    throw error;
  }

  return normalizeAsset(
    data as FixedIncomeAsset
  );
}

/* =========================================================
   Create Asset
========================================================= */

export async function createFixedIncomeAsset(
  payload: Partial<FixedIncomeAsset>
): Promise<FixedIncomeAsset> {
  const groupId =
    payload.group_id ??
    null;

  let nextSortOrder = 0;

  /*
   * 找目标分组当前最大的 sort_order。
   */
  const {
    data,
    error,
  } = groupId
    ? await supabase
        .from(
          "fixed_income_assets"
        )
        .select("sort_order")
        .eq(
          "group_id",
          groupId
        )
        .order(
          "sort_order",
          {
            ascending:
              false,
          }
        )
        .limit(1)
    : await supabase
        .from(
          "fixed_income_assets"
        )
        .select("sort_order")
        .is(
          "group_id",
          null
        )
        .order(
          "sort_order",
          {
            ascending:
              false,
          }
        )
        .limit(1);

  if (error) {
    console.error(
      "获取新固收资产排序失败:",
      error
    );

    throw error;
  }

  if (
    data &&
    data.length > 0
  ) {
    nextSortOrder =
      Number(
        data[0]
          .sort_order ?? 0
      ) + 1;
  }

  const insertPayload = {
    name:
      payload.name?.trim() ??
      "",

    code:
      payload.code ??
      null,

    type:
      payload.type ??
      "其他",

    amount:
      Number(
        payload.amount ?? 0
      ),

    institution:
      payload.institution ??
      null,

    interest_rate:
      payload.interest_rate ==
      null
        ? null
        : Number(
            payload.interest_rate
          ),

    auto_interest:
      Boolean(
        payload.auto_interest
      ),

    interest_date:
      payload.interest_date ??
      null,

    note:
      payload.note ??
      null,

    group_id:
      groupId,

    sort_order:
      nextSortOrder,
  };

  const {
    data: created,
    error: insertError,
  } =
    await supabase
      .from(
        "fixed_income_assets"
      )
      .insert(
        insertPayload
      )
      .select("*")
      .single();

  if (insertError) {
    console.error(
      "创建固收资产失败:",
      insertError
    );

    throw insertError;
  }

  return normalizeAsset(
    created as FixedIncomeAsset
  );
}

/* =========================================================
   Delete Asset
========================================================= */

export async function deleteFixedIncomeAsset(
  id: string
): Promise<void> {
  const { error } =
    await supabase
      .from(
        "fixed_income_assets"
      )
      .delete()
      .eq(
        "id",
        id
      );

  if (error) {
    console.error(
      "删除固收资产失败:",
      error
    );

    throw error;
  }

  /*
   * 删除后重新整理各组 sort_order，
   * 防止中间出现空号。
   */
  await normalizeFixedIncomeAssetOrder();
}

/* =========================================================
   Total
========================================================= */

export async function getFixedIncomeTotal(): Promise<number> {
  const {
    data,
    error,
  } =
    await supabase
      .from(
        "fixed_income_assets"
      )
      .select("amount");

  if (error) {
    console.error(
      "获取固收总额失败:",
      error
    );

    throw error;
  }

  return (
    data?.reduce(
      (
        sum,
        item
      ) =>
        sum +
        Number(
          item.amount ??
            0
        ),
      0
    ) ?? 0
  );
}

/* =========================================================
   Normalize Asset Order
========================================================= */

export async function normalizeFixedIncomeAssetOrder(): Promise<void> {
  const assets =
    await getFixedIncomeAssets();

  /*
   * 注意：
   * getFixedIncomeAssets 已经按照
   *
   * group_id
   * sort_order
   * created_at
   *
   * 排好。
   *
   * 这里仅重新给每个 group 编号。
   */

  const counters =
    new Map<string, number>();

  const normalized =
    assets.map(
      (asset) => {
        const key =
          asset.group_id ??
          "__ungrouped__";

        const index =
          counters.get(
            key
          ) ?? 0;

        counters.set(
          key,
          index + 1
        );

        return {
          ...asset,
          sort_order:
            index,
        };
      }
    );

  await updateFixedIncomeAssetOrder(
    normalized
  );
}