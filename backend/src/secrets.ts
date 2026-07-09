import fs from "fs";

/**
 * Supports the common "_FILE" convention for Docker/Kubernetes secrets:
 * if e.g. PGPASSWORD_FILE points at a mounted secret file, its contents
 * are read and exposed as process.env.PGPASSWORD. Falls back to leaving
 * the plain env var untouched if no _FILE variant is set (useful for
 * local development without Docker secrets).
 */
export function resolveSecretEnv(plainEnvVar: string): void {
  const fileEnvVar = `${plainEnvVar}_FILE`;
  const filePath = process.env[fileEnvVar];
  if (!filePath) return;

  try {
    const value = fs.readFileSync(filePath, "utf-8").trim();
    if (value) {
      process.env[plainEnvVar] = value;
    }
  } catch (err) {
    console.error(`[secrets] failed to read ${fileEnvVar} at ${filePath}:`, err);
  }
}
