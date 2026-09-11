import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
	globalIgnores(["dist"]),
	{
		files: ["**/*.{ts,tsx}"],
		extends: [
			js.configs.recommended,
			tseslint.configs.recommended,
			reactHooks.configs.flat.recommended,
			reactRefresh.configs.vite,
		],
		languageOptions: {
			ecmaVersion: 2020,
			globals: globals.browser,
		},
		rules: {
			// Typing the third-party surfaces (Annotorious, OpenSeadragon, Frappe
			// responses) is ongoing; an `any` is a warning, not a build failure.
			"@typescript-eslint/no-explicit-any": "warn",
			// shadcn/ui files and the context modules export helpers next to
			// components on purpose; Fast Refresh simply falls back to a reload.
			"react-refresh/only-export-components": "warn",
		},
	},
]);
