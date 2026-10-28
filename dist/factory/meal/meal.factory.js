"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.factory.ts
// PURPOSE: Factory for initializing MealController with its dependencies.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.MealFactory = void 0;
const meal_controller_1 = require("../../controller/meal/meal.controller");
const meal_repository_1 = require("../../repository/meal/meal.repository");
const meal_service_1 = require("../../services/meal/meal.service");
class MealFactory {
    constructor() { }
    static create() {
        const repo = new meal_repository_1.MealRepository();
        const service = new meal_service_1.MealService(repo);
        return new meal_controller_1.MealController(service);
    }
}
exports.MealFactory = MealFactory;
