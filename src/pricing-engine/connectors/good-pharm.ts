import { PublishPriceConnector } from './base'
export class GoodPharmConnector extends PublishPriceConnector {
  chainSlug = 'good-pharm'
  chainName = '??? ????'
  get priceIndexUrl() { return 'https://publishprice.goodpharm.co.il/' }
}