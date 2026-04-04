import fs from 'fs'
const p = 'src/types/supabase.ts'
let c = fs.readFileSync(p, 'utf8')
const rowOld = `          association_price: number | null\r\n          created_at: string\r\n          updated_at: string`
const rowNew = `          association_price: number | null\r\n          ingrediente: string | null\r\n          alergeni: string | null\r\n          conditii_pastrare: string | null\r\n          termen_valabilitate: string | null\r\n          tip_produs: string\r\n          created_at: string\r\n          updated_at: string`
if (!c.includes(rowOld)) {
  console.error('Row block not found')
  process.exit(1)
}
c = c.replace(rowOld, rowNew)
const insOld = `          association_price?: number | null\r\n          created_at?: string\r\n          updated_at?: string`
const insNew = `          association_price?: number | null\r\n          ingrediente?: string | null\r\n          alergeni?: string | null\r\n          conditii_pastrare?: string | null\r\n          termen_valabilitate?: string | null\r\n          tip_produs?: string\r\n          created_at?: string\r\n          updated_at?: string`
let n = 0
while (c.includes(insOld)) {
  c = c.replace(insOld, insNew)
  n++
}
console.log('Insert/Update blocks replaced:', n)
fs.writeFileSync(p, c, 'utf8')
