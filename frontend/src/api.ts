import { CreateTaskInput, Developer, Skill, TaskNode, TaskStatus } from "./types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:4000/api";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed with status ${res.status}`);
  }
  return res.json();
}

export const api = {
  getTasks: () => request<TaskNode[]>("/tasks"),
  createTask: (input: CreateTaskInput) =>
    request<TaskNode>("/tasks", { method: "POST", body: JSON.stringify(input) }),
  assignDeveloper: (taskId: number, assignedDeveloperId: number | null) =>
    request<TaskNode>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ assignedDeveloperId }),
    }),
  updateStatus: (taskId: number, status: TaskStatus) =>
    request<TaskNode>(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    }),
  getDevelopers: () => request<Developer[]>("/developers"),
  getSkills: () => request<Skill[]>("/skills"),
};
