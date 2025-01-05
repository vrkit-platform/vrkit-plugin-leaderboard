import "@vrkit-platform/plugin-sdk"
import type { SessionInfoMessage } from "@vrkit-platform/plugin-sdk"
import {
  SessionDataAccess,
  SessionDataVariableValueMap,
  SessionDataVarNamesKey,
  toSessionDataVarNames
} from "@vrkit-platform/models"
import { asOption } from "@3fv/prelude-ts"
import { getLogger } from "@3fv/logger-proxy"

const log = getLogger(__filename)

export const DataVarNames = toSessionDataVarNames(
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
  "Lat",
  "Lon",
  "CarIdxPaceLine",
  "CarIdxPaceRow",
  "CarIdxPaceFlags",
  "LapLastLapTime"
)

export type DataVarNamesKey = SessionDataVarNamesKey<typeof DataVarNames>

export interface RaceInfo {
  trackName: string

  sof: number

  weather: string

  lap: number

  lapsRemaining: number

  sessionTimeRemaining: number

  sessionTime: number

  isTimedRace: boolean
  
  playerIdx: number
  playerCarData: CarData
  
  sessionType: "PRACTICE" | "QUALIFY" | "RACE"
}

export interface DriverInfo {
  idx: number // from info
  id: number

  username: string // from info
  isPlayer: boolean
  
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

export interface CarData {
  idx: number

  lap: number // CarIdxLap
  lapCompleted: number // CarIdxLapCompleted
  lapPercentComplete: number // CarIdxLapDistPct
  lapTimeBest: number

  lapTimeLast: number

  position: number // CarIdxPosition
  classPosition: number // CarIdxClassPosition
  relativeTimeToPlayer: number
  timeToLeader: number
  driver: DriverInfo
}

export function updateRaceInfo(
  sessionInfo: SessionInfoMessage,
  carDatas: CarData[],
  dataVarValues: SessionDataVariableValueMap
): RaceInfo {
  if (!sessionInfo || !carDatas.length || !dataVarValues) {
    return null
  }
  const dataAccess = SessionDataAccess.create(dataVarValues, DataVarNames),
    data = carDatas.filter(data => data.position > 0 && !!data.driver),
    totalStrength = data.reduce((totalStrength, data) => totalStrength + data.driver.iRating, 0),
    raceInfo: RaceInfo = {
      sof: totalStrength / data.length,
      weather: "",
      trackName: sessionInfo?.weekendInfo?.trackDisplayName ?? "",
      lap: dataAccess.getNumber("RaceLaps"),
      lapsRemaining: dataAccess.getNumber("SessionLapsRemain"),
      sessionTimeRemaining: dataAccess.getNumber("SessionTimeRemain"),
      sessionTime: dataAccess.getNumber("SessionTime"),
      isTimedRace: true,
      sessionType: "RACE",
      playerIdx: sessionInfo.driverInfo.driverCarIdx,
      playerCarData: data.find(data => data.driver.isPlayer),
    }

  return raceInfo
}

export function updateDriverInfo(
  driverInfoMap: Record<number, DriverInfo>,
  sessionInfo: SessionInfoMessage
): Record<number, DriverInfo> {
  const drivers = sessionInfo?.driverInfo?.drivers

  if (!drivers) {
    
    return driverInfoMap ?? {}
  }

  const newDriverInfoMap: Record<number, DriverInfo> = {}
  for (let driver of window.Object.values(drivers)) {
    if (driver.carIsPaceCar || driver.isSpectator) {
      // log.warn(`Ignoring driver is pace car or spectator`)
      continue
    }

    const [licenseLetter, licenseSR] = asOption(driver.licString)
      .map(s => s.split(" "))
      .filter(it => it.length === 2)
      .getOrElse(["R", "0"])

    const participant: DriverInfo = Object.assign(driverInfoMap[driver.carIdx] ?? ({} as DriverInfo), {
      id: driver.carID,
      idx: driver.carIdx,
      carNumber: driver.carNumber,
      username: driver.userName,
      isPlayer: sessionInfo.driverInfo.driverCarIdx === driver.carIdx,
      iRating: driver.iRating,
      license: licenseLetter,
      licenseColor: driver.licColor,
      safetyRating: licenseSR,
      isSpectator: driver.isSpectator,
      curIncidentCount: driver.curDriverIncidentCount,
      curTeamIncidentCount: driver.teamIncidentCount,
      carScreenName: driver.carScreenName,
      carClassColor: driver.carClassColor
    }) as DriverInfo

    newDriverInfoMap[participant.idx] = participant
  }

  return newDriverInfoMap
}

export type LeaderboardMode = "RELATIVE" | "STANDINGS"

export function updateCarData(
    mode: LeaderboardMode,
  driverInfoMap: Record<number, DriverInfo>,
  dataVarValues: SessionDataVariableValueMap
): CarData[] {
  const dataAccess = SessionDataAccess.create(dataVarValues, DataVarNames),
    cars = Array<CarData>(),
    drivers = window.Object.values(driverInfoMap)

  for (const driver of drivers) {
    const idx = driver.idx

    try {
      const data = {
        idx,
        lap: dataAccess.getNumber("CarIdxLap", idx, -1),
        lapCompleted: dataAccess.getNumber("CarIdxLapCompleted", idx, -1),
        lapPercentComplete: dataAccess.getNumber("CarIdxLapDistPct", idx, -1),
        lapTimeBest: dataAccess.getNumber("CarIdxBestLapTime", idx, -1),
        lapTimeLast: dataAccess.getNumber("CarIdxLastLapTime", idx, -1),
        
        relativeTimeToPlayer: dataAccess.getNumber("CarIdxEstTime", idx, -1),
        
        timeToLeader: dataAccess.getNumber("CarIdxF2Time", idx, -1),
        position: dataAccess.getNumber("CarIdxPosition", idx, -1),
        classPosition: dataAccess.getNumber("CarIdxClassPosition", idx, -1),
        driver
      }
      
      if (data.position > 0) {
        cars.push(data)
      }
    } catch (err) {
      log.error(`Unable to update ${idx}`, err)
    }
  }
  
  // const playerCarData = cars.find(data => data.driver.isPlayer)
  // if (playerCarData) {
  //   const playerTimeToLeader = playerCarData.timeToLeader
  //
  //   for (const car of cars) {
  //     if (car.driver.isPlayer) continue
  //     car.relativeTimeToPlayer = playerTimeToLeader - car.timeToLeader
  //   }
  // }
  //
  // if (mode === "RELATIVE") {
  //   return cars.sort((a, b) => a.relativeTimeToPlayer - b.relativeTimeToPlayer)
  // }
  if (mode === "RELATIVE") {
    return cars.sort((a, b) => a.relativeTimeToPlayer - b.relativeTimeToPlayer)
  }
  return cars.sort((a, b) => a.position - b.position)
}
