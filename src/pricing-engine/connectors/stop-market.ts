import { PublishPriceConnector } from './base'
export class StopMarketConnector extends PublishPriceConnector {
  chainSlug = 'stop-market'
  chainName = '???? ????'
  get priceIndexUrl() { return 'https://publishprice.stopmarket.co.il/' }
}