import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    react(),
    dts({ tsconfigPath: resolve(__dirname, "tsconfig.json") }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Garment3DReact",
      formats: ["es", "cjs"],
      fileName: "index",
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "three",
        /^three\//,
        "@garment-3d/core",
        "@garment-3d/shared",
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          three: "THREE",
        },
      },
    },
  },
});
