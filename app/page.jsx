import CampPage from './camp-page'
import { CustomerLayout } from './customer-layout'
import { pageMetadata } from '../lib/request-language'

export const generateMetadata = () => pageMetadata('จองลานและอุปกรณ์')

export default function Home() {
  return <CustomerLayout><CampPage /></CustomerLayout>
}
