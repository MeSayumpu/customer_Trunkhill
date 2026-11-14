import CampPage from '../camp-page'
import { CustomerLayout } from '../customer-layout'
import { pageMetadata } from '../../lib/request-language'

export const generateMetadata = () => pageMetadata('ตรวจสอบการจอง')

export default function ReviewPage() {
  return <CustomerLayout><CampPage review /></CustomerLayout>
}
