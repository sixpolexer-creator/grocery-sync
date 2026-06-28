import { PublishPriceConnector } from './base'
export class VictoryConnector extends PublishPriceConnector {
  chainSlug = 'victory'
  chainName = 'ויקטורי'
  get priceIndexUrl() { return 'https://publishprice.victory.co.il/' }
  get promoIndexUrl() { return 'https://publishprice.victory.co.il/' }
}
