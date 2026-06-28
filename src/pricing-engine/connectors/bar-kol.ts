import { PublishPriceConnector } from './base'
export class BarKolConnector extends PublishPriceConnector {
  chainSlug = 'bar-kol'
  chainName = '?? ???'
  get priceIndexUrl() { return 'https://publishprice.barkol.co.il/' }
}