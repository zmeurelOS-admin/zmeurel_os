/** Folosit doar pentru detectarea rândurilor vechi la cleanup; nu în date noi de seed. */
export const DEMO_FIXTURE_TAG = '[DEMO_FIXTURE_V2]'

/** ID-urile de business ale vechiului seed fix (V2), după care cleanup-ul recunoaște rândurile vechi. */
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
