import { PublishPriceConnector } from './base'
export class KeshetTeamimConnector extends PublishPriceConnector {
  chainSlug = 'keshet-teamim'
  chainName = '??? ?????'
  get priceIndexUrl() { return 'https://publishprice.keshetteamim.co.il/' }
}