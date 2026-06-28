import { PublishPriceConnector } from './base'
export class MahsaneiHashukConnector extends PublishPriceConnector {
  chainSlug = 'mahsanei-hashuk'
  chainName = '????? ????'
  get priceIndexUrl() { return 'https://publishprice.mahsaneihashuk.co.il/' }
}