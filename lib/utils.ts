import type { PlanKey, UserSkill, Preferences } from './types';

export function normalizePlan(plan: unknown): PlanKey {
  if (plan === 'business_pro' || plan === 'pro') return 'business_pro';
  if (plan === 'business' || plan === 'premium') return 'business';
  return 'free';
}

export function isPaidPlan(plan: unknown): boolean {
  const p = normalizePlan(plan);
  return p === 'business' || p === 'business_pro';
}

export function canChat(myPlan: unknown, otherPlan: unknown): boolean {
  return isPaidPlan(myPlan) && isPaidPlan(otherPlan);
}

export const DEFAULT_PREFERENCES: Preferences = {
  distance_km: 1000,
  age_min: 18,
  age_max: 99,
  skill_filters: [],
};

export const INTERESTS = [
  'Business',
  'Tech',
  'Finance',
  'Marketing',
  'Design',
  'Startups',
  'Investissement',
  'Coaching',
  'Networking',
  'Developpement personnel',
  'E-commerce',
  'IA',
  'Immobilier',
  'Sport',
  'Art',
  'Musique',
  'Voyage',
  'Autre',
];

export const SKILLS_LIST = [
  'Marketing',
  'Vente / Closing',
  'Copywriting',
  'IA / Automation',
  'Developpement Web',
  'Strategie digitale',
  'Reseaux sociaux',
  'Montage video',
  'Ads / Acquisition',
  'SEO / Growth',
];

export const MAX_PHOTOS = 6;

export function parseSkills(value: unknown): UserSkill[] {
  try {
    const arr = Array.isArray(value)
      ? value
      : typeof value === 'string'
        ? JSON.parse(value || '[]')
        : [];
    if (!Array.isArray(arr)) return [];
    return arr
      .filter(
        (s: any) =>
          typeof s === 'object' &&
          s !== null &&
          typeof s.name === 'string' &&
          s.name.trim().length > 0 &&
          typeof s.level === 'number' &&
          s.level >= 0 &&
          s.level <= 10,
      )
      .map((s: any) => ({
        name: s.name.trim(),
        level: Math.round(s.level),
        ...(typeof s.comment === 'string' && s.comment.trim()
          ? { comment: s.comment.trim() }
          : {}),
      }));
  } catch {
    return [];
  }
}

export function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'maintenant';
  if (diffMins < 60) return `${diffMins} min`;
  if (diffHours < 24) return `${diffHours} h`;
  if (diffDays < 7) return `${diffDays} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export function cleanPhotoUrls(photos: unknown): string[] {
  const arr = (() => {
    if (Array.isArray(photos)) return photos;
    if (typeof photos === 'string') {
      try {
        const parsed = JSON.parse(photos || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  })();
  return arr
    .filter((p): p is string => typeof p === 'string' && p.trim().length > 0)
    .map((p) => p.trim());
}

export function cleanStringArray(value: unknown): string[] {
  const arr = (() => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  })();
  return arr
    .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
    .map((v) => v.trim());
}

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
