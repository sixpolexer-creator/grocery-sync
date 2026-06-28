import { PublishPriceConnector } from './base'
export class OsherAdConnector extends PublishPriceConnector {
  chainSlug = 'osher-ad'
  chainName = '???? ??'
  get priceIndexUrl() { return 'https://publishprice.osherad.co.il/' }
}