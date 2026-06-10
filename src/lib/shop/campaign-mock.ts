export type CampaignMilestone = {
  threshold: number
  rewardLabel: string
  reached: boolean
  isNext: boolean
}

export type CampaignLeaderboardEntry = {
  anonId: string
  city: string | null
  count: number
  seasonPrizeLabel: string | null
}

export type CampaignData = {
  campaignId: string
  currentCount: number
  target: number
  milestones: CampaignMilestone[]
  leaderboard: CampaignLeaderboardEntry[]
  nextMilestone: CampaignMilestone
  rules: string[]
}

export type CampaignSnapshot = {
  currentCount: number
  targetQty: number
  status: string
  milestones: Array<{
    threshold: number
    rewardLabel: string
    reached: boolean
  }>
  leaderboard: CampaignLeaderboardEntry[]
}

export const CAMPAIGN_DATA: CampaignData = {
  campaignId: '21d158e1-dfa3-4db3-894b-d64ecad29b45',
  currentCount: 498,
  target: 2000,
  milestones: [
    {
      threshold: 150,
      rewardLabel: '+1 caserolă 250 g',
      reached: true,
      isNext: false,
    },
    {
      threshold: 300,
      rewardLabel: '+1 caserolă 500 g',
      reached: true,
      isNext: false,
    },
    {
      threshold: 500,
      rewardLabel: '+2 caserole 500 g',
      reached: false,
      isNext: true,
    },
    {
      threshold: 750,
      rewardLabel: '+1 kg zmeură',
      reached: false,
      isNext: false,
    },
    {
      threshold: 1000,
      rewardLabel: '+2 kg zmeură',
      reached: false,
      isNext: false,
    },
    {
      threshold: 1250,
      rewardLabel: '+1 caserolă 500 g',
      reached: false,
      isNext: false,
    },
    {
      threshold: 1500,
      rewardLabel: '+2 caserole 500 g',
      reached: false,
      isNext: false,
    },
    {
      threshold: 1750,
      rewardLabel: '+2 caserole 500 g',
      reached: false,
      isNext: false,
    },
    {
      threshold: 2000,
      rewardLabel: '3 kg zmeură + borcan de miere de la fermă',
      reached: false,
      isNext: false,
    },
  ],
  leaderboard: [
    {
      anonId: 'Client Zmeurel #07',
      city: 'Suceava',
      count: 28,
      seasonPrizeLabel: '2 kg zmeură + miere + jeleu de zmeure',
    },
    {
      anonId: 'Client Zmeurel #12',
      city: 'Șcheia',
      count: 22,
      seasonPrizeLabel: '1 kg zmeură + miere',
    },
    {
      anonId: 'Client Zmeurel #03',
      city: 'Salcea',
      count: 18,
      seasonPrizeLabel: '1 kg zmeură',
    },
    {
      anonId: 'Client Zmeurel #19',
      city: 'Ipotești',
      count: 14,
      seasonPrizeLabel: 'Voucher sezon următor',
    },
    {
      anonId: 'Client Zmeurel #24',
      city: 'Bosanci',
      count: 12,
      seasonPrizeLabel: 'Voucher sezon următor',
    },
  ],
  nextMilestone: {
    threshold: 500,
    rewardLabel: '+2 caserole 500 g',
    reached: false,
    isNext: true,
  },
  rules: [
    'Comanda care trece un prag primește bonusul afișat pentru acel prag.',
    'Bonusul se validează la confirmarea sau livrarea comenzii.',
    'Comenzile anulate nu sunt eligibile pentru bonus.',
    'Premiile sunt acordate o singură dată pentru fiecare prag.',
    'Clasamentul final este anonimizat. Datele personale nu sunt afișate public.',
  ],
}

export function mergeCampaignSnapshot(snapshot: CampaignSnapshot): CampaignData {
  const nextMilestoneIndex = snapshot.milestones.findIndex(
    (milestone) => !milestone.reached && milestone.threshold > snapshot.currentCount,
  )
  const milestones = snapshot.milestones.map((milestone, index) => ({
    ...milestone,
    isNext: index === nextMilestoneIndex,
  }))

  return {
    ...CAMPAIGN_DATA,
    currentCount: snapshot.currentCount,
    target: snapshot.targetQty,
    milestones,
    leaderboard:
      snapshot.leaderboard.length > 0 ? snapshot.leaderboard : CAMPAIGN_DATA.leaderboard,
    nextMilestone:
      milestones[nextMilestoneIndex] ?? milestones.at(-1) ?? CAMPAIGN_DATA.nextMilestone,
  }
}

export function isCampaignSnapshot(value: unknown): value is CampaignSnapshot {
  if (!value || typeof value !== 'object') return false

  const snapshot = value as Partial<CampaignSnapshot>
  return (
    typeof snapshot.currentCount === 'number' &&
    typeof snapshot.targetQty === 'number' &&
    typeof snapshot.status === 'string' &&
    Array.isArray(snapshot.milestones) &&
    snapshot.milestones.every(
      (milestone) =>
        typeof milestone?.threshold === 'number' &&
        typeof milestone.rewardLabel === 'string' &&
        typeof milestone.reached === 'boolean',
    ) &&
    Array.isArray(snapshot.leaderboard) &&
    snapshot.leaderboard.every(
      (entry) =>
        typeof entry?.anonId === 'string' &&
        (typeof entry.city === 'string' || entry.city === null) &&
        typeof entry.count === 'number' &&
        (typeof entry.seasonPrizeLabel === 'string' || entry.seasonPrizeLabel === null),
    )
  )
}
