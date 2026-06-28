import { PublishPriceConnector } from './base'
export class NetivHachesedConnector extends PublishPriceConnector {
  chainSlug = 'netiv-hachesed'
  chainName = '???? ????'
  get priceIndexUrl() { return 'https://publishprice.netivhachesed.co.il/' }
}