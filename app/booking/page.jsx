import { BookingManagement } from './booking-management'
import { CustomerLayout } from '../customer-layout'
import { pageMetadata } from '../../lib/request-language'

export const generateMetadata = () => pageMetadata('ตรวจสอบการจอง')

export default function BookingPage() {
  return <CustomerLayout><BookingManagement/></CustomerLayout>
}
