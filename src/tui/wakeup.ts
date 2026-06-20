import { isCancel, select } from "@clack/prompts";
import chalk from "chalk";
import figlet from "figlet";
import runCliMode from "@interfaces/cli.js";

const BANNER_FONT = "ANSI Shadow";
const SHADOW = chalk.hex("#5b4d9e");
const FACE = chalk.hex("#e8dcf8").bold;

function printBannerWithShadow(ascii: string) {
    const bannerLines = ascii.replace(/\s+$/, "").split("\n");
    const maxLen = Math.max(...bannerLines.map((l) => l.length), 0);
    const rowWidth = maxLen + 2;

    for (const line of bannerLines) {
        console.log(SHADOW(("  " + line).padEnd(rowWidth)));
    }
    process.stdout.write(`\x1b[${bannerLines.length}A`);
    for (const line of bannerLines) {
        console.log(FACE(line.padEnd(rowWidth)));
    }
    console.log();
}

async function wakeup() {
    let ascii: string;
    try {
        ascii = figlet.textSync("Ingenium", { font: BANNER_FONT });
    } catch {
        ascii = figlet.textSync("Ingenium", { font: "Standard" });
    }
    printBannerWithShadow(ascii);

    const mode = await select({
        message: "Select the mode",
        options: [
            { value: "cli", label: "CLI Mode" },
            { value: "telegram", label: "Telegram Mode" },
            { value: "exit", label: "Exit" },
        ],
    });

    if (isCancel(mode) || mode === "exit") {
        console.log(chalk.red("Operation cancelled."));
        return;
    }

    if (mode === "cli") {
        await runCliMode();
    }
}

export default wakeup;
