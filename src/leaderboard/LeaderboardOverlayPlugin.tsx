import "@vrkit-platform/plugin-sdk"
import type { IPluginComponentProps } from "@vrkit-platform/plugin-sdk"
import {
  PluginClientEventType,
  useVRKitPluginClientEvent,
  useVRKitPluginClientSessionInfo
} from "@vrkit-platform/plugin-sdk"
import Box from "@mui/material/Box"
import React, { useCallback, useEffect, useMemo, useState } from "react"
import { createTheme, styled, ThemeProvider } from "@mui/material/styles"
import { SessionDataVariableValueMap, SessionTiming } from "@vrkit-platform/models"
import {
  child,
  createClassNames,
  DurationView,
  Ellipsis,
  Fill,
  FillBounds,
  flexAlign,
  FlexAuto,
  FlexAutoBox,
  FlexColumn,
  FlexRow,
  FlexRowCenter,
  FlexScaleZeroBox,
  hasCls,
  OverflowHidden,
  padding,
  PositionAbsolute,
  rem,
  widthConstraint
} from "@vrkit-platform/shared-ui"
import { getLogger } from "@3fv/logger-proxy"
import {
  CarData,
  DriverInfo,
  RaceInfo,
  updateCarData,
  updateDriverInfo,
  updateRaceInfo
} from "./LeaderboardOverlayPlugin.data"
import clsx from "clsx"
import { capitalize, debounce, throttle } from "lodash"
import { asOption } from "@3fv/prelude-ts"

const log = getLogger(__filename)

const FontTagText = `<link data-owner="leaderboard" rel="stylesheet" href="https://use.typekit.net/wyy7wko.css">`

if (!document.querySelector(`link[data-owner="leaderboard"]`)) {
  document.head.insertAdjacentHTML("beforeend", FontTagText)
}

const classNamePrefix = "leaderboardPlugin"

const classes = createClassNames(
  classNamePrefix,
  "root",
  "grid",
  "row",
  "rowLapAhead",
  "rowLapBehind",
  "rowLapCurrent",
  "rowInPits",
  "rowPlayer",
  "cell",
  "cellPosition",
  "cellIRating",
  "cellRelativeTime"
)

const LeaderboardViewRoot = styled(Box, { name: "LeaderboardViewRoot" })(({ theme }) => {
  return {
    [hasCls(classes.root)]: {
      ...Fill,
      ...OverflowHidden,
      "&, & *": {
        fontFamily: `"magistral"`,
        fontWeight: 800,
        fontStyle: "normal"
      }
      // borderRadius: rem(1),
      // backgroundColor: alpha(theme.palette.grey.A700, 0.9),
      // color: theme.palette.getContrastText(theme.palette.grey.A700)
    }
  }
})

const LeaderboardGrid = styled("div", { name: "LeaderboardGrid" })(({ theme }) => {
  return {
    [hasCls(classes.grid)]: {
      ...PositionAbsolute,
      ...FillBounds,
      ...Fill,
      ...OverflowHidden, // ...FlexRowCenter,
      // display: "grid",
      // gridTemplateColumns: `1rem auto 2rem 1rem`,
      ...FlexColumn,
      ...flexAlign("stretch", "flex-start"),
      borderRadius: rem(1), // backgroundColor: "#242424",
      color: "white",
      fontFamily: `"magistral","Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
      fontWeight: 800,
      "& *": {
        // borderCollapse: "collapse",
        // borderSpacing: 0,
        border: 0
      },
      [child(classes.row)]: {
        margin: 0,
        border: 0,
        ...OverflowHidden,
        ...FlexAuto,
        "&:first-of-type": {
          backgroundColor: "#242424",
          color: "white", //gridColumn: "1 / span 4",
          ...FlexRow,
          ...padding(rem(0.5), rem(1)),
          ...flexAlign("center", "stretch")
        },
        "&:not(:first-of-type)": {
          ...FlexRow,

          ...flexAlign("center", "stretch"),
          [hasCls(classes.rowLapAhead)]: {
            color: "#5B9DEE"
          },
          [hasCls(classes.rowLapBehind)]: {
            color: "#6F162A"
          },
          [hasCls(classes.rowLapCurrent)]: {
            color: "#F6F6F6"
          },
          [hasCls(classes.rowPlayer)]: {
            color: "#E4BD2A"
          },

          [hasCls(classes.rowInPits)]: {
            opacity: 0.5
          },
          "&:nth-of-type(odd)": {
            backgroundColor: "#141414"
          },

          "&:nth-of-type(even)": {
            backgroundColor: "#202020"
          },

          [child(classes.cell)]: {
            ...padding(rem(0.25), rem(0.5)),
            ...OverflowHidden,
            ...Ellipsis,
            [hasCls(classes.cellPosition)]: {
              // ...FlexRowCenter,

              // ...widthConstraint(rem(1)),
              // ...Fill,
              ...widthConstraint(rem(3.5)),
              borderBottomRightRadius: rem(0.75),
              backgroundColor: "#F0F0F0",
              color: "black",
              alignSelf: "center",
              justifySelf: "center",
              textAlign: "center"
            },
            [hasCls(classes.cellIRating)]: {
              ...widthConstraint(rem(4)),
              "&, & *": {
                fontWeight: 700,
              },
              borderRadius: rem(0.25),
              backgroundColor: "#F0F0F0",
              color: "black",
              alignSelf: "center",
              justifySelf: "center",
              textAlign: "center"
            },
            [hasCls(classes.cellRelativeTime)]: {
              ...widthConstraint(rem(5.5)),

              alignSelf: "flex-end",
              justifySelf: "center",
              textAlign: "end"
            }
          }
        }
      }
    }
  }
})

export interface LeaderboardViewProps {}

function LeaderboardView({ ...other }: LeaderboardViewProps) {
  const client = getVRKitPluginClient(),
    [raceInfo, setRaceInfo] = useState<RaceInfo>(),
    [sampleIndex, setSampleIndex] = useState(0),
    [driverInfoMap, setDriverInfoMap] = useState<Record<number, DriverInfo>>(() =>
      updateDriverInfo({}, client.getSessionInfo())
    ),
    [carDatas, setCarDatas] = useState<Array<CarData>>([]),
    [dataVarValues, setDataVarValues] = useState<SessionDataVariableValueMap>({}),
    sessionInfo = useVRKitPluginClientSessionInfo(),
    hasCarData = carDatas.length > 0,
    hasDriverInfo = Object.keys(driverInfoMap).length > 0,
    handleSessionData = useMemo(() =>
      throttle((sessionId: string, timing: SessionTiming, newDataVarValues: SessionDataVariableValueMap) => {
        setSampleIndex(idx => idx + 1)
        setDataVarValues(newDataVarValues)
      }, 100),
      []
    )

  useEffect(() => {
    setDriverInfoMap(driverInfoMap => updateDriverInfo(driverInfoMap, client.getSessionInfo()))
  }, [sessionInfo])

  useEffect(() => {
    if (
      sessionInfo?.driverInfo &&
      dataVarValues &&
      driverInfoMap &&
      hasDriverInfo &&
      Object.keys(dataVarValues).length > 0
    ) {
      const newCarDatas = updateCarData("RELATIVE", sessionInfo, driverInfoMap, dataVarValues)
      const newRaceInfo = updateRaceInfo(sessionInfo, newCarDatas, dataVarValues)
      setCarDatas(newCarDatas)
      setRaceInfo(newRaceInfo)
    }
  }, [driverInfoMap, dataVarValues, sessionInfo])

  useVRKitPluginClientEvent(PluginClientEventType.DATA_FRAME, handleSessionData)

  return (
    hasDriverInfo &&
    hasCarData && (
      <LeaderboardViewRoot {...other}>
        <LeaderboardGrid className={clsx(classes.grid)}>
          <div className={clsx(classes.row)}>
            <FlexAutoBox>{capitalize(raceInfo.sessionType)}</FlexAutoBox>
            <FlexScaleZeroBox
              sx={{
                ...Ellipsis,
                textAlign: "center",
                alignSelf: "center",
                justifySelf: "center"
              }}
              className={clsx(classes.cell)}
            >
              SoF {(raceInfo?.sof / 1000.0).toFixed(1)}K
            </FlexScaleZeroBox>
            <FlexAutoBox>
              <DurationView millis={raceInfo.sessionTime * 1000}/> /
              <DurationView millis={raceInfo.sessionTimeRemaining * 1000}/>
              {/*{raceInfo.lap}/{raceInfo.lapsRemaining + raceInfo.lap}*/}
            </FlexAutoBox>
          </div>

          {carDatas.map((p, idx) => {
            return (
              <div
                key={p.idx}
                className={clsx(classes.row, {
                  [classes.rowPlayer]: p.driver?.isPlayer ?? false,
                  [classes.rowInPits]: p.trackLocationSurface < 3
                })}
              >
                <div
                  className={clsx(classes.cell, classes.cellPosition)}
                  style={{
                    backgroundColor: `#${p.driver.carClassColor}`
                  }}
                >
                  <span>{p.classPosition}</span>
                </div>
                <FlexScaleZeroBox
                  sx={{ ...Ellipsis }}
                  className={clsx(classes.cell)}
                >
                  {p.driver.username}
                </FlexScaleZeroBox>
                <div className={clsx(classes.cell, classes.cellIRating)}
                     style={{
                       backgroundColor: `#${p.driver.licenseColor}`
                     }}
                >{(p.driver.iRating / 1000).toFixed(1)}k {p.driver.license}</div>
                <div className={clsx(classes.cell, classes.cellRelativeTime)}>
                  {p.relativeTimeToPlayer.toFixed(2)}
                  {/*{p.timeToLeader.toFixed(2)}*/}
                </div>
                {/*<td>{p.info.carNumber}</td>*/}
                {/*<td>{p.lapTimeBest}</td>*/}
                {/*<td>{p.lapTimeLast}</td>*/}
                {/*<td>{p.lap}</td>*/}
                {/*<td>{p.lapPercentComplete}</td>*/}
              </div>
            )
          })}
        </LeaderboardGrid>
      </LeaderboardViewRoot>
    )
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

  return (
    <ThemeProvider theme={theme}>
      <LeaderboardView />
    </ThemeProvider>
  )
}

export default LeaderboardOverlayPlugin as React.ComponentType<IPluginComponentProps>
