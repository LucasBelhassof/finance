import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

function resolveTimestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function ensureDirectoryExists(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

function runCommand(command, args, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: environment,
      shell: false,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} exited with code ${code ?? "unknown"}.`));
    });
  });
}

async function main() {
  const databaseUrl = process.env.BACKUP_DATABASE_URL ?? process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("BACKUP_DATABASE_URL or DATABASE_URL is required.");
  }

  const format = process.env.BACKUP_FORMAT === "plain" ? "plain" : "custom";
  const extension = format === "plain" ? "sql" : "dump";
  const outputPath =
    process.env.BACKUP_OUTPUT_PATH ??
    path.resolve(process.cwd(), "backups", `finly-${resolveTimestamp()}.${extension}`);

  ensureDirectoryExists(outputPath);

  const args =
    format === "plain"
      ? ["--format=plain", `--file=${outputPath}`, databaseUrl]
      : ["--format=custom", `--file=${outputPath}`, databaseUrl];

  await runCommand("pg_dump", args, process.env);
  console.log(`Backup written to ${outputPath}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
