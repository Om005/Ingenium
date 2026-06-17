import React, { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { listSessions } from "../../session/session-manager.js";

interface SessionEntry {
    id: string;
    updatedAt: Date;
}

interface SessionPickerProps {
    onSelect: (sessionId: string) => void;
    onClose: () => void;
}

function formatRelativeTime(date: Date): string {
    const now = Date.now();
    const diffMs = now - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 60) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    if (diffDay === 1) return "yesterday";
    return `${diffDay}d ago`;
}

function truncateId(id: string, maxLen = 20): string {
    return id.length > maxLen ? id.substring(0, maxLen) + "…" : id;
}

export function SessionPicker({ onSelect, onClose }: SessionPickerProps) {
    const [sessions, setSessions] = useState<SessionEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
        listSessions()
            .then((list) => {
                setSessions(list);
                setLoading(false);
            })
            .catch(() => {
                setSessions([]);
                setLoading(false);
            });
    }, []);

    const clamp = useCallback(
        (val: number) => Math.max(0, Math.min(val, sessions.length - 1)),
        [sessions.length]
    );

    useInput(
        (_, key) => {
            if (key.upArrow) {
                setSelectedIndex((prev) => clamp(prev - 1));
            } else if (key.downArrow) {
                setSelectedIndex((prev) => clamp(prev + 1));
            } else if (key.return) {
                const session = sessions[selectedIndex];
                if (session) onSelect(session.id);
            } else if (key.escape) {
                onClose();
            }
        },
        { isActive: !loading }
    );

    return (
        <Box
            flexDirection="column"
            borderStyle="round"
            borderColor="#0055cc"
            paddingX={1}
            paddingY={0}
            marginBottom={1}
        >
            <Box paddingX={1} marginBottom={0}>
                <Text color="#555555" dimColor>
                    Sessions
                </Text>
                <Text color="#333333"> ↑↓ navigate · Enter select · Esc close</Text>
            </Box>

            {loading ? (
                <Box paddingX={2} paddingY={1}>
                    <Text color="#00aaff">Loading sessions…</Text>
                </Box>
            ) : sessions.length === 0 ? (
                <Box paddingX={2} paddingY={1}>
                    <Text color="#555555" italic>
                        No sessions found. Start chatting to create one.
                    </Text>
                </Box>
            ) : (
                sessions.map((session, i) => {
                    const isSelected = i === selectedIndex;
                    return (
                        <Box key={session.id} paddingX={1}>
                            <Box width={4}>
                                {isSelected ? (
                                    <Text color="#00aaff" bold>
                                        {">"}{" "}
                                    </Text>
                                ) : (
                                    <Text color="#333333">{"  "}</Text>
                                )}
                            </Box>
                            <Box width={24}>
                                <Text color={isSelected ? "#00d2ff" : "#888888"} bold={isSelected}>
                                    {truncateId(session.id)}
                                </Text>
                            </Box>
                            <Text color="#333333"> </Text>
                            <Text color={isSelected ? "#666666" : "#444444"}>
                                {formatRelativeTime(session.updatedAt)}
                            </Text>
                        </Box>
                    );
                })
            )}
        </Box>
    );
}
