import type { TablesInsert } from '@/types/supabase'

const DAY_MS = 24 * 60 * 60 * 1000

export const DEMO_FIXTURE_TAG = '[DEMO_FIXTURE_V2]'

export function buildDemoDates() {
  const today = new Date()

  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  const twoDaysAgo = new Date(today)
  twoDaysAgo.setDate(today.getDate() - 2)

  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  return {
    today,
    yesterday,
    twoDaysAgo,
    tomorrow,
  }
}

export type DemoParcelaKey = 'maravilla' | 'delniwa'
export type DemoClientKey = 'client_1' | 'client_2'

type DemoParcelaFixture = {
  key: DemoParcelaKey
  row: Omit<TablesInsert<'parcele'>, 'tenant_id'>
}

type DemoClientFixture = {
  key: DemoClientKey
  row: Omit<TablesInsert<'clienti'>, 'tenant_id'>
}

type DemoRecoltareFixture = {
  parcelaKey: DemoParcelaKey
  row: Omit<TablesInsert<'recoltari'>, 'tenant_id' | 'parcela_id' | 'culegator_id'>
}

type DemoComandaFixture = {
  clientKey: DemoClientKey
  row: Omit<TablesInsert<'comenzi'>, 'tenant_id' | 'client_id'>
}

type DemoVanzareFixture = {
  clientKey: DemoClientKey
  row: Omit<TablesInsert<'vanzari'>, 'tenant_id' | 'client_id' | 'comanda_id'>
}

type DemoActivitateFixture = {
  parcelaKey: DemoParcelaKey
  row: Omit<TablesInsert<'activitati_agricole'>, 'tenant_id' | 'parcela_id'>
}

export type DemoFixtureData = {
  parcele: DemoParcelaFixture[]
  clienti: DemoClientFixture[]
  recoltari: DemoRecoltareFixture[]
  comenzi: DemoComandaFixture[]
  vanzari: DemoVanzareFixture[]
  cheltuieli: Array<Omit<TablesInsert<'cheltuieli_diverse'>, 'tenant_id'>>
  activitati: DemoActivitateFixture[]
}

export const DEMO_FIXED_IDS: Record<
  'parcele' | 'clienti' | 'recoltari' | 'comenzi' | 'vanzari' | 'cheltuieli' | 'activitati',
  string[]
> = {
  parcele: ['DEMO-PAR-MARAVILLA', 'DEMO-PAR-DELNIWA'],
  clienti: ['DEMO-CLI-001', 'DEMO-CLI-002'],
  recoltari: ['DEMO-REC-001', 'DEMO-REC-002', 'DEMO-REC-003'],
  comenzi: [],
  vanzari: ['DEMO-VNZ-001', 'DEMO-VNZ-002'],
  cheltuieli: ['DEMO-CH-001', 'DEMO-CH-002'],
  activitati: ['DEMO-ACT-001'],
}

function toLocalIsoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function isoDateWithOffset(referenceDate: Date, dayOffset: number): string {
  const day = new Date(referenceDate.getTime() + dayOffset * DAY_MS)
  return toLocalIsoDate(day)
}

export function buildDemoFixture(referenceDate = new Date()): DemoFixtureData {
  const base = new Date(referenceDate)
  base.setHours(12, 0, 0, 0)
  const nowYear = base.getFullYear()

  const todayIso = isoDateWithOffset(base, 0)
  const yesterdayIso = isoDateWithOffset(base, -1)
  const minus2DaysIso = isoDateWithOffset(base, -2)
  const minus3DaysIso = isoDateWithOffset(base, -3)
  const minus4DaysIso = isoDateWithOffset(base, -4)
  const tomorrowIso = isoDateWithOffset(base, 1)

  return {
    parcele: [
      {
        key: 'maravilla',
        row: {
          id_parcela: 'DEMO-PAR-MARAVILLA',
          nume_parcela: 'MARAVILLA',
          tip_fruct: 'Zmeura',
          soi_plantat: 'Maravilla',
          suprafata_m2: 1200,
          nr_plante: 900,
          an_plantare: nowYear - 2,
          status: 'Activ',
          observatii: `${DEMO_FIXTURE_TAG} Parcela demo MARAVILLA`,
        },
      },
      {
        key: 'delniwa',
        row: {
          id_parcela: 'DEMO-PAR-DELNIWA',
          nume_parcela: 'DELNIWA',
          tip_fruct: 'Zmeura',
          soi_plantat: 'Delniwa',
          suprafata_m2: 1000,
          nr_plante: 750,
          an_plantare: nowYear - 1,
          status: 'Activ',
          observatii: `${DEMO_FIXTURE_TAG} Parcela demo DELNIWA`,
        },
      },
    ],
    clienti: [
      {
        key: 'client_1',
        row: {
          id_client: 'DEMO-CLI-001',
          nume_client: 'Client Demo Fresh',
          telefon: '0740000001',
          adresa: 'Suceava',
          observatii: `${DEMO_FIXTURE_TAG} Client demo`,
        },
      },
      {
        key: 'client_2',
        row: {
          id_client: 'DEMO-CLI-002',
          nume_client: 'Client Demo Market',
          telefon: '0740000002',
          adresa: 'Falticeni',
          observatii: `${DEMO_FIXTURE_TAG} Client demo`,
        },
      },
    ],
    recoltari: [
      {
        parcelaKey: 'maravilla',
        row: {
          id_recoltare: 'DEMO-REC-001',
          data: minus3DaysIso,
          kg_cal1: 6,
          kg_cal2: 2,
          cantitate_kg: 8,
          pret_lei_pe_kg_snapshot: 0,
          valoare_munca_lei: 0,
          observatii: `${DEMO_FIXTURE_TAG} Recoltare demo`,
        },
      },
      {
        parcelaKey: 'delniwa',
        row: {
          id_recoltare: 'DEMO-REC-002',
          data: yesterdayIso,
          kg_cal1: 10,
          kg_cal2: 2,
          cantitate_kg: 12,
          pret_lei_pe_kg_snapshot: 0,
          valoare_munca_lei: 0,
          observatii: `${DEMO_FIXTURE_TAG} Recoltare demo`,
        },
      },
      {
        parcelaKey: 'maravilla',
        row: {
          id_recoltare: 'DEMO-REC-003',
          data: todayIso,
          kg_cal1: 12,
          kg_cal2: 3,
          cantitate_kg: 15,
          pret_lei_pe_kg_snapshot: 0,
          valoare_munca_lei: 0,
          observatii: `${DEMO_FIXTURE_TAG} Recoltare demo`,
        },
      },
    ],
    comenzi: [
      {
        clientKey: 'client_1',
        row: {
          data_comanda: todayIso,
          data_livrare: todayIso,
          cantitate_kg: 10,
          pret_per_kg: 35,
          total: 350,
          status: 'programata',
          observatii: `${DEMO_FIXTURE_TAG} Comanda demo`,
          client_nume_manual: null,
          locatie_livrare: 'Suceava',
          telefon: '0740000001',
        },
      },
      {
        clientKey: 'client_2',
        row: {
          data_comanda: todayIso,
          data_livrare: tomorrowIso,
          cantitate_kg: 20,
          pret_per_kg: 32,
          total: 640,
          status: 'noua',
          observatii: `${DEMO_FIXTURE_TAG} Comanda demo`,
          client_nume_manual: null,
          locatie_livrare: 'Falticeni',
          telefon: '0740000002',
        },
      },
    ],
    vanzari: [
      {
        clientKey: 'client_1',
        row: {
          id_vanzare: 'DEMO-VNZ-001',
          data: yesterdayIso,
          cantitate_kg: 8,
          pret_lei_kg: 35,
          status_plata: 'platit',
          observatii_ladite: `${DEMO_FIXTURE_TAG} Vanzare demo`,
        },
      },
      {
        clientKey: 'client_2',
        row: {
          id_vanzare: 'DEMO-VNZ-002',
          data: todayIso,
          cantitate_kg: 12,
          pret_lei_kg: 34,
          status_plata: 'platit',
          observatii_ladite: `${DEMO_FIXTURE_TAG} Vanzare demo`,
        },
      },
    ],
    cheltuieli: [
      {
        id_cheltuiala: 'DEMO-CH-001',
        data: minus4DaysIso,
        categorie: 'motorina',
        descriere: `${DEMO_FIXTURE_TAG} Motorina utilaj`,
        suma_lei: 120,
        furnizor: 'Statie carburanti',
      },
      {
        id_cheltuiala: 'DEMO-CH-002',
        data: yesterdayIso,
        categorie: 'ambalaje',
        descriere: `${DEMO_FIXTURE_TAG} Ambalaje`,
        suma_lei: 85,
        furnizor: 'Depozit ambalaje',
      },
    ],
    activitati: [
      {
        parcelaKey: 'maravilla',
        row: {
          id_activitate: 'DEMO-ACT-001',
          data_aplicare: minus2DaysIso,
          tip_activitate: 'Fertilizare Foliara',
          produs_utilizat: 'fertilizare_foliara',
          doza: '2 l/ha',
          timp_pauza_zile: 0,
          operator: 'Operator demo',
          observatii: `${DEMO_FIXTURE_TAG} Activitate demo`,
        },
      },
    ],
  }
}
