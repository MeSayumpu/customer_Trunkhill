import {
  faRulerCombined,faPlug,faBolt,faWifi,faSignal,faRestroom,faToilet,faShower,faBath,faSink,faFaucet,
  faSquareParking,faCar,faVanShuttle,faStore,faMugHot,faMugSaucer,faUtensils,faKitchenSet,faBowlFood,faFireBurner,
  faFire,faTree,faLeaf,faMountainSun,faSun,faCloudSun,faMoon,faWater,faFish,faPersonSwimming,faPersonHiking,
  faBicycle,faBinoculars,faCamera,faDog,faPaw,faChild,faBaby,faPeopleGroup,faTent,faCampground,faHouseChimney,
  faLightbulb,faVolumeLow,faShieldHalved,faKitMedical,faFireExtinguisher,faTrashCan,faRecycle,faBottleWater,
  faSnowflake,faFan,faWheelchair,faBanSmoking,faMusic,faRoad,faLocationDot,faClock,faStar,faCircleCheck,
} from '@fortawesome/free-solid-svg-icons'

// Icons the admin can pick for a zone's highlights and recommended facilities.
// The key is what gets stored, so never rename an existing key.
export const zoneFeatureIcons = [
  ['area',faRulerCombined,'ขนาดพื้นที่'],['plug',faPlug,'ปลั๊กไฟ'],['power',faBolt,'ไฟฟ้า'],['wifi',faWifi,'Wi-Fi'],
  ['signal',faSignal,'สัญญาณมือถือ'],['restroom',faRestroom,'ห้องน้ำ'],['toilet',faToilet,'สุขา'],['shower',faShower,'ฝักบัว'],
  ['bath',faBath,'อ่างอาบน้ำ'],['sink',faSink,'จุดล้างจาน'],['tap',faFaucet,'ก๊อกน้ำ'],['parking',faSquareParking,'ที่จอดรถ'],
  ['car',faCar,'รถเข้าถึงได้'],['van',faVanShuttle,'รถตู้ / แคมป์ปิ้งคาร์'],['store',faStore,'ร้านค้า'],['coffee',faMugHot,'กาแฟ'],
  ['cafe',faMugSaucer,'คาเฟ่'],['food',faUtensils,'ร้านอาหาร'],['kitchen',faKitchenSet,'ครัว'],['meal',faBowlFood,'อาหาร'],
  ['stove',faFireBurner,'เตา'],['campfire',faFire,'ก่อกองไฟได้'],['shade',faTree,'ร่มไม้'],['nature',faLeaf,'ธรรมชาติ'],
  ['view',faMountainSun,'วิวภูเขา'],['sunrise',faSun,'แสงแดด / พระอาทิตย์'],['weather',faCloudSun,'อากาศดี'],['night',faMoon,'บรรยากาศกลางคืน'],
  ['water',faWater,'ริมน้ำ'],['fishing',faFish,'ตกปลา'],['swim',faPersonSwimming,'เล่นน้ำ'],['hike',faPersonHiking,'เดินป่า'],
  ['bike',faBicycle,'ปั่นจักรยาน'],['stars',faBinoculars,'ดูดาว / ดูนก'],['photo',faCamera,'จุดถ่ายรูป'],['dog',faDog,'นำสุนัขมาได้'],
  ['pet',faPaw,'สัตว์เลี้ยง'],['kids',faChild,'เหมาะกับเด็ก'],['baby',faBaby,'เด็กเล็ก'],['group',faPeopleGroup,'มาเป็นกลุ่ม'],
  ['tent',faTent,'เต็นท์'],['camp',faCampground,'ลานกางเต็นท์'],['cabin',faHouseChimney,'บ้านพัก'],['light',faLightbulb,'ไฟส่องสว่าง'],
  ['quiet',faVolumeLow,'เงียบสงบ'],['security',faShieldHalved,'ปลอดภัย'],['firstAid',faKitMedical,'ปฐมพยาบาล'],
  ['extinguisher',faFireExtinguisher,'ถังดับเพลิง'],['trash',faTrashCan,'จุดทิ้งขยะ'],['recycle',faRecycle,'แยกขยะ'],
  ['drinkingWater',faBottleWater,'น้ำดื่ม'],['cool',faSnowflake,'อากาศเย็น'],['fan',faFan,'พัดลม'],['accessible',faWheelchair,'ผู้ใช้วีลแชร์'],
  ['noSmoking',faBanSmoking,'ห้ามสูบบุหรี่'],['music',faMusic,'เปิดเพลงได้'],['road',faRoad,'ถนนเข้าถึง'],['location',faLocationDot,'ตำแหน่ง'],
  ['time',faClock,'เวลา'],['star',faStar,'จุดเด่น'],['check',faCircleCheck,'มีให้บริการ'],
]
const iconByKey = new Map(zoneFeatureIcons.map(([key,icon]) => [key,icon]))
export const zoneFeatureIcon = key => iconByKey.get(key) ?? faCircleCheck

export const zoneFeatureGroups = [
  ['highlights','จุดเด่นของโซน'],
  ['facilities','สิ่งอำนวยความสะดวกที่แนะนำ'],
]
export const zoneFeatureLimit = 12
const limits = {label:60,note:80}

const clean = (value,max) => typeof value === 'string' ? value.trim().replace(/\s+/g,' ').slice(0,max) : ''

// Accepts the stored JSON (string or object) and always returns {highlights:[],facilities:[]}.
export function normalizeZoneFeatures(raw) {
  let value = raw
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { value = null } }
  return Object.fromEntries(zoneFeatureGroups.map(([group]) => [group,
    (Array.isArray(value?.[group]) ? value[group] : []).map(item => ({
      icon:iconByKey.has(item?.icon) ? item.icon : 'check',
      label:clean(item?.label,limits.label), labelEn:clean(item?.labelEn,limits.label),
      note:clean(item?.note,limits.note), noteEn:clean(item?.noteEn,limits.note),
    })).filter(item => item.label).slice(0,zoneFeatureLimit)]))
}

// A plot's own pick from its zone's lists, stored as {"highlights":[label,...],"facilities":[label,...]}.
// null means the plot was never customised and shows everything its zone has.
export function plotFeatureSelection(raw) {
  let value = raw
  if (typeof value === 'string') { try { value = JSON.parse(value) } catch { value = null } }
  if (!value || typeof value !== 'object') return null
  return Object.fromEntries(zoneFeatureGroups.map(([group]) => [group,
    (Array.isArray(value[group]) ? value[group] : []).filter(label => typeof label === 'string')]))
}

// The zone's features narrowed to the ones picked for a plot.
export function plotFeatures(zoneFeatures, raw) {
  const features = zoneFeatures ?? normalizeZoneFeatures(null)
  const selection = plotFeatureSelection(raw)
  if (!selection) return features
  return Object.fromEntries(zoneFeatureGroups.map(([group]) => [group,
    features[group].filter(item => selection[group].includes(item.label))]))
}

// Strict check for what the admin submits; returns an error message or ''.
export function zoneFeaturesError(value) {
  if (!value || typeof value !== 'object') return 'ข้อมูลจุดเด่นไม่ถูกต้อง'
  for (const [group,title] of zoneFeatureGroups) {
    const items = value[group]
    if (!Array.isArray(items)) return 'ข้อมูลจุดเด่นไม่ถูกต้อง'
    if (items.length > zoneFeatureLimit) return `${title} เพิ่มได้ไม่เกิน ${zoneFeatureLimit} รายการ`
    for (const item of items) {
      if (!iconByKey.has(item?.icon)) return `${title}: กรุณาเลือกไอคอน`
      if (!clean(item?.label,999)) return `${title}: กรุณากรอกชื่อรายการ`
      for (const [field,max] of [['label',limits.label],['labelEn',limits.label],['note',limits.note],['noteEn',limits.note]]) {
        if (item[field] != null && (typeof item[field] !== 'string' || item[field].trim().length > max)) return `${title}: ข้อความยาวเกินไป`
      }
    }
  }
  return ''
}
