import { supabase } from "@/lib/supabase";

// =====================================================
// Types
// =====================================================

export type AiCfoInvestmentPlan = {
  id: string;
  plan_name: string;
  currency: string;
  planned_amount: number;
  interval_months: number;
  assets: string[];
  allow_batch: boolean;
  max_batches: number | null;
  current_cycle_start: string | null;
  next_cycle_date: string | null;
  status: "active" | "paused" | "completed";
  remark: string | null;
  created_at: string;
  updated_at: string;
};

export type AiCfoTaskStatus =
  | "pending_ai"
  | "waiting"
  | "in_progress"
  | "completed"
  | "cancelled";

export type AiCfoTask = {
  id: string;
  plan_id: string | null;
  task_type: string;
  title: string;
  planned_amount: number;
  invested_amount: number;
  remaining_amount: number;
  currency: string;
  status: AiCfoTaskStatus;
  needs_ai_decision: boolean;
  start_date: string;
  completed_at: string | null;
  remark: string | null;
  created_at: string;
  updated_at: string;
};

export type AiCfoDecisionAction = "buy" | "wait" | "hold";

export type AiCfoExecutionStatus =
  | "pending"
  | "executed"
  | "partial"
  | "skipped";

export type AiCfoDecision = {
  id: string;
  task_id: string;
  plan_id: string | null;
  decision_date: string;
  decision_type: string;
  action: AiCfoDecisionAction;
  recommended_assets: string[];
  recommended_amount: number | null;
  recommended_shares: Record<string, number> | null;
  recommend_batch: boolean | null;
  decision_text: string;
  asset_snapshot: Record<string, unknown> | null;
  market_snapshot: Record<string, unknown> | null;
  holding_snapshot: Record<string, unknown> | null;
  execution_status: AiCfoExecutionStatus;
  executed_amount: number | null;
  execution_text: string | null;
  executed_at: string | null;
  created_at: string;
};

export type AiCfoCreateTaskInput = {
  plan_id?: string | null;
  title: string;
  planned_amount: number;
  currency?: string;
  start_date?: string;
  remark?: string | null;
};

export type AiCfoCreateDecisionInput = {
  task_id: string;
  plan_id?: string | null;
  action: AiCfoDecisionAction;
  recommended_assets?: string[];
  recommended_amount?: number | null;
  recommended_shares?: Record<string, number> | null;
  recommend_batch?: boolean | null;
  decision_text: string;
  asset_snapshot?: Record<string, unknown> | null;
  market_snapshot?: Record<string, unknown> | null;
  holding_snapshot?: Record<string, unknown> | null;
};

// =====================================================
// Helpers
// =====================================================

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function normalizePlan(row: any): AiCfoInvestmentPlan {
  return {
    ...row,
    planned_amount: Number(row.planned_amount ?? 0),
    interval_months: Number(row.interval_months ?? 0),
    assets: Array.isArray(row.assets) ? row.assets : [],
    allow_batch: Boolean(row.allow_batch),
    max_batches:
      row.max_batches === null || row.max_batches === undefined
        ? null
        : Number(row.max_batches),
  };
}

function normalizeTask(row: any): AiCfoTask {
  return {
    ...row,
    planned_amount: Number(row.planned_amount ?? 0),
    invested_amount: Number(row.invested_amount ?? 0),
    remaining_amount: Number(row.remaining_amount ?? 0),
    needs_ai_decision: Boolean(row.needs_ai_decision),
  };
}

function normalizeDecision(row: any): AiCfoDecision {
  return {
    ...row,
    recommended_amount:
      row.recommended_amount === null ||
      row.recommended_amount === undefined
        ? null
        : Number(row.recommended_amount),

    recommended_assets: Array.isArray(row.recommended_assets)
      ? row.recommended_assets
      : [],

    recommended_shares:
      row.recommended_shares &&
      typeof row.recommended_shares === "object"
        ? row.recommended_shares
        : null,

    recommend_batch:
      row.recommend_batch === null ||
      row.recommend_batch === undefined
        ? null
        : Boolean(row.recommend_batch),

    executed_amount:
      row.executed_amount === null ||
      row.executed_amount === undefined
        ? null
        : Number(row.executed_amount),
  };
}

// =====================================================
// Plans
// =====================================================

export async function getActiveAiCfoPlan(): Promise<AiCfoInvestmentPlan | null> {
  const { data, error } = await supabase
    .from("ai_cfo_investment_plans")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getActiveAiCfoPlan:", error);
    throw error;
  }

  return data ? normalizePlan(data) : null;
}

export async function getAiCfoPlans(): Promise<AiCfoInvestmentPlan[]> {
  const { data, error } = await supabase
    .from("ai_cfo_investment_plans")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAiCfoPlans:", error);
    throw error;
  }

  return (data ?? []).map(normalizePlan);
}

export async function updateAiCfoPlan(
  id: string,
  patch: Partial<
    Pick<
      AiCfoInvestmentPlan,
      | "plan_name"
      | "planned_amount"
      | "interval_months"
      | "assets"
      | "allow_batch"
      | "max_batches"
      | "current_cycle_start"
      | "next_cycle_date"
      | "status"
      | "remark"
    >
  >,
) {
  const { data, error } = await supabase
    .from("ai_cfo_investment_plans")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("updateAiCfoPlan:", error);
    throw error;
  }

  return normalizePlan(data);
}

// =====================================================
// Tasks
// =====================================================

export async function getAiCfoTasks(): Promise<AiCfoTask[]> {
  const { data, error } = await supabase
    .from("ai_cfo_tasks")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAiCfoTasks:", error);
    throw error;
  }

  return (data ?? []).map(normalizeTask);
}

export async function getOpenAiCfoTask(): Promise<AiCfoTask | null> {
  const { data, error } = await supabase
    .from("ai_cfo_tasks")
    .select("*")
    .in("status", ["pending_ai", "waiting", "in_progress"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("getOpenAiCfoTask:", error);
    throw error;
  }

  return data ? normalizeTask(data) : null;
}

export async function createAiCfoTask(
  input: AiCfoCreateTaskInput,
): Promise<AiCfoTask> {
  const amount = Number(input.planned_amount);

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("投资任务金额必须大于 0");
  }

  const { data, error } = await supabase
    .from("ai_cfo_tasks")
    .insert({
      plan_id: input.plan_id ?? null,
      task_type: "investment",
      title: input.title,
      planned_amount: amount,
      invested_amount: 0,
      remaining_amount: amount,
      currency: input.currency ?? "USD",
      status: "pending_ai",
      needs_ai_decision: true,
      start_date: input.start_date ?? todayString(),
      remark: input.remark ?? null,
    })
    .select("*")
    .single();

  if (error) {
    console.error("createAiCfoTask:", error);
    throw error;
  }

  return normalizeTask(data);
}

export async function updateAiCfoTask(
  id: string,
  patch: Partial<
    Pick<
      AiCfoTask,
      | "title"
      | "planned_amount"
      | "invested_amount"
      | "remaining_amount"
      | "status"
      | "needs_ai_decision"
      | "completed_at"
      | "remark"
    >
  >,
) {
  const { data, error } = await supabase
    .from("ai_cfo_tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if (error) {
    console.error("updateAiCfoTask:", error);
    throw error;
  }

  return normalizeTask(data);
}

// =====================================================
// Decisions
// =====================================================

export async function getAiCfoDecisions(
  limit = 30,
): Promise<AiCfoDecision[]> {
  const { data, error } = await supabase
    .from("ai_cfo_decisions")
    .select("*")
    .order("decision_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("getAiCfoDecisions:", error);
    throw error;
  }

  return (data ?? []).map(normalizeDecision);
}

export async function getAiCfoTaskDecisions(
  taskId: string,
): Promise<AiCfoDecision[]> {
  const { data, error } = await supabase
    .from("ai_cfo_decisions")
    .select("*")
    .eq("task_id", taskId)
    .order("decision_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("getAiCfoTaskDecisions:", error);
    throw error;
  }

  return (data ?? []).map(normalizeDecision);
}

export async function createAiCfoDecision(
  input: AiCfoCreateDecisionInput,
): Promise<AiCfoDecision> {
  const { data, error } = await supabase
    .from("ai_cfo_decisions")
    .insert({
      task_id: input.task_id,
      plan_id: input.plan_id ?? null,
      decision_date: todayString(),
      decision_type: "decision",
      action: input.action,
      recommended_assets: input.recommended_assets ?? [],
      recommended_amount: input.recommended_amount ?? null,
      recommended_shares: input.recommended_shares ?? null,
      recommend_batch: input.recommend_batch ?? null,
      decision_text: input.decision_text,
      asset_snapshot: input.asset_snapshot ?? null,
      market_snapshot: input.market_snapshot ?? null,
      holding_snapshot: input.holding_snapshot ?? null,
      execution_status: "pending",
    })
    .select("*")
    .single();

  if (error) {
    console.error("createAiCfoDecision:", error);
    throw error;
  }

  return normalizeDecision(data);
}

// =====================================================
// Execution result
// =====================================================

export async function recordAiCfoExecution(
  decisionId: string,
  input: {
    executionStatus: AiCfoExecutionStatus;
    executedAmount?: number | null;
    executionText?: string | null;
    executedAt?: string | null;
  },
) {
  const executedAmount =
    input.executedAmount === undefined ||
    input.executedAmount === null
      ? null
      : Number(input.executedAmount);

  const { data: decision, error: decisionError } = await supabase
    .from("ai_cfo_decisions")
    .update({
      execution_status: input.executionStatus,
      executed_amount: executedAmount,
      execution_text: input.executionText ?? null,
      executed_at:
        input.executedAt ??
        (input.executionStatus === "pending"
          ? null
          : new Date().toISOString()),
    })
    .eq("id", decisionId)
    .select("*")
    .single();

  if (decisionError) {
    console.error("recordAiCfoExecution decision:", decisionError);
    throw decisionError;
  }

  const taskId = decision.task_id;

  const { data: decisions, error: listError } = await supabase
    .from("ai_cfo_decisions")
    .select("execution_status, executed_amount")
    .eq("task_id", taskId);

  if (listError) {
    console.error("recordAiCfoExecution list:", listError);
    throw listError;
  }

  const investedAmount = (decisions ?? []).reduce(
    (sum: number, row: any) =>
      sum +
      (row.execution_status === "executed" ||
      row.execution_status === "partial"
        ? Number(row.executed_amount ?? 0)
        : 0),
    0,
  );

  const { data: task, error: taskError } = await supabase
    .from("ai_cfo_tasks")
    .select("*")
    .eq("id", taskId)
    .single();

  if (taskError) {
    console.error("recordAiCfoExecution task:", taskError);
    throw taskError;
  }

  const plannedAmount = Number(task.planned_amount ?? 0);

  const remainingAmount = Math.max(
    0,
    plannedAmount - investedAmount,
  );

  let status: AiCfoTaskStatus = "in_progress";

  if (remainingAmount <= 0.01) {
    status = "completed";
  } else if (input.executionStatus === "skipped") {
    status = "waiting";
  } else {
    status = "in_progress";
  }

  const updatedTask = await updateAiCfoTask(taskId, {
    invested_amount: investedAmount,
    remaining_amount: remainingAmount,
    status,
    needs_ai_decision: remainingAmount > 0.01,
    completed_at:
      status === "completed" ? new Date().toISOString() : null,
  });

  return {
    decision: normalizeDecision(decision),
    task: updatedTask,
  };
}