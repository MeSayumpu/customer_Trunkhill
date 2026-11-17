import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { config } from '@fortawesome/fontawesome-svg-core'
import { faFaceSadTear,faCalendarDays,faMapLocationDot,faMagnifyingGlass,faCircleInfo,faUsers,faCampground,
  faSuitcase,faTrashCan,faPen,faXmark,faChevronLeft,faChevronRight,faPlus,faMinus,faImages,
  faClipboardCheck,faVideo,faComment,faQrcode,faBuildingColumns,faCopy,faDownload,faExpand,
  faPhone,faArrowRight,faCircleCheck,faReceipt,faPrint,faCloudArrowUp,faRestroom,faSink,faMugSaucer,faUtensils,
  faTent,faTents,faHouseChimney,faCube,faRotateLeft,faRotateRight,faMagnifyingGlassPlus,faMagnifyingGlassMinus,
  faTriangleExclamation,faCheck,faArrowLeft,faMountainSun,faLayerGroup,faCamera,faChevronDown,faAddressCard,faDiamondTurnRight,faArrowUpRightFromSquare,faLocationDot,faCartFlatbed,faKitMedical } from '@fortawesome/free-solid-svg-icons'
config.autoAddCss=false
const icons={cry:faFaceSadTear,calendar:faCalendarDays,map:faMapLocationDot,search:faMagnifyingGlass,info:faCircleInfo,
  guests:faUsers,stay:faCampground,gear:faSuitcase,remove:faTrashCan,edit:faPen,close:faXmark,
  previous:faChevronLeft,next:faChevronRight,plus:faPlus,minus:faMinus,gallery:faImages,
  details:faCircleInfo,rules:faClipboardCheck,video:faVideo,caption:faComment,qr:faQrcode,
  bank:faBuildingColumns,copy:faCopy,download:faDownload,expand:faExpand,phone:faPhone,
  arrow:faArrowRight,back:faArrowLeft,check:faCircleCheck,tick:faCheck,receipt:faReceipt,print:faPrint,upload:faCloudArrowUp,
  bathroom:faRestroom,wash:faSink,cafe:faMugSaucer,food:faUtensils,
  tent:faTent,tents:faTents,cabin:faHouseChimney,cube:faCube,rotateLeft:faRotateLeft,rotateRight:faRotateRight,
  zoomIn:faMagnifyingGlassPlus,zoomOut:faMagnifyingGlassMinus,warning:faTriangleExclamation,
  mountain:faMountainSun,layers:faLayerGroup,camera:faCamera,more:faChevronDown,contact:faAddressCard,directions:faDiamondTurnRight,external:faArrowUpRightFromSquare,pin:faLocationDot,cart:faCartFlatbed,firstAid:faKitMedical}
export function CustomerIcon({name,className=''}) {
  return <FontAwesomeIcon icon={icons[name]||faCircleInfo} className={'customer-icon '+className} aria-hidden="true"/>
}
