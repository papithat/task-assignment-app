export type TaskStatus = "To-do" | "In Progress" | "Done";

export interface Skill {
  id: number;
  name: string;
}

export interface Developer {
  id: number;
  name: string;
  skills: Skill[];
}

export interface TaskNode {
  id: number;
  title: string;
  status: TaskStatus;
  parentTaskId: number | null;
  assignedDeveloperId: number | null;
  skills: Skill[];
  subtasks: TaskNode[];
}

/** Draft shape used only in the Task Creation form, before submission. */
export interface TaskDraft {
  title: string;
  skillIds: number[];
  subtasks: TaskDraft[];
}

export interface CreateTaskInput {
  title: string;
  skillIds?: number[];
  subtasks?: CreateTaskInput[];
}
