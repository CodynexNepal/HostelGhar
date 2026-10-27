"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminFactory = void 0;
const admin_controller_1 = require("../../controller/admin/admin.controller");
const admin_repository_1 = require("../../repository/admin/admin.repository");
const admin_services_1 = require("../../services/admin/admin.services");
const user_repository_1 = require("../../repository/auth/user.repository");
class AdminFactory {
    constructor() { }
    static create() {
        const adminRepository = new admin_repository_1.AdminRepository();
        const adminService = new admin_services_1.AdminService(adminRepository, new user_repository_1.UserRepository());
        return new admin_controller_1.AdminController(adminService);
    }
}
exports.AdminFactory = AdminFactory;
