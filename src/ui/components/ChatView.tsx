import React from "react";
import { Box, Text } from "ink";
import type { Message } from "../../session/session-manager.js";

interface ChatViewProps {
    messages: Message[];
    sessionId: string;
}

function MessageBubble({ message }: { message: Message }) {
    const isUser = message.role === "user";

    if (isUser) {
        return (
            <Box flexDirection="column" marginBottom={1}>
                <Box>
                    <Text color="#00aaff" bold>
                        You
                    </Text>
                    <Text color="#333333"> ──────────────────────────────────</Text>
                </Box>
                <Box paddingLeft={2}>
                    <Text color="#e0e0e0" wrap="wrap">
                        {message.content}
                    </Text>
                </Box>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box>
                <Text color="#00d2ff" bold>
                    Ingenium
                </Text>
                <Text color="#1a3a5c"> ──────────────────────────────</Text>
            </Box>
            <Box paddingLeft={2}>
                <Text color="#aaddff" wrap="wrap">
                    {message.content}
                </Text>
            </Box>
        </Box>
    );
}

export function ChatView({ messages, sessionId }: ChatViewProps) {
    if (messages.length === 0) {
        return (
            <Box
                flexDirection="column"
                paddingX={2}
                paddingY={1}
                borderStyle="round"
                borderColor="#1a2a3a"
                marginBottom={1}
            >
                <Text color="#444444" italic>
                    No messages in this session yet.
                </Text>
            </Box>
        );
    }

    return (
        <Box flexDirection="column" marginBottom={1}>
            <Box marginBottom={1}>
                <Text color="#333333">{"─".repeat(60)}</Text>
            </Box>
            <Box paddingLeft={1} marginBottom={1}>
                <Text color="#444444">Session </Text>
                <Text color="#0055cc">{sessionId}</Text>
            </Box>
            <Box flexDirection="column">
                {messages.map((msg, i) => (
                    <MessageBubble key={i} message={msg} />
                ))}
            </Box>
            <Box>
                <Text color="#333333">{"─".repeat(60)}</Text>
            </Box>
        </Box>
    );
}
