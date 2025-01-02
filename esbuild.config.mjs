import builtins from "builtin-modules"
import esbuild from "esbuild"
import * as Path from "node:path"

const prod = process.env.NODE_ENV === "production",
  watch = !prod && process.env.BUILD_WATCH === "1",
  outdir = Path.resolve(import.meta.dirname, "dist"),
  outfile = Path.join(outdir, "bundled-plugin.js")


async function run() {
  let ctx = null
  try {
    const opts = {
      entryPoints: ["src/index.ts"],
      bundle: true,
      // prod: false,
      // production: false,
      // jsxDev: true,
      
      external: [
        "@3fv/guard",
        "@3fv/deferred",
        "@3fv/logger-proxy",
        "@3fv/prelude-ts",
        "@3fv/ditsy",
        "@mui/material",
        "@mui/material/*",
        "@mui/material/Box",
        "@mui/material/styles",
        "@mui/styled-engine",
        "@mui/styled-engine-sc",
        "@mui/system",
        "@mui/lab",
        "@mui/x-data-grid",
        "@mui/x-tree-view",
        "usehooks-ts",
        "lodash",
        "lodash/fp",
        "@vrkit-platform/*",
        "electron",
        "react",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "react-dom",
        ...builtins
      ],
      // jsxFactory: "react-jsx",
      format: "cjs",
      target: "es2020",
      logLevel: "info",
      sourcemap: "both",
      
      treeShaking: false,
      outfile
    }
    
    if (watch) {
      ctx = await esbuild.context(opts)
      console.log("Starting watch...")
      ctx.watch()
        .catch(err => {
          console.error("Watch error", err)
        })
    } else {
      await esbuild.build(opts)
    }
  } catch (err) {
    console.error(`Build failed`, err)
    throw err
  }
}

run()
