import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number;
}

@Injectable()
export class MlService {
  private readonly logger = new Logger(MlService.name);

  constructor(private readonly config: ConfigService) {}

  async train(userId = 'default_user') {
    const { stdout } = await this.runPython('train.py', ['--user-id', userId]);
    return this.parseJson(stdout, 'train');
  }

  async forecast(months = 6) {
    const { stdout } = await this.runPython('forecast.py', ['--months', String(months)]);
    return this.parseJson(stdout, 'forecast');
  }

  private mlDir(): string {
    const configured = this.config.get<string>('ML_DIR') ?? 'ml';
    // Resolve relative to backend/ (one level up from dist/ at runtime, or src/ during dev)
    return resolve(process.cwd(), configured);
  }

  private resolvePython(): string {
    const configured = this.config.get<string>('PYTHON_BIN') ?? 'python';
    const venvWin = join(this.mlDir(), '.venv', 'Scripts', 'python.exe');
    const venvPosix = join(this.mlDir(), '.venv', 'bin', 'python');
    if (existsSync(venvWin)) return venvWin;
    if (existsSync(venvPosix)) return venvPosix;
    return configured;
  }

  private runPython(script: string, args: string[]): Promise<SpawnResult> {
    const cwd = this.mlDir();
    const scriptPath = join(cwd, script);
    if (!existsSync(scriptPath)) {
      throw new InternalServerErrorException(`ML script not found: ${scriptPath}`);
    }
    const python = this.resolvePython();
    this.logger.log(`Spawning ${python} ${script} ${args.join(' ')}`);

    return new Promise((resolvePromise, rejectPromise) => {
      const proc = spawn(python, [scriptPath, ...args], { cwd, windowsHide: true });
      let stdout = '';
      let stderr = '';
      proc.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });
      proc.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });
      proc.on('error', (err) => rejectPromise(err));
      proc.on('close', (code) => {
        if (code === 0) {
          resolvePromise({ stdout, stderr, code: code ?? 0 });
        } else {
          this.logger.error(`Python ${script} exited ${code}: ${stderr}`);
          rejectPromise(
            new InternalServerErrorException({
              message: `Python ${script} failed`,
              exitCode: code,
              stderr: stderr.trim(),
            }),
          );
        }
      });
    });
  }

  private parseJson(raw: string, label: string) {
    const trimmed = raw.trim();
    if (!trimmed) {
      throw new InternalServerErrorException(`Empty output from ${label}`);
    }
    // In case the script printed multiple lines, take the last JSON line
    const lastLine = trimmed.split(/\r?\n/).filter(Boolean).pop() ?? trimmed;
    try {
      return JSON.parse(lastLine);
    } catch (err) {
      this.logger.error(`Failed to parse ${label} JSON: ${lastLine}`);
      throw new InternalServerErrorException(`Invalid JSON from ${label}: ${(err as Error).message}`);
    }
  }
}
