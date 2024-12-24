import "@vrkit-platform/plugin-sdk"
import Box, { type BoxProps } from "@mui/material/Box"

import { getLogger } from "@3fv/logger-proxy"

import { IPluginComponentProps } from "@vrkit-platform/plugin-sdk"
import React from "react"
import clsx from "clsx"
import { styled } from "@mui/material/styles"
import {
  alpha, createClassNames, FillWidth, FlexAuto, FlexRowCenter, hasCls, rem
} from "@vrkit-platform/shared-ui"

const log = getLogger(__filename)

const classNamePrefix = "leaderboardPlugin"

const classNames = createClassNames(classNamePrefix, "root")

const LeaderboardViewRoot = styled(
    Box,
    { name: "LeaderboardViewRoot" }
)(
    ({ theme }) => {
      return {
        [hasCls(classNames.root)]: {
          borderRadius: rem(1),
          backgroundColor: alpha(theme.palette.grey.A700, 0.9),
          color: theme.palette.getContrastText(theme.palette.grey.A700), ...FillWidth, ...FlexRowCenter,
          "& > time": {
            ...FlexAuto
          }
        }
      }
    })


interface LeaderboardViewProps extends BoxProps {
  showMillis?:boolean
}

function LeaderboardView({
  showMillis = false, className, ...other
}:LeaderboardViewProps) {
  return (
      <LeaderboardViewRoot
          className={clsx(classNames.root, className)} {...other}>
        Leaderboard will be here
      </LeaderboardViewRoot>
  )
}

function LeaderboardOverlayPlugin(props:IPluginComponentProps) {
  const { client, width, height } = props
  
  return (
      <LeaderboardView showMillis={false}/>
  )
}

export default LeaderboardOverlayPlugin as React.ComponentType<IPluginComponentProps>
