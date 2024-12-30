import "@vrkit-platform/plugin-sdk"
import Box, { type BoxProps } from "@mui/material/Box"

import type { IPluginComponentProps } from "@vrkit-platform/plugin-sdk"
import React from "react"
import { createTheme, ThemeProvider } from "@mui/material/styles"
// import clsx from "clsx"
// import { styled } from "@mui/material/styles"
// import { alpha, createClassNames, FillWidth, FlexAuto, FlexRowCenter, hasCls, rem } from "@vrkit-platform/shared-ui"

const classNamePrefix = "leaderboardPlugin"

// const classNames = createClassNames(classNamePrefix, "root")
//
// const LeaderboardViewRoot = styled(Box, { name: "LeaderboardViewRoot" })(({ theme }) => {
//   return {
//     [hasCls(classNames.root)]: {
//       ...FillWidth,
//       ...FlexRowCenter,
//       borderRadius: rem(1),
//       backgroundColor: alpha(theme.palette.grey.A700, 0.9),
//       color: theme.palette.getContrastText(theme.palette.grey.A700)
//     }
//   }
// })

interface LeaderboardViewProps {}

function LeaderboardView({ ...other }: LeaderboardViewProps) {
  return (
      <Box
          // sx={{
          //   backgroundColor: "red"
          // }}
          {...other}
      >
        Leaderboard will be here
      </Box>
    // <LeaderboardViewRoot
    //   className={clsx(classNames.root, className)}
    //   sx={{
    //     backgroundColor: "red"
    //   }}
    //   {...other}
    // >
    //   Leaderboard will be here
    // </LeaderboardViewRoot>
  )
}

function LeaderboardOverlayPlugin(props: IPluginComponentProps) {
  const { client, width, height } = props,
      theme = createTheme()

  return <ThemeProvider theme={theme}><LeaderboardView /></ThemeProvider>
}

export default LeaderboardOverlayPlugin as React.ComponentType<IPluginComponentProps>
