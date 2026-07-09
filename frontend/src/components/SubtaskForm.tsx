import { Skill, TaskDraft } from "../types";

interface Props {
  draft: TaskDraft;
  skills: Skill[];
  depth: number;
  onChange: (updated: TaskDraft) => void;
  onRemove?: () => void;
  label: string;
}

function emptyDraft(): TaskDraft {
  return { title: "", skillIds: [], subtasks: [] };
}

export default function SubtaskForm({ draft, skills, depth, onChange, onRemove, label }: Props) {
  function updateTitle(title: string) {
    onChange({ ...draft, title });
  }

  function toggleSkill(skillId: number) {
    const has = draft.skillIds.includes(skillId);
    const skillIds = has ? draft.skillIds.filter((id) => id !== skillId) : [...draft.skillIds, skillId];
    onChange({ ...draft, skillIds });
  }

  function addSubtask() {
    onChange({ ...draft, subtasks: [...draft.subtasks, emptyDraft()] });
  }

  function updateSubtask(index: number, updated: TaskDraft) {
    const subtasks = [...draft.subtasks];
    subtasks[index] = updated;
    onChange({ ...draft, subtasks });
  }

  function removeSubtask(index: number) {
    onChange({ ...draft, subtasks: draft.subtasks.filter((_, i) => i !== index) });
  }

  return (
    <div className={depth > 0 ? "subtask-block subtask-nested" : "subtask-block"}>
      <div className="subtask-header">
        <strong>{label}</strong>
        {onRemove && (
          <button type="button" className="btn-danger" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Title</label>
        <textarea
          rows={2}
          value={draft.title}
          onChange={(e) => updateTitle(e.target.value)}
          placeholder='e.g. "As a visitor, I want to see a responsive homepage..."'
        />
      </div>

      <div className="form-group">
        <label className="form-label">Skill(s) Required</label>
        <div className="checkbox-row">
          {skills.map((skill) => (
            <label key={skill.id}>
              <input
                type="checkbox"
                checked={draft.skillIds.includes(skill.id)}
                onChange={() => toggleSkill(skill.id)}
              />
              {skill.name}
            </label>
          ))}
        </div>
        <div className="hint-text">
          Leave unchecked to let the LLM automatically determine the required skill(s) from the title.
        </div>
      </div>

      {draft.subtasks.map((sub, index) => (
        <SubtaskForm
          key={index}
          draft={sub}
          skills={skills}
          depth={depth + 1}
          label={`Subtask ${index + 1}`}
          onChange={(updated) => updateSubtask(index, updated)}
          onRemove={() => removeSubtask(index)}
        />
      ))}

      <div style={{ marginTop: 10 }}>
        <button type="button" className="btn-secondary" onClick={addSubtask}>
          + Add Subtask
        </button>
      </div>
    </div>
  );
}
