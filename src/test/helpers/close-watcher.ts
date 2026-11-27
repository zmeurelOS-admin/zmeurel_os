/**
 * `CloseWatcher` simulat (promptul 34, §5): în jsdom nu există. „Înapoi” pe Android = `apasaInapoi()`, care
 * consumă watcher-ul de deasupra și îi trimite `close`, ca browserul.
 */
type Ascultator = () => void

export class CloseWatcherSimulat {
  static active: CloseWatcherSimulat[] = []
  static create = 0
  private ascultatori: Ascultator[] = []

  constructor() {
    CloseWatcherSimulat.active.push(this)
    CloseWatcherSimulat.create += 1
  }

  addEventListener(type: 'close', listener: Ascultator) {
    if (type === 'close') this.ascultatori.push(listener)
  }

  destroy() {
    CloseWatcherSimulat.active = CloseWatcherSimulat.active.filter((watcher) => watcher !== this)
  }

  requestClose() {
    this.destroy()
    for (const ascultator of this.ascultatori) ascultator()
  }
}

export function instaleazaCloseWatcher() {
  CloseWatcherSimulat.active = []
  CloseWatcherSimulat.create = 0
  ;(window as unknown as { CloseWatcher?: unknown }).CloseWatcher = CloseWatcherSimulat
}

export function dezinstaleazaCloseWatcher() {
  CloseWatcherSimulat.active = []
  delete (window as unknown as { CloseWatcher?: unknown }).CloseWatcher
}

/** „Înapoi”: închide watcher-ul de deasupra. Întoarce `false` dacă nu era niciunul. */
export function apasaInapoi(): boolean {
  const deasupra = CloseWatcherSimulat.active.at(-1)
  if (!deasupra) return false
  deasupra.requestClose()
  return true
}
