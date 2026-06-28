import { PublishPriceConnector } from './base'
export class ShefaBirkatHashemConnector extends PublishPriceConnector {
  chainSlug = 'shefa-birkat-hashem'
  chainName = '??? ???? ???'
  get priceIndexUrl() { return 'https://publishprice.shefabirtsin.co.il/' }
}