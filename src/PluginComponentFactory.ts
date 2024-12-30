import type {
  IPluginComponentProps,
  IPluginComponentFactory
} from "@vrkit-platform/plugin-sdk"
import type { Container } from "@3fv/ditsy"
import type {
  PluginComponentDefinition, PluginManifest
} from "@vrkit-platform/models"
// import { getLogger } from "@3fv/logger-proxy"

import React from "react"

// const log = getLogger(__filename)
const log = console

const PluginComponentFactory:IPluginComponentFactory = async function PluginComponentFactory(
    _manifest:PluginManifest,
    componentDef:PluginComponentDefinition,
    _serviceContainer:Container
) {
  log.info("LEADERBOARD PLUGIN")
  const { id } = componentDef,
      ComponentTypePromise:Promise<{
        default:React.ComponentType<IPluginComponentProps>
      }> = import("./leaderboard/LeaderboardOverlayPlugin.js")
      //     (
      //     id.endsWith("::leaderboard") ?
      //         import("./leaderboard/LeaderboardOverlayPlugin.js") :
      //         null
      // ) as any
  
  log.assert(!!ComponentTypePromise, `Unknown component overlay id (id=${id})`)
  
  // if (log.isDebugEnabled()) {
    log.debug(`Loading plugin component ${id}`)
  // }
  
  const { default: componentType } = await ComponentTypePromise
  log.assert(!!componentType, `Failed to load plugin component ${id}`)
  
  return componentType
  
}

export default PluginComponentFactory
