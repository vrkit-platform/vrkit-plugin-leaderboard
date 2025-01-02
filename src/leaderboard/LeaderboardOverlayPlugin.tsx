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
  PositionAbsolute,
  rem
} from "@vrkit-platform/shared-ui"
import { asOption } from "@3fv/prelude-ts"
import { getLogger } from "@3fv/logger-proxy"

const log = getLogger(__filename)

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
  totalLaps: number
  totalTime: number
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
  const 
      dataAccess = SessionDataAccess.create(dataVarValues, DataVarNames),
      participants = Array<ParticipantData>(),
      participantInfos = window.Object.values(participantInfoMap)

  for (const info of participantInfos) {
    const idx = info.idx

    try {
      const data = {
        idx,
        lap: dataAccess.getNumber("CarIdxLap",idx, -1),
        lapCompleted: dataAccess.getNumber("CarIdxLapCompleted",idx, -1),
        lapPercentComplete: dataAccess.getNumber("CarIdxLapDistPct",idx, -1),
        lapTimeBest: dataAccess.getNumber("CarIdxBestLapTime",idx, -1),
        lapTimeLast: dataAccess.getNumber("CarIdxLastLapTime",idx, -1),
        position: dataAccess.getNumber("CarIdxPosition",idx, -1),
        classPosition: dataAccess.getNumber("CarIdxClassPosition",idx, -1),
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
      ...FlexRowCenter,
      borderRadius: rem(1),
      backgroundColor: alpha(theme.palette.grey.A700, 0.9),
      color: theme.palette.getContrastText(theme.palette.grey.A700)
    }
  }
})

const LeaderboardTable = styled("table", { name: "LeaderboardTable" })(({ theme }) => {
  return {
    ...PositionAbsolute,
    ...FillBounds,
    ...OverflowHidden, // ...FlexRowCenter,
    borderRadius: rem(1),
    backgroundColor: alpha("#000000", 0.5),
    color: "white",
    fontFamily: "Segoe UI, Tahoma, Geneva, Verdana, sans-serif",
    "& *": {
      borderCollapse: "collapse",
      borderSpacing: 0,
      border: 0
    },
    "& thead": {
      backgroundColor: alpha("#ffffff", 0.7),
      color: "black",
      "& th": {
        fontWeight: "bold"
      }
    },
    "& tbody": {
      "& tr": {
        "& td": {}
      }
    }
  }
})

export interface LeaderboardViewProps {}

function LeaderboardView({ ...other }: LeaderboardViewProps) {
  const client = getVRKitPluginClient(),
    [sampleIndex, setSampleIndex] = useState(0),
    [participantInfoMap, setParticipantInfoMap] = useState<Record<number, ParticipantInfo>>(() =>
      updateParticipantInfo({}, client.getSessionInfo())
    ),
    [participantData, setParticipantData] = useState<Array<ParticipantData>>([]),
    [dataVarValues, setDataVarValues] = useState<SessionDataVariableValueMap>({}),
    sampleIndexRef = React.useRef<number>(null),
    sessionInfo = useVRKitPluginClientSessionInfo(),
    handleSessionData = useCallback(
      (sessionId: string, timing: SessionTiming, newDataVarValues: SessionDataVariableValueMap) => {
        setSampleIndex(idx => idx + 1)
        // log.info(`ON DATA FRAME vars: ${Object.keys(newDataVarValues).join(", ")}`)
        setDataVarValues(newDataVarValues)
      },
      []
    )

  useEffect(() => {
    setParticipantInfoMap(participantInfoMap => updateParticipantInfo(participantInfoMap, client.getSessionInfo()))
  }, [sessionInfo])

  useEffect(() => {
    if (dataVarValues && participantInfoMap) {
      const newParticipantData = updateParticipantData(participantInfoMap, dataVarValues)
      setParticipantData(newParticipantData)
    }
  }, [participantInfoMap, dataVarValues])

  useVRKitPluginClientEvent(PluginClientEventType.DATA_FRAME, handleSessionData)

  return (
    <Box
      sx={{
        ...Fill,
        ...OverflowHidden
      }}
      {...other}
    >
      {/*<Box>sampleIndex={sampleIndex}</Box>*/}
      <Box>{`Session data updated (track=${sessionInfo?.weekendInfo?.trackDisplayName},session_id=${sessionInfo?.weekendInfo?.sessionID},sub_session_id=${sessionInfo?.weekendInfo?.subSessionID}`}</Box>
      <LeaderboardTable>
        <thead>
          <tr>
            <th>Pos</th>
            <th>Name</th>
            <th>License</th>
            <th>Car #</th>
            <th>B LapTime</th>
            <th>L LapTime</th>
            <th>Lap</th>
            <th>Lap %</th>
          </tr>
        </thead>
        <tbody>
          {participantData.map((p, idx) => (
            <tr key={idx}>
              <td>{p.position}</td>
              <td>{p.info.username}</td>
              <td>{p.info.license}</td>
              <td>{p.info.carNumber}</td>
              <td>{p.lapTimeBest}</td>
              <td>{p.lapTimeLast}</td>
              <td>{p.lap}</td>
              <td>{p.lapPercentComplete}</td>
            </tr>
          ))}
        </tbody>
      </LeaderboardTable>
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

  return (
    <ThemeProvider theme={theme}>
      <LeaderboardView />
    </ThemeProvider>
  )
}

export default LeaderboardOverlayPlugin as React.ComponentType<IPluginComponentProps>
