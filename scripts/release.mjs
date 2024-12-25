#!/usr/bin/env node

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
  
const rawArgv = process.argv.slice(2),
  npmTag = rawArgv[0]

if (!npmTag || !npmTag.length)
  die("package version must be provided")

const pkgJson = Fsx.readJSONSync("package.json")

const npmVer = pkgJson.version

await $`git push --tags`
echo("Publishing")

const [yarnExe, npmExe] = await Promise.all(which("yarn"),which("npm"))

if (!yarnExe) {
  die(`yarn not found, try \`${npmExe} i -g yarn\``, 1)
}

// await $`${yarnExe} publish . --from-package --non-interactive --tag ${npmTag}`

await $`git push`

echo(`Successfully pushed version ${npmVer} with tag ${npmTag}.
The release workflow should take it from here!`)