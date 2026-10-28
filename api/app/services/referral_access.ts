import type User from '#models/user'

/** RF-11 + confidencialidade: encaminhamento confidencial só é visto por quem criou, coordenação e administração. */
export function canSeeReferral(
  user: User,
  referral: { isConfidential: boolean; createdBy: number | null }
) {
  if (!referral.isConfidential) return true
  return user.role !== 'preceptor' || referral.createdBy === user.id
}

export function visibleReferralsScope<Q extends { where: (...args: any[]) => any }>(
  query: Q,
  user: User
): Q {
  if (user.role === 'preceptor') {
    query.where((b: any) => b.where('is_confidential', false).orWhere('created_by', user.id))
  }
  return query
}
