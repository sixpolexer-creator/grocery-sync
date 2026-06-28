import { PublishPriceConnector } from './base'
export class TivTaamConnector extends PublishPriceConnector {
  chainSlug = 'tiv-taam'
  chainName = '??? ???'
  get priceIndexUrl() { return 'https://publishprice.tivtaam.co.il/' }
}