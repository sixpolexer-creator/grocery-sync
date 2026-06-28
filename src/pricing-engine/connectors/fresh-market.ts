import { PublishPriceConnector } from './base'
export class FreshMarketConnector extends PublishPriceConnector {
  chainSlug = 'fresh-market'
  chainName = '??? ????'
  get priceIndexUrl() { return 'https://publishprice.freshmarket.co.il/' }
}