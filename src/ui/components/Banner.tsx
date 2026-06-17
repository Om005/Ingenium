import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import figlet from "figlet";

const GRADIENT_COLORS = ["#00d2ff", "#0088ff", "#0055cc", "#3388ff", "#00aaff"];

function applyGradient(text: string): string[] {
    const lines = text.split("\n");
    return lines;
}

export function Banner() {
    const [bannerLines, setBannerLines] = useState<string[]>([]);

    useEffect(() => {
        figlet.text(
            "INGENIUM",
            {
                font: "ANSI Shadow",
                horizontalLayout: "default",
                verticalLayout: "default",
            },
            (err, result) => {
                if (err || !result) {
                    setBannerLines(["INGENIUM"]);
                    return;
                }
                setBannerLines(applyGradient(result));
            }
        );
    }, []);

    const colorFor = (i: number, total: number): string => {
        const idx = Math.round((i / Math.max(total - 1, 1)) * (GRADIENT_COLORS.length - 1));
        return GRADIENT_COLORS[idx] ?? GRADIENT_COLORS[0] ?? "#00d2ff";
    };

    if (bannerLines.length === 0) return null;

    return (
        <Box flexDirection="column" alignItems="center" marginBottom={1}>
            <Box flexDirection="column" alignItems="flex-start">
                {bannerLines.map((line, i) => (
                    <Text key={i} color={colorFor(i, bannerLines.length)} bold>
                        {line}
                    </Text>
                ))}
            </Box>
            <Box marginTop={1}>
                <Text color="#555555">{"─".repeat(60)}</Text>
            </Box>
            <Box>
                <Text color="#444444" italic>
                    AI coding agent ·{" "}
                </Text>
                <Text color="#00aaff">type </Text>
                <Text color="#ffffff">/</Text>
                <Text color="#00aaff"> for commands</Text>
                <Text color="#444444"> · </Text>
                <Text color="#00aaff">Enter</Text>
                <Text color="#444444"> to send · </Text>
                <Text color="#00aaff">Ctrl+C</Text>
                <Text color="#444444"> to quit</Text>
            </Box>
            <Box marginTop={1}>
                <Text color="#555555">{"─".repeat(60)}</Text>
            </Box>
        </Box>
    );
}
