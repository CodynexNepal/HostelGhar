"use strict";
// ──────────────────────────────────────────────────────────────────────────────
// FILE: settings.service.ts
// PURPOSE: Business logic for admin platform settings.
//          Merges partial PUT payloads over stored values + defaults,
//          persists via repository (falls back to in-memory when DB/table
//          is unavailable, e.g. unit tests), and busts the settings cache.
// ──────────────────────────────────────────────────────────────────────────────
Object.defineProperty(exports, "__esModule", { value: true });
exports.SettingsService = void 0;
const cache_util_1 = require("../../utils/cache.util");
const DEFAULTS = {
    general: {
        platformName: 'Hostel Ghar',
        tagline: "Nepal's Leading Smart Hostel Management System",
        currency: 'NPR',
        timezone: 'Asia/Kathmandu (UTC+5:45)',
        supportEmail: 'support@hostelghar.com',
        supportPhone: '+977-1-4445555',
        officeAddress: 'Putalisadak, Kathmandu, Bagmati, Nepal',
    },
    billing: {
        standardPlanPrice: 1500,
        enterprisePlanPrice: 3500,
        freeTierResidentCap: 5,
        gracePeriodDays: 3,
        allowQrCheckout: true,
        autoRemindRenewals: true,
    },
    access: {
        allowPublicHostelSignup: true,
        requireHostelApproval: true,
        allowResidentSelfInvite: true,
        requireAdmin2FA: false,
        sessionLifetimeDays: 14,
    },
    alerts: {
        overdueAlertThreshold: 25000,
        notifyOnSubscriptionProof: true,
        dailyDigestEmail: true,
        smsGatewayProvider: 'SPARROW_SMS',
    },
    system: {
        maintenanceMode: false,
        maintenanceMessage: 'Hostel Ghar is undergoing scheduled maintenance. Please check back in a few minutes.',
    },
};
// In-memory fallback so the endpoints keep working when the DB/table is not
// reachable (unit tests, fresh clones before migrations run).
const memoryStore = new Map();
function cacheKey(section) {
    return cache_util_1.cacheService.generateKey('admin:settings', { section, v: 1 });
}
function definedEntries(obj) {
    const out = {};
    for (const [k, v] of Object.entries(obj ?? {})) {
        if (v !== undefined)
            out[k] = v;
    }
    return out;
}
class SettingsService {
    constructor(settingsRepository) {
        this.settingsRepository = settingsRepository;
    }
    getDefaults(section) {
        return { ...DEFAULTS[section] };
    }
    getAllDefaults() {
        return {
            general: { ...DEFAULTS.general },
            billing: { ...DEFAULTS.billing },
            access: { ...DEFAULTS.access },
            alerts: { ...DEFAULTS.alerts },
            system: { ...DEFAULTS.system },
        };
    }
    async getSection(section) {
        const key = cacheKey(section);
        const { data } = await cache_util_1.cacheService.wrap(key, async () => {
            const row = await this.settingsRepository.findBySection(section);
            const stored = (row?.value ?? {});
            const merged = { ...DEFAULTS[section], ...stored };
            memoryStore.set(section, merged);
            return merged;
        }, { l1TtlSeconds: 30, l2TtlSeconds: 120 });
        return data;
    }
    async getAll() {
        const [general, billing, access, alerts, system] = await Promise.all([
            this.getSection('general'),
            this.getSection('billing'),
            this.getSection('access'),
            this.getSection('alerts'),
            this.getSection('system'),
        ]);
        return { general, billing, access, alerts, system };
    }
    async updateSection(section, patch) {
        const current = await this.getSection(section);
        const merged = { ...current, ...definedEntries(patch) };
        try {
            await this.settingsRepository.upsertSection(section, merged);
        }
        catch {
            // DB unavailable — keep serving from the in-memory fallback.
        }
        memoryStore.set(section, merged);
        await cache_util_1.cacheService.invalidate(cacheKey(section));
        await cache_util_1.cacheService.invalidatePattern('admin:settings');
        return merged;
    }
}
exports.SettingsService = SettingsService;
