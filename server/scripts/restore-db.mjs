import fs from "node:fs";
import { spawn } from "node:child_process";

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

function parseDatabaseHost(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return parsed.hostname.toLowerCase();
}

function isLocalHost(hostname) {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
}

async function main() {
  const sourcePath = process.env.RESTORE_SOURCE_PATH;
  const databaseUrl = process.env.RESTORE_DATABASE_URL;

  if (!sourcePath) {
    throw new Error("RESTORE_SOURCE_PATH is required.");
  }

  if (!databaseUrl) {
    throw new Error("RESTORE_DATABASE_URL is required.");
  }

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Backup file not found: ${sourcePath}`);
  }

  if (process.env.RESTORE_CONFIRM_TARGET !== "overwrite") {
    throw new Error('RESTORE_CONFIRM_TARGET must be set to "overwrite".');
  }

  const targetHost = parseDatabaseHost(databaseUrl);
  const allowRemote = process.env.RESTORE_ALLOW_REMOTE === "true";

  if (!allowRemote && !isLocalHost(targetHost)) {
    throw new Error(
      `Refusing to restore into remote host "${targetHost}". Set RESTORE_ALLOW_REMOTE=true only for an approved non-production target.`,
    );
  }

  const format = process.env.RESTORE_FORMAT === "plain" ? "plain" : "custom";

  if (format === "plain") {
    await runCommand("psql", [databaseUrl, "-f", sourcePath], process.env);
  } else {
    await runCommand(
      "pg_restore",
      ["--clean", "--if-exists", "--no-owner", "--no-privileges", `--dbname=${databaseUrl}`, sourcePath],
      process.env,
    );
  }

  console.log(`Restore finished for target host ${targetHost}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
