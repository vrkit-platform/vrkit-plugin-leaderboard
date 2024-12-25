#!/usr/bin/env node

import { $, echo} from "zx"
import { die, rawArgv, pkgVersion } from "./common-cli.mjs"

const npmTag = rawArgv[0]

if (!npmTag || !npmTag.length) {
  die("package version must be provided")
}


echo`Push tags...`
await $`git push --tags`

echo`Push...`
await $`git push`

echo`Successfully pushed version ${pkgVersion} with tag ${npmTag}.
The release workflow should take it from here!`