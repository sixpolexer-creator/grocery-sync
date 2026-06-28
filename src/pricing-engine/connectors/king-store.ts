import { PublishPriceConnector } from './base'
export class KingStoreConnector extends PublishPriceConnector {
  chainSlug = 'king-store'
  chainName = '???? ????'
  get priceIndexUrl() { return 'https://publishprice.kingstore.co.il/' }
}