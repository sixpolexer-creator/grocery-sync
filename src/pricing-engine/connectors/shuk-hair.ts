import { PublishPriceConnector } from './base'
export class ShukHairConnector extends PublishPriceConnector {
  chainSlug = 'shuk-hair'
  chainName = '??? ????'
  get priceIndexUrl() { return 'https://publishprice.shukahair.co.il/' }
}