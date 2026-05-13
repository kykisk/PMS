import { IsString, IsOptional, IsInt, IsArray, ValidateNested } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class SaveResultDto {
  @ApiProperty()
  @IsString()
  scenarioCode: string;

  @ApiProperty()
  @IsString()
  caseTitle: string;

  @ApiProperty()
  @IsInt()
  caseIndex: number;

  @ApiPropertyOptional({ description: 'pass | fail | blocked | na' })
  @IsOptional()
  @IsString()
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  actual?: string;

  @ApiPropertyOptional()
  @IsOptional()
  stepResults?: any;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defectId?: string;
}

export class BulkSaveResultDto {
  @ApiProperty({ type: [SaveResultDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveResultDto)
  results: SaveResultDto[];
}
