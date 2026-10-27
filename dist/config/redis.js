"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.redisOptions = exports.redisClient = exports.createRedisClient = void 0;
var redis_config_1 = require("../configs/redis.config");
Object.defineProperty(exports, "createRedisClient", { enumerable: true, get: function () { return redis_config_1.createRedisClient; } });
Object.defineProperty(exports, "redisClient", { enumerable: true, get: function () { return redis_config_1.redisClient; } });
Object.defineProperty(exports, "redisOptions", { enumerable: true, get: function () { return redis_config_1.redisOptions; } });
