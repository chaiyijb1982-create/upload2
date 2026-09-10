"use client";

import { useEffect, useMemo, useState } from "react";

import {
  getFixedIncomeAssets,
  createFixedIncomeAsset,
  updateFixedIncomeAsset,
  deleteFixedIncomeAsset,
  type FixedIncomeAsset,
} from "@/lib/fixed-income";

import TopBar from "@/components/TopBar";

// =====================================================
// 工具
// =====================================================

function toNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function money(value: number) {
  return value.toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
    maximumFractionDigits: 2,
  });
}

function moneyExact(value: number) {
  return value.toLocaleString("zh-CN", {
    style: "currency",
    currency: "CNY",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function todayString() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");

  return `${y}-${m}-${day}`;
}

function getDailyInterest(asset: FixedIncomeAsset) {
  if (!asset.auto_interest) return 0;

  const amount = toNumber(asset.amount);
  const rate = toNumber(asset.interest_rate);

  if (amount <= 0 || rate <= 0) return 0;

  return (amount * rate) / 100 / 365;
}

// =====================================================
// 类型
// =====================================================

const ASSET_TYPES = [
  "万能险",
  "活期",
  "银行理财",
  "定期存款",
  "货币基金",
  "债券",
  "固收理财",
  "其他",
];

const SORT_STORAGE_KEY =
  "ai-wealth-os-fixed-income-order";

// =====================================================
// 页面
// =====================================================

export default function FixedIncomePage() {
  const [assets, setAssets] = useState<FixedIncomeAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);

  // ===================================================
  // 选中的固收
  // ===================================================

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // ===================================================
  // 拖动排序
  // ===================================================

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // ===================================================
  // 表单
  // ===================================================

  const [type, setType] = useState("固收理财");
  const [name, setName] = useState("");
  const [institution, setInstitution] = useState("");
  const [amount, setAmount] = useState("");
  const [interestRate, setInterestRate] = useState("");
  const [autoInterest, setAutoInterest] = useState(false);
  const [interestDate, setInterestDate] = useState("");
  const [note, setNote] = useState("");

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // ===================================================
  // 加载
  // ===================================================

  async function loadAssets() {
    try {
      setLoading(true);
      setError("");

      const data = await getFixedIncomeAssets();

      let orderedData = data;

      try {
        const savedOrder = localStorage.getItem(
          SORT_STORAGE_KEY
        );

        if (savedOrder) {
          const ids = JSON.parse(savedOrder);

          if (Array.isArray(ids)) {
            const orderMap = new Map<string, number>();

            ids.forEach((id, index) => {
              orderMap.set(String(id), index);
            });

            orderedData = [...data].sort((a, b) => {
              const aIndex = orderMap.get(a.id);
              const bIndex = orderMap.get(b.id);

              if (
                aIndex !== undefined &&
                bIndex !== undefined
              ) {
                return aIndex - bIndex;
              }

              if (aIndex !== undefined) {
                return -1;
              }

              if (bIndex !== undefined) {
                return 1;
              }

              return 0;
            });
          }
        }
      } catch (orderError) {
        console.error(
          "读取固收排序失败:",
          orderError
        );
      }

      setAssets(orderedData);
    } catch (err) {
      console.error(err);
      setError("加载固收资产失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAssets();
  }, []);

  // ===================================================
  // 保存排序
  // ===================================================

  function saveOrder(list: FixedIncomeAsset[]) {
    try {
      const ids = list.map((asset) => asset.id);

      localStorage.setItem(
        SORT_STORAGE_KEY,
        JSON.stringify(ids)
      );
    } catch (err) {
      console.error("保存固收排序失败:", err);
    }
  }

  // ===================================================
  // 开始拖动
  // ===================================================

  function handleDragStart(
    event: React.DragEvent,
    id: string
  ) {
    setDraggingId(id);
    setDragOverId(null);

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", id);
  }

  // ===================================================
  // 拖动经过
  // ===================================================

  function handleDragOver(
    event: React.DragEvent,
    id: string
  ) {
    event.preventDefault();

    if (!draggingId || draggingId === id) {
      return;
    }

    event.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  }

  // ===================================================
  // 放下
  // ===================================================

  function handleDrop(
    event: React.DragEvent,
    targetId: string
  ) {
    event.preventDefault();

    const sourceId =
      draggingId ||
      event.dataTransfer.getData("text/plain");

    if (!sourceId || sourceId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }

    setAssets((prev) => {
      const sourceIndex = prev.findIndex(
        (asset) => asset.id === sourceId
      );

      const targetIndex = prev.findIndex(
        (asset) => asset.id === targetId
      );

      if (
        sourceIndex === -1 ||
        targetIndex === -1
      ) {
        return prev;
      }

      const next = [...prev];

      const [movedAsset] = next.splice(
        sourceIndex,
        1
      );

      next.splice(targetIndex, 0, movedAsset);

      saveOrder(next);

      return next;
    });

    setDraggingId(null);
    setDragOverId(null);
  }

  // ===================================================
  // 拖动结束
  // ===================================================

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverId(null);
  }

  // ===================================================
  // 选中 / 取消选中
  // ===================================================

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }

      return [...prev, id];
    });
  }

  // ===================================================
  // 总统计
  // ===================================================

  const totalAmount = useMemo(() => {
    return assets.reduce((sum, asset) => {
      return sum + toNumber(asset.amount);
    }, 0);
  }, [assets]);

  const autoInterestAssets = useMemo(() => {
    return assets.filter(
      (asset) => asset.auto_interest
    );
  }, [assets]);

  const totalDailyInterest = useMemo(() => {
    return assets.reduce((sum, asset) => {
      return sum + getDailyInterest(asset);
    }, 0);
  }, [assets]);

  const totalAnnualInterest = useMemo(() => {
    return totalDailyInterest * 365;
  }, [totalDailyInterest]);

  // ===================================================
  // 已选固收统计
  // ===================================================

  const selectedAssets = useMemo(() => {
    return assets.filter((asset) =>
      selectedIds.includes(asset.id)
    );
  }, [assets, selectedIds]);

  const selectedAmount = useMemo(() => {
    return selectedAssets.reduce((sum, asset) => {
      return sum + toNumber(asset.amount);
    }, 0);
  }, [selectedAssets]);

  const selectedDailyInterest = useMemo(() => {
    return selectedAssets.reduce((sum, asset) => {
      return sum + getDailyInterest(asset);
    }, 0);
  }, [selectedAssets]);

  const selectedAnnualInterest = useMemo(() => {
    return selectedDailyInterest * 365;
  }, [selectedDailyInterest]);

  // ===================================================
  // 清空表单
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
  }

  // ===================================================
  // 编辑
  // ===================================================

  function startEdit(asset: FixedIncomeAsset) {
    setEditingId(asset.id);

    setType(asset.type || "固收理财");
    setName(asset.name || "");
    setInstitution(asset.institution || "");
    setAmount(String(asset.amount ?? ""));

    setInterestRate(
      asset.interest_rate === null ||
      asset.interest_rate === undefined
        ? ""
        : String(asset.interest_rate)
    );

    setAutoInterest(
      Boolean(asset.auto_interest)
    );

    setInterestDate(
      asset.interest_date || ""
    );

    setNote(asset.note || "");

    setMessage("");
    setError("");

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  // ===================================================
  // 保存
  // ===================================================

  async function handleSave() {
    setMessage("");
    setError("");

    if (!name.trim()) {
      setError("请输入资产名称");
      return;
    }

    const amountNumber = toNumber(amount);

    if (amountNumber <= 0) {
      setError("请输入正确的资产金额");
      return;
    }

    try {
      setSaving(true);

      if (editingId) {
        await updateFixedIncomeAsset(
          editingId,
          {
            type,
            name: name.trim(),
            institution:
              institution.trim() || null,
            amount: amountNumber,
            interest_rate:
              interestRate.trim() === ""
                ? null
                : toNumber(interestRate),
            auto_interest: autoInterest,
            interest_date:
              interestDate || null,
            note: note.trim() || null,
          }
        );

        setMessage("固收资产已更新");
      } else {
        await createFixedIncomeAsset({
          type,
          name: name.trim(),
          institution:
            institution.trim() || null,
          amount: amountNumber,
          interest_rate:
            interestRate.trim() === ""
              ? null
              : toNumber(interestRate),
          auto_interest: autoInterest,
          interest_date:
            interestDate || null,
          note: note.trim() || null,
        });

        setMessage("固收资产已添加");
      }

      resetForm();

      await loadAssets();
    } catch (err) {
      console.error(err);
      setError("保存失败");
    } finally {
      setSaving(false);
    }
  }

  // ===================================================
  // 删除
  // ===================================================

  async function handleDelete(id: string) {
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

      await deleteFixedIncomeAsset(id);

      setSelectedIds((prev) =>
        prev.filter((item) => item !== id)
      );

      setAssets((prev) => {
        const next = prev.filter(
          (asset) => asset.id !== id
        );

        saveOrder(next);

        return next;
      });

      if (editingId === id) {
        resetForm();
      }

      setMessage("固收资产已删除");

      await loadAssets();
    } catch (err) {
      console.error(err);
      setError("删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  // ===================================================
  // 页面
  // ===================================================

  return (
    <div className="min-h-screen bg-gray-50">
      <TopBar />

      <main className="mx-auto max-w-7xl px-6 py-6">
        {/* =================================================
            标题
        ================================================= */}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            固收资产
          </h1>

          <p className="mt-1 text-sm text-gray-500">
            管理万能险、活期、银行理财、定期存款、货币基金、债券及其他固收资产
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
          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              固收总资产
            </div>

            <div className="mt-2 text-2xl font-bold text-gray-900">
              {money(totalAmount)}
            </div>

            <div className="mt-1 text-xs text-gray-400">
              并入 Dashboard Total Wealth
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              自动计息资产
            </div>

            <div className="mt-2 text-2xl font-bold text-gray-900">
              {autoInterestAssets.length}
            </div>

            <div className="mt-1 text-xs text-gray-400">
              开启每日自动计息
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              今日预计利息
            </div>

            <div className="mt-2 text-2xl font-bold text-green-600">
              {moneyExact(totalDailyInterest)}
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="text-sm text-gray-500">
              年预计利息
            </div>

            <div className="mt-2 text-2xl font-bold text-green-600">
              {money(totalAnnualInterest)}
            </div>
          </div>
        </div>

        {/* =================================================
            添加 / 编辑固收资产
        ================================================= */}

        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                {editingId
                  ? "编辑固收资产"
                  : "添加固收资产"}
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                资产金额统一按人民币记录
              </p>
            </div>

            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                取消编辑
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm text-gray-600">
                类型
              </label>

              <select
                value={type}
                onChange={(e) =>
                  setType(e.target.value)
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {ASSET_TYPES.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">
                资产名称
              </label>

              <input
                value={name}
                onChange={(e) =>
                  setName(e.target.value)
                }
                placeholder="例如：长盛盛裕纯债D"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">
                机构
              </label>

              <input
                value={institution}
                onChange={(e) =>
                  setInstitution(e.target.value)
                }
                placeholder="例如：银行 / 基金公司 / 保险公司"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">
                资产金额
              </label>

              <input
                value={amount}
                onChange={(e) =>
                  setAmount(e.target.value)
                }
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">
                年利率 %
              </label>

              <input
                value={interestRate}
                onChange={(e) =>
                  setInterestRate(e.target.value)
                }
                type="number"
                min="0"
                step="0.01"
                placeholder="例如：3.50"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-600">
                起息日
              </label>

              <input
                value={interestDate}
                onChange={(e) =>
                  setInterestDate(e.target.value)
                }
                type="date"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex items-center">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={autoInterest}
                  onChange={(e) =>
                    setAutoInterest(
                      e.target.checked
                    )
                  }
                  className="h-4 w-4"
                />

                开启每日自动计息
              </label>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1 block text-sm text-gray-600">
                备注
              </label>

              <input
                value={note}
                onChange={(e) =>
                  setNote(e.target.value)
                }
                placeholder="备注"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-gray-900 px-5 py-2.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
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
                onClick={resetForm}
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
          <div className="mb-4">
            <div className="text-base font-semibold text-gray-900">
              已选固收统计
            </div>

            <div className="mt-1 text-xs text-gray-500">
              勾选下面的固收资产后，这里只统计已选资产
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div>
              <div className="text-sm text-gray-500">
                已选资产
              </div>

              <div className="mt-1 text-xl font-bold text-gray-900">
                {selectedAssets.length} 笔
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">
                已选资产金额
              </div>

              <div className="mt-1 text-xl font-bold text-gray-900">
                {money(selectedAmount)}
              </div>
            </div>

            <div>
              <div className="text-sm text-gray-500">
                已选年预计利息
              </div>

              <div className="mt-1 text-xl font-bold text-green-600">
                {money(selectedAnnualInterest)}
              </div>

              <div className="mt-1 text-xs text-gray-400">
                今日预计{" "}
                {moneyExact(selectedDailyInterest)}
              </div>
            </div>
          </div>
        </div>

        {/* =================================================
            固收资产列表
        ================================================= */}

        <div>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">
                固收资产明细
              </h2>

              <p className="mt-1 text-xs text-gray-500">
                共 {assets.length} 笔 · 拖动左侧 ⠿ 可以调整顺序
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              加载中...
            </div>
          ) : assets.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-sm text-gray-500">
              暂无固收资产
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {assets.map((asset) => {
                const dailyInterest =
                  getDailyInterest(asset);

                const selected =
                  selectedIds.includes(asset.id);

                const isDragging =
                  draggingId === asset.id;

                const isDragOver =
                  dragOverId === asset.id;

                return (
                  <div
                    key={asset.id}
                    draggable
                    onDragStart={(event) =>
                      handleDragStart(
                        event,
                        asset.id
                      )
                    }
                    onDragOver={(event) =>
                      handleDragOver(
                        event,
                        asset.id
                      )
                    }
                    onDrop={(event) =>
                      handleDrop(
                        event,
                        asset.id
                      )
                    }
                    onDragEnd={handleDragEnd}
                    className={[
                      "rounded-xl border border-gray-200 bg-white p-4 shadow-sm",
                      "transition-all duration-150",
                      isDragging
                        ? "opacity-40"
                        : "",
                      isDragOver
                        ? "border-blue-500 ring-2 ring-blue-100"
                        : "",
                    ].join(" ")}
                  >
                    {/* =========================================
                        名称 + 拖动手柄 + 选择框
                    ========================================= */}

                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {/* 拖动手柄 */}

                        <div
                          title="按住拖动调整顺序"
                          className="flex h-7 w-6 shrink-0 cursor-grab select-none items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-base leading-none text-gray-400 active:cursor-grabbing"
                        >
                          ⠿
                        </div>

                        {/* 勾选框 + 名称 */}

                        <label className="flex min-w-0 cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() =>
                              toggleSelected(
                                asset.id
                              )
                            }
                            onClick={(event) =>
                              event.stopPropagation()
                            }
                            className="h-5 w-5 shrink-0 cursor-pointer accent-blue-600"
                          />

                          <h3 className="truncate text-base font-semibold text-gray-900">
                            {asset.name}
                          </h3>
                        </label>
                      </div>

                      <span className="shrink-0 rounded-full bg-gray-100 px-2 py-1 text-xs text-gray-600">
                        {asset.type}
                      </span>
                    </div>

                    {/* =========================================
                        基础信息
                    ========================================= */}

                    <div className="mt-3 space-y-1.5 text-sm">
                      {asset.institution && (
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500">
                            机构
                          </span>

                          <span className="truncate text-right text-gray-900">
                            {asset.institution}
                          </span>
                        </div>
                      )}

                      {asset.note && (
                        <div className="flex justify-between gap-2">
                          <span className="text-gray-500">
                            备注
                          </span>

                          <span className="truncate text-right text-gray-900">
                            {asset.note}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* =========================================
                        金额
                    ========================================= */}

                    <div className="mt-3 border-t border-gray-100 pt-3">
                      <div className="text-xs text-gray-500">
                        当前资产
                      </div>

                      <div className="mt-1 text-xl font-bold text-gray-900">
                        {money(asset.amount)}
                      </div>
                    </div>

                    {/* =========================================
                        利息
                    ========================================= */}

                    {asset.auto_interest && (
                      <div className="mt-3 rounded-lg bg-green-50 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-600">
                            年利率
                          </span>

                          <span className="text-sm font-semibold text-gray-900">
                            {toNumber(
                              asset.interest_rate
                            ).toFixed(2)}
                            %
                          </span>
                        </div>

                        <div className="mt-1.5 flex items-center justify-between">
                          <span className="text-xs text-gray-600">
                            今日预计利息
                          </span>

                          <span className="text-sm font-semibold text-green-600">
                            {moneyExact(
                              dailyInterest
                            )}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* =========================================
                        起息日
                    ========================================= */}

                    {asset.interest_date && (
                      <div className="mt-2 text-xs text-gray-500">
                        起息日：
                        {asset.interest_date}
                      </div>
                    )}

                    {/* =========================================
                        操作
                    ========================================= */}

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        draggable={false}
                        onClick={() =>
                          startEdit(asset)
                        }
                        className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50"
                      >
                        编辑
                      </button>

                      <button
                        type="button"
                        draggable={false}
                        onClick={() =>
                          handleDelete(
                            asset.id
                          )
                        }
                        disabled={
                          deletingId ===
                          asset.id
                        }
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId === asset.id
                          ? "删除中..."
                          : "删除"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}