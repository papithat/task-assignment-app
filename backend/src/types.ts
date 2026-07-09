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

/** Shape accepted when creating a task, allowing arbitrarily nested subtasks in one request. */
export interface CreateTaskInput {
  title: string;
  skillIds?: number[];
  subtasks?: CreateTaskInput[];
}
