"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: platform-qr.factory.ts
// PURPOSE: Factory to instantiate PlatformQrController with its dependencies.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformQrFactory = void 0;
const platform_qr_controller_1 = require("../../controller/platform-qr/platform-qr.controller");
const platform_qr_repository_1 = require("../../repository/platform-qr/platform-qr.repository");
const platform_qr_service_1 = require("../../services/platform-qr/platform-qr.service");
class PlatformQrFactory {
    constructor() { }
    static create() {
        const repository = new platform_qr_repository_1.PlatformQrRepository();
        const service = new platform_qr_service_1.PlatformQrService(repository);
        return new platform_qr_controller_1.PlatformQrController(service);
    }
}
exports.PlatformQrFactory = PlatformQrFactory;
