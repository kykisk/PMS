import { IsString, IsOptional, IsIn } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateExecutionDto {
  @ApiProperty()
  @IsString()
  testCaseId: string;

  @ApiProperty({ enum: ['pass', 'fail', 'blocked', 'skipped'] })
  @IsIn(['pass', 'fail', 'blocked', 'skipped'])
  result: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actual?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
