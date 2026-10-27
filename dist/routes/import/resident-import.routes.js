"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.residentImportRouter = void 0;
// ──────────────────────────────────────────────────────────────────────────────
// FILE: resident-import.routes.ts
// PURPOSE: Import Residents endpoints (background CSV): template, upload,
//          history, detail, plan limits.
// ──────────────────────────────────────────────────────────────────────────────
const express_1 = require("express");
const resident_import_controller_1 = require("../../controller/import/resident-import.controller");
const auth_middleware_1 = require("../../middleware/auth.middleware");
const roles_enum_1 = require("../../enum/roles.enum");
const http_decorator_1 = require("../../decorators/http.decorator");
const upload_middleware_1 = require("../../middleware/upload.middleware");
const hostel_context_middleware_1 = require("../../middleware/hostel-context.middleware");
const residentImportRouter = (0, express_1.Router)();
exports.residentImportRouter = residentImportRouter;
residentImportRouter.use(auth_middleware_1.authenticate, (0, auth_middleware_1.requireRoles)(roles_enum_1.IROLES.OWNER, roles_enum_1.IROLES.ADMIN));
residentImportRouter.get('/template', resident_import_controller_1.residentImportController.downloadTemplate);
residentImportRouter.get('/plan-limits', resident_import_controller_1.residentImportController.getPlanLimits);
residentImportRouter.get('/', resident_import_controller_1.residentImportController.getHistory);
residentImportRouter.post('/', hostel_context_middleware_1.resolveHostelId, upload_middleware_1.uploadResidentCsv, resident_import_controller_1.residentImportController.startImport);
residentImportRouter.get('/:id', (0, http_decorator_1.requireParam)('id'), resident_import_controller_1.residentImportController.getDetail);
