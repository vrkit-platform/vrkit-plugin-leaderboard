import type {
  IPluginComponentProps,
  IPluginComponentFactory
} from "@vrkit-platform/plugin-sdk"
import LeaderboardOverlayPlugin from "./leaderboard/LeaderboardOverlayPlugin.js"
import type { Container } from "@3fv/ditsy"
import type {
  PluginComponentDefinition, PluginManifest
} from "@vrkit-platform/models"

// const log = getLogger(__filename)
const log = console

const PluginComponentFactory:IPluginComponentFactory = async function PluginComponentFactory(
    _manifest:PluginManifest,
    componentDef:PluginComponentDefinition,
    _serviceContainer:Container
) {
  log.info("LEADERBOARD PLUGIN")
  const { id } = componentDef
  
  log.debug(`Loading plugin component ${id}`)
  
  return LeaderboardOverlayPlugin
  
}

export default PluginComponentFactory
