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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MlController = void 0;
const common_1 = require("@nestjs/common");
const ml_service_js_1 = require("./ml.service.js");
const forecast_query_dto_js_1 = require("./dto/forecast-query.dto.js");
let MlController = class MlController {
    service;
    constructor(service) {
        this.service = service;
    }
    train(userId) {
        return this.service.train(userId ?? 'default_user');
    }
    forecast(query) {
        return this.service.forecast(query.months ?? 6);
    }
};
exports.MlController = MlController;
__decorate([
    (0, common_1.Post)('train'),
    __param(0, (0, common_1.Body)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MlController.prototype, "train", null);
__decorate([
    (0, common_1.Get)('forecast'),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [forecast_query_dto_js_1.ForecastQueryDto]),
    __metadata("design:returntype", void 0)
], MlController.prototype, "forecast", null);
exports.MlController = MlController = __decorate([
    (0, common_1.Controller)('ml'),
    __metadata("design:paramtypes", [ml_service_js_1.MlService])
], MlController);
//# sourceMappingURL=ml.controller.js.map