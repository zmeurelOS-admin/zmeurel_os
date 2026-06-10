export type CampaignMilestone = {
  threshold: number
  rewardLabel: string
  reached: boolean
  isNext: boolean
}

export type CampaignLeaderboardEntry = {
  anonId: string
  city: string
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

export const CAMPAIGN_DATA: CampaignData = {
  campaignId: '21d158e1-dfa3-4db3-894b-d64ecad29b45',
  currentCount: 498,
  target: 2000,
  milestones: [
    {
      threshold: 150,
      rewardLabel: 'o caserolă bonus',
      reached: true,
      isNext: false,
    },
    {
      threshold: 300,
      rewardLabel: 'două caserole bonus',
      reached: true,
      isNext: false,
    },
    {
      threshold: 500,
      rewardLabel: 'un coș cu produse locale',
      reached: false,
      isNext: true,
    },
    {
      threshold: 750,
      rewardLabel: 'un kilogram de zmeură bonus',
      reached: false,
      isNext: false,
    },
    {
      threshold: 1000,
      rewardLabel: 'un voucher Zmeurel de 100 lei',
      reached: false,
      isNext: false,
    },
    {
      threshold: 1250,
      rewardLabel: 'o ladă de fructe de sezon',
      reached: false,
      isNext: false,
    },
    {
      threshold: 1500,
      rewardLabel: 'o vizită pentru două persoane la fermă',
      reached: false,
      isNext: false,
    },
    {
      threshold: 1750,
      rewardLabel: 'un abonament cu trei livrări',
      reached: false,
      isNext: false,
    },
    {
      threshold: 2000,
      rewardLabel: 'marele coș Zmeurel 2026',
      reached: false,
      isNext: false,
    },
  ],
  leaderboard: [
    {
      anonId: 'Client Zmeurel #07',
      city: 'Suceava',
      count: 28,
      seasonPrizeLabel: 'Coș Zmeurel premium',
    },
    {
      anonId: 'Client Zmeurel #12',
      city: 'Șcheia',
      count: 22,
      seasonPrizeLabel: '5 kg de zmeură',
    },
    {
      anonId: 'Client Zmeurel #03',
      city: 'Salcea',
      count: 18,
      seasonPrizeLabel: '3 kg de zmeură',
    },
    {
      anonId: 'Client Zmeurel #19',
      city: 'Ipotești',
      count: 14,
      seasonPrizeLabel: null,
    },
    {
      anonId: 'Client Zmeurel #24',
      city: 'Bosanci',
      count: 12,
      seasonPrizeLabel: null,
    },
  ],
  nextMilestone: {
    threshold: 500,
    rewardLabel: 'un coș cu produse locale',
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

export function checkMilestoneHit(
  currentCount: number,
  qty: number,
  nextMilestone: CampaignMilestone,
): boolean {
  if (!Number.isInteger(qty) || qty <= 0 || nextMilestone.reached) return false

  return currentCount < nextMilestone.threshold && currentCount + qty >= nextMilestone.threshold
}
