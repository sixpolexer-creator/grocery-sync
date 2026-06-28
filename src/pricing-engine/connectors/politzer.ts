import { PublishPriceConnector } from './base'
export class PolitzerConnector extends PublishPriceConnector {
  chainSlug = 'politzer'
  chainName = '??????'
  get priceIndexUrl() { return 'https://publishprice.politzer.co.il/' }
}