import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { config } from '@fortawesome/fontawesome-svg-core'
import { faHardDrive, faTrash, faBars, faXmark, faGaugeHigh, faClipboardList, faRightFromBracket, faPhoneSlash,
  faCampground, faBed, faChair, faMapLocationDot, faImages, faGear, faFilter, faDownload,
  faClock, faCircleCheck, faCoins, faArrowLeft, faArrowRight, faChevronDown, faChevronRight,
  faCalendarDays, faCreditCard, faFloppyDisk, faPlus, faMagnifyingGlass, faArrowRotateLeft, faCircleInfo, faAddressBook, faBullhorn, faNoteSticky, faTriangleExclamation, faUserShield, faRightToBracket } from '@fortawesome/free-solid-svg-icons'

config.autoAddCss = false
const icons = { storage:faHardDrive, trash:faTrash, menu:faBars, close:faXmark, dashboard:faGaugeHigh, bookings:faClipboardList,
  checkout:faRightFromBracket, checkin:faRightToBracket, blockedPhones:faPhoneSlash, plots:faCampground, rooms:faBed,
  gear:faChair, plotMap:faMapLocationDot, zoneMedia:faImages, settings:faGear,
  filter:faFilter, download:faDownload, all:faClipboardList, pending:faClock,
  confirmed:faCircleCheck, revenue:faCoins, back:faArrowLeft, next:faArrowRight,
  down:faChevronDown, right:faChevronRight, rates:faCalendarDays, payment:faCreditCard,
  policy:faArrowRotateLeft, save:faFloppyDisk, add:faPlus, search:faMagnifyingGlass,
  facilities:faCircleInfo, contacts:faAddressBook, welcome:faBullhorn, note:faNoteSticky, warning:faTriangleExclamation, staff:faUserShield }
export function AdminIcon({name,className=''}) {
  return <FontAwesomeIcon icon={icons[name] || faGear} className={'admin-icon '+className} aria-hidden="true"/>
}
