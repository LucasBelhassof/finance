import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const serverDirectory = path.resolve(currentDirectory, "..");
const sourceDirectory = path.join(serverDirectory, "migrations");
const targetDirectory = path.resolve(serverDirectory, "..", "dist-server", "migrations");

await fs.mkdir(targetDirectory, { recursive: true });
await fs.cp(sourceDirectory, targetDirectory, { recursive: true });
