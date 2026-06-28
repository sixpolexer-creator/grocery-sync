import { PublishPriceConnector } from './base'
export class SalachDabachConnector extends PublishPriceConnector {
  chainSlug = 'salach-dabach'
  chainName = '???? ????'
  get priceIndexUrl() { return 'https://publishprice.salachdabach.co.il/' }
}