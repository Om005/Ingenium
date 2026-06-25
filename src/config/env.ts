import dotenv from "dotenv";
import path from "path";

const envFile = ".env";
const PATH = path.resolve(process.cwd(), envFile);

dotenv.config({
    path: PATH,
});

interface EnvConfig {
    OPENROUTER_API_KEY: string;
    OPENROUTER_DEFAULT_MODEL: string;
    TAVILY_API_KEY: string;
    TELEGRAM_BOT_TOKEN: string;
    TELEGRAM_USER_ID: string;
}

const env: EnvConfig = {
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
    OPENROUTER_DEFAULT_MODEL: process.env.OPENROUTER_DEFAULT_MODEL!,
    TAVILY_API_KEY: process.env.TAVILY_API_KEY!,
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN!,
    TELEGRAM_USER_ID: process.env.TELEGRAM_USER_ID!,
};

export default env;
