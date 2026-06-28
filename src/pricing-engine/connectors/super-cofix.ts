import { PublishPriceConnector } from './base'
export class SuperCofixConnector extends PublishPriceConnector {
  chainSlug = 'super-cofix'
  chainName = '???? ??????'
  get priceIndexUrl() { return 'https://publishprice.supercofix.co.il/' }
}