import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";
import type { OpenRouterChatModelId } from "@openrouter/ai-sdk-provider/internal";

async function getAgentModel(): Promise<LanguageModel> {
    const provider = createOpenRouter({
        apiKey: process.env.OPENROUTER_API_KEY!,
    });

    const modelId = process.env.OPENROUTER_DEFAULT_MODEL;

    return provider(modelId as OpenRouterChatModelId);
}

export default getAgentModel;
