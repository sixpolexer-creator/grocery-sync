import { PublishPriceConnector } from './base'
export class ZolVebegadolConnector extends PublishPriceConnector {
  chainSlug = 'zol-vebegadol'
  chainName = '??? ??????'
  get priceIndexUrl() { return 'https://publishprice.zolvebegadol.co.il/' }
}