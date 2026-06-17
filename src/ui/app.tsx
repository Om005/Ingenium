import React, { useCallback, useState } from "react";
import { Box, Text, useApp } from "ink";
import { loadSession, type Message } from "../session/session-manager.js";
import { Banner } from "./components/Banner.js";
import { SlashMenu, type SlashCommand } from "./components/SlashMenu.js";
import { SessionPicker } from "./components/SessionPicker.js";
import { ChatView } from "./components/ChatView.js";
import { PromptBar } from "./components/PromptBar.js";

// Which overlay is visible above the prompt bar
type Overlay = "none" | "slash-menu" | "session-picker";

interface LoadedSession {
    id: string;
    messages: Message[];
}

export default function App() {
    const { exit } = useApp();

    const [input, setInput] = useState("");
    const [overlay, setOverlay] = useState<Overlay>("none");
    const [loadedSession, setLoadedSession] = useState<LoadedSession | null>(null);
    const [statusLine, setStatusLine] = useState<string | null>(null);

    // Called on every keystroke in the prompt bar
    const handleInputChange = useCallback(
        (val: string) => {
            setInput(val);

            if (val.startsWith("/")) {
                setOverlay("slash-menu");
            } else {
                // If user deleted the '/', close the slash menu
                if (overlay === "slash-menu") {
                    setOverlay("none");
                }
            }
        },
        [overlay]
    );

    // User pressed Enter in the prompt bar (and no overlay is open)
    const handleInputSubmit = useCallback((val: string) => {
        if (val.trim() === "") return;

        if (val.startsWith("/")) {
            // Let slash menu handle it via its own key listener
            return;
        }

        // Plain message — placeholder until agent is wired in
        setStatusLine(`Message sent: "${val.trim()}"`);
        setInput("");
    }, []);

    // Slash command selected from menu
    const handleCommandSelect = useCallback((cmd: SlashCommand) => {
        setInput("");
        setOverlay("none");

        if (cmd.value === "sessions") {
            setOverlay("session-picker");
        }
    }, []);

    // Session selected from session picker
    const handleSessionSelect = useCallback(async (sessionId: string) => {
        setOverlay("none");
        setStatusLine(`Loading session ${sessionId}…`);

        try {
            const data = await loadSession(sessionId);
            if (data) {
                setLoadedSession({ id: data.id, messages: data.messages });
                setStatusLine(null);
            } else {
                setStatusLine(`Session "${sessionId}" not found.`);
            }
        } catch {
            setStatusLine(`Failed to load session "${sessionId}".`);
        }
    }, []);

    const handleClose = useCallback(() => {
        setOverlay("none");
        setInput("");
    }, []);

    // Slash query is everything after "/"
    const slashQuery = input.startsWith("/") ? input.slice(1) : "";

    // Determine if the prompt bar's TextInput should be focused.
    // When session-picker is open, its own useInput handles arrow keys; the
    // text-input shouldn't steal focus.
    const promptFocused = overlay !== "session-picker";

    return (
        <Box flexDirection="column" paddingX={2} paddingTop={1}>
            {/* ── Banner ── */}
            <Banner />

            {/* ── Loaded session messages ── */}
            {loadedSession && (
                <ChatView messages={loadedSession.messages} sessionId={loadedSession.id} />
            )}

            {/* ── Status line ── */}
            {statusLine && (
                <Box marginBottom={1} paddingLeft={1}>
                    <Text color="#555555" italic>
                        {statusLine}
                    </Text>
                </Box>
            )}

            {/* ── Overlays (appear above prompt bar) ── */}
            {overlay === "slash-menu" && (
                <SlashMenu
                    query={slashQuery}
                    onSelect={handleCommandSelect}
                    onClose={handleClose}
                />
            )}

            {overlay === "session-picker" && (
                <SessionPicker onSelect={handleSessionSelect} onClose={handleClose} />
            )}

            {/* ── Prompt bar ── */}
            <PromptBar
                value={input}
                onChange={handleInputChange}
                onSubmit={handleInputSubmit}
                isFocused={promptFocused}
                sessionId={loadedSession?.id}
            />
        </Box>
    );
}
