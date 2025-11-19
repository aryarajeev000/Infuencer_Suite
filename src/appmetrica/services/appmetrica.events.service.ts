import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class AppmetricaEventsService {
  private readonly logger = new Logger(AppmetricaEventsService.name);

  private readonly LOGS_URL =
    'https://api.appmetrica.yandex.com/logs/v1/export/events.json';

  private readonly APP_ID = process.env.APPMETRICA_APP_ID;
  private readonly OAUTH_TOKEN = process.env.APP_METRICA_AUTH_TOKEN;

  constructor(private readonly httpService: HttpService) {}

  async getRegistrationEvents(influencerId: string) {
    this.logger.log(`🔎 Fetching registration events for: ${influencerId}`);

    try {
      const params = {
        application_id: this.APP_ID,
        date_since: '2024-01-01',
        date_until: '2030-12-31',
        fields: 'event_name,event_json',
        limit: 10000,
      };

      const res = await lastValueFrom(
        this.httpService.get(this.LOGS_URL, {
          headers: {
            Authorization: `OAuth ${this.OAUTH_TOKEN}`,
            Accept: 'application/json',
          },
          params,
        }),
      );

      const events = res.data?.data || [];
      this.logger.log(`📌 EVENTS COUNT = ${events.length}`);

      let count = 0;

      for (const ev of events) {
        if (ev.event_name !== 'register') continue;

        let params = ev.event_json;

        if (typeof params === 'string') {
          try {
            params = JSON.parse(params);
          } catch {
            this.logger.warn(`⚠ Invalid JSON`);
            continue;
          }
        }

        const adContent =
          params?.ad_content ??
          params?.params?.ad_content ??
          null;

        this.logger.log(
          `➡ Checking event ad_content=${adContent} against ${influencerId}`,
        );

        if (String(adContent) === influencerId) {
          count++;
          this.logger.log(`✔ REGISTER MATCH! COUNT=${count}`);
        }
      }

      this.logger.log(
        `✔ FINAL REGISTRATIONS FOR ${influencerId}: ${count}`,
      );

      return count;
    } catch (e) {
      this.logger.error(
        '❌ Registration API error',
        e.response?.data || e.message,
      );
      return 0;
    }
  }
}
