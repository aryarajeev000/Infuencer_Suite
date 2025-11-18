// appmetrica.controller.ts
import { 
  Controller, 
  Get, 
  UseGuards, 
  Request, 
  UnauthorizedException, 
  Injectable, 
  ExecutionContext 
} from '@nestjs/common';
import { AppmetricaService } from './appmetrica.service';

// ---- MOCK AUTH GUARD ----
// Replace this with JwtAuthGuard in production
@Injectable()
class MockAuthGuard {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();

    // In real app, JWT decoded payload sets req.user
    req.user = { 
      _id: req.headers['x-mock-user-id'] || '6912273ea74a59746533529d',
      name: 'Authenticated Influencer' 
    };

    return true;
  }
}

@Controller('appmetrica')
export class AppmetricaController {
  constructor(private readonly appmetricaService: AppmetricaService) {}

  @Get('stats')
  @UseGuards(MockAuthGuard)
  async getStats(@Request() req: any) {

    const influencerId = req.user?._id;

    if (!influencerId) {
      throw new UnauthorizedException('Authentication token missing influencer ID');
    }

    // Call service to fetch: clicks, installs, registrations, earnings, referralLink
    return this.appmetricaService.getInfluencerStats(influencerId);
  }
}
