import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'admin@pms.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Hong Gildong' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'Admin1234!' })
  @IsString()
  @MinLength(8)
  password: string;
}
