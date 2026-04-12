import { initializeDatabase } from "./database.js";
import { bootstrapAuthSchema } from "./modules/auth/schemas.js";
import { bootstrapUserCredentials } from "./modules/auth/service.js";
import { closeSharedDatabase } from "./shared/db.js";

function parseArguments(argv: string[]) {
  const parsed: Record<string, string> = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (!token.startsWith("--")) {
      continue;
    }

    const key = token.slice(2);
    const nextValue = argv[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      parsed[key] = "true";
      continue;
    }

    parsed[key] = nextValue;
    index += 1;
  }

  return parsed;
}

async function main() {
  await initializeDatabase();

  const argumentsMap = parseArguments(process.argv.slice(2));
  const input = bootstrapAuthSchema.parse({
    email: argumentsMap.email,
    password: argumentsMap.password,
    name: argumentsMap.name || "João",
    userId: argumentsMap["user-id"] ? Number(argumentsMap["user-id"]) : undefined,
  });

  const result = await bootstrapUserCredentials({
    email: input.email,
    password: input.password,
    name: input.name,
    userId: input.userId,
  });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeSharedDatabase();
  });
