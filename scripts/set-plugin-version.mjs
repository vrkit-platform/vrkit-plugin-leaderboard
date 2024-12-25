#!/usr/bin/env node

import JSON5 from "json5"
import { $, echo, fs as Fsx } from "zx"
import { die, pkgVersion, pluginFile, pluginFilename } from "./common-cli.mjs"

try {
  const
    newVersion = pkgVersion,
    pluginJson = JSON5.parse(Fsx.readFileSync(pluginFile, "utf8"))
  
  echo`Setting plugin version to ${newVersion} ...`
  pluginJson.version = newVersion
  Fsx.writeFileSync(pluginFile, JSON5.stringify(pluginJson, null, 2))
  
  echo`Staging ${pluginFilename} with new version ${newVersion} ...`
  await $`git add ${pluginFilename}`
} catch (err) {
  die("Failed to set plugin version", 1, err)
}

echo(`Done`)