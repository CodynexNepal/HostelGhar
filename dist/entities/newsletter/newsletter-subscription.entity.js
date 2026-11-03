"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterSubscription = exports.NewsletterStatus = void 0;
const typeorm_1 = require("typeorm");
var NewsletterStatus;
(function (NewsletterStatus) {
    NewsletterStatus["ACTIVE"] = "ACTIVE";
    NewsletterStatus["UNSUBSCRIBED"] = "UNSUBSCRIBED";
})(NewsletterStatus || (exports.NewsletterStatus = NewsletterStatus = {}));
let NewsletterSubscription = class NewsletterSubscription {
};
exports.NewsletterSubscription = NewsletterSubscription;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], NewsletterSubscription.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 255, unique: true }),
    __metadata("design:type", String)
], NewsletterSubscription.prototype, "email", void 0);
__decorate([
    (0, typeorm_1.Column)({
        type: 'enum',
        enum: NewsletterStatus,
        default: NewsletterStatus.ACTIVE,
    }),
    __metadata("design:type", String)
], NewsletterSubscription.prototype, "status", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 100, nullable: true, default: 'footer' }),
    __metadata("design:type", Object)
], NewsletterSubscription.prototype, "source", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 64, nullable: true }),
    __metadata("design:type", Object)
], NewsletterSubscription.prototype, "ipAddress", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], NewsletterSubscription.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ type: 'timestamptz' }),
    __metadata("design:type", Date)
], NewsletterSubscription.prototype, "updatedAt", void 0);
exports.NewsletterSubscription = NewsletterSubscription = __decorate([
    (0, typeorm_1.Entity)('newsletter_subscriptions'),
    (0, typeorm_1.Index)('idx_newsletter_email', ['email'], { unique: true })
], NewsletterSubscription);
