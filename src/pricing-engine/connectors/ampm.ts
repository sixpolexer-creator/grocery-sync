import { PublishPriceConnector } from './base'
export class AmpmConnector extends PublishPriceConnector {
  chainSlug = 'ampm'
  chainName = 'AM:PM'
  get priceIndexUrl() { return 'https://publishprice.ampm.co.il/' }
}