import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { CreateTaskInput, Skill, TaskDraft } from "../types";
import SubtaskForm from "../components/SubtaskForm";

function emptyDraft(): TaskDraft {
  return { title: "", skillIds: [], subtasks: [] };
}

function toCreateInput(draft: TaskDraft): CreateTaskInput {
  return {
    title: draft.title.trim(),
    skillIds: draft.skillIds,
    subtasks: draft.subtasks.map(toCreateInput),
  };
}

function validateDraft(draft: TaskDraft): string | null {
  if (draft.title.trim().length === 0) return "Every task and subtask needs a title.";
  for (const sub of draft.subtasks) {
    const err = validateDraft(sub);
    if (err) return err;
  }
  return null;
}

export default function TaskCreationPage() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [draft, setDraft] = useState<TaskDraft>(emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    api.getSkills().then(setSkills).catch(() => setError("Failed to load skills"));
  }, []);

  async function handleSave() {
    setError(null);
    setSuccess(null);

    const validationError = validateDraft(draft);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    try {
      await api.createTask(toCreateInput(draft));
      setSuccess("Task created successfully.");
      setDraft(emptyDraft());
      setTimeout(() => navigate("/"), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create task");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h1>Create Task</h1>
      {error && <div className="error-banner">{error}</div>}
      {success && <div className="success-banner">{success}</div>}
      <div className="card">
        <SubtaskForm draft={draft} skills={skills} depth={0} label="New Task" onChange={setDraft} />

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20 }}>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
