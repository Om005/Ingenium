import { z } from "zod";
import env from "@config/env.js";

const EnvSchema = z.object({
    OPENROUTER_API_KEY: z.string().nonempty("OPENROUTER_API_KEY is required"),
    OPENROUTER_DEFAULT_MODEL: z.string().nonempty("OPENROUTER_DEFAULT_MODEL is required"),
    TAVILY_API_KEY: z.string().nonempty("TAVILY_API_KEY is required"),
});

export const checkEnv = () => {
    try {
        EnvSchema.parse(env);
    } catch (err) {
        console.error("Invalid environment configuration");
        if (err instanceof z.ZodError) {
            console.error(err.format());
        }
        process.exit(1);
    }
};
