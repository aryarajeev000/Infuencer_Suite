// appmetrica.service.ts
import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Document } from 'mongoose';
import { Influencer } from './influencer.schema';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AppmetricaService {
  private readonly logger = new Logger(AppmetricaService.name);

  private readonly BASE_URL =
    'https://api.appmetrica.yandex.com/v2/user/acquisition';

  private readonly APP_ID = process.env.APPMETRICA_APP_ID;
  private readonly PUBLISHER = process.env.APPMETRICA_PUBLISHER;
  private readonly CAMPAIGN = process.env.APPMETRICA_CAMPAIGN;
  private readonly INSTALL_TYPE = process.env.APPMETRICA_INSTALL_TYPE;
  private readonly OAUTH_TOKEN = process.env.APP_METRICA_AUTH_TOKEN;
  private readonly MASTER_TRACKER_ID = process.env.APPMETRICA_MASTER_TRACKER_ID;

  private readonly TRACKING_BASE_URL =
    'https://redirect.appmetrica.yandex.com/serve/';

  constructor(
    @InjectModel(Influencer.name)
    private influencerModel: Model<Influencer & Document>,
    private readonly httpService: HttpService,
  ) { }

  /**
   * Fetch installs & clicks via correct AppMetrica parameters
   */
  async getInstallsByAd(influencerMongoId: string): Promise<number> {
    try {
      const params = {
        id: this.APP_ID,
        ids: this.APP_ID,
        date1: '2024-01-01',
        date2: 'today',
        group: 'Day',

        // correct metrics
        metrics:
          'impressions,clicks,devices,deeplinks,conversion,sessions',

        // only ad_content dimension (as per your request URL)
        dimensions: "urlParameter{'ad_content'}",

        limit: 10000,
        accuracy: 'medium',
        include_undefined: true,
        currency: 'RUB',
        sort: '-devices',

        // ONLY valid source
        source: 'installation',

        lang: 'en',
        request_domain: 'com',

        // 🔥 CRITICAL — MATCHES YOUR WORKING API URL EXACTLY
        filters: `(
            publisher=='${this.PUBLISHER}' 
            AND campaign=='${this.CAMPAIGN}' 
            AND installType=='${this.INSTALL_TYPE}'
        )`,
      };

      const response = await lastValueFrom(
        this.httpService.get(this.BASE_URL, {
          headers: { Authorization: `OAuth ${this.OAUTH_TOKEN}` },
          params,
        }),
      );

      const rows = response.data?.data || [];
      //this.logger.log("📌 FULL APIMETRICA RESPONSE:");
      //this.logger.log(JSON.stringify(rows, null, 2));

      // row MUST match influencer _id
      const matchedRow = rows.find(
        (row: any) =>
          String(row?.dimensions?.[0]?.name) === String(influencerMongoId) ||
          String(row?.dimensions?.[0]?.value) === String(influencerMongoId),
      );

      if (!matchedRow) {
        this.logger.warn(`⚠ No AppMetrica row found for influencer ${influencerMongoId}`);
        return 0;
      }

      // metrics index mapping:
      // 0 = impressions
      // 1 = clicks
      // 2 = devices (installs)
      const impressions = matchedRow.metrics?.[0] ?? 0;
      const clicks = matchedRow.metrics?.[1] ?? 0;
      const installs = matchedRow.metrics?.[2] ?? 0;

      // Print results
      this.logger.log(`📌 AD_CONTENT (Influencer ID): ${influencerMongoId}`);
      this.logger.log(`📊 Impressions: ${impressions}`);
      this.logger.log(`📌 Clicks: ${clicks}`);
      this.logger.log(`📌 Installs: ${installs}`);

      return installs;
    } catch (error: any) {
      this.logger.error(
        `❌ AppMetrica API request failed`,
        error.response?.data || error.message,
      );
      return 0;
    }
  }

  //function to build the referral link
  private buildReferralLink(influencerId: string): string {
    return `https://${this.APP_ID}.redirect.appmetrica.yandex.com/?appmetrica_tracking_id=${this.MASTER_TRACKER_ID}&referrer=reattribution%3D1&ad_content=${influencerId}`;
  }



  /**
   * Update influencer stats & calculate earnings
   */
  async getInfluencerStats(influencerId: string) {
    try {
      const influencer = await this.influencerModel.findById(influencerId);

      if (!influencer) {
        throw new NotFoundException(
          `Influencer with ID ${influencerId} not found.`,
        );
      }

      const installs = await this.getInstallsByAd(String(influencer._id));

      const eligibleGroups = Math.floor(installs / 20);
      const earnings = eligibleGroups * 1;

      const referralLink = this.buildReferralLink(String(influencer._id));

      influencer.installs = installs;
      influencer.earnings = earnings;
      await influencer.save();

      return {
        name: influencer.name,
        installs,
        earnings: earnings.toFixed(2),
        referralLink,
      };
    } catch (error: any) {
      this.logger.error('Service failure:', error.message);
      throw new InternalServerErrorException(
        'Error calculating influencer stats',
      );
    }
  }
}
