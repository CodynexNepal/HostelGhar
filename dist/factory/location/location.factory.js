"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: location.factory.ts
// PURPOSE: Factory for initializing LocationController with its dependencies.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.LocationFactory = void 0;
const location_controller_1 = require("../../controller/location/location.controller");
const location_service_1 = require("../../services/location/location.service");
class LocationFactory {
    constructor() { }
    static create() {
        const service = new location_service_1.LocationService();
        return new location_controller_1.LocationController(service);
    }
}
exports.LocationFactory = LocationFactory;
