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
import { ConditionalAuthGuard } from '../auth/guards/conditional-auth.guard';
import { CreateRaceDto } from './dto/create-race.dto';
import { UpdateRaceDto } from './dto/update-race.dto';
import { RaceService } from './race.service';

@ApiTags('races')
@ApiBearerAuth('access-token')
@Controller('api/races')
@UseGuards(ConditionalAuthGuard) // RolesGuard は 2.6 節で追加する
export class RaceController {
  constructor(private readonly raceService: RaceService) {}

  @Get()
  @ApiOperation({ summary: 'レース一覧取得' })
  findAll() {
    return this.raceService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'レース個別取得' })
  @ApiResponse({ status: 404, description: '指定した ID のレースが存在しない' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.raceService.findOne(id);
  }

  @Post()
  @ApiOperation({ summary: 'レース作成' })
  @ApiResponse({
    status: 409,
    description: '同日・同名・同会場のレースが既に存在する',
  })
  create(
    @Body() createRaceDto: CreateRaceDto,
    @OperatorId() operatorId: string,
  ) {
    return this.raceService.create(createRaceDto, operatorId);
  }

  @Patch(':id')
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
  @HttpCode(204)
  @ApiOperation({ summary: 'レース削除' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.raceService.remove(id);
  }
}
