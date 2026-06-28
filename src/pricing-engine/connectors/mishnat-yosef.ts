import { PublishPriceConnector } from './base'
export class MishnatYosefConnector extends PublishPriceConnector {
  chainSlug = 'mishnat-yosef'
  chainName = '???? ????'
  get priceIndexUrl() { return 'https://publishprice.mishnatyosef.co.il/' }
}