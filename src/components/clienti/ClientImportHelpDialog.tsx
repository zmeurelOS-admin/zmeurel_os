'use client'

import { AppDialog } from '@/components/app/AppDialog'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

interface ClientImportHelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onDownloadTemplate: () => void
}

export function ClientImportHelpDialog({
  open,
  onOpenChange,
  onDownloadTemplate,
}: ClientImportHelpDialogProps) {
  return (
    <AppDialog
      open={open}
      onOpenChange={onOpenChange}
      title="Format fișier import clienți"
      footer={
        <Button type="button" variant="outline" className="gap-2" onClick={onDownloadTemplate}>
          ⬇️ Descarcă model .xlsx
        </Button>
      }
    >
      <div className="space-y-4 text-sm text-[var(--agri-text-muted)]">
        <p>
          Poți importa clienți dintr-un fișier <strong className="text-[var(--agri-text)]">Excel (.xlsx)</strong> sau{' '}
          <strong className="text-[var(--agri-text)]">CSV</strong>.
        </p>
        <p>
          Fișierul trebuie să aibă un <strong className="text-[var(--agri-text)]">rând de antet</strong> (header) pe
          prima linie cu numele coloanelor.
        </p>

        <div className="space-y-2">
          <p className="font-medium text-[var(--agri-text)]">Coloane recunoscute:</p>
          <ul className="space-y-1.5 pl-1">
            {[
              { field: 'Nume client (obligatoriu)', aliases: 'Display Name, Name, Nume, Nume client' },
              { field: 'Telefon', aliases: 'Phone, Phone 1 - Value, Telefon, Tel, Mobil, Nr telefon' },
              { field: 'Email', aliases: 'Email, E-mail' },
              { field: 'Adresă', aliases: 'Adresa, Address, Localitate, City, Delivery Location' },
              { field: 'Observații', aliases: 'Observatii, Notes, Note' },
            ].map(({ field, aliases }) => (
              <li key={field} className="flex flex-col gap-0.5">
                <span className="font-medium text-[var(--agri-text)]">{field}</span>
                <span className="text-xs text-[var(--agri-text-muted)]">acceptă: {aliases}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-2">
          <p className="font-medium text-[var(--agri-text)]">Exemplu:</p>
          <div className="overflow-hidden rounded-xl border border-[var(--agri-border)] bg-[var(--agri-surface)]">
            <Table className="text-xs">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  {['Nume client', 'Telefon', 'Email', 'Adresă'].map((header) => (
                    <TableHead
                      key={header}
                      className="px-3 py-2 normal-case text-xs font-semibold text-[var(--agri-text)]"
                    >
                      {header}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="px-3 py-2 text-xs text-[var(--agri-text)]">Ion Popescu</TableCell>
                  <TableCell className="px-3 py-2 text-xs text-[var(--agri-text)]">0745123456</TableCell>
                  <TableCell className="px-3 py-2 text-xs text-[var(--agri-text)]">ion@email.com</TableCell>
                  <TableCell className="px-3 py-2 text-xs text-[var(--agri-text)]">Suceava</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="px-3 py-2 text-xs text-[var(--agri-text)]">Maria Ionescu</TableCell>
                  <TableCell className="px-3 py-2 text-xs text-[var(--agri-text)]">0722334455</TableCell>
                  <TableCell className="px-3 py-2 text-xs text-[var(--agri-text-muted)]">—</TableCell>
                  <TableCell className="px-3 py-2 text-xs text-[var(--agri-text)]">Fălticeni</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>

        <p className="rounded-lg bg-[var(--agri-surface-muted)] px-3 py-2 text-xs">
          Fișierele exportate din <strong className="text-[var(--agri-text)]">Google Contacts</strong> sau din{' '}
          <strong className="text-[var(--agri-text)]">agenda telefonului</strong> sunt recunoscute automat.
        </p>
      </div>
    </AppDialog>
  )
}
