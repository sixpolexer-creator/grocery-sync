import { PublishPriceConnector } from './base'
export class SuperBareketConnector extends PublishPriceConnector {
  chainSlug = 'super-bareket'
  chainName = '???? ????'
  get priceIndexUrl() { return 'https://publishprice.superbareket.co.il/' }
}