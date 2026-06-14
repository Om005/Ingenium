import "dotenv/config";
import React from "react";
import { render } from "ink";
import App from "./ui/app.js";

async function bootstrap() {
    try {
        const { waitUntilExit } = render(<App />);

        await waitUntilExit();
    } catch (error) {
        console.error("Failed to start application:", error);
        process.exit(1);
    }
}

await bootstrap();
