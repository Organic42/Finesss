import { plainToInstance } from 'class-transformer';
import { IsBooleanString, IsIn, IsInt, IsOptional, IsString, Min, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsInt()
  PORT: number = 4000;

  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string = 'development';

  @IsString()
  DB_HOST: string;

  @IsInt()
  @Min(1)
  DB_PORT: number;

  @IsString()
  DB_USERNAME: string;

  @IsString()
  DB_PASSWORD: string;

  @IsString()
  DB_DATABASE: string;

  @IsBooleanString()
  @IsOptional()
  DB_SYNCHRONIZE?: string;

  @IsString()
  @IsOptional()
  CORS_ORIGIN?: string;

  @IsString()
  @IsOptional()
  GEMINI_API_KEY?: string;

  @IsString()
  @IsOptional()
  PYTHON_BIN?: string;

  @IsString()
  @IsOptional()
  ML_DIR?: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const coerced = {
    ...config,
    PORT: config.PORT ? Number(config.PORT) : 4000,
    DB_PORT: config.DB_PORT ? Number(config.DB_PORT) : 5432,
  };
  const validated = plainToInstance(EnvironmentVariables, coerced, { enableImplicitConversion: true });
  const errors = validateSync(validated, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error('Environment validation failed: ' + errors.map((e) => e.toString()).join('; '));
  }
  return validated;
}
