"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthFactory = void 0;
const user_repository_1 = require("../../repository/auth/user.repository");
const auth_controller_1 = require("../../controller/auth/auth.controller");
const auth_services_1 = require("../../services/auth/auth.services");
class AuthFactory {
    constructor() { }
    static create() {
        const userRepository = new user_repository_1.UserRepository();
        const authService = new auth_services_1.AuthService(userRepository);
        return new auth_controller_1.AuthController(authService);
    }
}
exports.AuthFactory = AuthFactory;
