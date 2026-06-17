import React from "react";
import { Box, Text } from "ink";
import TextInput from "ink-text-input";

interface PromptBarProps {
    value: string;
    onChange: (val: string) => void;
    onSubmit: (val: string) => void;
    isFocused: boolean;
    sessionId?: string | undefined;
}

export function PromptBar({ value, onChange, onSubmit, isFocused, sessionId }: PromptBarProps) {
    return (
        <Box flexDirection="column">
            {sessionId && (
                <Box marginBottom={0}>
                    <Text color="#1a3a5c">session: </Text>
                    <Text color="#0055cc">{sessionId}</Text>
                </Box>
            )}
            <Box borderStyle="round" borderColor={isFocused ? "#0055cc" : "#333333"} paddingX={1}>
                <Text color="#00aaff" bold>
                    {"> "}
                </Text>
                <TextInput
                    value={value}
                    onChange={onChange}
                    onSubmit={onSubmit}
                    focus={isFocused}
                    placeholder="Ask anything or type / for commands…"
                />
            </Box>
            <Box marginTop={0} paddingX={1}>
                <Text color="#2a2a2a">
                    {value.startsWith("/")
                        ? "↑↓ navigate  Enter select  Esc cancel"
                        : "Enter to send  /  for commands  Ctrl+C to quit"}
                </Text>
            </Box>
        </Box>
    );
}
