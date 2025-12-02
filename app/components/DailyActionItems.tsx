"use client";

import { useCallback, useEffect, useState } from "react";

export type Task = {
  id: string;
  lead_id: string | null;
  agent_id: string | null;
  title: string;
  notes: string | null;
  due_at: string; // ISO string from Supabase
  is_completed: boolean;
  priority: "low" | "medium" | "high" | string;
  created_at: string;
};

type DailyActionItemsProps = {
  onTaskCompleted?: (taskId: string) => void;
};

export function DailyActionItems({ onTaskCompleted }: DailyActionItemsProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadDailyTasks = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/tasks/daily", {
        method: "GET",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || body.ok === false) {
        console.error("Failed to load daily tasks:", body.error);
        setTasks([]);
        return;
      }

      setTasks(body.tasks || []);
    } catch (err) {
      console.error("Error loading daily tasks:", err);
      setTasks([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDailyTasks();
  }, [loadDailyTasks]);

  async function handleMarkDone(taskId: string) {
    try {
      setRefreshing(true);
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ task_id: taskId }),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || body.ok === false) {
        console.error("Failed to complete task:", body.error);
        return;
      }

      // Update local list so it disappears immediately
      setTasks((prev) => prev.filter((t) => t.id !== taskId));

      if (onTaskCompleted) {
        onTaskCompleted(taskId);
      }
    } catch (err) {
      console.error("Error marking task done:", err);
    } finally {
      setRefreshing(false);
    }
  }

  function formatDue(due_at: string) {
    if (!due_at) return "";
    const d = new Date(due_at);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function priorityLabel(p: string | null | undefined) {
    const v = (p || "").toLowerCase();
    if (v === "high") return "HIGH";
    if (v === "medium") return "MEDIUM";
    return "LOW";
  }

  function priorityBadgeStyle(p: string | null | undefined) {
    const v = (p || "").toLowerCase();
    if (v === "high") {
      return {
        backgroundColor: "rgba(248, 113, 113, 0.15)",
        color: "#fecaca",
        border: "1px solid rgba(248, 113, 113, 0.4)",
      };
    }
    if (v === "medium") {
      return {
        backgroundColor: "rgba(251, 191, 36, 0.15)",
        color: "#facc15",
        border: "1px solid rgba(251, 191, 36, 0.4)",
      };
    }
    return {
      backgroundColor: "rgba(56, 189, 248, 0.15)",
      color: "#7dd3fc",
      border: "1px solid rgba(56, 189, 248, 0.4)",
    };
  }

  return (
    <section
      style={{
        padding: "1.25rem 1.5rem",
        borderRadius: "1rem",
        border: "1px solid #1f2937",
        marginTop: "1rem",
      }}
    >
      <div
        style={{
          marginBottom: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5rem",
        }}
      >
        <div>
          <h3
            style={{
              fontSize: "0.95rem",
              fontWeight: 500,
              marginBottom: "0.15rem",
            }}
          >
            Daily Action Items
          </h3>
          <p
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
            }}
          >
            Due today or overdue
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setRefreshing(true);
            loadDailyTasks();
          }}
          style={{
            fontSize: "0.75rem",
            padding: "0.3rem 0.75rem",
            borderRadius: "999px",
            border: "1px solid #374151",
            backgroundColor: "rgba(15,23,42,0.9)",
            cursor: "pointer",
            opacity: refreshing ? 0.6 : 1,
          }}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </div>

      {loading ? (
        <p
          style={{
            fontSize: "0.8rem",
            color: "#9ca3af",
          }}
        >
          Loading tasks…
        </p>
      ) : tasks.length === 0 ? (
        <p
          style={{
            fontSize: "0.8rem",
            color: "#9ca3af",
          }}
        >
          No tasks due today. You&apos;re all caught up. 🎉
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            margin: 0,
            padding: 0,
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          {tasks.map((task) => (
            <li
              key={task.id}
              style={{
                padding: "0.75rem 0.9rem",
                borderRadius: "0.75rem",
                border: "1px solid #1f2937",
                backgroundColor: "rgba(15,23,42,0.85)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "0.9rem",
                    marginBottom: "0.15rem",
                  }}
                >
                  {task.title}
                </div>
                <div
                  style={{
                    fontSize: "0.75rem",
                    color: "#9ca3af",
                  }}
                >
                  Due {formatDue(task.due_at)}
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    padding: "0.2rem 0.6rem",
                    borderRadius: "999px",
                    ...priorityBadgeStyle(task.priority),
                  }}
                >
                  {priorityLabel(task.priority)}
                </span>

                <button
                  type="button"
                  onClick={() => handleMarkDone(task.id)}
                  style={{
                    fontSize: "0.75rem",
                    padding: "0.35rem 0.9rem",
                    borderRadius: "999px",
                    border: "1px solid #374151",
                    backgroundColor: "rgba(22,163,74,0.9)",
                    cursor: "pointer",
                  }}
                >
                  Mark done
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
