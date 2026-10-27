"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.psqlDbConfig = exports.AppDataSource = void 0;
var database_source_1 = require("../database/database-source");
Object.defineProperty(exports, "AppDataSource", { enumerable: true, get: function () { return database_source_1.AppDataSource; } });
var psqlDb_config_1 = require("../configs/psqlDb.config");
Object.defineProperty(exports, "psqlDbConfig", { enumerable: true, get: function () { return psqlDb_config_1.psqlDbConfig; } });
