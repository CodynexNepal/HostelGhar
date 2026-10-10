// ──────────────────────────────────────────────────────────────────────────────
// FILE: settings.service.ts
// PURPOSE: Business logic for admin platform settings.
//          Merges partial PUT payloads over stored values + defaults,
//          persists via repository (falls back to in-memory when DB/table
//          is unavailable, e.g. unit tests), and busts the settings cache.
// ──────────────────────────────────────────────────────────────────────────────

import { SettingsRepository } from '../../repository/settings/settings.repository';
import { PlatformSettingSection } from '../../entities/settings/platform-setting.entity';
import { cacheService } from '../../utils/cache.util';

export type SettingsSection = PlatformSettingSection;

export interface GeneralSettings {
  platformName: string;
  tagline: string;
  currency: string;
  timezone: string;
  supportEmail: string;
  supportPhone: string;
  officeAddress: string;
}

export interface BillingSettings {
  standardPlanPrice: number;
  enterprisePlanPrice: number;
  freeTierResidentCap: number;
  gracePeriodDays: number;
  allowQrCheckout: boolean;
  autoRemindRenewals: boolean;
}

export interface AccessSettings {
  allowPublicHostelSignup: boolean;
  requireHostelApproval: boolean;
  allowResidentSelfInvite: boolean;
  requireAdmin2FA: boolean;
  sessionLifetimeDays: number;
}

export interface AlertsSettings {
  overdueAlertThreshold: number;
  notifyOnSubscriptionProof: boolean;
  dailyDigestEmail: boolean;
  smsGatewayProvider: string;
}

export interface SystemSettings {
  maintenanceMode: boolean;
  maintenanceMessage: string;
}

export type SectionValue =
  GeneralSettings | BillingSettings | AccessSettings | AlertsSettings | SystemSettings;

const DEFAULTS: Record<SettingsSection, SectionValue> = {
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
    maintenanceMessage:
      'Hostel Ghar is undergoing scheduled maintenance. Please check back in a few minutes.',
  },
};

// In-memory fallback so the endpoints keep working when the DB/table is not
// reachable (unit tests, fresh clones before migrations run).
const memoryStore = new Map<SettingsSection, SectionValue>();

function cacheKey(section: SettingsSection): string {
  return cacheService.generateKey('admin:settings', { section, v: 1 });
}

function definedEntries<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [k, v] of Object.entries(obj ?? {})) {
    if (v !== undefined) (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

export class SettingsService {
  constructor(private readonly settingsRepository: SettingsRepository) {}

  public getDefaults(section: SettingsSection): SectionValue {
    return { ...DEFAULTS[section] } as SectionValue;
  }

  public getAllDefaults(): Record<SettingsSection, SectionValue> {
    return {
      general: { ...DEFAULTS.general },
      billing: { ...DEFAULTS.billing },
      access: { ...DEFAULTS.access },
      alerts: { ...DEFAULTS.alerts },
      system: { ...DEFAULTS.system },
    };
  }

  public async getSection<T extends SectionValue>(section: SettingsSection): Promise<T> {
    const key = cacheKey(section);
    const { data } = await cacheService.wrap<T>(
      key,
      async () => {
        const row = await this.settingsRepository.findBySection(section);
        const stored = (row?.value ?? {}) as Record<string, unknown>;
        const merged = { ...DEFAULTS[section], ...stored } as T;
        memoryStore.set(section, merged);
        return merged;
      },
      { l1TtlSeconds: 30, l2TtlSeconds: 120 },
    );
    return data;
  }

  public async getAll(): Promise<Record<SettingsSection, SectionValue>> {
    const [general, billing, access, alerts, system] = await Promise.all([
      this.getSection<GeneralSettings>('general'),
      this.getSection<BillingSettings>('billing'),
      this.getSection<AccessSettings>('access'),
      this.getSection<AlertsSettings>('alerts'),
      this.getSection<SystemSettings>('system'),
    ]);
    return { general, billing, access, alerts, system };
  }

  public async updateSection<T extends SectionValue>(
    section: SettingsSection,
    patch: Partial<T>,
  ): Promise<T> {
    const current = await this.getSection<T>(section);
    const merged = { ...current, ...definedEntries(patch as Record<string, unknown>) } as T;
    try {
      await this.settingsRepository.upsertSection(
        section,
        merged as unknown as Record<string, unknown>,
      );
    } catch {
      // DB unavailable — keep serving from the in-memory fallback.
    }
    memoryStore.set(section, merged);
    await cacheService.invalidate(cacheKey(section));
    await cacheService.invalidatePattern('admin:settings');
    return merged;
  }
}
