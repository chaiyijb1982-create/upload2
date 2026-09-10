import { createClient } from "@supabase/supabase-js";

// =====================================================
// Supabase
// =====================================================

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// =====================================================
// 类型
// =====================================================

export type RecordItem = {
  id: string;
  title: string;
  content: Record<string, unknown>;

  // 整个事件是否已经结束
  completed: boolean;

  // 整个事件完成的时间
  completed_at: string | null;

  created_at: string;
  updated_at: string;
};

export type RecordTask = {
  id: string;
  record_id: string;
  title: string;

  // ===================================================
  // 任务执行条件
  //
  // 普通任务可以为空
  //
  // 例如：
  // "回本后卖出"
  // "达到目标价后处理"
  // "根据当时价格决定"
  // ===================================================
  condition: string | null;

  // ===================================================
  // 关联 Holding
  //
  // 普通任务可以为空
  //
  // holdings.id = bigint
  // 所以这里使用 number
  // ===================================================
  holding_id: number | null;

  completed: boolean;
  completed_at: string | null;
  sort_order: number;
  created_at: string;
};

export type RecordFile = {
  id: string;
  record_id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  created_at: string;
};

// =====================================================
// 常量
// =====================================================

const RECORD_FILES_BUCKET = "record-files";

// =====================================================
// 默认内容
// =====================================================

const DEFAULT_RECORD_CONTENT: Record<string, unknown> = {
  type: "doc",
  content: [
    {
      type: "paragraph",
    },
  ],
};

// =====================================================
// Records
// =====================================================

/**
 * 获取当前进行中的事件
 *
 * 首页使用这个函数。
 *
 * 只显示：
 * completed = false
 *
 * 最新修改的事件排最前面。
 */
export async function getActiveRecords(): Promise<RecordItem[]> {
  const { data, error } = await supabase
    .from("records")
    .select("*")
    .eq("completed", false)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getActiveRecords error:", error);
    throw new Error(`获取进行中记录失败：${error.message}`);
  }

  return (data ?? []) as RecordItem[];
}

/**
 * 获取所有记录
 *
 * 包括已经完成的历史事件。
 *
 * 后面“已完成事件”页面可以使用。
 */
export async function getRecords(): Promise<RecordItem[]> {
  const { data, error } = await supabase
    .from("records")
    .select("*")
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getRecords error:", error);
    throw new Error(`获取记录失败：${error.message}`);
  }

  return (data ?? []) as RecordItem[];
}

/**
 * 获取已完成的事件
 *
 * completed = true
 */
export async function getCompletedRecords(): Promise<RecordItem[]> {
  const { data, error } = await supabase
    .from("records")
    .select("*")
    .eq("completed", true)
    .order("completed_at", { ascending: false });

  if (error) {
    console.error("getCompletedRecords error:", error);
    throw new Error(`获取已完成记录失败：${error.message}`);
  }

  return (data ?? []) as RecordItem[];
}

/**
 * 获取单条记录
 */
export async function getRecord(
  id: string
): Promise<RecordItem | null> {
  const { data, error } = await supabase
    .from("records")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("getRecord error:", error);
    throw new Error(`获取记录失败：${error.message}`);
  }

  return data as RecordItem | null;
}

/**
 * 新建记录
 *
 * 新建以后：
 * completed = false
 */
export async function createRecord(
  title: string,
  content?: Record<string, unknown>
): Promise<RecordItem> {
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("记录标题不能为空");
  }

  const { data, error } = await supabase
    .from("records")
    .insert({
      title: cleanTitle,
      content: content ?? DEFAULT_RECORD_CONTENT,
      completed: false,
      completed_at: null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createRecord error:", error);
    throw new Error(`创建记录失败：${error.message}`);
  }

  return data as RecordItem;
}

/**
 * 修改记录
 *
 * 只要修改内容：
 * updated_at 就会更新。
 *
 * 注意：
 * 这里不会自动改变 completed 状态。
 */
export async function updateRecord(
  id: string,
  updates: {
    title?: string;
    content?: Record<string, unknown>;
  }
): Promise<RecordItem> {
  const payload: {
    title?: string;
    content?: Record<string, unknown>;
    updated_at: string;
  } = {
    updated_at: new Date().toISOString(),
  };

  if (updates.title !== undefined) {
    const cleanTitle = updates.title.trim();

    if (!cleanTitle) {
      throw new Error("记录标题不能为空");
    }

    payload.title = cleanTitle;
  }

  if (updates.content !== undefined) {
    payload.content = updates.content;
  }

  const { data, error } = await supabase
    .from("records")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("updateRecord error:", error);
    throw new Error(`保存记录失败：${error.message}`);
  }

  return data as RecordItem;
}

/**
 * 完成整个事件
 *
 * 完成以后：
 *
 * completed = true
 * completed_at = 当前时间
 *
 * 首页 getActiveRecords()
 * 就不会再显示这条事件。
 *
 * 注意：
 * 完成事件不会删除：
 * - 正文
 * - 任务
 * - 附件
 */
export async function completeRecord(
  id: string
): Promise<RecordItem> {
  const completedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("records")
    .update({
      completed: true,
      completed_at: completedAt,
      updated_at: completedAt,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("completeRecord error:", error);
    throw new Error(`完成事件失败：${error.message}`);
  }

  return data as RecordItem;
}

/**
 * 重新打开一个已经完成的事件
 *
 * 如果以后发现：
 * “这个事件其实还没结束”
 *
 * 可以重新打开。
 */
export async function reopenRecord(
  id: string
): Promise<RecordItem> {
  const updatedAt = new Date().toISOString();

  const { data, error } = await supabase
    .from("records")
    .update({
      completed: false,
      completed_at: null,
      updated_at: updatedAt,
    })
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("reopenRecord error:", error);
    throw new Error(`重新打开事件失败：${error.message}`);
  }

  return data as RecordItem;
}

/**
 * 删除整个事件
 *
 * 删除范围：
 *
 * 1. records
 *    - 标题删除
 *    - 正文 content 删除
 *    - 完成状态删除
 *    - 创建时间删除
 *    - 更新时间删除
 *
 * 2. record_tasks
 *    - 因为 ON DELETE CASCADE
 *      会随 records 自动删除
 *
 * 3. record_files
 *    - 因为 ON DELETE CASCADE
 *      会随 records 自动删除
 *
 * 4. Supabase Storage
 *    - 主动删除这个事件对应的所有实际附件文件
 *
 * 注意：
 *
 * 数据库的 ON DELETE CASCADE
 * 只负责数据库里的 record_tasks / record_files。
 *
 * Supabase Storage 不属于数据库级联，
 * 所以必须手动 remove。
 */
export async function deleteRecord(
  id: string
): Promise<void> {
  // =====================================================
  // 1. 查询这个事件的所有附件
  // =====================================================

  const { data: files, error: filesError } =
    await supabase
      .from("record_files")
      .select("id, file_path")
      .eq("record_id", id);

  if (filesError) {
    console.error(
      "deleteRecord get files error:",
      filesError
    );

    throw new Error(
      `获取事件附件失败：${filesError.message}`
    );
  }

  // =====================================================
  // 2. 删除 Supabase Storage 中的实际附件
  // =====================================================

  if (files && files.length > 0) {
    const filePaths = files
      .map((file) => file.file_path)
      .filter(
        (filePath): filePath is string =>
          typeof filePath === "string" &&
          filePath.trim().length > 0
      );

    if (filePaths.length > 0) {
      const { error: storageError } =
        await supabase.storage
          .from(RECORD_FILES_BUCKET)
          .remove(filePaths);

      if (storageError) {
        console.error(
          "deleteRecord storage error:",
          storageError
        );

        /**
         * Storage 删除失败时，
         * 不继续删除 records。
         *
         * 这样可以避免：
         *
         * records 已删除
         * 但 Storage 附件还残留
         */
        throw new Error(
          `删除事件附件失败：${storageError.message}`
        );
      }
    }
  }

  // =====================================================
  // 3. 删除 records
  // =====================================================

  const { error: recordError } =
    await supabase
      .from("records")
      .delete()
      .eq("id", id);

  if (recordError) {
    console.error(
      "deleteRecord error:",
      recordError
    );

    throw new Error(
      `删除记录失败：${recordError.message}`
    );
  }
}

// =====================================================
// Tasks
// =====================================================

/**
 * 获取某条记录的任务
 *
 * 按 sort_order 排列。
 * 如果 sort_order 相同，
 * 再按创建时间排列。
 *
 * 同时返回：
 *
 * condition
 * holding_id
 */
export async function getRecordTasks(
  recordId: string
): Promise<RecordTask[]> {
  const { data, error } = await supabase
    .from("record_tasks")
    .select("*")
    .eq("record_id", recordId)
    .order("sort_order", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `获取任务失败：${error.message}`
    );
  }

  return (data ?? []) as RecordTask[];
}

/**
 * 新增任务
 *
 * condition / holdingId 都是可选的。
 *
 * 普通任务：
 *
 * createRecordTask(
 *   recordId,
 *   "检查整体资产配置"
 * )
 *
 * 得到：
 *
 * condition = null
 * holding_id = null
 *
 * 资产任务：
 *
 * createRecordTask(
 *   recordId,
 *   "卖出日本基金",
 *   "回本后卖出",
 *   123
 * )
 *
 * 得到：
 *
 * condition = "回本后卖出"
 * holding_id = 123
 */
export async function createRecordTask(
  recordId: string,
  title: string,
  condition: string | null = null,
  holdingId: number | null = null
): Promise<RecordTask> {
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("任务名称不能为空");
  }

  // =====================================================
  // 清理 condition
  // =====================================================

  const cleanCondition =
    typeof condition === "string"
      ? condition.trim()
      : "";

  const normalizedCondition =
    cleanCondition.length > 0
      ? cleanCondition
      : null;

  // =====================================================
  // 清理 holdingId
  // =====================================================

  let normalizedHoldingId: number | null = null;

  if (holdingId !== null && holdingId !== undefined) {
    const numericHoldingId = Number(holdingId);

    if (!Number.isInteger(numericHoldingId)) {
      throw new Error("Holding ID 无效");
    }

    normalizedHoldingId = numericHoldingId;
  }

  // =====================================================
  // 如果没有 Holding，
  // 就没有必要保存条件关联
  //
  // 但这里不强制要求：
  // 因为以后可能存在：
  //
  // condition = "根据当时价格决定"
  // holding_id = null
  //
  // 所以 condition 可以独立存在。
  // =====================================================

  // =====================================================
  // 找当前最大的 sort_order
  // =====================================================

  const {
    data: lastTask,
    error: lastTaskError,
  } = await supabase
    .from("record_tasks")
    .select("sort_order")
    .eq("record_id", recordId)
    .order("sort_order", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (lastTaskError) {
    throw new Error(
      `获取任务顺序失败：${lastTaskError.message}`
    );
  }

  const nextSortOrder =
    typeof lastTask?.sort_order === "number"
      ? lastTask.sort_order + 1
      : 0;

  // =====================================================
  // 插入任务
  // =====================================================

  const { data, error } = await supabase
    .from("record_tasks")
    .insert({
      record_id: recordId,
      title: cleanTitle,

      // 新增
      condition: normalizedCondition,
      holding_id: normalizedHoldingId,

      completed: false,
      completed_at: null,
      sort_order: nextSortOrder,
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(
      `新增任务失败：${error.message}`
    );
  }

  return data as RecordTask;
}

/**
 * 修改任务
 *
 * 保持原来的调用方式：
 *
 * updateRecordTask(taskId, title)
 *
 * 同时支持：
 *
 * updateRecordTask(
 *   taskId,
 *   title,
 *   condition,
 *   holdingId
 * )
 *
 * 所以不会破坏现有代码。
 */
export async function updateRecordTask(
  taskId: string,
  title: string,
  condition?: string | null,
  holdingId?: number | null
): Promise<RecordTask> {
  const cleanTitle = title.trim();

  if (!cleanTitle) {
    throw new Error("任务名称不能为空");
  }

  const payload: {
    title: string;
    condition?: string | null;
    holding_id?: number | null;
  } = {
    title: cleanTitle,
  };

  // =====================================================
  // condition
  //
  // undefined：
  // 不修改原来的 condition
  //
  // null：
  // 清空 condition
  //
  // string：
  // 保存新的 condition
  // =====================================================

  if (condition !== undefined) {
    const cleanCondition =
      typeof condition === "string"
        ? condition.trim()
        : "";

    payload.condition =
      cleanCondition.length > 0
        ? cleanCondition
        : null;
  }

  // =====================================================
  // holding_id
  //
  // undefined：
  // 不修改
  //
  // null：
  // 清空关联 Holding
  //
  // number：
  // 设置 Holding
  // =====================================================

  if (holdingId !== undefined) {
    if (holdingId === null) {
      payload.holding_id = null;
    } else {
      const numericHoldingId =
        Number(holdingId);

      if (!Number.isInteger(numericHoldingId)) {
        throw new Error("Holding ID 无效");
      }

      payload.holding_id =
        numericHoldingId;
    }
  }

  const { data, error } = await supabase
    .from("record_tasks")
    .update(payload)
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    console.error(
      "updateRecordTask error:",
      error
    );

    throw new Error(
      `修改任务失败：${error.message}`
    );
  }

  return data as RecordTask;
}

/**
 * 完成 / 取消完成任务
 *
 * 完成：
 * completed = true
 * completed_at = 当前时间
 *
 * 取消：
 * completed = false
 * completed_at = null
 *
 * 页面显示规则：
 *
 * completed = false
 * → 正常颜色
 *
 * completed = true
 * → 灰色
 */
export async function setRecordTaskCompleted(
  taskId: string,
  completed: boolean
): Promise<RecordTask> {
  const completedAt = completed
    ? new Date().toISOString()
    : null;

  const { data, error } = await supabase
    .from("record_tasks")
    .update({
      completed,
      completed_at: completedAt,
    })
    .eq("id", taskId)
    .select("*")
    .single();

  if (error) {
    console.error(
      "setRecordTaskCompleted error:",
      error
    );

    throw new Error(
      `更新任务状态失败：${error.message}`
    );
  }

  return data as RecordTask;
}

/**
 * 调整任务顺序
 *
 * orderedTaskIds：
 * 当前记录下所有任务 ID，
 * 按页面最终显示顺序排列。
 */
export async function reorderRecordTasks(
  recordId: string,
  orderedTaskIds: string[]
): Promise<RecordTask[]> {
  if (!orderedTaskIds.length) {
    return getRecordTasks(recordId);
  }

  // =====================================================
  // 确认这些任务确实属于当前 record
  // =====================================================

  const {
    data: existingTasks,
    error: existingError,
  } = await supabase
    .from("record_tasks")
    .select("id")
    .eq("record_id", recordId);

  if (existingError) {
    throw new Error(
      `检查任务失败：${existingError.message}`
    );
  }

  const existingIds = new Set(
    (existingTasks ?? []).map(
      (task) => task.id
    )
  );

  // =====================================================
  // 确认数量一致
  // =====================================================

  if (
    orderedTaskIds.length !==
    existingIds.size
  ) {
    throw new Error(
      "任务顺序数据不完整"
    );
  }

  // =====================================================
  // 确认每一个任务 ID 都有效
  // =====================================================

  for (const taskId of orderedTaskIds) {
    if (!existingIds.has(taskId)) {
      throw new Error(
        "存在无效任务"
      );
    }
  }

  // =====================================================
  // 保存新的顺序
  // =====================================================

  for (
    let index = 0;
    index < orderedTaskIds.length;
    index++
  ) {
    const taskId =
      orderedTaskIds[index];

    const { error } = await supabase
      .from("record_tasks")
      .update({
        sort_order: index,
      })
      .eq("id", taskId)
      .eq("record_id", recordId);

    if (error) {
      throw new Error(
        `保存任务顺序失败：${error.message}`
      );
    }
  }

  // =====================================================
  // 调整任务顺序也算一次记录更新
  // =====================================================

  const { error: recordError } =
    await supabase
      .from("records")
      .update({
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", recordId);

  if (recordError) {
    throw new Error(
      `更新时间失败：${recordError.message}`
    );
  }

  return getRecordTasks(recordId);
}

/**
 * 删除任务
 */
export async function deleteRecordTask(
  taskId: string
): Promise<void> {
  const { error } = await supabase
    .from("record_tasks")
    .delete()
    .eq("id", taskId);

  if (error) {
    console.error(
      "deleteRecordTask error:",
      error
    );

    throw new Error(
      `删除任务失败：${error.message}`
    );
  }
}

// =====================================================
// Task Statistics
// =====================================================

/**
 * 获取任务完成进度
 *
 * 例如：
 *
 * total = 7
 * completed = 2
 *
 * 返回：
 * 2 / 7
 */
export async function getRecordTaskProgress(
  recordId: string
): Promise<{
  total: number;
  completed: number;
  remaining: number;
  percentage: number;
}> {
  const tasks =
    await getRecordTasks(recordId);

  const total = tasks.length;

  const completed = tasks.filter(
    (task) => task.completed
  ).length;

  const remaining =
    total - completed;

  const percentage =
    total === 0
      ? 0
      : Math.round(
          (completed / total) * 100
        );

  return {
    total,
    completed,
    remaining,
    percentage,
  };
}

// =====================================================
// Files
// =====================================================

/**
 * 获取某条记录的附件
 */
export async function getRecordFiles(
  recordId: string
): Promise<RecordFile[]> {
  const { data, error } = await supabase
    .from("record_files")
    .select("*")
    .eq("record_id", recordId)
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    console.error(
      "getRecordFiles error:",
      error
    );

    throw new Error(
      `获取附件失败：${error.message}`
    );
  }

  return (data ?? []) as RecordFile[];
}

/**
 * 上传附件
 *
 * Storage：
 *
 * record-files/
 *   recordId/
 *     时间-UUID.扩展名
 *
 * 数据库：
 *
 * record_files.file_name
 *   保存用户原始文件名
 *
 * record_files.file_path
 *   保存 Storage 实际路径
 */
export async function uploadRecordFile(
  recordId: string,
  file: File
): Promise<RecordFile> {
  // =====================================================
  // 1. 获取扩展名
  // =====================================================

  const extension =
    file.name.includes(".")
      ? file.name.substring(
          file.name.lastIndexOf(".")
        )
      : "";

  // =====================================================
  // 2. Storage 扩展名使用安全字符
  // =====================================================

  const safeExtension =
    extension
      .toLowerCase()
      .replace(
        /[^a-z0-9.]/g,
        ""
      );

  // =====================================================
  // 3. 生成安全 Storage 文件名
  //
  // 不再直接使用用户原始文件名，
  // 避免中文、特殊字符等造成 Storage key 问题。
  // =====================================================

  const safeFileName =
    `${Date.now()}-${crypto.randomUUID()}${safeExtension}`;

  const filePath =
    `${recordId}/${safeFileName}`;

  // =====================================================
  // 4. 上传到 Supabase Storage
  // =====================================================

  const {
    error: uploadError,
  } = await supabase.storage
    .from(RECORD_FILES_BUCKET)
    .upload(
      filePath,
      file,
      {
        contentType:
          file.type ||
          "application/octet-stream",
        upsert: false,
      }
    );

  if (uploadError) {
    console.error(
      "uploadRecordFile storage error:",
      uploadError
    );

    throw new Error(
      `上传文件失败：${uploadError.message}`
    );
  }

  // =====================================================
  // 5. 保存附件数据库记录
  // =====================================================

  const {
    data,
    error: dbError,
  } = await supabase
    .from("record_files")
    .insert({
      record_id: recordId,

      // 用户看到的原始文件名
      file_name: file.name,

      // Storage 的安全路径
      file_path: filePath,

      file_type:
        file.type || null,
    })
    .select("*")
    .single();

  if (dbError) {
    console.error(
      "uploadRecordFile database error:",
      dbError
    );

    // ===================================================
    // 数据库写入失败
    //
    // Storage 已经有文件，
    // 所以必须回滚 Storage 文件。
    // ===================================================

    await supabase.storage
      .from(RECORD_FILES_BUCKET)
      .remove([filePath]);

    throw new Error(
      `保存附件记录失败：${dbError.message}`
    );
  }

  return data as RecordFile;
}

/**
 * 获取 Private Storage 文件的临时 URL
 *
 * expiresIn 默认 1 小时。
 */
export async function getRecordFileUrl(
  filePath: string,
  expiresIn = 3600
): Promise<string> {
  const {
    data,
    error,
  } = await supabase.storage
    .from(RECORD_FILES_BUCKET)
    .createSignedUrl(
      filePath,
      expiresIn
    );

  if (error) {
    console.error(
      "getRecordFileUrl error:",
      error
    );

    throw new Error(
      `获取文件地址失败：${error.message}`
    );
  }

  return data.signedUrl;
}

/**
 * 删除单个附件
 *
 * 删除顺序：
 *
 * 1. 找到 file_path
 * 2. 删除 Storage 实际文件
 * 3. 删除 record_files 数据
 */
export async function deleteRecordFile(
  fileId: string
): Promise<void> {
  // =====================================================
  // 1. 先取得文件路径
  // =====================================================

  const {
    data: file,
    error: findError,
  } = await supabase
    .from("record_files")
    .select("file_path")
    .eq("id", fileId)
    .single();

  if (findError) {
    console.error(
      "deleteRecordFile find error:",
      findError
    );

    throw new Error(
      `查找附件失败：${findError.message}`
    );
  }

  // =====================================================
  // 2. 删除 Storage 文件
  // =====================================================

  const {
    error: storageError,
  } = await supabase.storage
    .from(RECORD_FILES_BUCKET)
    .remove([
      file.file_path,
    ]);

  if (storageError) {
    console.error(
      "deleteRecordFile storage error:",
      storageError
    );

    throw new Error(
      `删除文件失败：${storageError.message}`
    );
  }

  // =====================================================
  // 3. 删除数据库附件记录
  // =====================================================

  const {
    error: dbError,
  } = await supabase
    .from("record_files")
    .delete()
    .eq("id", fileId);

  if (dbError) {
    console.error(
      "deleteRecordFile database error:",
      dbError
    );

    throw new Error(
      `删除附件记录失败：${dbError.message}`
    );
  }
}