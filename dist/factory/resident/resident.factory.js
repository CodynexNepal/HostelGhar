"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ResidentFactory = void 0;
const resident_controller_1 = require("../../controller/resident/resident.controller");
const resident_repository_1 = require("../../repository/resident/resident.repository");
class ResidentFactory {
    constructor() { }
    static create() {
        const residentRepository = new resident_repository_1.ResidentRepository();
        return new resident_controller_1.ResidentController(residentRepository);
    }
}
exports.ResidentFactory = ResidentFactory;
