import { PublishPriceConnector } from './base'
export class YeinotBitanConnector extends PublishPriceConnector {
  chainSlug = 'yeinot-bitan'
  chainName = '????? ????'
  get priceIndexUrl() { return 'https://publishprice.yeinotbitan.co.il/' }
}