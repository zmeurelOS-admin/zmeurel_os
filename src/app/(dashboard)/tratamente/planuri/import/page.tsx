import type { Metadata } from 'next'

import { ImportFlowClient } from './ImportFlowClient'

export const metadata: Metadata = {
  title: 'Import plan din Excel | Zmeurel OS',
  description: 'Importă planuri de tratament dintr-un fișier Excel.',
}

export default function TratamentePlanImportPage() {
  return <ImportFlowClient />
}
