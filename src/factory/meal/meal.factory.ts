// ──────────────────────────────────────────────────────────────────────────────
// FILE: meal.factory.ts
// PURPOSE: Factory for initializing MealController with its dependencies.
// ──────────────────────────────────────────────────────────────────────────────

import { MealController } from '../../controller/meal/meal.controller';
import { MealRepository } from '../../repository/meal/meal.repository';
import { MealService } from '../../services/meal/meal.service';

export class MealFactory {
  private constructor() {}

  public static create(): MealController {
    const repo = new MealRepository();
    const service = new MealService(repo);
    return new MealController(service);
  }
}
