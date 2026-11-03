import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OperatorId } from '../auth/decorators/operator-id.decorator';
import { StrictThrottle } from '../common/decorators/strict-throttle.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { ConditionalAuthGuard } from '../auth/guards/conditional-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';
import { RaceService } from './race.service';

@ApiTags('races')
@ApiBearerAuth('access-token')
@Controller('api/races')
@UseGuards(ConditionalAuthGuard, RolesGuard)
export class RaceController {
  constructor(private readonly raceService: RaceService) {}

  @Get()
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'レース一覧取得' })
  findAll() {
    return this.raceService.findAll();
  }

  @Get(':id')
  @Roles('admin', 'operator', 'viewer')
  @ApiOperation({ summary: 'レース詳細取得' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.raceService.findOne(id);
  }

  @StrictThrottle()
  @Post()
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'レース作成' })
  @ApiResponse({
    status: 409,
    description: '同日・同名・同競馬場のレースが既に存在する',
  })
  create(
    @Body() createRaceDto: CreateRaceDto,
    @OperatorId() operatorId: string,
  ) {
    return this.raceService.create(createRaceDto, operatorId);
  }

  @Patch(':id')
  @Roles('admin', 'operator')
  @ApiOperation({ summary: 'レース更新（楽観ロック）' })
  @ApiResponse({ status: 409, description: '他のリクエストが先に更新した' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('version', ParseIntPipe) version: number,
    @Body() updateRaceDto: UpdateRaceDto,
    @OperatorId() operatorId: string,
  ) {
    return this.raceService.update(id, version, updateRaceDto, operatorId);
  }

  @Delete(':id')
  @Roles('admin')
  @HttpCode(204)
  @ApiOperation({ summary: 'レース削除' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.raceService.remove(id);
  }
}
