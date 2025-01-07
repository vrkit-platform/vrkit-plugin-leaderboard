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
import { isNotEmptyString, Pair } from "@vrkit-platform/shared"
import { padStart, partition } from "lodash"
import { isNumber, isString } from "@3fv/guard"

const log = getLogger(__filename)

function toHexColor(value: string | number, defaultValue: string = "FF0000"): string {
  return isString(value)
    ? value.startsWith("0x")
      ? value.substring(2)
      : value
    : isNumber(value)
      ? `${padStart((value as any).toString(16), 6, "0")}`
      : defaultValue
}

function getTrackLength(sessionInfo: SessionInfoMessage): number {
  return asOption(sessionInfo?.weekendInfo?.trackLength)
    .filter(isNotEmptyString)
    .map(str => parseInt(str.split(" ")[0], 10) * 1000.0)
    .getOrElse(0)
}

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
  "SessionState",
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

export enum IRacingSessionState {
  INVALID = 0,
  GET_IN_CAR = 1,
  WARMUP = 3,
  PARADE_LAPS = 4,
  RACE = 5,
  CHECKERED = 6,
  COOLDOWN = 7
}

export enum IRacingSessionType {
  PRACTICE = "PRACTICE",
  QUALIFY = "QUALIFY",
  RACE = "RACE"
}

export interface RaceInfo {
  trackName: string

  trackLength: number

  sof: number

  weather: string

  lap: number

  lapsRemaining: number

  sessionTimeRemaining: number

  sessionTime: number
  sessionNum: number
  isTimedRace: boolean

  playerIdx: number

  playerCarData: CarData

  sessionState: IRacingSessionState

  sessionType: IRacingSessionType
}

export interface DriverInfo {
  idx: number // from info
  carId: number

  username: string // from info

  qualifiedPosition: number

  qualifiedClassPosition: number

  isPlayer: boolean

  iRating: number

  license: string

  licenseColor: string

  safetyRating: number

  relativeSpeed: number

  isSpectator: boolean

  carScreenName: string

  carClassColor: string

  carNumber: string // from info

  curIncidentCount: number

  curTeamIncidentCount: number
}

export interface CarData {
  idx: number

  trackLocationSurface: number

  lap: number // CarIdxLap
  lapCompleted: number // CarIdxLapCompleted
  lapPercentComplete: number // CarIdxLapDistPct
  lapTimeEst: number

  lapTimeBest: number

  lapTimeLast: number

  totalDistance: number

  position: number // CarIdxPosition
  classPosition: number // CarIdxClassPosition

  estSpeed: number

  relativeDistanceToPlayer: number

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
    data = carDatas.filter(data => !!data.driver),
    totalStrength = data.reduce((totalStrength, data) => totalStrength + data.driver.iRating, 0),
    sessionNum = dataAccess.getNumber("SessionNum"),
    sessionType = asOption(sessionNum)
      .filter(it => it >= 0)
      .map(sessionNum => sessionInfo.sessionInfo?.sessions?.find?.(it => it.sessionNum === sessionNum))
      .map(subSessionInfo => subSessionInfo?.sessionType as IRacingSessionType)
      .getOrElse(IRacingSessionType.RACE)
  
  
  const raceInfo: RaceInfo = {
    sof: totalStrength / data.length,
    weather: "",
    trackName: sessionInfo?.weekendInfo?.trackDisplayName ?? "",
    trackLength: getTrackLength(sessionInfo),
    lap: dataAccess.getNumber("RaceLaps"),
    lapsRemaining: dataAccess.getNumber("SessionLapsRemain"),
    sessionTimeRemaining: dataAccess.getNumber("SessionTimeRemain"),
    sessionTime: dataAccess.getNumber("SessionTime"),
    isTimedRace: true,
    sessionNum,
    sessionState: dataAccess.getNumber("SessionState"),
    sessionType,
    playerIdx: sessionInfo.driverInfo.driverCarIdx,
    playerCarData: data.find(data => data.driver.isPlayer)
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
  for (let driver of Object.values(drivers)) {
    if (driver.carIsPaceCar || driver.isSpectator) {
      // log.warn(`Ignoring driver is pace car or spectator`)
      continue
    }

    const [licenseLetter, licenseSR] = asOption(driver.licString)
      .map(s => s.split(" "))
      .filter(it => it.length === 2)
      .getOrElse(["R", "0"])

    const newDriverInfo: DriverInfo =
      driverInfoMap[driver.carIdx] ??
      ({
        relativeSpeed: 0
      } as DriverInfo)

    Object.assign(newDriverInfo, {
      carId: driver.carID,
      idx: driver.carIdx,
      carNumber: driver.carNumber,
      ...asOption(sessionInfo.qualifyResultsInfo)
        .map(q => q.results.find(r => r.carIdx === driver.carIdx))
        .map(r => ({
          qualifiedPosition: r.position,
          qualifiedClassPosition: r.classPosition
        }))
        .getOrElse({ qualifiedPosition: 0, qualifiedClassPosition: 0 }),
      username: driver.userName,
      isPlayer: sessionInfo.driverInfo.driverCarIdx === driver.carIdx,
      iRating: driver.iRating,
      license: licenseLetter,
      licenseColor: toHexColor(driver.licColor, "FFFFFF"),
      safetyRating: licenseSR,
      isSpectator: driver.isSpectator,
      curIncidentCount: driver.curDriverIncidentCount,
      curTeamIncidentCount: driver.teamIncidentCount,
      carScreenName: driver.carScreenName,
      carClassColor: toHexColor(driver.carClassColor, "FF0000")
    })

    newDriverInfoMap[newDriverInfo.idx] = newDriverInfo
  }

  return newDriverInfoMap
}

export type LeaderboardMode = "RELATIVE" | "STANDINGS"

export function updateCarData(
  mode: LeaderboardMode,
  sessionInfo: SessionInfoMessage,
  driverInfoMap: Record<number, DriverInfo>,
  dataVarValues: SessionDataVariableValueMap
): CarData[] {
  const dataAccess = SessionDataAccess.create(dataVarValues, DataVarNames),
    cars = Array<CarData>(),
    drivers = window.Object.values(driverInfoMap),
    trackLength = getTrackLength(sessionInfo)

  for (const driver of drivers) {
    const idx = driver.idx

    try {
      const lapPercentComplete = dataAccess.getNumber("CarIdxLapDistPct", idx, -1),
        lapTimeEst = dataAccess.getNumber("CarIdxEstTime", idx, -1),
        lap = dataAccess.getNumber("CarIdxLap", idx, -1)

      if (lap === -1 || lapPercentComplete === -1 || lapTimeEst === -1) {
        continue
      }

      const previousRelativeSpeed = driver.relativeSpeed,
        relativeSpeed =
          lapTimeEst < 10 && previousRelativeSpeed > 0
            ? previousRelativeSpeed
            : (lapPercentComplete * trackLength) / lapTimeEst,
        totalDistance = (lap + lapPercentComplete) * trackLength

      if (relativeSpeed > 0 && (!driver.relativeSpeed || lapTimeEst >= 10)) {
        driver.relativeSpeed = relativeSpeed
      }

      const data: CarData = {
        idx,
        lap,
        lapCompleted: dataAccess.getNumber("CarIdxLapCompleted", idx, -1),
        lapPercentComplete,
        lapTimeBest: dataAccess.getNumber("CarIdxBestLapTime", idx, -1),
        lapTimeLast: dataAccess.getNumber("CarIdxLastLapTime", idx, -1),
        trackLocationSurface: dataAccess.getNumber("CarIdxTrackSurface", idx, -1),
        lapTimeEst,
        totalDistance,
        relativeTimeToPlayer: 0,
        relativeDistanceToPlayer: 0,
        timeToLeader: dataAccess.getNumber("CarIdxF2Time", idx, -1),
        position: asOption(dataAccess.getNumber("CarIdxPosition", idx, -1))
          .filter(it => it > 0)
          .getOrElse(driver.qualifiedPosition),
        classPosition: asOption(dataAccess.getNumber("CarIdxClassPosition", idx, -1))
          .filter(it => it > 0)
          .getOrElse(driver.qualifiedClassPosition),
        estSpeed: relativeSpeed,
        driver
      }

      if (data.trackLocationSurface > -1 && data.lap > -1) {
        cars.push(data)
      }
    } catch (err) {
      log.error(`Unable to update ${idx}`, err)
    }
  }

  if (mode === "RELATIVE") {
    const playerCarData = cars.find(data => data.driver.isPlayer)
    if (playerCarData) {
      for (const car of cars) {
        if (car.driver.isPlayer) {
          continue
        }

        const [min, max] = [
          Math.min(playerCarData.lapPercentComplete, car.lapPercentComplete),
          Math.max(playerCarData.lapPercentComplete, car.lapPercentComplete)
        ]

        car.relativeDistanceToPlayer = Math.abs((max - min) * trackLength)
        car.relativeTimeToPlayer = !car.relativeDistanceToPlayer ? 0 : car.relativeDistanceToPlayer / car.estSpeed
      }

      let pct = playerCarData.lapPercentComplete,
        pctStart = pct - 0.5,
        pctEnd = pct + 0.5,
        behindRanges = Array<Pair<number, number>>(),
        aheadRanges = Array<Pair<number, number>>()

      if (pctStart < 0) {
        behindRanges.push([0.0, pct], [1.0 + pctStart, 1.0])
      } else {
        behindRanges.push([pctStart, pct])
      }

      if (pctEnd > 1.0) {
        aheadRanges.push([pct, 1.0], [0, pctEnd - 1.0])
      } else {
        aheadRanges.push([pct, pctEnd])
      }

      let [behindCars, aheadCars] = partition(
        cars.filter(car => !car.driver.isPlayer),
        car => behindRanges.some(([min, max]) => car.lapPercentComplete >= min && car.lapPercentComplete <= max)
      )

      // behindCars = behindCars.sort((a, b) => pctStart + a.lapPercentComplete
      // - (pctStart + b.lapPercentComplete)).reverse() aheadCars.sort((a, b)
      // => pctEnd - a.lapPercentComplete - (pctEnd - b.lapPercentComplete))
      behindCars = behindCars.sort((a, b) => a.relativeTimeToPlayer - b.relativeTimeToPlayer)
      aheadCars.sort((a, b) => a.relativeTimeToPlayer - b.relativeTimeToPlayer).reverse()
      const relativeCars = [...aheadCars, playerCarData, ...behindCars]

      //const playerTimeToLeader = playerCarData.timeToLeader
      // if (playerTimeToLeader >= 0) {

      //}
      return relativeCars
    }
    // return cars.sort((a, b) => b.relativeTimeToPlayer -
    // a.relativeTimeToPlayer)
  }
  return cars.sort((a, b) => a.position - b.position)
}
