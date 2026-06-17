import env from "@config/env.js";
import type { ActionTracker } from "@core/action-tracker.js";
import type { AgentConfig, StagingState } from "@core/types.js";

const TAVILY_API_URL = "https://api.tavily.com/search";
const TAVILY_EXTRACT_URL = "https://api.tavily.com/extract";

export class WebTools {
    constructor(
        private config: AgentConfig,
        private tracker: ActionTracker,
        private states: StagingState
    ) {}

    async webSearch(
        query: string,
        max_results: number,
        topic: "general" | "news"
    ): Promise<string> {
        this.tracker.log({
            type: "tool_execute",
            details: { command: `web_search: ${query}`, toolName: "web_search" },
            status: "executed",
            path: "N/A",
        });
        const res = await fetch(TAVILY_API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.TAVILY_API_KEY}`,
            },
            body: JSON.stringify({
                query,
                max_results,
                topic,
                include_answer: true,
                include_raw_content: false,
            }),
        });
        if (!res.ok) {
            throw new Error(`Tavily search failed: ${res.status} ${await res.text()}`);
        }
        const data = (await res.json()) as {
            answer?: string;
            results: Array<{
                title: string;
                url: string;
                content: string;
                score: number;
            }>;
        };
        const lines: string[] = [];

        if (data.answer) {
            lines.push(`## Summary\n${data.answer}\n`);
        }

        lines.push("## Results");
        for (const r of data.results) {
            lines.push(`### ${r.title}\nURL: ${r.url}\n${r.content}`);
        }

        return lines.join("\n\n");
    }

    async webFetch(url: string): Promise<string> {
        this.tracker.log({
            type: "tool_execute",
            details: { command: `web_fetch: ${url}`, toolName: "web_fetch" },
            status: "executed",
            path: "N/A",
        });
        const res = await fetch(TAVILY_EXTRACT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${env.TAVILY_API_KEY}`,
            },
            body: JSON.stringify({ urls: [url] }),
        });

        if (!res.ok) {
            throw new Error(`Tavily extract failed: ${res.status} ${await res.text()}`);
        }

        const data = (await res.json()) as {
            results: Array<{
                url: string;
                raw_content: string;
            }>;
            failed_results: Array<{ url: string; error: string }>;
        };

        if (data.failed_results?.length) {
            throw new Error(`Failed to fetch ${url}: ${data.failed_results[0]!.error}`);
        }

        const result = data.results[0];
        if (!result) throw new Error(`No content returned for ${url}`);

        const MAX_CHARS = 12_000;
        const content = result.raw_content.trim();
        const truncated = content.length > MAX_CHARS;

        return truncated
            ? `${content.slice(0, MAX_CHARS)}\n\n[...truncated at ${MAX_CHARS} chars — use a more specific URL or search for a specific section]`
            : content;
    }
}
