import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	plugins: [react()],
	server: {
		// The dev server proxies the socket so the page talks to one origin either way, and
		// the client never needs to know whether it is running under Vite or off the build.
		proxy: {
			"/ws": { target: "ws://127.0.0.1:4173", ws: true },
		},
	},
});
