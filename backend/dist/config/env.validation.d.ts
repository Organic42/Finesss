declare class EnvironmentVariables {
    PORT: number;
    NODE_ENV: string;
    DB_HOST: string;
    DB_PORT: number;
    DB_USERNAME: string;
    DB_PASSWORD: string;
    DB_DATABASE: string;
    DB_SYNCHRONIZE?: string;
    CORS_ORIGIN?: string;
    GEMINI_API_KEY?: string;
    PYTHON_BIN?: string;
    ML_DIR?: string;
}
export declare function validateEnv(config: Record<string, unknown>): EnvironmentVariables;
export {};
