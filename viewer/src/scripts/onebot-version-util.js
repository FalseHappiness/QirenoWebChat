import { isString } from "@/scripts/types-util.js";
import semver from "semver";
import { useGlobalStore } from "@/store/global.js";

/**
 * 比较版本 version 是否大于等于 target
 * @param version
 * @param target
 * @returns {boolean}
 */
const gte = (version, target) => {
  if (!isString(version, target)) {
    return false
  }
  const strip = v => v.split('-')[0]
  return semver.gte(strip(version), strip(target))
}

const versionInfo = () => {
  return useGlobalStore().apiVersionInfo
}

const version = () => {
  return versionInfo()?.app_version
}

const gteSnowLuma = (...ver) => {
  if (!isSnowLuma()) return false
  return gte(version(), ver.join("."))
}
const isSnowLuma = () => {
  return versionInfo()?.app_name?.includes("SnowLuma") || false
}

export { isSnowLuma, gteSnowLuma };