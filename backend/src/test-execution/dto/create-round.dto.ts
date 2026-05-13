import { IsString, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateRoundDto {
  @ApiProperty()
  @IsString()
  testerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  testerDept?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  executedAt?: string;

  @ApiPropertyOptional({ description: 'full | partial', default: 'full' })
  @IsOptional()
  @IsString()
  scope?: string;

  @ApiPropertyOptional({ description: 'partial일 때 참조할 회차 ID' })
  @IsOptional()
  @IsString()
  sourceRoundId?: string;
}
