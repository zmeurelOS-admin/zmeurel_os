'use client'

import { AppDialog } from '@/components/app/AppDialog'
import { Button } from '@/components/ui/button'

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
          <div className="overflow-x-auto rounded-lg border border-[var(--agri-border)]">
            <table className="min-w-full text-xs">
              <thead className="bg-[var(--agri-surface-muted)]">
                <tr>
                  {['Nume client', 'Telefon', 'Email', 'Adresă'].map((header) => (
                    <th key={header} className="px-3 py-2 text-left font-semibold text-[var(--agri-text)]">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--agri-border)]">
                <tr>
                  <td className="px-3 py-2">Ion Popescu</td>
                  <td className="px-3 py-2">0745123456</td>
                  <td className="px-3 py-2">ion@email.com</td>
                  <td className="px-3 py-2">Suceava</td>
                </tr>
                <tr>
                  <td className="px-3 py-2">Maria Ionescu</td>
                  <td className="px-3 py-2">0722334455</td>
                  <td className="px-3 py-2 text-[var(--agri-text-muted)]">—</td>
                  <td className="px-3 py-2">Fălticeni</td>
                </tr>
              </tbody>
            </table>
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
