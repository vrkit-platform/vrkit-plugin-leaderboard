import "@vrkit-platform/plugin-sdk"
import {
  PluginClientEventType,
  useVRKitPluginClient,
  useVRKitPluginClientEvent,
  useVRKitPluginClientSessionInfo
} from "@vrkit-platform/plugin-sdk"
import Box, { type BoxProps } from "@mui/material/Box"

import type { IPluginComponentProps, SessionInfoMessage } from "@vrkit-platform/plugin-sdk"
import React, { useEffect, useCallback, useState } from "react"
import { createTheme, ThemeProvider } from "@mui/material/styles"
import {
  SessionDataAccess,
  SessionDataVariableType,
  SessionDataVariableValueMap,
  SessionDataVarNamesKey,
  SessionTiming,
  toSessionDataVarNames
} from "@vrkit-platform/models"
import clsx from "clsx"
import { styled } from "@mui/material/styles"
import {
  alpha,
  createClassNames,
  Fill,
  FillBounds,
  FillWidth,
  FlexAuto,
  FlexRowCenter,
  hasCls,
  OverflowHidden,
  padding,
  PositionAbsolute,
  rem,
  widthConstraint
} from "@vrkit-platform/shared-ui"
import { asOption } from "@3fv/prelude-ts"
import { getLogger } from "@3fv/logger-proxy"

const log = getLogger(__filename)

const FontTagText = `<link data-owner="leaderboard" rel="stylesheet" href="https://use.typekit.net/wyy7wko.css">`

if (!document.querySelector(`link[data-owner="leaderboard"]`)) {
  document.head.insertAdjacentHTML("beforeend", FontTagText)
}

const classNamePrefix = "leaderboardPlugin"

const classes = createClassNames(classNamePrefix, "root")

const DataVarNames = toSessionDataVarNames(
  "AirDensity",
  "AirPressure",
  "AirTemp",
  "FogLevel",
  "RelativeHumidity",
  "Skies",
  "TrackTempCrew",
  "WeatherType",
  "WindDir",
  "WindVel",
  "PitsOpen",
  "RaceLaps",
  "SessionFlags",
  "SessionLapsRemain",
  "SessionLapsRemainEx",
  "SessionNum",
  "AppSessionState",
  "SessionTick",
  "SessionTime",
  "SessionTimeOfDay",
  "SessionTimeRemain",
  "SessionUniqueID",
  "CarIdxEstTime",
  "CarIdxClassPosition",
  "CarIdxF2Time",
  "CarIdxGear",
  "CarIdxLap",
  "CarIdxLapCompleted",
  "CarIdxLapDistPct",
  "CarIdxOnPitRoad",
  "CarIdxPosition",
  "CarIdxRPM",
  "CarIdxSteer",
  "CarIdxTrackSurface",
  "CarIdxTrackSurfaceMaterial",
  "CarIdxLastLapTime",
  "CarIdxBestLapTime",
  "CarIdxBestLapNum",
  "PaceMode",
  "Lap",
  "RaceLaps",
  "Lat",
  "Lon",
  "CarIdxPaceLine",
  "CarIdxPaceRow",
  "CarIdxPaceFlags",
  "LapLastLapTime"
)

type DataVarNamesKey = SessionDataVarNamesKey<typeof DataVarNames>

interface RaceInfo {
  trackName: string

  sof: number

  weather: string

  lap: number

  lapsRemaining: number

  sessionTimeRemaining: number

  sessionTime: number

  isTimedRace: boolean

  sessionType: "PRACTICE" | "QUALIFY" | "RACE"
}

interface ParticipantInfo {
  idx: number // from info
  id: number

  username: string // from info
  iRating: number

  license: string

  licenseColor: string

  safetyRating: number

  isSpectator: boolean

  carScreenName: string

  carClassColor: string

  carNumber: string // from info

  curIncidentCount: number

  curTeamIncidentCount: number
}

interface ParticipantData {
  idx: number

  lap: number // CarIdxLap
  lapCompleted: number // CarIdxLapCompleted
  lapPercentComplete: number // CarIdxLapDistPct
  lapTimeBest: number

  lapTimeLast: number

  position: number // CarIdxPosition
  classPosition: number // CarIdxClassPosition

  info: ParticipantInfo
}

function updateRaceInfo(
    sessionInfo: SessionInfoMessage,
    participantData: ParticipantData[],
    dataVarValues: SessionDataVariableValueMap
): RaceInfo {
  const dataAccess = SessionDataAccess.create(dataVarValues, DataVarNames),
      data = participantData.filter(data => data.position > 0 && !!data.info),
      totalStrength = data.reduce((totalStrength, data) => totalStrength + data.info.iRating, 0),
      raceInfo: RaceInfo = {
        sof: totalStrength / data.length,
        weather: "",
        trackName: sessionInfo?.weekendInfo?.trackDisplayName ?? "",
        lap: dataAccess.getNumber("RaceLaps"),
        lapsRemaining: dataAccess.getNumber("SessionLapsRemain"),
        sessionTimeRemaining: dataAccess.getNumber("SessionTimeRemain"),
        sessionTime: dataAccess.getNumber("SessionTime"),
        isTimedRace: true,
        sessionType: "RACE"
      }
  
  return raceInfo
}

function updateParticipantInfo(
  participants: Record<number, ParticipantInfo>,
  sessionInfo: SessionInfoMessage
): Record<number, ParticipantInfo> {
  const drivers = sessionInfo?.driverInfo?.drivers

  if (!drivers) {
    // log.warn(`No drivers in session info`)
    return participants ?? {}
  }

  const newParticipants: Record<number, ParticipantInfo> = {}
  for (let driver of window.Object.values(drivers)) {
    if (driver.carIsPaceCar || driver.isSpectator) {
      // log.warn(`Ignoring driver is pace car or spectator`)
      continue
    }

    const [licenseLetter, licenseSR] = asOption(driver.licString)
      .map(s => s.split(" "))
      .filter(it => it.length === 2)
      .getOrElse(["R", "0"])

    const participant: ParticipantInfo = Object.assign(participants[driver.carIdx] ?? ({} as ParticipantInfo), {
      id: driver.carID,
      idx: driver.carIdx,
      carNumber: driver.carNumber,
      username: driver.userName,
      iRating: driver.iRating,
      license: licenseLetter,
      licenseColor: driver.licColor,
      safetyRating: licenseSR,
      isSpectator: driver.isSpectator,
      curIncidentCount: driver.curDriverIncidentCount,
      curTeamIncidentCount: driver.teamIncidentCount,
      carScreenName: driver.carScreenName,
      carClassColor: driver.carClassColor
    }) as ParticipantInfo

    newParticipants[participant.idx] = participant
  }

  return newParticipants
}

function updateParticipantData(
  participantInfoMap: Record<number, ParticipantInfo>,
  dataVarValues: SessionDataVariableValueMap
): ParticipantData[] {
  const dataAccess = SessionDataAccess.create(dataVarValues, DataVarNames),
    participants = Array<ParticipantData>(),
    participantInfos = window.Object.values(participantInfoMap)

  for (const info of participantInfos) {
    const idx = info.idx

    try {
      const data = {
        idx,
        lap: dataAccess.getNumber("CarIdxLap", idx, -1),
        lapCompleted: dataAccess.getNumber("CarIdxLapCompleted", idx, -1),
        lapPercentComplete: dataAccess.getNumber("CarIdxLapDistPct", idx, -1),
        lapTimeBest: dataAccess.getNumber("CarIdxBestLapTime", idx, -1),
        lapTimeLast: dataAccess.getNumber("CarIdxLastLapTime", idx, -1),
        position: dataAccess.getNumber("CarIdxPosition", idx, -1),
        classPosition: dataAccess.getNumber("CarIdxClassPosition", idx, -1),
        info
      }

      participants.push(data)
    } catch (err) {
      log.error(`Unable to update ${idx}`, err)
    }
  }

  return participants.sort((a, b) => a.position - b.position).filter(({ position }) => position > 0)
}

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

const LeaderboardTable = styled("table", { name: "LeaderboardTable" })(({ theme }) => {
  return {
    ...PositionAbsolute,
    ...FillBounds,
    ...Fill,
    ...OverflowHidden, // ...FlexRowCenter,
    borderRadius: rem(1),
    backgroundColor: "#242424",
    color: "white",
    fontFamily: `"magistral","Segoe UI", Tahoma, Geneva, Verdana, sans-serif`,
    fontWeight: 800,
    "& *": {
      borderCollapse: "collapse",
      borderSpacing: 0,
      border: 0,
      
    },
    "& thead": {
      backgroundColor: "#242424",
      color: "white",
      // backgroundColor: alpha("#ffffff", 1.0),
      // color: "black",
      "& th": {
        
      }
    },
    "& tbody": {
      "& tr": {
        margin:0,
        border:0,
        "& td": {
          ...padding(0,rem(1)),
          margin:0,
          border:0,
          "&:first-of-type": {
            backgroundColor: "#F0F0F0",
            color: "black",
            textAlign: "center",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            ...widthConstraint(rem(1))
          },
          
        },
        
        "&:nth-of-type(odd)": {
          backgroundColor: "#141414",
        },
        
        "&:nth-of-type(even)": {
          backgroundColor: "#202020",
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
    [participantInfoMap, setParticipantInfoMap] = useState<Record<number, ParticipantInfo>>(() =>
      updateParticipantInfo({}, client.getSessionInfo())
    ),
    [participantData, setParticipantData] = useState<Array<ParticipantData>>([]),
    [dataVarValues, setDataVarValues] = useState<SessionDataVariableValueMap>({}),
    sessionInfo = useVRKitPluginClientSessionInfo(),
      hasParticipantData = participantData.length > 0,
      hasParticipantInfo = Object.keys(participantInfoMap).length > 0,
    handleSessionData = useCallback(
      (sessionId: string, timing: SessionTiming, newDataVarValues: SessionDataVariableValueMap) => {
        setSampleIndex(idx => idx + 1)
        setDataVarValues(newDataVarValues)
      },
      []
    )

  useEffect(() => {
    setParticipantInfoMap(participantInfoMap => updateParticipantInfo(participantInfoMap, client.getSessionInfo()))
  }, [sessionInfo])

  useEffect(() => {
    if (dataVarValues && participantInfoMap && hasParticipantInfo && Object.keys(dataVarValues).length > 0) {
      const newParticipantData = updateParticipantData(participantInfoMap, dataVarValues)
      const newRaceInfo = updateRaceInfo(sessionInfo, newParticipantData, dataVarValues)
      setParticipantData(newParticipantData)
      setRaceInfo(newRaceInfo)
    }
  }, [participantInfoMap, dataVarValues])

  useVRKitPluginClientEvent(PluginClientEventType.DATA_FRAME, handleSessionData)

  return (hasParticipantInfo && hasParticipantData &&
    <LeaderboardViewRoot {...other}>
      {/*<Box>sampleIndex={sampleIndex}</Box>*/}
      <Box>{`Session data updated (track=${sessionInfo?.weekendInfo?.trackDisplayName},session_id=${sessionInfo?.weekendInfo?.sessionID},sub_session_id=${sessionInfo?.weekendInfo?.subSessionID}`}</Box>
      <LeaderboardTable>
        <thead>
          <tr>
            <th colSpan={3}>
              SoF {(raceInfo?.sof / 1000.0).toFixed(1)}K
            </th>
          </tr>
        </thead>
        <tbody>
          {participantData.map((p, idx) => (
            <tr key={idx}>
              <td><span>{p.position}</span></td>
              <td>{p.info.username}</td>
              <td>{p.info.license}</td>
              {/*<td>{p.info.carNumber}</td>*/}
              {/*<td>{p.lapTimeBest}</td>*/}
              {/*<td>{p.lapTimeLast}</td>*/}
              {/*<td>{p.lap}</td>*/}
              {/*<td>{p.lapPercentComplete}</td>*/}
            </tr>
          ))}
        </tbody>
      </LeaderboardTable>
    </LeaderboardViewRoot>
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
