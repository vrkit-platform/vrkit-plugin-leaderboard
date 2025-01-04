const
  log = console,
  CSS = require('css'),
  Fs = require("fs"),
  Path = require("path"),
  cssFile = Path.join(__dirname, "typekit.css"),
  cssText = Fs.readFileSync(cssFile, "utf8"),
  cssData = CSS.parse(cssText)

log.info(JSON.stringify(cssData, null, 2))

