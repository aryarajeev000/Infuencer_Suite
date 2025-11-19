import {
  Controller,
  Get,
  UseGuards,
  Request,
  UnauthorizedException,
  Injectable,
  ExecutionContext,
} from '@nestjs/common';

import { AppmetricaMergeService } from '../services/appmetrica.merge.service';

// TEMP mock guard
@Injectable()
class MockAuthGuard {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    req.user = {
      _id: req.headers['x-mock-user-id'] || '6912273ea74a59746533529d'
    };
    return true;
  }
}

@Controller('appmetrica')
export class AppmetricaController {
  constructor(private readonly mergeService: AppmetricaMergeService) {}

  @Get('stats')
  @UseGuards(MockAuthGuard)
  async getStats(@Request() req: any) {
    const id = req.user._id;

    if (!id) throw new UnauthorizedException('User ID missing');

    return await this.mergeService.getStats(id);
  }
}
