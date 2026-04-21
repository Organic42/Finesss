"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MlModule = void 0;
const common_1 = require("@nestjs/common");
const ml_controller_js_1 = require("./ml.controller.js");
const ml_service_js_1 = require("./ml.service.js");
let MlModule = class MlModule {
};
exports.MlModule = MlModule;
exports.MlModule = MlModule = __decorate([
    (0, common_1.Module)({
        controllers: [ml_controller_js_1.MlController],
        providers: [ml_service_js_1.MlService],
        exports: [ml_service_js_1.MlService],
    })
], MlModule);
//# sourceMappingURL=ml.module.js.map