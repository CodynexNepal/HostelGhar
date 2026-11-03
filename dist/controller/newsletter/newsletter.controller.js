"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
class NewsletterController {
    constructor(newsletterService) {
        this.newsletterService = newsletterService;
        this.subscribe = async (req, res, next) => {
            try {
                const { email, source } = req.body;
                if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email.trim())) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Please provide a valid email address.',
                    });
                    return;
                }
                const ipAddress = req.ip || req.socket.remoteAddress || null;
                const { subscription, isNew } = await this.newsletterService.subscribe(email, source || 'website-footer', ipAddress);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: isNew
                        ? 'Welcome to the Hostel Ghar community! You are now subscribed.'
                        : 'You are already on our priority newsletter list!',
                    data: {
                        email: subscription.email,
                        createdAt: subscription.createdAt,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.unsubscribe = async (req, res, next) => {
            try {
                const { email } = req.body;
                if (!email) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Email is required to unsubscribe.',
                    });
                    return;
                }
                await this.newsletterService.unsubscribe(email);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'You have been unsubscribed from newsletter updates.',
                });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.NewsletterController = NewsletterController;
