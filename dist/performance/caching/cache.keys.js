"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cacheKey = void 0;
const cacheKey = (namespace, identifier) => `cache:${namespace}:${identifier}`;
exports.cacheKey = cacheKey;
