#!/usr/bin/env node

import { Command } from "commander";
import wakeup from "./tui/wakeup.js";
import { checkEnv } from "@config/envCheck.js";
import runCliMode from "@interfaces/cli.js";
import { initDb } from "@db/client.js";

checkEnv();
initDb();

const program = new Command();

program.name("ingenium").description("Ingenium CLI").version("1.0.0");

program
    .command("wakeup")
    .description("First-time setup wizard")
    .action(async () => {
        await wakeup();
    });

program
    .command("start")
    .description("Start Ingenium")
    .action(async () => {
        await runCliMode();
    });

// Default: running `ingenium` with no command also starts it
if (process.argv.length === 2) {
    await runCliMode();
}

await program.parseAsync(process.argv);
