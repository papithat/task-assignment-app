/**
 * Classifies the required Skill(s) for a Task based on its title, using an LLM.
 *
 * Uses Gemini (free tier) via the generative language REST API when GEMINI_API_KEY
 * is configured. If no key is set, falls back to a simple keyword heuristic so the
 * app remains fully functional out of the box without any external dependency.
 */

import { resolveSecretEnv } from "../secrets";

resolveSecretEnv("GEMINI_API_KEY");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY?.trim();
const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash";

const VALID_SKILLS = ["Frontend", "Backend"] as const;
type ValidSkill = (typeof VALID_SKILLS)[number];

function keywordFallbackClassify(title: string): ValidSkill[] {
  const text = title.toLowerCase();

  const frontendKeywords = [
    "ui", "page", "screen", "responsive", "homepage", "navigate", "form",
    "button", "display", "view", "profile picture", "upload", "browser",
    "mobile", "desktop", "layout", "design", "visitor", "user interface",
  ];
  const backendKeywords = [
    "api", "database", "server", "audit log", "compliance", "security",
    "authentication", "auth", "endpoint", "data access", "modification",
    "storage", "backend", "process", "queue", "integration", "logs",
  ];

  const hasFrontend = frontendKeywords.some((k) => text.includes(k));
  const hasBackend = backendKeywords.some((k) => text.includes(k));

  if (hasFrontend && hasBackend) return ["Frontend", "Backend"];
  if (hasFrontend) return ["Frontend"];
  if (hasBackend) return ["Backend"];

  // Default: cannot confidently tell, so ask for both to avoid under-assigning.
  return ["Frontend", "Backend"];
}

async function classifyWithGemini(title: string): Promise<ValidSkill[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  const prompt = `You are classifying software development tasks by the skill(s) required to complete them.
The only valid skills are "Frontend" and "Backend". A task may require one or both.

Task title: "${title}"

Respond with ONLY a JSON array of strings from ["Frontend", "Backend"], nothing else.
Examples:
"As a visitor, I want to see a responsive homepage" -> ["Frontend"]
"As a system administrator, I want audit logs of all data access" -> ["Backend"]
"As a logged-in user, I want to update my profile and upload a profile picture" -> ["Frontend", "Backend"]`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 50 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as any;
  const textOutput: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!textOutput) throw new Error("Gemini API returned no content");

  const cleaned = textOutput.replace(/```json|```/g, "").trim();
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) throw new Error("Gemini response was not an array");

  const skills = parsed.filter((s): s is ValidSkill =>
    VALID_SKILLS.includes(s)
  );

  return skills.length > 0 ? skills : keywordFallbackClassify(title);
}

/**
 * Returns the list of required skill names (e.g. ["Frontend"], ["Backend"],
 * or ["Frontend", "Backend"]) for a given task title.
 */
export async function classifySkillsForTitle(title: string): Promise<ValidSkill[]> {
  if (!GEMINI_API_KEY) {
    console.log("[llm] GEMINI_API_KEY not set, using keyword fallback classifier");
    return keywordFallbackClassify(title);
  }

  try {
    return await classifyWithGemini(title);
  } catch (err) {
    console.error("[llm] Gemini classification failed, falling back to keyword classifier:", err);
    return keywordFallbackClassify(title);
  }
}
