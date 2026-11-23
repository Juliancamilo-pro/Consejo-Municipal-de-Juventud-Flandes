import type { AccessTier, RoleLabel } from '../types/cmj';

export const SECRETARY_BOOTSTRAP_EMAIL = 'trujillogordilooo@gmail.com';

export function roleLabelToAccessTier(roleLabel: RoleLabel): AccessTier {
  switch (roleLabel) {
    case 'Presidente':
      return 'tier_1_pres';
    case 'Vicepresidente':
      return 'tier_2_vp';
    case 'Secretario':
      return 'tier_3_sec';
    default:
      return 'tier_4_member';
  }
}

export function isLeadershipTier(tier?: AccessTier | null): boolean {
  return tier === 'tier_1_pres' || tier === 'tier_2_vp' || tier === 'tier_3_sec';
}
