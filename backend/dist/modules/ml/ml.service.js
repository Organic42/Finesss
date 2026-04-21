"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var MlService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MlService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const node_child_process_1 = require("node:child_process");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
let MlService = MlService_1 = class MlService {
    config;
    logger = new common_1.Logger(MlService_1.name);
    constructor(config) {
        this.config = config;
    }
    async train(userId = 'default_user') {
        const { stdout } = await this.runPython('train.py', ['--user-id', userId]);
        return this.parseJson(stdout, 'train');
    }
    async forecast(months = 6) {
        const { stdout } = await this.runPython('forecast.py', ['--months', String(months)]);
        return this.parseJson(stdout, 'forecast');
    }
    mlDir() {
        const configured = this.config.get('ML_DIR') ?? 'ml';
        return (0, node_path_1.resolve)(process.cwd(), configured);
    }
    resolvePython() {
        const configured = this.config.get('PYTHON_BIN') ?? 'python';
        const venvWin = (0, node_path_1.join)(this.mlDir(), '.venv', 'Scripts', 'python.exe');
        const venvPosix = (0, node_path_1.join)(this.mlDir(), '.venv', 'bin', 'python');
        if ((0, node_fs_1.existsSync)(venvWin))
            return venvWin;
        if ((0, node_fs_1.existsSync)(venvPosix))
            return venvPosix;
        return configured;
    }
    runPython(script, args) {
        const cwd = this.mlDir();
        const scriptPath = (0, node_path_1.join)(cwd, script);
        if (!(0, node_fs_1.existsSync)(scriptPath)) {
            throw new common_1.InternalServerErrorException(`ML script not found: ${scriptPath}`);
        }
        const python = this.resolvePython();
        this.logger.log(`Spawning ${python} ${script} ${args.join(' ')}`);
        return new Promise((resolvePromise, rejectPromise) => {
            const proc = (0, node_child_process_1.spawn)(python, [scriptPath, ...args], { cwd, windowsHide: true });
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
                }
                else {
                    this.logger.error(`Python ${script} exited ${code}: ${stderr}`);
                    rejectPromise(new common_1.InternalServerErrorException({
                        message: `Python ${script} failed`,
                        exitCode: code,
                        stderr: stderr.trim(),
                    }));
                }
            });
        });
    }
    parseJson(raw, label) {
        const trimmed = raw.trim();
        if (!trimmed) {
            throw new common_1.InternalServerErrorException(`Empty output from ${label}`);
        }
        const lastLine = trimmed.split(/\r?\n/).filter(Boolean).pop() ?? trimmed;
        try {
            return JSON.parse(lastLine);
        }
        catch (err) {
            this.logger.error(`Failed to parse ${label} JSON: ${lastLine}`);
            throw new common_1.InternalServerErrorException(`Invalid JSON from ${label}: ${err.message}`);
        }
    }
};
exports.MlService = MlService;
exports.MlService = MlService = MlService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], MlService);
//# sourceMappingURL=ml.service.js.map