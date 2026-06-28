import { PublishPriceConnector } from './base'
export class YeshChesedConnector extends PublishPriceConnector {
  chainSlug = 'yesh-chesed'
  chainName = '?? ???'
  get priceIndexUrl() { return 'https://publishprice.yeshchesed.co.il/' }
}