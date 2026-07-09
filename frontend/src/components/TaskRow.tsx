import { Developer, TaskNode, TaskStatus } from "../types";

interface Props {
  task: TaskNode;
  depth: number;
  developers: Developer[];
  onAssign: (taskId: number, developerId: number | null) => void;
  onStatusChange: (taskId: number, status: TaskStatus) => void;
}

const STATUS_OPTIONS: TaskStatus[] = ["To-do", "In Progress", "Done"];

export default function TaskRow({ task, depth, developers, onAssign, onStatusChange }: Props) {
  const eligibleDevelopers = developers.filter((dev) => {
    const devSkillIds = new Set(dev.skills.map((s) => s.id));
    return task.skills.every((s) => devSkillIds.has(s.id));
  });

  return (
    <>
      <tr>
        <td style={{ paddingLeft: 10 + depth * 24 }}>
          {depth > 0 && <span style={{ color: "#999", marginRight: 6 }}>&#8627;</span>}
          {task.title}
        </td>
        <td>
          {task.skills.length === 0 ? (
            <span className="hint-text">None specified</span>
          ) : (
            task.skills.map((s) => (
              <span key={s.id} className="skill-badge">
                {s.name}
              </span>
            ))
          )}
        </td>
        <td>
          <select
            value={task.assignedDeveloperId ?? ""}
            onChange={(e) =>
              onAssign(task.id, e.target.value === "" ? null : Number(e.target.value))
            }
          >
            <option value="">Unassigned</option>
            {eligibleDevelopers.map((dev) => (
              <option key={dev.id} value={dev.id}>
                {dev.name}
              </option>
            ))}
          </select>
          {eligibleDevelopers.length === 0 && (
            <div className="hint-text">No developer has the required skill(s)</div>
          )}
        </td>
        <td>
          <select
            className={`status-select status-${task.status.replace(" ", "-")}`}
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value as TaskStatus)}
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </td>
      </tr>
      {task.subtasks.map((sub) => (
        <TaskRow
          key={sub.id}
          task={sub}
          depth={depth + 1}
          developers={developers}
          onAssign={onAssign}
          onStatusChange={onStatusChange}
        />
      ))}
    </>
  );
}
