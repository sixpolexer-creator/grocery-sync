import { PublishPriceConnector } from './base'
export class YohananofConnector extends PublishPriceConnector {
  chainSlug = 'yohananof'
  chainName = '???????'
  get priceIndexUrl() { return 'https://www.yohananof.co.il/prices' }
}