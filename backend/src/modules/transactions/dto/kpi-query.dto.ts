import { IsDateString, IsOptional, IsString } from 'class-validator';

export class KpiQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsDateString()
  start?: string;

  @IsOptional()
  @IsDateString()
  end?: string;
}
