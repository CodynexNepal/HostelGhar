"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsletterController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const socket_server_1 = require("../../socket/socket.server");
const queue_constants_1 = require("../../constant/queue.constants");
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
                try {
                    socket_server_1.socketServer.toRole('ADMIN', queue_constants_1.SocketEvent.NEWSLETTER_SUBSCRIBED, subscription);
                    socket_server_1.socketServer.toRole('SUPER_ADMIN', queue_constants_1.SocketEvent.NEWSLETTER_SUBSCRIBED, subscription);
                }
                catch {
                    // non-blocking
                }
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
                try {
                    socket_server_1.socketServer.toRole('ADMIN', queue_constants_1.SocketEvent.NEWSLETTER_SUBSCRIBED, { email, status: 'UNSUBSCRIBED' });
                    socket_server_1.socketServer.toRole('SUPER_ADMIN', queue_constants_1.SocketEvent.NEWSLETTER_SUBSCRIBED, { email, status: 'UNSUBSCRIBED' });
                }
                catch {
                    // non-blocking
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({
                    success: true,
                    message: 'You have been unsubscribed from newsletter updates.',
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.list = async (req, res, next) => {
            try {
                const page = parseInt(req.query.page, 10) || 1;
                const limit = parseInt(req.query.limit, 10) || 50;
                const result = await this.newsletterService.listSubscriptions(page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
            }
            catch (error) {
                next(error);
            }
        };
        this.delete = async (req, res, next) => {
            try {
                const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
                if (!id) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({ success: false, message: 'ID is required.' });
                    return;
                }
                const deleted = await this.newsletterService.deleteSubscription(id);
                if (!deleted) {
                    res.status(statusCode_interface_1.STATUS_CODE.NOT_FOUND).json({ success: false, message: 'Subscriber not found.' });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, message: 'Subscriber removed successfully.' });
            }
            catch (error) {
                next(error);
            }
        };
        this.updateStatus = async (req, res, next) => {
            try {
                const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
                if (!id) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({ success: false, message: 'ID is required.' });
                    return;
                }
                const { status } = req.body;
                const updated = await this.newsletterService.updateStatus(id, status);
                if (!updated) {
                    res.status(statusCode_interface_1.STATUS_CODE.NOT_FOUND).json({ success: false, message: 'Subscriber not found.' });
                    return;
                }
                try {
                    socket_server_1.socketServer.toRole('ADMIN', queue_constants_1.SocketEvent.NEWSLETTER_SUBSCRIBED, updated);
                    socket_server_1.socketServer.toRole('SUPER_ADMIN', queue_constants_1.SocketEvent.NEWSLETTER_SUBSCRIBED, updated);
                }
                catch {
                    // non-blocking
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data: updated, message: 'Status updated.' });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.NewsletterController = NewsletterController;
