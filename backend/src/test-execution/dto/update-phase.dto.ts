import { PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreatePhaseDto } from './create-phase.dto';

export class UpdatePhaseDto extends PartialType(CreatePhaseDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;
}
