// lib/tasks.ts
import { supabase } from "../lib/supabaseClient";

export type TaskPriority = "low" | "medium" | "high";

export type Task = {
  id: string;
  lead_id: string;
  agent_id: string;
  title: string;
  due_at: string;
  is_completed: boolean;
  priority: TaskPriority | null;
  created_at: string;
};

// This function gets the urgent tasks for the logged-in agent
export async function getDailyActionItems(): Promise<Task[]> {
  // 1) Get the current user's session
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError || !session) {
    throw new Error("Not authenticated");
  }

  const agentId = session.user.id;

  // 2) Calculate "one hour from now"
  const now = new Date();
  const oneHourLater = new Date(now.getTime() + 60 * 60 * 1000);

  // 3) Query Supabase: tasks for this agent, not completed, due within 1 hour
  const { data, error } = await supabase
    .from("tasks")
    .select("*")
    .eq("agent_id", agentId)
    .eq("is_completed", false)
    .lte("due_at", oneHourLater.toISOString())
    .order("due_at", { ascending: true });

  if (error) {
    console.error("getDailyActionItems error:", error);
    throw error;
  }

  return (data || []) as Task[];
}
