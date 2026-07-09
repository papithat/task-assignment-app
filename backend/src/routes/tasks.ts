import { Router } from "express";
import {
  assignDeveloper,
  createTask,
  getAllTasks,
  getTaskById,
  TaskUpdateError,
  updateTaskStatus,
} from "../services/taskService";
import { CreateTaskInput } from "../types";

export const tasksRouter = Router();

function validateCreateInput(body: unknown): body is CreateTaskInput {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.title !== "string" || b.title.trim().length === 0) return false;
  if (b.skillIds !== undefined && !Array.isArray(b.skillIds)) return false;
  if (b.subtasks !== undefined) {
    if (!Array.isArray(b.subtasks)) return false;
    return b.subtasks.every((s) => validateCreateInput(s));
  }
  return true;
}

// POST /api/tasks - create a task, optionally with nested subtasks.
// If skillIds is omitted (or empty) for a node, the backend uses an LLM
// to auto-classify the required skill(s) from the title.
tasksRouter.post("/", async (req, res) => {
  const body = req.body;
  if (!validateCreateInput(body)) {
    return res.status(400).json({
      error:
        "Invalid request body. Expected { title: string, skillIds?: number[], subtasks?: [...] }",
    });
  }

  try {
    const task = await createTask(body);
    res.status(201).json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create task" });
  }
});

// GET /api/tasks - list all top-level tasks with nested subtasks
tasksRouter.get("/", async (_req, res) => {
  try {
    const tasks = await getAllTasks();
    res.json(tasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch tasks" });
  }
});

// GET /api/tasks/:id - a single task (with its subtask tree)
tasksRouter.get("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid task id" });

  try {
    const task = await getTaskById(id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    res.json(task);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch task" });
  }
});

// PATCH /api/tasks/:id - update assignedDeveloperId and/or status
tasksRouter.patch("/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid task id" });

  const { assignedDeveloperId, status } = req.body ?? {};

  try {
    let task = await getTaskById(id);
    if (!task) return res.status(404).json({ error: "Task not found" });

    if (assignedDeveloperId !== undefined) {
      if (assignedDeveloperId !== null && !Number.isInteger(assignedDeveloperId)) {
        return res.status(400).json({ error: "assignedDeveloperId must be an integer or null" });
      }
      task = await assignDeveloper(id, assignedDeveloperId);
    }

    if (status !== undefined) {
      if (!["To-do", "In Progress", "Done"].includes(status)) {
        return res.status(400).json({ error: "Invalid status value" });
      }
      task = await updateTaskStatus(id, status);
    }

    res.json(task);
  } catch (err) {
    if (err instanceof TaskUpdateError) {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Failed to update task" });
  }
});
