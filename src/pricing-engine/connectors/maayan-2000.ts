import { PublishPriceConnector } from './base'
export class Maayan2000Connector extends PublishPriceConnector {
  chainSlug = 'maayan-2000'
  chainName = '????? 2000'
  get priceIndexUrl() { return 'https://publishprice.maayan2000.co.il/' }
}