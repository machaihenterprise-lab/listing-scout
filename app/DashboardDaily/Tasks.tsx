// app/DashboardDailyTasks.tsx
"use client";

import { useEffect, useState } from "react";
import { getDailyActionItems, type Task } from "../lib/tasks";

export function DashboardDailyTasks() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function load() {
      try {
        const items = await getDailyActionItems();
        if (isMounted) setTasks(items);
      } catch (err) {
        console.error(err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    load();

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading) {
    return <div>Loading daily action items...</div>;
  }

  if (tasks.length === 0) {
    return <div>No urgent tasks in the next hour. 🎉</div>;
  }

  return (
    <div className="space-y-2">
      <h2 className="font-semibold text-lg">Daily Action Items</h2>
      <ul className="space-y-1">
        {tasks.map((task) => (
          <li
            key={task.id}
            className="border rounded p-2 flex flex-col text-sm"
          >
            <span className="font-medium">{task.title}</span>
            <span>
              Due:{" "}
              {new Date(task.due_at).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })}
            </span>
            <span className="text-xs opacity-70">
              Priority: {task.priority ?? "medium"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
