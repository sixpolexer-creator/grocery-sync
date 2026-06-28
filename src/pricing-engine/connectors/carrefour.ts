import { PublishPriceConnector } from './base'
export class CarrefourConnector extends PublishPriceConnector {
  chainSlug = 'carrefour'
  chainName = '?????'
  get priceIndexUrl() { return 'https://publishprice.carrefour.co.il/' }
}