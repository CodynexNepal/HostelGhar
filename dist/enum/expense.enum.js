"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExpenseStatus = exports.ExpenseCategory = void 0;
var ExpenseCategory;
(function (ExpenseCategory) {
    ExpenseCategory["STAFF"] = "STAFF";
    ExpenseCategory["FOOD"] = "FOOD";
    ExpenseCategory["MAINTENANCE"] = "MAINTENANCE";
    ExpenseCategory["UTILITIES"] = "UTILITIES";
    ExpenseCategory["ELECTRICITY"] = "ELECTRICITY";
    ExpenseCategory["WATER"] = "WATER";
    ExpenseCategory["SUPPLIES"] = "SUPPLIES";
    ExpenseCategory["INTERNET"] = "INTERNET";
    ExpenseCategory["OTHER"] = "OTHER";
})(ExpenseCategory || (exports.ExpenseCategory = ExpenseCategory = {}));
var ExpenseStatus;
(function (ExpenseStatus) {
    ExpenseStatus["PENDING"] = "PENDING";
    ExpenseStatus["PAID"] = "PAID";
    ExpenseStatus["CANCELLED"] = "CANCELLED";
})(ExpenseStatus || (exports.ExpenseStatus = ExpenseStatus = {}));
