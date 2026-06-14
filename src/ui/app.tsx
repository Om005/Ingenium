import React from "react";
import { Box, Text } from "ink";
import Gradient from "ink-gradient";
import figlet from "figlet";

const bannerText = figlet.textSync("INGENIUM", {
    font: "Slant",
});

export default function App() {
    return (
        <Box flexDirection="column" padding={1}>
            <Box marginBottom={1}>
                <Gradient name="cristal">
                    <Text>{bannerText}</Text>
                </Gradient>
            </Box>

            <Box marginBottom={1} flexDirection="row">
                <Text color="green">✔ System initialized successfully.</Text>
            </Box>

            <Box borderStyle="round" borderColor="gray" padding={1} flexDirection="column">
                <Text color="gray">Ready to map standard input and '/' commands...</Text>
            </Box>
        </Box>
    );
}
