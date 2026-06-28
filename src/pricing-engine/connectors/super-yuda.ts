import { PublishPriceConnector } from './base'
export class SuperYudaConnector extends PublishPriceConnector {
  chainSlug = 'super-yuda'
  chainName = '???? ????'
  get priceIndexUrl() { return 'https://publishprice.superyuda.co.il/' }
}