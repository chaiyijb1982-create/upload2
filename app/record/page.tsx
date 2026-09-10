"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";

// =====================================================
// 类型
// =====================================================

type RecordItem = {
  id: string;
  title: string;
  content: Record<string, unknown>;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};

// =====================================================
// 工具函数
// =====================================================

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// =====================================================
// Page
// =====================================================

export default function RecordPage() {
  const router = useRouter();

  const [records, setRecords] =
    useState<RecordItem[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [creating, setCreating] =
    useState(false);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  // ===================================================
  // Load active records
  // ===================================================

  const loadRecords = useCallback(
    async () => {
      try {
        setLoading(true);
        setError("");

        const response = await fetch(
          "/api/record",
          {
            cache: "no-store",
          }
        );

        const data =
          await response.json().catch(
            () => null
          );

        if (!response.ok) {
          throw new Error(
            data?.error ||
              "读取记录失败"
          );
        }

        const list =
          Array.isArray(data?.records)
            ? data.records
            : Array.isArray(data)
              ? data
              : [];

        setRecords(list);
      } catch (error) {
        console.error(
          "读取记录失败:",
          error
        );

        setError(
          error instanceof Error
            ? error.message
            : "读取记录失败"
        );
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // ===================================================
  // Initial load
  // ===================================================

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // ===================================================
  // Create record
  // ===================================================

  async function createRecord() {
    if (creating) return;

    const title =
      window.prompt(
        "请输入记录名称"
      );

    if (!title?.trim()) {
      return;
    }

    try {
      setCreating(true);
      setError("");

      const response =
        await fetch(
          "/api/record",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              title: title.trim(),
            }),
          }
        );

      const data =
        await response.json().catch(
          () => null
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "新建记录失败"
        );
      }

      const record =
        data?.record ?? data;

      if (!record?.id) {
        throw new Error(
          "新建记录成功，但没有返回记录 ID"
        );
      }

      router.push(
        `/record/${record.id}`
      );
    } catch (error) {
      console.error(
        "新建记录失败:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "新建记录失败"
      );
    } finally {
      setCreating(false);
    }
  }

  // ===================================================
  // Complete record
  // ===================================================

  async function completeRecord(
    record: RecordItem
  ) {
    if (processingId) return;

    const confirmed =
      window.confirm(
        `确定将「${record.title}」标记为完成吗？`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(record.id);
      setError("");

      const response =
        await fetch(
          `/api/record/${record.id}`,
          {
            method: "PUT",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action: "complete",
            }),
          }
        );

      const data =
        await response.json().catch(
          () => null
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "完成事件失败"
        );
      }

      // =================================================
      // 首页只显示未完成记录
      // 所以完成后直接从列表移除
      // =================================================

      setRecords((current) =>
        current.filter(
          (item) =>
            item.id !== record.id
        )
      );
    } catch (error) {
      console.error(
        "完成事件失败:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "完成事件失败"
      );
    } finally {
      setProcessingId(null);
    }
  }

  // ===================================================
  // Delete record
  // ===================================================

  async function deleteRecord(
    record: RecordItem
  ) {
    if (processingId) return;

    const confirmed =
      window.confirm(
        `确定删除「${record.title}」吗？\n\n删除后记录、任务、附件都会删除，且无法恢复。`
      );

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(record.id);
      setError("");

      const response =
        await fetch(
          `/api/record/${record.id}`,
          {
            method: "DELETE",
          }
        );

      const data =
        await response.json().catch(
          () => null
        );

      if (!response.ok) {
        throw new Error(
          data?.error ||
            "删除记录失败"
        );
      }

      setRecords((current) =>
        current.filter(
          (item) =>
            item.id !== record.id
        )
      );
    } catch (error) {
      console.error(
        "删除记录失败:",
        error
      );

      setError(
        error instanceof Error
          ? error.message
          : "删除记录失败"
      );
    } finally {
      setProcessingId(null);
    }
  }

  // ===================================================
  // Open record
  // ===================================================

  function openRecord(
    record: RecordItem
  ) {
    if (processingId) return;

    router.push(
      `/record/${record.id}`
    );
  }

  // ===================================================
  // Loading
  // ===================================================

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">
            📝 记录版
          </h1>

          <button
            type="button"
            disabled
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm text-white opacity-50"
          >
            ＋ 新建记录
          </button>
        </div>

        <div className="mt-8 rounded-xl border border-gray-200 bg-white px-5 py-10 text-center text-sm text-gray-400">
          正在加载……
        </div>
      </div>
    );
  }

  // ===================================================
  // Render
  // ===================================================

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 pb-16">
      {/* =============================================
          Header
      ============================================== */}

      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            📝 记录版
          </h1>

          <div className="mt-1 text-xs text-gray-400">
            记录要做什么，并持续更新最后更新时间
          </div>
        </div>

        <button
          type="button"
          onClick={createRecord}
          disabled={creating}
          className="shrink-0 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {creating
            ? "创建中…"
            : "＋ 新建记录"}
        </button>
      </div>

      {/* =============================================
          Error
      ============================================== */}

      {error && (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* =============================================
          Empty
      ============================================== */}

      {records.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white px-5 py-14 text-center">
          <div className="text-base font-medium text-gray-700">
            暂无进行中的记录
          </div>

          <div className="mt-2 text-sm text-gray-400">
            新建一条记录，开始记录要做什么。
          </div>

          <button
            type="button"
            onClick={createRecord}
            disabled={creating}
            className="mt-6 rounded-lg bg-gray-900 px-4 py-2 text-sm text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {creating
              ? "创建中…"
              : "新建第一条记录"}
          </button>
        </div>
      ) : (
        <>
          {/* =========================================
              Table Header
          ========================================== */}

          <div className="hidden grid-cols-[180px_minmax(0,1fr)_220px] items-center gap-4 border-b border-gray-200 px-4 pb-3 text-xs font-medium text-gray-400 sm:grid">
            <div>
              最后更新时间
            </div>

            <div>
              事件
            </div>

            <div className="text-right">
              操作
            </div>
          </div>

          {/* =========================================
              Record List
          ========================================== */}

          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {records.map(
              (record) => {
                const processing =
                  processingId ===
                  record.id;

                return (
                  <div
                    key={record.id}
                    className="border-b border-gray-100 last:border-b-0"
                  >
                    <div
                      className={`grid grid-cols-1 gap-3 px-4 py-4 transition sm:grid-cols-[180px_minmax(0,1fr)_220px] sm:items-center sm:gap-4 ${
                        processing
                          ? "opacity-50"
                          : "hover:bg-gray-50"
                      }`}
                    >
                      {/* =================================
                          Updated At
                      ================================== */}

                      <div className="text-xs text-gray-400">
                        <span className="sm:hidden">
                          最后更新：
                        </span>

                        {formatDateTime(
                          record.updated_at
                        )}
                      </div>

                      {/* =================================
                          Title
                      ================================== */}

                      <button
                        type="button"
                        onClick={() =>
                          openRecord(
                            record
                          )
                        }
                        disabled={
                          processing
                        }
                        className="min-w-0 text-left text-sm font-medium text-gray-900 hover:text-gray-600 disabled:cursor-not-allowed"
                      >
                        <span className="block truncate">
                          {record.title ||
                            "未命名记录"}
                        </span>
                      </button>

                      {/* =================================
                          Actions
                      ================================== */}

                      <div className="flex items-center justify-start gap-2 sm:justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            completeRecord(
                              record
                            )
                          }
                          disabled={
                            processing ||
                            processingId !==
                              null
                          }
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          完成事件
                        </button>

                        <button
                          type="button"
                          onClick={() =>
                            deleteRecord(
                              record
                            )
                          }
                          disabled={
                            processing ||
                            processingId !==
                              null
                          }
                          className="rounded-lg bg-red-500 px-3 py-1.5 text-xs text-white transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          删除
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </>
      )}
    </div>
  );
}

