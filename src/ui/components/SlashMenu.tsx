import React, { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";

export interface SlashCommand {
    name: string;
    description: string;
    value: string;
}

const ALL_COMMANDS: SlashCommand[] = [
    {
        name: "sessions",
        description: "Browse and load previous sessions",
        value: "sessions",
    },
];

interface SlashMenuProps {
    query: string; // the part after "/"
    onSelect: (command: SlashCommand) => void;
    onClose: () => void;
}

export function SlashMenu({ query, onSelect, onClose }: SlashMenuProps) {
    const filtered = ALL_COMMANDS.filter((cmd) =>
        cmd.name.toLowerCase().startsWith(query.toLowerCase())
    );

    const [selectedIndex, setSelectedIndex] = useState(0);

    // Reset selection when filter changes
    useEffect(() => {
        setSelectedIndex(0);
    }, [query]);

    const clamp = useCallback(
        (val: number) => Math.max(0, Math.min(val, filtered.length - 1)),
        [filtered.length]
    );

    useInput(
        (_, key) => {
            if (key.upArrow) {
                setSelectedIndex((prev) => clamp(prev - 1));
            } else if (key.downArrow) {
                setSelectedIndex((prev) => clamp(prev + 1));
            } else if (key.return) {
                const item = filtered[selectedIndex];
                if (item) onSelect(item);
            } else if (key.escape) {
                onClose();
            }
        },
        { isActive: true }
    );

    if (filtered.length === 0) {
        return (
            <Box
                borderStyle="round"
                borderColor="#333333"
                paddingX={2}
                paddingY={0}
                marginBottom={1}
            >
                <Text color="#555555" italic>
                    No commands match &quot;/{query}&quot;
                </Text>
            </Box>
        );
    }

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="#0055cc"
            paddingX={1}
            paddingY={0}
            marginBottom={1}
        >
            <Box marginBottom={0} paddingX={1}>
                <Text color="#555555" dimColor>
                    Commands
                </Text>
            </Box>
            {filtered.map((cmd, i) => {
                const isSelected = i === selectedIndex;
                return (
                    <Box key={cmd.value} paddingX={1}>
                        {isSelected ? (
                            <Text color="#00aaff" bold>
                                {"  "}&gt;{" "}
                            </Text>
                        ) : (
                            <Text color="#333333">{"     "}</Text>
                        )}
                        <Text color={isSelected ? "#00d2ff" : "#aaaaaa"} bold={isSelected}>
                            /{cmd.name}
                        </Text>
                        <Text color="#555555">{"  "}</Text>
                        <Text color={isSelected ? "#888888" : "#444444"}>{cmd.description}</Text>
                    </Box>
                );
            })}
        </Box>
    );
}
