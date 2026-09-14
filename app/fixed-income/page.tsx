"use client";

import {
  useEffect,
  useMemo,
  useState,
  type DragEvent,
  type ReactNode,
} from "react";

import {
  getFixedIncomeAssets,
  createFixedIncomeAsset,
  updateFixedIncomeAsset,
  deleteFixedIncomeAsset,
  getFixedIncomeGroups,
  createFixedIncomeGroup,
  updateFixedIncomeGroup,
  deleteFixedIncomeGroup,
  updateFixedIncomeGroupOrder,
  updateFixedIncomeAssetGroup,
  updateFixedIncomeAssetOrder,
  type FixedIncomeAsset,
  type FixedIncomeGroup,
  type FixedIncomeType,
} from "@/lib/fixed-income";

import TopBar from "@/components/TopBar";

// =====================================================
// 工具函数
// =====================================================

function toNumber(value: unknown): number {
  const n = Number(value);

  return Number.isFinite(n) ? n : 0;
}

function money(value: number): string {
  return value.toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  });
}

function moneyExact(value: number): string {
  return value.toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getDailyInterest(
  asset: FixedIncomeAsset
): number {
  if (!asset.auto_interest) {
    return 0;
  }

  const amount = toNumber(asset.amount);
  const rate = toNumber(asset.interest_rate);

  if (amount <= 0 || rate <= 0) {
    return 0;
  }

  return (amount * rate) / 100 / 365;
}

function getAnnualInterest(
  asset: FixedIncomeAsset
): number {
  return getDailyInterest(asset) * 365;
}

// =====================================================
// 固收资产类型
// =====================================================

const ASSET_TYPES: FixedIncomeType[] = [
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

  const [assets, setAssets] =
    useState<FixedIncomeAsset[]>([]);

  const [groups, setGroups] =
    useState<FixedIncomeGroup[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [deletingId, setDeletingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  // ===================================================
  // 固收资产表单
  // ===================================================

  const [editingId, setEditingId] =
    useState<string | null>(null);

  const [type, setType] =
    useState<FixedIncomeType>("固收理财");

  const [name, setName] =
    useState("");

  const [institution, setInstitution] =
    useState("");

  const [amount, setAmount] =
    useState("");

  const [interestRate, setInterestRate] =
    useState("");

  const [autoInterest, setAutoInterest] =
    useState(false);

  const [interestDate, setInterestDate] =
    useState("");

  const [note, setNote] =
    useState("");

  const [assetGroupId, setAssetGroupId] =
    useState<string | null>(null);

  // ===================================================
  // 分组表单
  // ===================================================

  const [editingGroupId, setEditingGroupId] =
    useState<string | null>(null);

  const [groupName, setGroupName] =
    useState("");

  const [groupFormOpen, setGroupFormOpen] =
    useState(false);

  const [groupSaving, setGroupSaving] =
    useState(false);

  // ===================================================
  // 勾选
  // ===================================================

  const [selectedIds, setSelectedIds] =
    useState<string[]>([]);

  // ===================================================
  // 资产拖动状态
  // ===================================================

  const [draggingAssetId, setDraggingAssetId] =
    useState<string | null>(null);

  const [dragOverAssetId, setDragOverAssetId] =
    useState<string | null>(null);

  const [dragOverGroupId, setDragOverGroupId] =
    useState<string | null>(null);

  // ===================================================
  // 分组拖动状态
  // ===================================================

  const [draggingGroupId, setDraggingGroupId] =
    useState<string | null>(null);

  const [
    dragOverGroupOrderId,
    setDragOverGroupOrderId,
  ] = useState<string | null>(null);

  // ===================================================
  // 加载
  // ===================================================

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [assetData, groupData] =
        await Promise.all([
          getFixedIncomeAssets(),
          getFixedIncomeGroups(),
        ]);

      // 排序完全来自 Supabase
      setAssets(assetData);

      setGroups(
        [...groupData].sort(
          (a, b) =>
            toNumber(a.sort_order) -
            toNumber(b.sort_order)
        )
      );
    } catch (err) {
      console.error(
        "加载固收数据失败:",
        err
      );

      setError("加载固收数据失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, []);

  // ===================================================
  // 资产拖动
  // ===================================================

  function handleAssetDragStart(
    event: DragEvent,
    id: string
  ) {
    // 如果正在拖组，不允许启动资产拖动
    if (draggingGroupId) {
      event.preventDefault();
      return;
    }

    setDraggingAssetId(id);
    setDragOverAssetId(null);
    setDragOverGroupId(null);

    event.dataTransfer.effectAllowed = "move";

    event.dataTransfer.setData(
      "text/fixed-income-asset",
      id
    );

    // 同时写 text/plain，保证浏览器 drop 时稳定
    event.dataTransfer.setData(
      "text/plain",
      `asset:${id}`
    );
  }

  function handleAssetDragOver(
    event: DragEvent,
    id: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (
      !draggingAssetId ||
      draggingAssetId === id
    ) {
      return;
    }

    // 如果正在拖组，不响应资产排序
    if (draggingGroupId) {
      return;
    }

    const source = assets.find(
      (asset) =>
        asset.id === draggingAssetId
    );

    const target = assets.find(
      (asset) => asset.id === id
    );

    if (
      !source ||
      !target ||
      (source.group_id ?? null) !==
        (target.group_id ?? null)
    ) {
      return;
    }

    event.dataTransfer.dropEffect = "move";

    setDragOverAssetId(id);
  }

  async function handleAssetDrop(
    event: DragEvent,
    targetId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    // 如果是组拖拽，不处理资产 drop
    if (draggingGroupId) {
      return;
    }

    let sourceId =
      draggingAssetId ||
      event.dataTransfer.getData(
        "text/fixed-income-asset"
      );

    if (!sourceId) {
      const plain =
        event.dataTransfer.getData(
          "text/plain"
        );

      if (plain.startsWith("asset:")) {
        sourceId =
          plain.replace(
            "asset:",
            ""
          );
      }
    }

    if (
      !sourceId ||
      sourceId === targetId
    ) {
      handleAssetDragEnd();
      return;
    }

    const source = assets.find(
      (asset) =>
        asset.id === sourceId
    );

    const target = assets.find(
      (asset) =>
        asset.id === targetId
    );

    if (!source || !target) {
      handleAssetDragEnd();
      return;
    }

    // 不允许跨组直接排序
    if (
      (source.group_id ?? null) !==
      (target.group_id ?? null)
    ) {
      handleAssetDragEnd();
      return;
    }

    const groupId =
      source.group_id ?? null;

    const groupAssets =
      assets.filter(
        (asset) =>
          (asset.group_id ?? null) ===
          groupId
      );

    const sourceGroupIndex =
      groupAssets.findIndex(
        (asset) =>
          asset.id === sourceId
      );

    const targetGroupIndex =
      groupAssets.findIndex(
        (asset) =>
          asset.id === targetId
      );

    if (
      sourceGroupIndex === -1 ||
      targetGroupIndex === -1
    ) {
      handleAssetDragEnd();
      return;
    }

    const nextGroupAssets =
      [...groupAssets];

    const [movedAsset] =
      nextGroupAssets.splice(
        sourceGroupIndex,
        1
      );

    const adjustedTargetIndex =
      sourceGroupIndex <
      targetGroupIndex
        ? targetGroupIndex - 1
        : targetGroupIndex;

    nextGroupAssets.splice(
      adjustedTargetIndex,
      0,
      movedAsset
    );

    /*
     * 当前组在整个 assets 中重新生成顺序。
     * 其他组完全不动。
     */
    const originalGroupIndexes =
      assets
        .map(
          (asset, index) => ({
            asset,
            index,
          })
        )
        .filter(
          ({ asset }) =>
            (asset.group_id ?? null) ===
            groupId
        )
        .map(
          ({ index }) => index
        );

    const firstGroupIndex =
      Math.min(
        ...originalGroupIndexes
      );

    let finalAssets =
      assets.filter(
        (asset) =>
          (asset.group_id ?? null) !==
          groupId
      );

    const orderedGroupAssets =
      nextGroupAssets.map(
        (asset, index) => ({
          ...asset,
          sort_order: index,
        })
      );

    finalAssets.splice(
      firstGroupIndex,
      0,
      ...orderedGroupAssets
    );

    setAssets(finalAssets);

    handleAssetDragEnd();

    try {
      setError("");
      setMessage("");

      await updateFixedIncomeAssetOrder(
        finalAssets
      );

      setMessage(
        "固收资产顺序已保存"
      );
    } catch (err) {
      console.error(
        "保存资产顺序失败:",
        err
      );

      setError(
        "保存资产顺序失败"
      );

      await loadData();
    }
  }

  function handleAssetDragEnd() {
    setDraggingAssetId(null);
    setDragOverAssetId(null);
    setDragOverGroupId(null);
  }

  // ===================================================
  // 资产拖到分组
  // ===================================================

  function handleAssetGroupDragOver(
    event: DragEvent,
    groupId: string | null
  ) {
    event.preventDefault();
    event.stopPropagation();

    // 正在拖组时，完全不处理资产移动
    if (draggingGroupId) {
      return;
    }

    if (!draggingAssetId) {
      return;
    }

    event.dataTransfer.dropEffect = "move";

    setDragOverGroupId(groupId);
  }

  async function handleAssetDropToGroup(
    event: DragEvent,
    groupId: string | null
  ) {
    event.preventDefault();
    event.stopPropagation();

    // 正在拖组时不能移动资产
    if (draggingGroupId) {
      return;
    }

    let sourceId =
      draggingAssetId ||
      event.dataTransfer.getData(
        "text/fixed-income-asset"
      );

    if (!sourceId) {
      const plain =
        event.dataTransfer.getData(
          "text/plain"
        );

      if (plain.startsWith("asset:")) {
        sourceId =
          plain.replace(
            "asset:",
            ""
          );
      }
    }

    if (!sourceId) {
      return;
    }

    const currentAsset =
      assets.find(
        (asset) =>
          asset.id === sourceId
      );

    if (!currentAsset) {
      return;
    }

    const currentGroupId =
      currentAsset.group_id ?? null;

    if (
      currentGroupId === groupId
    ) {
      handleAssetDragEnd();
      return;
    }

    try {
      setError("");
      setMessage("");

      const updated =
        await updateFixedIncomeAssetGroup(
          sourceId,
          groupId
        );

      setAssets(
        (prev) => {
          const without =
            prev.filter(
              (asset) =>
                asset.id !== sourceId
            );

          return [
            ...without,
            updated,
          ];
        }
      );

      const targetName =
        groupId === null
          ? "未分组"
          : groups.find(
              (group) =>
                group.id === groupId
            )?.name ||
            "目标分组";

      setMessage(
        `已将「${currentAsset.name}」移动到「${targetName}」`
      );
    } catch (err) {
      console.error(
        "移动资产失败:",
        err
      );

      setError(
        "移动固收资产失败"
      );

      await loadData();
    } finally {
      handleAssetDragEnd();
    }
  }

  // ===================================================
  // 分组拖动排序
  // ===================================================

  function handleGroupDragStart(
    event: DragEvent<HTMLDivElement>,
    groupId: string
  ) {
    /*
     * 非常重要：
     * 组拖拽只从 ⠿ 手柄启动。
     */

    event.stopPropagation();

    setDraggingGroupId(groupId);
    setDragOverGroupOrderId(null);

    // 清除资产拖拽状态
    setDraggingAssetId(null);
    setDragOverAssetId(null);
    setDragOverGroupId(null);

    event.dataTransfer.effectAllowed =
      "move";

    /*
     * 同时设置两个 MIME 类型。
     *
     * Chrome / Edge 对自定义 MIME 有时会出现
     * drop 事件拿不到数据的问题。
     *
     * text/plain 可以保证稳定。
     */
    event.dataTransfer.setData(
      "text/fixed-income-group",
      groupId
    );

    event.dataTransfer.setData(
      "text/plain",
      `group:${groupId}`
    );
  }

  function handleGroupOrderDragOver(
    event: DragEvent<HTMLDivElement>,
    groupId: string
  ) {
    /*
     * 必须 preventDefault，
     * 否则浏览器不会允许 drop。
     */
    event.preventDefault();
    event.stopPropagation();

    /*
     * 如果正在拖资产，
     * 绝对不能触发组排序。
     */
    if (draggingAssetId) {
      return;
    }

    /*
     * 没有正在拖组时不处理。
     */
    if (!draggingGroupId) {
      return;
    }

    /*
     * 拖到自己身上没有意义。
     */
    if (
      draggingGroupId === groupId
    ) {
      setDragOverGroupOrderId(null);
      return;
    }

    event.dataTransfer.dropEffect =
      "move";

    setDragOverGroupOrderId(groupId);
  }

  function handleGroupOrderDragEnter(
    event: DragEvent<HTMLDivElement>,
    groupId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    if (
      !draggingGroupId ||
      draggingAssetId
    ) {
      return;
    }

    if (
      draggingGroupId === groupId
    ) {
      return;
    }

    setDragOverGroupOrderId(groupId);
  }

  async function handleGroupOrderDrop(
    event: DragEvent<HTMLDivElement>,
    targetId: string
  ) {
    event.preventDefault();
    event.stopPropagation();

    /*
     * 先从 state 取，
     * state 没有时再从 dataTransfer 取。
     */
    let sourceId =
      draggingGroupId ||
      event.dataTransfer.getData(
        "text/fixed-income-group"
      );

    if (!sourceId) {
      const plain =
        event.dataTransfer.getData(
          "text/plain"
        );

      if (plain.startsWith("group:")) {
        sourceId =
          plain.replace(
            "group:",
            ""
          );
      }
    }

    if (
      !sourceId ||
      sourceId === targetId
    ) {
      handleGroupDragEnd();
      return;
    }

    /*
     * 如果实际是资产拖拽，
     * 这里直接退出。
     */
    if (draggingAssetId) {
      handleGroupDragEnd();
      return;
    }

    const sourceIndex =
      groups.findIndex(
        (group) =>
          group.id === sourceId
      );

    const targetIndex =
      groups.findIndex(
        (group) =>
          group.id === targetId
      );

    if (
      sourceIndex === -1 ||
      targetIndex === -1
    ) {
      handleGroupDragEnd();
      return;
    }

    /*
     * 生成新的组顺序。
     */
    const next =
      [...groups];

    const [movedGroup] =
      next.splice(
        sourceIndex,
        1
      );

    /*
     * 注意：
     * source 在 target 前面时，
     * 删除 source 后 target index - 1。
     */
    const adjustedTargetIndex =
      sourceIndex <
      targetIndex
        ? targetIndex - 1
        : targetIndex;

    next.splice(
      adjustedTargetIndex,
      0,
      movedGroup
    );

    /*
     * 从 0 开始重新编号。
     * 这就是 Supabase 中最终保存的 sort_order。
     */
    const normalized =
      next.map(
        (group, index) => ({
          ...group,
          sort_order: index,
        })
      );

    /*
     * 页面先立即变化。
     */
    setGroups(normalized);

    handleGroupDragEnd();

    try {
      setError("");
      setMessage("");

      /*
       * 真正保存到 Supabase。
       */
      await updateFixedIncomeGroupOrder(
        normalized
      );

      setMessage(
        "固收分组顺序已保存"
      );
    } catch (err) {
      console.error(
        "保存分组顺序失败:",
        err
      );

      setError(
        "保存分组顺序失败"
      );

      /*
       * 如果数据库保存失败，
       * 恢复成数据库实际顺序。
       */
      await loadData();
    }
  }

  function handleGroupDragEnd() {
    setDraggingGroupId(null);
    setDragOverGroupOrderId(null);
  }

  // ===================================================
  // 勾选
  // ===================================================

  function toggleSelected(
    id: string
  ) {
    setSelectedIds(
      (prev) =>
        prev.includes(id)
          ? prev.filter(
              (item) =>
                item !== id
            )
          : [
              ...prev,
              id,
            ]
    );
  }

  function selectAllAssets() {
    setSelectedIds(
      assets.map(
        (asset) =>
          asset.id
      )
    );
  }

  function clearSelectedAssets() {
    setSelectedIds([]);
  }

  // ===================================================
  // 总统计
  // ===================================================

  const totalAmount =
    useMemo(
      () =>
        assets.reduce(
          (sum, asset) =>
            sum +
            toNumber(
              asset.amount
            ),
          0
        ),
      [assets]
    );

  const totalDailyInterest =
    useMemo(
      () =>
        assets.reduce(
          (sum, asset) =>
            sum +
            getDailyInterest(
              asset
            ),
          0
        ),
      [assets]
    );

  const totalAnnualInterest =
    useMemo(
      () =>
        totalDailyInterest * 365,
      [totalDailyInterest]
    );

  const autoInterestAssets =
    useMemo(
      () =>
        assets.filter(
          (asset) =>
            asset.auto_interest
        ),
      [assets]
    );

  // ===================================================
  // 已选统计
  // ===================================================

  const selectedAssets =
    useMemo(
      () =>
        assets.filter(
          (asset) =>
            selectedIds.includes(
              asset.id
            )
        ),
      [assets, selectedIds]
    );

  const selectedAmount =
    useMemo(
      () =>
        selectedAssets.reduce(
          (sum, asset) =>
            sum +
            toNumber(
              asset.amount
            ),
          0
        ),
      [selectedAssets]
    );

  const selectedDailyInterest =
    useMemo(
      () =>
        selectedAssets.reduce(
          (sum, asset) =>
            sum +
            getDailyInterest(
              asset
            ),
          0
        ),
      [selectedAssets]
    );

  const selectedAnnualInterest =
    selectedDailyInterest * 365;

  // ===================================================
  // 分组
  // ===================================================

  const orderedGroups =
    useMemo(
      () =>
        [...groups].sort(
          (a, b) =>
            toNumber(
              a.sort_order
            ) -
            toNumber(
              b.sort_order
            )
        ),
      [groups]
    );

  function getGroupAssets(
    groupId: string | null
  ) {
    return assets
      .filter(
        (asset) =>
          (asset.group_id ?? null) ===
          groupId
      )
      .sort(
        (a, b) =>
          toNumber(
            a.sort_order
          ) -
          toNumber(
            b.sort_order
          )
      );
  }

  function getGroupStats(
    groupId: string | null
  ) {
    const groupAssets =
      getGroupAssets(
        groupId
      );

    const amount =
      groupAssets.reduce(
        (sum, asset) =>
          sum +
          toNumber(
            asset.amount
          ),
        0
      );

    const dailyInterest =
      groupAssets.reduce(
        (sum, asset) =>
          sum +
          getDailyInterest(
            asset
          ),
        0
      );

    const annualInterest =
      dailyInterest * 365;

    const percentage =
      totalAmount > 0
        ? (amount / totalAmount) *
          100
        : 0;

    return {
      assets: groupAssets,
      count: groupAssets.length,
      amount,
      dailyInterest,
      annualInterest,
      percentage,
    };
  }

  // ===================================================
  // 固收表单
  // ===================================================

  function resetForm() {
    setEditingId(null);
    setType("固收理财");
    setName("");
    setInstitution("");
    setAmount("");
    setInterestRate("");
    setAutoInterest(false);
    setInterestDate("");
    setNote("");
    setAssetGroupId(null);
  }

  function startEdit(
    asset: FixedIncomeAsset
  ) {
    setEditingId(asset.id);

    setType(
      asset.type ||
        "固收理财"
    );

    setName(
      asset.name || ""
    );

    setInstitution(
      asset.institution || ""
    );

    setAmount(
      String(
        asset.amount ?? ""
      )
    );

    setInterestRate(
      asset.interest_rate ===
        null ||
      asset.interest_rate ===
        undefined
        ? ""
        : String(
            asset.interest_rate
          )
    );

    setAutoInterest(
      Boolean(
        asset.auto_interest
      )
    );

    setInterestDate(
      asset.interest_date ||
        ""
    );

    setNote(
      asset.note || ""
    );

    setAssetGroupId(
      asset.group_id ?? null
    );

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function handleSave() {
    setMessage("");
    setError("");

    if (!name.trim()) {
      setError(
        "请输入资产名称"
      );

      return;
    }

    const amountNumber =
      toNumber(amount);

    if (amountNumber <= 0) {
      setError(
        "请输入正确的资产金额"
      );

      return;
    }

    try {
      setSaving(true);

      const payload = {
        type,
        name: name.trim(),
        institution:
          institution.trim() ||
          undefined,
        amount: amountNumber,
        interest_rate:
          interestRate.trim() ===
          ""
            ? null
            : toNumber(
                interestRate
              ),
        auto_interest:
          autoInterest,
        interest_date:
          interestDate || null,
        note:
          note.trim() ||
          undefined,
        group_id:
          assetGroupId,
      };

      if (editingId) {
        await updateFixedIncomeAsset(
          editingId,
          payload
        );

        setMessage(
          "固收资产已更新"
        );
      } else {
        await createFixedIncomeAsset(
          payload
        );

        setMessage(
          "固收资产已添加"
        );
      }

      resetForm();

      await loadData();
    } catch (err) {
      console.error(
        "保存固收失败:",
        err
      );

      setError(
        "固收资产保存失败"
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(
    id: string
  ) {
    if (
      !window.confirm(
        "确定删除这笔固收资产吗？"
      )
    ) {
      return;
    }

    try {
      setDeletingId(id);
      setMessage("");
      setError("");

      await deleteFixedIncomeAsset(
        id
      );

      setSelectedIds(
        (prev) =>
          prev.filter(
            (item) =>
              item !== id
          )
      );

      if (editingId === id) {
        resetForm();
      }

      setMessage(
        "固收资产已删除"
      );

      await loadData();
    } catch (err) {
      console.error(
        "删除固收失败:",
        err
      );

      setError(
        "删除固收资产失败"
      );
    } finally {
      setDeletingId(null);
    }
  }

  // ===================================================
  // 分组
  // ===================================================

  function startCreateGroup() {
    setEditingGroupId(null);
    setGroupName("");
    setGroupFormOpen(true);
    setMessage("");
    setError("");
  }

  function startEditGroup(
    group: FixedIncomeGroup
  ) {
    setEditingGroupId(
      group.id
    );

    setGroupName(
      group.name
    );

    setGroupFormOpen(true);
    setMessage("");
    setError("");
  }

  function cancelGroupEdit() {
    setEditingGroupId(null);
    setGroupName("");
    setGroupFormOpen(false);
  }

  async function handleSaveGroup() {
    const cleanName =
      groupName.trim();

    if (!cleanName) {
      setError(
        "请输入分组名称"
      );

      return;
    }

    try {
      setGroupSaving(true);
      setError("");
      setMessage("");

      if (editingGroupId) {
        const updated =
          await updateFixedIncomeGroup(
            editingGroupId,
            cleanName
          );

        setGroups(
          (prev) =>
            prev.map(
              (group) =>
                group.id ===
                editingGroupId
                  ? updated
                  : group
            )
        );

        setMessage(
          `分组「${cleanName}」已修改`
        );
      } else {
        const created =
          await createFixedIncomeGroup(
            cleanName
          );

        setGroups(
          (prev) => [
            ...prev,
            created,
          ]
        );

        setMessage(
          `分组「${cleanName}」已创建`
        );
      }

      setEditingGroupId(null);
      setGroupName("");
      setGroupFormOpen(false);
    } catch (err) {
      console.error(
        "保存分组失败:",
        err
      );

      setError(
        "分组保存失败"
      );
    } finally {
      setGroupSaving(false);
    }
  }

  async function handleDeleteGroup(
    group: FixedIncomeGroup
  ) {
    if (
      !window.confirm(
        `确定删除分组「${group.name}」吗？\n\n分组里的资产不会删除，会自动变成「未分组」。`
      )
    ) {
      return;
    }

    try {
      setError("");
      setMessage("");

      await deleteFixedIncomeGroup(
        group.id
      );

      setAssets(
        (prev) =>
          prev.map(
            (asset) =>
              asset.group_id ===
              group.id
                ? {
                    ...asset,
                    group_id:
                      null,
                  }
                : asset
          )
      );

      setGroups(
        (prev) =>
          prev.filter(
            (item) =>
              item.id !==
              group.id
          )
      );

      if (
        editingGroupId ===
        group.id
      ) {
        cancelGroupEdit();
      }

      setMessage(
        `分组「${group.name}」已删除`
      );

      await loadData();
    } catch (err) {
      console.error(
        "删除分组失败:",
        err
      );

      setError(
        "删除分组失败"
      );
    }
  }

  // ===================================================
  // 页面
  // ===================================================

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar title="固收资产"/>

      <main className="mx-auto max-w-7xl px-6 py-6">

        {/* =================================================
            标题
        ================================================= */}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            固收资产
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            自定义分组管理固收资产
          </p>
        </div>

        {/* =================================================
            消息
        ================================================= */}

        {message && (
          <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
            {message}
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* =================================================
            总统计
        ================================================= */}

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

          <StatCard
            label="固收总资产"
            value={money(
              totalAmount
            )}
            hint="全部固收资产"
          />

          <StatCard
            label="固收资产"
            value={`${assets.length} 笔`}
            hint={`自定义分组 ${groups.length} 个`}
          />

          <StatCard
            label="今日预计利息"
            value={moneyExact(
              totalDailyInterest
            )}
            valueClassName="text-green-600"
          />

          <StatCard
            label="年预计利息"
            value={money(
              totalAnnualInterest
            )}
            hint={`自动计息 ${autoInterestAssets.length} 笔`}
            valueClassName="text-green-600"
          />

        </div>

        {/* =================================================
            分组管理
        ================================================= */}

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

          <div className="mb-4 flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold text-gray-900">
                固收分组
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                拖动左侧 ⠿ 可以调整整个分组的位置
              </p>

            </div>

            <button
              type="button"
              onClick={
                startCreateGroup
              }
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
            >
              + 新建分组
            </button>

          </div>

          {/* =================================================
              新建 / 编辑组
          ================================================= */}

          {groupFormOpen && (
            <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 p-4">

              <div className="mb-2 text-sm font-medium text-gray-700">
                {editingGroupId
                  ? "修改分组名称"
                  : "新建分组"}
              </div>

              <div className="flex gap-2">

                <input
                  autoFocus
                  value={
                    groupName
                  }
                  onChange={(
                    event
                  ) =>
                    setGroupName(
                      event.target.value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                      "Enter"
                    ) {
                      event.preventDefault();

                      void handleSaveGroup();
                    }

                    if (
                      event.key ===
                      "Escape"
                    ) {
                      cancelGroupEdit();
                    }
                  }}
                  placeholder="例如：2030 前不能动"
                  className="min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-gray-500"
                />

                <button
                  type="button"
                  onClick={
                    handleSaveGroup
                  }
                  disabled={
                    groupSaving
                  }
                  className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                >
                  {groupSaving
                    ? "保存中..."
                    : "保存"}
                </button>

                <button
                  type="button"
                  onClick={
                    cancelGroupEdit
                  }
                  disabled={
                    groupSaving
                  }
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>

              </div>

            </div>
          )}

          {/* =================================================
              分组
          ================================================= */}

          {orderedGroups.length ===
          0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500">
              还没有自定义分组
            </div>
          ) : (
            <div className="space-y-2">

              {orderedGroups.map(
                (group) => {
                  const stats =
                    getGroupStats(
                      group.id
                    );

                  const orderDragOver =
                    dragOverGroupOrderId ===
                    group.id;

                  const isGroupBeingDragged =
                    draggingGroupId ===
                    group.id;

                  return (
                    <div
                      key={
                        group.id
                      }

                      /*
                       * =================================================
                       * 组排序 Drop Zone
                       * =================================================
                       */
                      onDragEnter={(
                        event
                      ) =>
                        handleGroupOrderDragEnter(
                          event,
                          group.id
                        )
                      }
                      onDragOver={(
                        event
                      ) =>
                        handleGroupOrderDragOver(
                          event,
                          group.id
                        )
                      }
                      onDrop={(
                        event
                      ) =>
                        void handleGroupOrderDrop(
                          event,
                          group.id
                        )
                      }

                      className={`rounded-lg border bg-white transition ${
                        orderDragOver
                          ? "border-gray-500 bg-gray-50"
                          : "border-gray-200"
                      } ${
                        isGroupBeingDragged
                          ? "opacity-40"
                          : ""
                      }`}
                    >

                      <div className="flex items-center gap-3 px-4 py-3">

                        {/* =================================
                            组拖动手柄
                        ================================= */}

                        <div
                          draggable

                          /*
                           * 只允许这个 ⠿ 启动组拖动。
                           */
                          onDragStart={(
                            event
                          ) => {
                            handleGroupDragStart(
                              event,
                              group.id
                            );
                          }}

                          onDragEnd={
                            handleGroupDragEnd
                          }

                          /*
                           * 防止手柄的 drag 事件
                           * 被父级 / 其他区域干扰。
                           */
                          onMouseDown={(
                            event
                          ) => {
                            event.stopPropagation();
                          }}

                          className="cursor-grab select-none text-lg text-gray-400 active:cursor-grabbing"
                          title="拖动调整组的位置"
                        >
                          ⠿
                        </div>

                        <div className="min-w-0 flex-1">

                          <div className="flex items-center gap-2">

                            <span className="font-semibold text-gray-900">
                              {
                                group.name
                              }
                            </span>

                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                              {
                                stats.count
                              }
                              笔
                            </span>

                          </div>

                          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">

                            <span>
                              金额：
                              <strong className="ml-1 text-gray-700">
                                {money(
                                  stats.amount
                                )}
                              </strong>
                            </span>

                            <span>
                              今日：
                              <strong className="ml-1 text-green-600">
                                {moneyExact(
                                  stats.dailyInterest
                                )}
                              </strong>
                            </span>

                            <span>
                              年利息：
                              <strong className="ml-1 text-green-600">
                                {money(
                                  stats.annualInterest
                                )}
                              </strong>
                            </span>

                            <span>
                              占全部：
                              <strong className="ml-1 text-gray-700">
                                {stats.percentage.toFixed(
                                  2
                                )}
                                %
                              </strong>
                            </span>

                          </div>

                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            startEditGroup(
                              group
                            )
                          }
                          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                        >
                          编辑
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            void handleDeleteGroup(
                              group
                            )
                          }
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50"
                        >
                          删除
                        </button>

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </div>

        {/* =================================================
            添加 / 编辑固收
        ================================================= */}

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

          <div className="mb-4 flex items-center justify-between">

            <div>

              <h2 className="text-lg font-semibold text-gray-900">
                {editingId
                  ? "编辑固收资产"
                  : "添加固收资产"}
              </h2>

            </div>

            {editingId && (
              <button
                type="button"
                onClick={
                  resetForm
                }
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                取消编辑
              </button>
            )}

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

            <FormField label="类型">
              <select
                value={type}
                onChange={(
                  event
                ) =>
                  setType(
                    event.target.value as FixedIncomeType
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {ASSET_TYPES.map(
                  (item) => (
                    <option
                      key={
                        item
                      }
                      value={
                        item
                      }
                    >
                      {item}
                    </option>
                  )
                )}
              </select>
            </FormField>

            <FormField label="资产名称">
              <input
                value={name}
                onChange={(
                  event
                ) =>
                  setName(
                    event.target.value
                  )
                }
                placeholder="例如：长盛盛裕纯债D"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>

            <FormField label="机构">
              <input
                value={
                  institution
                }
                onChange={(
                  event
                ) =>
                  setInstitution(
                    event.target.value
                  )
                }
                placeholder="银行 / 基金公司 / 保险公司"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>

            <FormField label="资产金额">
              <input
                value={
                  amount
                }
                onChange={(
                  event
                ) =>
                  setAmount(
                    event.target.value
                  )
                }
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>

            <FormField label="年利率 %">
              <input
                value={
                  interestRate
                }
                onChange={(
                  event
                ) =>
                  setInterestRate(
                    event.target.value
                  )
                }
                type="number"
                min="0"
                step="0.01"
                placeholder="例如：3.50"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>

            <FormField label="起息日">
              <input
                value={
                  interestDate
                }
                onChange={(
                  event
                ) =>
                  setInterestDate(
                    event.target.value
                  )
                }
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>

            <FormField label="固收分组">
              <select
                value={
                  assetGroupId ||
                  ""
                }
                onChange={(
                  event
                ) =>
                  setAssetGroupId(
                    event.target
                      .value ||
                      null
                  )
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">
                  未分组
                </option>

                {orderedGroups.map(
                  (group) => (
                    <option
                      key={
                        group.id
                      }
                      value={
                        group.id
                      }
                    >
                      {
                        group.name
                      }
                    </option>
                  )
                )}
              </select>
            </FormField>

            <div className="flex items-end">

              <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm text-gray-700">

                <input
                  type="checkbox"
                  checked={
                    autoInterest
                  }
                  onChange={(
                    event
                  ) =>
                    setAutoInterest(
                      event.target
                        .checked
                    )
                  }
                  className="h-4 w-4"
                />

                开启每日自动计息

              </label>

            </div>

            <FormField label="备注">
              <input
                value={
                  note
                }
                onChange={(
                  event
                ) =>
                  setNote(
                    event.target.value
                  )
                }
                placeholder="备注"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </FormField>

          </div>

          <div className="mt-5 flex gap-3">

            <button
              type="button"
              onClick={
                handleSave
              }
              disabled={
                saving
              }
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving
                ? "保存中..."
                : editingId
                ? "保存修改"
                : "添加固收"}
            </button>

            {!editingId && (
              <button
                type="button"
                onClick={
                  resetForm
                }
                className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
              >
                清空
              </button>
            )}

          </div>

        </div>

        {/* =================================================
            已选固收统计
        ================================================= */}

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

          <div className="mb-4 flex items-center justify-between">

            <div>

              <div className="text-base font-semibold text-gray-900">
                已选固收统计
              </div>

              <div className="mt-1 text-xs text-gray-500">
                勾选下面的资产后自动统计
              </div>

            </div>

            <div className="flex gap-2">

              <button
                type="button"
                onClick={
                  selectAllAssets
                }
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                全选
              </button>

              <button
                type="button"
                onClick={
                  clearSelectedAssets
                }
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
              >
                清空
              </button>

            </div>

          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">

            <div>
              <div className="text-sm text-gray-500">
                已选资产
              </div>

              <div className="mt-1 text-xl font-bold text-gray-900">
                {
                  selectedAssets.length
                }{" "}
                笔
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">
                已选资产金额
              </div>

              <div className="mt-1 text-xl font-bold text-gray-900">
                {money(
                  selectedAmount
                )}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">
                已选年预计利息
              </div>

              <div className="mt-1 text-xl font-bold text-green-600">
                {money(
                  selectedAnnualInterest
                )}
              </div>

              <div className="mt-1 text-xs text-gray-400">
                今日预计{" "}
                {moneyExact(
                  selectedDailyInterest
                )}
              </div>
            </div>

          </div>

        </div>

        {/* =================================================
            资产标题
        ================================================= */}

        <div className="mb-3">

          <h2 className="text-lg font-semibold text-gray-900">
            固收资产明细
          </h2>

          <p className="mt-1 text-xs text-gray-500">
            资产左侧 ⠿ 调整资产顺序；直接把资产拖到其他组即可移动分组
          </p>

        </div>

        {/* =================================================
            资产区域
        ================================================= */}

        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
            加载中...
          </div>
        ) : (
          <div className="space-y-5">

            {/* 未分组 */}

            <GroupAssetSection
              title="未分组"
              groupId={null}
              stats={getGroupStats(
                null
              )}
              assets={getGroupAssets(
                null
              )}
              selectedIds={
                selectedIds
              }
              draggingAssetId={
                draggingAssetId
              }
              dragOverAssetId={
                dragOverAssetId
              }
              dragOverGroupId={
                dragOverGroupId
              }
              onToggleSelected={
                toggleSelected
              }
              onEdit={
                startEdit
              }
              onDelete={
                handleDelete
              }
              onAssetDragStart={
                handleAssetDragStart
              }
              onAssetDragOver={
                handleAssetDragOver
              }
              onAssetDrop={
                handleAssetDrop
              }
              onAssetDragEnd={
                handleAssetDragEnd
              }
              onGroupDragOver={
                handleAssetGroupDragOver
              }
              onGroupDrop={
                handleAssetDropToGroup
              }
              deletingId={
                deletingId
              }
            />

            {/* 自定义分组 */}

            {orderedGroups.map(
              (group) => (
                <GroupAssetSection
                  key={
                    group.id
                  }
                  title={
                    group.name
                  }
                  groupId={
                    group.id
                  }
                  stats={getGroupStats(
                    group.id
                  )}
                  assets={getGroupAssets(
                    group.id
                  )}
                  selectedIds={
                    selectedIds
                  }
                  draggingAssetId={
                    draggingAssetId
                  }
                  dragOverAssetId={
                    dragOverAssetId
                  }
                  dragOverGroupId={
                    dragOverGroupId
                  }
                  onToggleSelected={
                    toggleSelected
                  }
                  onEdit={
                    startEdit
                  }
                  onDelete={
                    handleDelete
                  }
                  onAssetDragStart={
                    handleAssetDragStart
                  }
                  onAssetDragOver={
                    handleAssetDragOver
                  }
                  onAssetDrop={
                    handleAssetDrop
                  }
                  onAssetDragEnd={
                    handleAssetDragEnd
                  }
                  onGroupDragOver={
                    handleAssetGroupDragOver
                  }
                  onGroupDrop={
                    handleAssetDropToGroup
                  }
                  deletingId={
                    deletingId
                  }
                />
              )
            )}

          </div>
        )}

      </main>
    </div>
  );
}

// =====================================================
// StatCard
// =====================================================

function StatCard({
  label,
  value,
  hint,
  valueClassName = "text-gray-900",
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">

      <div className="text-sm text-gray-500">
        {label}
      </div>

      <div
        className={`mt-2 text-2xl font-bold ${valueClassName}`}
      >
        {value}
      </div>

      {hint && (
        <div className="mt-1 text-xs text-gray-400">
          {hint}
        </div>
      )}

    </div>
  );
}

// =====================================================
// FormField
// =====================================================

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>

      <label className="mb-1 block text-sm text-gray-600">
        {label}
      </label>

      {children}

    </div>
  );
}

// =====================================================
// 分组资产 Props
// =====================================================

type GroupStats = {
  assets: FixedIncomeAsset[];
  count: number;
  amount: number;
  dailyInterest: number;
  annualInterest: number;
  percentage: number;
};

type GroupAssetSectionProps = {
  title: string;

  groupId: string | null;

  stats: GroupStats;

  assets: FixedIncomeAsset[];

  selectedIds: string[];

  draggingAssetId: string | null;

  dragOverAssetId: string | null;

  dragOverGroupId: string | null;

  onToggleSelected: (
    id: string
  ) => void;

  onEdit: (
    asset: FixedIncomeAsset
  ) => void;

  onDelete: (
    id: string
  ) => void;

  onAssetDragStart: (
    event: DragEvent,
    id: string
  ) => void;

  onAssetDragOver: (
    event: DragEvent,
    id: string
  ) => void;

  onAssetDrop: (
    event: DragEvent,
    id: string
  ) => void;

  onAssetDragEnd: () => void;

  onGroupDragOver: (
    event: DragEvent,
    groupId: string | null
  ) => void;

  onGroupDrop: (
    event: DragEvent,
    groupId: string | null
  ) => Promise<void>;

  deletingId: string | null;
};

// =====================================================
// 分组资产区域
// =====================================================

function GroupAssetSection({
  title,
  groupId,
  stats,
  assets,
  selectedIds,
  draggingAssetId,
  dragOverAssetId,
  dragOverGroupId,
  onToggleSelected,
  onEdit,
  onDelete,
  onAssetDragStart,
  onAssetDragOver,
  onAssetDrop,
  onAssetDragEnd,
  onGroupDragOver,
  onGroupDrop,
  deletingId,
}: GroupAssetSectionProps) {
  const isGroupDropTarget =
    dragOverGroupId ===
      groupId &&
    draggingAssetId !==
      null;

  return (
    <section
      onDragOver={(
        event
      ) =>
        onGroupDragOver(
          event,
          groupId
        )
      }
      onDrop={(
        event
      ) =>
        void onGroupDrop(
          event,
          groupId
        )
      }
      className={`rounded-xl border bg-white p-4 shadow-sm transition ${
        isGroupDropTarget
          ? "border-gray-500 bg-gray-50"
          : "border-gray-200"
      }`}
    >

      {/* =================================================
          组标题
      ================================================= */}

      <div className="mb-4 flex items-center justify-between">

        <div className="min-w-0">

          <div className="flex items-center gap-2">

            <h3 className="text-base font-semibold text-gray-900">
              {title}
            </h3>

            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {stats.count}
              笔
            </span>

          </div>

          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">

            <span>
              金额：
              <strong className="ml-1 text-gray-700">
                {money(
                  stats.amount
                )}
              </strong>
            </span>

            <span>
              今日：
              <strong className="ml-1 text-green-600">
                {moneyExact(
                  stats.dailyInterest
                )}
              </strong>
            </span>

            <span>
              年利息：
              <strong className="ml-1 text-green-600">
                {money(
                  stats.annualInterest
                )}
              </strong>
            </span>

            <span>
              占全部：
              <strong className="ml-1 text-gray-700">
                {stats.percentage.toFixed(
                  2
                )}
                %
              </strong>
            </span>

          </div>

        </div>

        {isGroupDropTarget && (
          <div className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs text-gray-600">
            松开即可移动到这里
          </div>
        )}

      </div>

      {/* =================================================
          资产
      ================================================= */}

      {assets.length ===
      0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 px-4 py-6 text-center text-xs text-gray-400">
          {isGroupDropTarget
            ? "松开鼠标，将资产移动到这里"
            : "暂无固收资产"}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

          {assets.map(
            (asset) => {
              const selected =
                selectedIds.includes(
                  asset.id
                );

              const isDragging =
                draggingAssetId ===
                asset.id;

              const isDragOver =
                dragOverAssetId ===
                asset.id;

              const dailyInterest =
                getDailyInterest(
                  asset
                );

              return (
                <div
                  key={
                    asset.id
                  }
                  draggable
                  onDragStart={(
                    event
                  ) =>
                    onAssetDragStart(
                      event,
                      asset.id
                    )
                  }
                  onDragOver={(
                    event
                  ) =>
                    onAssetDragOver(
                      event,
                      asset.id
                    )
                  }
                  onDrop={(
                    event
                  ) =>
                    onAssetDrop(
                      event,
                      asset.id
                    )
                  }
                  onDragEnd={
                    onAssetDragEnd
                  }
                  className={`rounded-lg border bg-white p-3 transition ${
                    isDragging
                      ? "opacity-40"
                      : ""
                  } ${
                    isDragOver
                      ? "border-gray-500 bg-gray-50"
                      : "border-gray-200"
                  }`}
                >

                  {/* =================================================
                      第一行
                  ================================================= */}

                  <div className="flex items-center gap-2">

                    <span
                      className="cursor-grab select-none text-lg text-gray-400 active:cursor-grabbing"
                      title="拖动调整资产顺序或移动到其他组"
                    >
                      ⠿
                    </span>

                    <input
                      type="checkbox"
                      checked={
                        selected
                      }
                      onChange={() =>
                        onToggleSelected(
                          asset.id
                        )
                      }
                      className="h-4 w-4 shrink-0"
                    />

                    <div className="min-w-0 flex-1">

                      <div className="truncate text-sm font-semibold text-gray-900">
                        {
                          asset.name
                        }
                      </div>

                      {asset.institution && (
                        <div className="truncate text-xs text-gray-400">
                          {
                            asset.institution
                          }
                        </div>
                      )}

                    </div>

                  </div>

                  {/* =================================================
                      数据
                  ================================================= */}

                  <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">

                    <div>

                      <div className="text-[11px] text-gray-400">
                        当前金额
                      </div>

                      <div className="mt-0.5 text-sm font-semibold text-gray-900">
                        {money(
                          toNumber(
                            asset.amount
                          )
                        )}
                      </div>

                    </div>

                    <div>

                      <div className="text-[11px] text-gray-400">
                        类型
                      </div>

                      <div className="mt-0.5 truncate text-sm text-gray-700">
                        {
                          asset.type
                        }
                      </div>

                    </div>

                    <div>

                      <div className="text-[11px] text-gray-400">
                        年利率
                      </div>

                      <div className="mt-0.5 text-sm text-gray-700">

                        {asset.interest_rate ===
                          null ||
                        asset.interest_rate ===
                          undefined
                          ? "-"
                          : `${toNumber(
                              asset.interest_rate
                            ).toFixed(
                              2
                            )}%`}

                      </div>

                    </div>

                    <div>

                      <div className="text-[11px] text-gray-400">
                        今日利息
                      </div>

                      <div className="mt-0.5 text-sm font-medium text-green-600">

                        {asset.auto_interest
                          ? moneyExact(
                              dailyInterest
                            )
                          : "-"}

                      </div>

                    </div>

                  </div>

                  {/* =================================================
                      自动计息
                  ================================================= */}

                  {asset.auto_interest && (
                    <div className="mt-2 text-[11px] text-gray-400">
                      自动计息 · 每日更新
                    </div>
                  )}

                  {/* =================================================
                      备注
                  ================================================= */}

                  {asset.note && (
                    <div className="mt-2 truncate text-[11px] text-gray-400">
                      {
                        asset.note
                      }
                    </div>
                  )}

                  {/* =================================================
                      操作
                  ================================================= */}

                  <div className="mt-3 flex gap-2 border-t border-gray-100 pt-3">

                    <button
                      type="button"
                      onClick={() =>
                        onEdit(
                          asset
                        )
                      }
                      className="flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                    >
                      编辑
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void onDelete(
                          asset.id
                        )
                      }
                      disabled={
                        deletingId ===
                        asset.id
                      }
                      className="flex-1 rounded-lg border border-red-200 px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId ===
                      asset.id
                        ? "删除中..."
                        : "删除"}
                    </button>

                  </div>

                </div>
              );
            }
          )}

        </div>
      )}

    </section>
  );
}