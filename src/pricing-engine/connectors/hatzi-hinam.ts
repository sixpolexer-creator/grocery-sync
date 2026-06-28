import { PublishPriceConnector } from './base'
export class HatziHinamConnector extends PublishPriceConnector {
  chainSlug = 'hatzi-hinam'
  chainName = '??? ????'
  get priceIndexUrl() { return 'https://www.hazi-hinam.co.il/publicprice' }
}