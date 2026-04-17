export interface MeteoSnapshot {
  timestamp: string
  temperatura_c: number | null
  umiditate_pct: number | null
  vant_kmh: number | null
  precipitatii_mm_24h: number | null
  descriere: string | null
}

export interface MeteoFereastra {
  ora_start: string
  ora_end: string
  safe: boolean
  motiv_blocaj: string | null
  temperatura_c: number | null
  vant_kmh: number | null
  precipitatii_mm: number | null
}

export interface MeteoZi {
  parcelaId: string
  snapshot_curent: MeteoSnapshot
  ferestre_24h: MeteoFereastra[]
}
