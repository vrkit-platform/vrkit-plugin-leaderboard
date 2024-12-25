import Os from "os"
import { $, fs as Fsx, path as Path, echo, useBash, usePwsh } from "zx"

$.verbose = true
export const isWindows = /Win/.test(Os.type())

if (isWindows) {
  usePwsh()
} else {
  useBash()
}

export const die = (msg, exitCode = 1, err = null) => {
  if (err) {
    console.error("ERROR: ", err)
  }
  
  echo`ERROR: ${msg}`
  process.exit(exitCode)
}

export const assert = (test, msg, exitCode = 1) => {
  let passed = false,
    err = null
  try {
    passed = (typeof test === "function") ? test() : !!test
  } catch (testErr) {
    err = testErr
    console.error(`ERROR: test failed`, err)
  }
  
  if (!passed) {
    die(msg, exitCode, err)
  }
}

export const rawArgv = process.argv.slice(2)

export const pkgFile = Fsx.realpathSync("package.json")
assert(Fsx.existsSync(pkgFile), `${pkgFile} not found`)

export const pkgJson = Fsx.readJSONSync(pkgFile)

export const pkgVersion = pkgJson.version

export const pluginFilesGlobPattern = "plugin.{json5,json,yaml}"
export const pluginFiles = Fsx.globSync(pluginFilesGlobPattern).map(f => Fsx.realpathSync(f))
assert(pluginFiles.length === 1, `Glob pattern ${pluginFilesGlobPattern} must match exactly 1, actual ${pluginFiles.length} in ${process.cwd()}`)

export const pluginFile = pluginFiles[0]
export const pluginFilename = Path.basename(pluginFile)