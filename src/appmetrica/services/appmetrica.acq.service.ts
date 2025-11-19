import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AppmetricaAcqService {
  private readonly logger = new Logger(AppmetricaAcqService.name);

  private readonly ACQ_URL =
    'https://api.appmetrica.yandex.com/v2/user/acquisition';

  private readonly APP_ID = process.env.APPMETRICA_APP_ID;
  private readonly PUBLISHER = process.env.APPMETRICA_PUBLISHER;
  private readonly CAMPAIGN = process.env.APPMETRICA_CAMPAIGN;
  private readonly INSTALL_TYPE = process.env.APPMETRICA_INSTALL_TYPE;
  private readonly OAUTH_TOKEN = process.env.APP_METRICA_AUTH_TOKEN;

  constructor(private readonly httpService: HttpService) {}

  async getClicksAndInstalls(influencerId: string) {
    this.logger.log(`🔎 Fetching acquisition stats for: ${influencerId}`);

    try {
      const params = {
        ids: this.APP_ID,
        id: this.APP_ID,
        date1: '2024-01-01',
        date2: 'today',
        group: 'Day',
        metrics:
          'impressions,clicks,devices,deeplinks,conversion,sessions',
        dimensions: "urlParameter{'ad_content'}",
        limit: 10000,
        accuracy: 'medium',
        include_undefined: true,
        currency: 'RUB',
        sort: '-devices',
        source: 'installation',
        filters: `
          (publisher=='${this.PUBLISHER}'
          AND campaign=='${this.CAMPAIGN}'
          AND installType=='${this.INSTALL_TYPE}')
        `,
      };

      const res = await lastValueFrom(
        this.httpService.get(this.ACQ_URL, {
          headers: { Authorization: `OAuth ${this.OAUTH_TOKEN}` },
          params,
        }),
      );

      const rows = res.data?.data || [];
      this.logger.log(`📌 ACQ ROW COUNT = ${rows.length}`);
      this.logger.log(`📌 ACQ RAW DATA:\n${JSON.stringify(rows, null, 2)}`);

      const match = rows.find(
        (r: any) =>
          String(r.dimensions?.[0]?.value) === influencerId ||
          String(r.dimensions?.[0]?.name) === influencerId,
      );

      if (!match) {
        this.logger.warn(`⚠ No acquisition row for ${influencerId}`);
        return { clicks: 0, installs: 0 };
      }

      const clicks = match.metrics?.[1] ?? 0;
      const installs = match.metrics?.[2] ?? 0;

      this.logger.log(
        `✔ MATCH: clicks=${clicks}, installs=${installs}`,
      );

      return { clicks, installs };
    } catch (err) {
      this.logger.error(
        '❌ Acquisition API error',
        err.response?.data || err.message,
      );
      return { clicks: 0, installs: 0 };
    }
  }
}
