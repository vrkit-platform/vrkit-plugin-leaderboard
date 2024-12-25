#!/usr/bin/env node
// noinspection DuplicatedCode

import { $, argv, fs as Fsx, path as Path, echo, usePwsh, which, os, useBash } from "zx"
import Os from "os"
import JSON5 from "json5"

$.verbose = true
const isWindows = /Win/.test(Os.type())
if (isWindows)
    usePwsh()
else
    useBash()

const die = (msg, exitCode = 1, err = null) => {
  if (err) {
    console.error("ERROR: ", err)
  }

  echo`ERROR: ${msg}`
  process.exit(exitCode)
}

try {
  const pkgJson = Fsx.readJSONSync("package.json"),
    newVersion = pkgJson.version,
    pluginJson = JSON5.parse(Fsx.readFileSync("plugin.json5", "utf8"))
  
  echo`Setting plugin version to ${newVersion} ...`
  pluginJson.version = newVersion
  Fsx.writeFileSync("plugin.json5", JSON5.stringify(pluginJson, null, 2))
  
  echo`Staging plugin.json5 with new version ${newVersion} ...`
  await $`git add plugin.json5`
} catch (err) {
  die("Failed to set plugin version", 1, err)
}

echo(`Done`)