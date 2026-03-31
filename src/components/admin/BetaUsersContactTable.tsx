'use client'

import { MessageCircle, Phone } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { toWhatsAppLink } from '@/lib/utils/phone'

export interface BetaUserContactRow {
  tenant_id: string
  tenant_name: string
  owner_email: string | null
  contact_phone: string | null
  created_at: string | null
  last_activity_at: string | null
}

interface BetaUsersContactTableProps {
  rows: BetaUserContactRow[]
}

function formatDate(value: string | null | undefined): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ro-RO', { day: '2-digit', month: 'short', year: 'numeric' }).format(date)
}

const WA_MESSAGE = encodeURIComponent(
  'Salut! Sunt Andrei, fondatorul Zmeurel 🌿 Te-am văzut că testezi aplicația și vreau să te întreb cum îți merge. Ai 5 minute să vorbim?'
)

export function BetaUsersContactTable({ rows }: BetaUsersContactTableProps) {
  const sorted = [...rows].sort((a, b) => {
    const dateA = a.last_activity_at ?? a.created_at ?? ''
    const dateB = b.last_activity_at ?? b.created_at ?? ''
    return dateB.localeCompare(dateA)
  })

  return (
    <Card className="rounded-2xl border-[var(--agri-border)] shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg">Beta useri — contact direct</CardTitle>
        <CardDescription>
          Lista completă de tenants cu informații de contact pentru outreach direct. Sortată după ultima activitate.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-900/20 dark:text-amber-200">
            Nu există tenants disponibili.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Nume fermă</TableHead>
                  <TableHead>Email utilizator</TableHead>
                  <TableHead>Telefon contact</TableHead>
                  <TableHead>Data înregistrării</TableHead>
                  <TableHead>Ultima activitate</TableHead>
                  <TableHead>Acțiuni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((row) => {
                  const hasPhone = Boolean(row.contact_phone?.trim())
                  const waUrl = hasPhone ? `${toWhatsAppLink(row.contact_phone!)}?text=${WA_MESSAGE}` : ''

                  return (
                    <TableRow key={row.tenant_id}>
                      <TableCell className="font-semibold text-[var(--agri-text)]">{row.tenant_name}</TableCell>
                      <TableCell className="text-sm text-[var(--agri-text-muted)]">{row.owner_email ?? '-'}</TableCell>
                      <TableCell>
                        {hasPhone ? (
                          <span className="font-mono text-sm">{row.contact_phone}</span>
                        ) : (
                          <Badge variant="outline" className="border-gray-200 bg-gray-50 text-gray-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                            Fără telefon
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--agri-text-muted)]">
                        {formatDate(row.created_at)}
                      </TableCell>
                      <TableCell className="text-sm text-[var(--agri-text-muted)]">
                        {formatDate(row.last_activity_at)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {hasPhone ? (
                            <>
                              <a
                                href={`tel:${row.contact_phone}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-blue-200 bg-blue-50 text-blue-700 transition-colors hover:bg-blue-100 dark:border-blue-900/60 dark:bg-blue-900/30 dark:text-blue-200 dark:hover:bg-blue-900/50"
                                title={`Sună ${row.contact_phone}`}
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 dark:border-emerald-900/60 dark:bg-emerald-900/30 dark:text-emerald-200 dark:hover:bg-emerald-900/50"
                                title="Trimite mesaj WhatsApp"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            </>
                          ) : (
                            <span className="text-xs text-[var(--agri-text-muted)]">—</span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
