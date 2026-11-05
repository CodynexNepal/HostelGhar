"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HostelListingController = void 0;
const statusCode_interface_1 = require("../../constant/statusCode.interface");
const socket_server_1 = require("../../socket/socket.server");
const queue_constants_1 = require("../../constant/queue.constants");
class HostelListingController {
    constructor(listingService) {
        this.listingService = listingService;
        this.submit = async (req, res, next) => {
            try {
                const { hostelName, type, totalBeds, phone, city, area, address, priceFrom, negotiable, amenities, description, rules, photos, ownerName, email, } = req.body;
                if (!hostelName || typeof hostelName !== 'string' || hostelName.trim().length === 0) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Hostel name is required.',
                    });
                    return;
                }
                if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Contact phone number is required.',
                    });
                    return;
                }
                if (!email || typeof email !== 'string' || !/^\S+@\S+\.\S+$/.test(email)) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'A valid owner email is required.',
                    });
                    return;
                }
                if (!ownerName || typeof ownerName !== 'string' || ownerName.trim().length === 0) {
                    res.status(statusCode_interface_1.STATUS_CODE.BAD_REQUEST).json({
                        success: false,
                        message: 'Owner name is required.',
                    });
                    return;
                }
                const ipAddress = req.ip || req.socket.remoteAddress || null;
                const submission = await this.listingService.submitListingRequest({
                    hostelName,
                    type: type || 'coed',
                    totalBeds: parseInt(totalBeds, 10) || 0,
                    phone,
                    city: city || 'Kathmandu',
                    area,
                    address: address || '',
                    priceFrom: priceFrom ? parseFloat(priceFrom) : null,
                    negotiable: Boolean(negotiable),
                    amenities,
                    description,
                    rules,
                    photos,
                    ownerName,
                    email,
                    ipAddress,
                });
                try {
                    socket_server_1.socketServer.toRole('ADMIN', queue_constants_1.SocketEvent.LISTING_REQUEST_CREATED, submission);
                    socket_server_1.socketServer.toRole('SUPER_ADMIN', queue_constants_1.SocketEvent.LISTING_REQUEST_CREATED, submission);
                }
                catch {
                    // non-blocking
                }
                res.status(statusCode_interface_1.STATUS_CODE.CREATED).json({
                    success: true,
                    message: 'Your hostel listing request has been submitted successfully! Our team will review and contact you shortly.',
                    data: {
                        id: submission.id,
                        hostelName: submission.hostelName,
                        createdAt: submission.createdAt,
                    },
                });
            }
            catch (error) {
                next(error);
            }
        };
        this.list = async (req, res, next) => {
            try {
                const page = parseInt(req.query.page, 10) || 1;
                const limit = parseInt(req.query.limit, 10) || 20;
                const result = await this.listingService.listRequests(page, limit);
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, ...result });
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
                const { status, adminNotes } = req.body;
                const updated = await this.listingService.updateStatus(id, status, adminNotes);
                if (!updated) {
                    res.status(statusCode_interface_1.STATUS_CODE.NOT_FOUND).json({ success: false, message: 'Listing request not found.' });
                    return;
                }
                try {
                    socket_server_1.socketServer.toRole('ADMIN', 'listing_request:updated', updated);
                    socket_server_1.socketServer.toRole('SUPER_ADMIN', 'listing_request:updated', updated);
                }
                catch {
                    // non-blocking
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, data: updated, message: 'Status updated successfully.' });
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
                const deleted = await this.listingService.deleteRequest(id);
                if (!deleted) {
                    res.status(statusCode_interface_1.STATUS_CODE.NOT_FOUND).json({ success: false, message: 'Listing request not found.' });
                    return;
                }
                res.status(statusCode_interface_1.STATUS_CODE.OK).json({ success: true, message: 'Listing request deleted successfully.' });
            }
            catch (error) {
                next(error);
            }
        };
    }
}
exports.HostelListingController = HostelListingController;
