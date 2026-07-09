import { useEffect, useState } from "react";
import { api } from "../api";
import { Developer, TaskNode, TaskStatus } from "../types";
import TaskRow from "../components/TaskRow";

export default function TaskListPage() {
  const [tasks, setTasks] = useState<TaskNode[]>([]);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [taskData, devData] = await Promise.all([api.getTasks(), api.getDevelopers()]);
      setTasks(taskData);
      setDevelopers(devData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleAssign(taskId: number, developerId: number | null) {
    setError(null);
    try {
      await api.assignDeveloper(taskId, developerId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to assign developer");
    }
  }

  async function handleStatusChange(taskId: number, status: TaskStatus) {
    setError(null);
    try {
      await api.updateStatus(taskId, status);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    }
  }

  return (
    <div>
      <h1>Task List</h1>
      {error && <div className="error-banner">{error}</div>}
      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : tasks.length === 0 ? (
          <p>No tasks yet. Create one from the "New Task" tab.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Task</th>
                <th>Skills</th>
                <th>Assignee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tasks.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  depth={0}
                  developers={developers}
                  onAssign={handleAssign}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
