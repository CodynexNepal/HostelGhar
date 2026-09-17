// ─────────────────────────────────────────────────────────────
// FILE: facility.repository.smoke.ts
// PURPOSE: Build-time smoke check for facility slug + DTO mapping.
//          Run: npx vitest run tests/unit/facility.repository.smoke.ts
// ─────────────────────────────────────────────────────────────
import { describe, expect, it } from 'vitest';
import { toFacilitySlug } from '../../src/repository/facility/facility.repository';
import { FacilityTag } from '../../src/enum/facility.enum';

describe('facility normalization', () => {
  it('dedupes titles into one slug', () => {
    expect(toFacilitySlug('Security')).toBe('security');
    expect(toFacilitySlug('  SECURITY  ')).toBe('security');
    expect(toFacilitySlug('High-Speed Wifi')).toBe('high-speed-wifi');
  });

  it('keeps canonical tag values', () => {
    expect(Object.values(FacilityTag)).toContain('Included');
  });

  it('maps frontend payload shape to repository input', () => {
    const frontend = {
      description: '24 security with guards',
      id: 'security-mu5ofghs',
      tag: 'Included',
      title: 'Security',
    };
    const input = {
      clientKey: frontend.id,
      title: frontend.title.trim(),
      description: frontend.description,
      tag: frontend.tag,
    };
    expect(input.clientKey).toBe('security-mu5ofghs');
    expect(toFacilitySlug(input.title)).toBe('security');
  });
});
