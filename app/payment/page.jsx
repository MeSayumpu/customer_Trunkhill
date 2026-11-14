import { PaymentScreen } from './payment-screen'
import { CustomerLayout } from '../customer-layout'
import { pageMetadata } from '../../lib/request-language'

export const generateMetadata = () => pageMetadata('ชำระเงิน')

export default async function PaymentPage({searchParams}) {
  const {id} = await searchParams
  return <CustomerLayout><PaymentScreen id={typeof id === 'string' ? id : ''}/></CustomerLayout>
}
