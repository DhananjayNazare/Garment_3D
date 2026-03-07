import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import { resolve } from "path";

export default defineConfig({
  plugins: [
    dts({
      tsconfigPath: resolve(__dirname, "tsconfig.json"),
    }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "Garment3DCore",
      formats: ["es", "cjs"],
      fileName: "index",
    },
    rollupOptions: {
      external: ["three", /^three\//],
      output: {
        globals: {
          three: "THREE",
        },
      },
    },
  },
});
