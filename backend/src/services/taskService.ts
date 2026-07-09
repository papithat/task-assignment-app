import { PoolClient } from "pg";
import { pool } from "../db/pool";
import { classifySkillsForTitle } from "./llmSkillClassifier";
import { CreateTaskInput, Developer, Skill, TaskNode, TaskStatus } from "../types";

async function getSkillIdsByName(client: PoolClient, names: string[]): Promise<number[]> {
  if (names.length === 0) return [];
  const { rows } = await client.query(
    `SELECT id FROM skills WHERE name = ANY($1::text[])`,
    [names]
  );
  return rows.map((r) => r.id);
}

/**
 * Recursively inserts a task (and any nested subtasks) inside an existing transaction.
 * If no skillIds are supplied for a given node, the LLM classifier is used to
 * automatically determine the required skill(s) from the title.
 */
async function insertTaskRecursive(
  client: PoolClient,
  input: CreateTaskInput,
  parentTaskId: number | null
): Promise<number> {
  let skillIds = input.skillIds ?? [];

  if (skillIds.length === 0) {
    const classifiedNames = await classifySkillsForTitle(input.title);
    skillIds = await getSkillIdsByName(client, classifiedNames);
  }

  const insertResult = await client.query(
    `INSERT INTO tasks (title, status, parent_task_id) VALUES ($1, 'To-do', $2) RETURNING id`,
    [input.title, parentTaskId]
  );
  const taskId: number = insertResult.rows[0].id;

  for (const skillId of skillIds) {
    await client.query(
      `INSERT INTO task_skills (task_id, skill_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [taskId, skillId]
    );
  }

  for (const subtask of input.subtasks ?? []) {
    await insertTaskRecursive(client, subtask, taskId);
  }

  return taskId;
}

export async function createTask(input: CreateTaskInput): Promise<TaskNode> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const taskId = await insertTaskRecursive(client, input, null);
    await client.query("COMMIT");
    const task = await getTaskById(taskId);
    if (!task) throw new Error("Failed to load created task");
    return task;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

interface FlatTaskRow {
  id: number;
  title: string;
  status: TaskStatus;
  parent_task_id: number | null;
  assigned_developer_id: number | null;
}

async function fetchSkillsForTasks(taskIds: number[]): Promise<Map<number, Skill[]>> {
  const map = new Map<number, Skill[]>();
  if (taskIds.length === 0) return map;

  const { rows } = await pool.query(
    `SELECT ts.task_id, s.id, s.name
     FROM task_skills ts
     JOIN skills s ON s.id = ts.skill_id
     WHERE ts.task_id = ANY($1::int[])
     ORDER BY s.name`,
    [taskIds]
  );

  for (const row of rows) {
    const list = map.get(row.task_id) ?? [];
    list.push({ id: row.id, name: row.name });
    map.set(row.task_id, list);
  }
  return map;
}

function buildTree(flatRows: FlatTaskRow[], skillsMap: Map<number, Skill[]>): TaskNode[] {
  const nodeById = new Map<number, TaskNode>();

  for (const row of flatRows) {
    nodeById.set(row.id, {
      id: row.id,
      title: row.title,
      status: row.status,
      parentTaskId: row.parent_task_id,
      assignedDeveloperId: row.assigned_developer_id,
      skills: skillsMap.get(row.id) ?? [],
      subtasks: [],
    });
  }

  const roots: TaskNode[] = [];
  for (const row of flatRows) {
    const node = nodeById.get(row.id)!;
    const parent = row.parent_task_id !== null ? nodeById.get(row.parent_task_id) : undefined;
    if (parent) {
      // Parent is part of this fetched set, so nest under it.
      parent.subtasks.push(node);
    } else {
      // Either a true top-level task (parent_task_id is null), or the top
      // of a partial fetch (e.g. getTaskById on a subtask) whose parent
      // wasn't included in this row set — either way, it's a root here.
      roots.push(node);
    }
  }
  return roots;
}

/** Returns all top-level tasks with their full nested subtask trees. */
export async function getAllTasks(): Promise<TaskNode[]> {
  const { rows } = await pool.query<FlatTaskRow>(
    `SELECT id, title, status, parent_task_id, assigned_developer_id
     FROM tasks
     ORDER BY id`
  );
  const skillsMap = await fetchSkillsForTasks(rows.map((r) => r.id));
  return buildTree(rows, skillsMap);
}

/** Returns a single task and all of its descendant subtasks as a tree. */
export async function getTaskById(taskId: number): Promise<TaskNode | null> {
  const { rows } = await pool.query<FlatTaskRow>(
    `WITH RECURSIVE descendants AS (
       SELECT id, title, status, parent_task_id, assigned_developer_id
       FROM tasks WHERE id = $1
       UNION ALL
       SELECT t.id, t.title, t.status, t.parent_task_id, t.assigned_developer_id
       FROM tasks t
       JOIN descendants d ON t.parent_task_id = d.id
     )
     SELECT * FROM descendants ORDER BY id`,
    [taskId]
  );

  if (rows.length === 0) return null;

  const skillsMap = await fetchSkillsForTasks(rows.map((r) => r.id));
  const tree = buildTree(rows, skillsMap);
  return tree.find((t) => t.id === taskId) ?? tree[0] ?? null;
}

export class TaskUpdateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TaskUpdateError";
  }
}

async function getDeveloperSkillIds(developerId: number): Promise<Set<number>> {
  const { rows } = await pool.query(
    `SELECT skill_id FROM developer_skills WHERE developer_id = $1`,
    [developerId]
  );
  return new Set(rows.map((r) => r.skill_id));
}

async function getTaskSkillIds(taskId: number): Promise<number[]> {
  const { rows } = await pool.query(
    `SELECT skill_id FROM task_skills WHERE task_id = $1`,
    [taskId]
  );
  return rows.map((r) => r.skill_id);
}

/** Assigns a task to a developer, enforcing that the developer has all required skills. */
export async function assignDeveloper(taskId: number, developerId: number | null): Promise<TaskNode> {
  if (developerId !== null) {
    const devCheck = await pool.query(`SELECT id FROM developers WHERE id = $1`, [developerId]);
    if (devCheck.rows.length === 0) {
      throw new TaskUpdateError(`Developer ${developerId} does not exist`);
    }

    const requiredSkillIds = await getTaskSkillIds(taskId);
    const developerSkillIds = await getDeveloperSkillIds(developerId);
    const missing = requiredSkillIds.filter((id) => !developerSkillIds.has(id));

    if (missing.length > 0) {
      throw new TaskUpdateError(
        "Developer does not have all the skill(s) required by this task"
      );
    }
  }

  await pool.query(
    `UPDATE tasks SET assigned_developer_id = $1, updated_at = now() WHERE id = $2`,
    [developerId, taskId]
  );

  const task = await getTaskById(taskId);
  if (!task) throw new TaskUpdateError("Task not found after update");
  return task;
}

/**
 * Updates a task's status. A task can only be moved to "Done" if ALL of its
 * direct subtasks already have a status of "Done" (subtasks are checked
 * recursively, since a subtask may itself have subtasks).
 */
export async function updateTaskStatus(taskId: number, status: TaskStatus): Promise<TaskNode> {
  if (status === "Done") {
    const { rows } = await pool.query(
      `WITH RECURSIVE descendants AS (
         SELECT id, status FROM tasks WHERE parent_task_id = $1
         UNION ALL
         SELECT t.id, t.status FROM tasks t
         JOIN descendants d ON t.parent_task_id = d.id
       )
       SELECT id, status FROM descendants`,
      [taskId]
    );

    const incomplete = rows.filter((r) => r.status !== "Done");
    if (incomplete.length > 0) {
      throw new TaskUpdateError(
        "Cannot mark this task as Done: it has subtask(s) that are not yet Done"
      );
    }
  }

  await pool.query(
    `UPDATE tasks SET status = $1, updated_at = now() WHERE id = $2`,
    [status, taskId]
  );

  const task = await getTaskById(taskId);
  if (!task) throw new TaskUpdateError("Task not found after update");
  return task;
}

export async function getAllDevelopers(): Promise<Developer[]> {
  const { rows: devRows } = await pool.query(
    `SELECT id, name FROM developers ORDER BY id`
  );

  const { rows: skillRows } = await pool.query(
    `SELECT ds.developer_id, s.id, s.name
     FROM developer_skills ds
     JOIN skills s ON s.id = ds.skill_id
     ORDER BY s.name`
  );

  const skillsByDev = new Map<number, Skill[]>();
  for (const row of skillRows) {
    const list = skillsByDev.get(row.developer_id) ?? [];
    list.push({ id: row.id, name: row.name });
    skillsByDev.set(row.developer_id, list);
  }

  return devRows.map((d) => ({
    id: d.id,
    name: d.name,
    skills: skillsByDev.get(d.id) ?? [],
  }));
}

export async function getAllSkills(): Promise<Skill[]> {
  const { rows } = await pool.query(`SELECT id, name FROM skills ORDER BY id`);
  return rows;
}
