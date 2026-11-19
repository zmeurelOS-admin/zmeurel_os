import { describe, expect, it } from 'vitest'

import { scanKitFileContent } from '../../../../scripts/kit-rules.mjs'

const scan = (content: string) =>
  scanKitFileContent({ filePath: 'src/components/kit/Exemplu.tsx', content }).map((finding) => finding.rule)

describe('regulile kitului (check:kit)', () => {
  it('lasă să treacă un cod scris doar cu tokeni canonici', () => {
    const content = [
      `const base = 'flex h-touch items-center rounded-box border-2 border-border bg-surface px-4 text-[17px] text-fg'`,
      `const helper = 'text-[13px] text-fg-muted'`,
      `const layer = 'z-modal'`,
      `const inner = 'sticky top-0 z-10'`,
      `const anchor = \`#\${id}\``,
      `const wrapper = 'dark rounded-card'`,
    ].join('\n')

    expect(scan(content)).toEqual([])
  })

  it.each([
    ['hex cu 6 cifre', `className="bg-[#1b3a2a]"`, 'hex'],
    ['hex cu 3 cifre', `style={{ color: '#fff' }}`, 'hex'],
    ['varianta dark:', `className="bg-surface dark:bg-black"`, 'dark-variant'],
    ['--agri-*', `className="bg-[var(--agri-surface)]"`, 'legacy-token'],
    ['--text-primary', `className="text-[var(--text-primary)]"`, 'legacy-token'],
    ['--surface-card', `className="bg-[var(--surface-card)]"`, 'legacy-token'],
    ['--status-*', `className="text-[var(--status-warning-text)]"`, 'legacy-token'],
    ['--soft-*', `className="bg-[var(--soft-success-bg)]"`, 'legacy-token'],
    ['text sub 13 px', `className="text-[12.5px]"`, 'text-under-13'],
    ['text sub 13 px în rem', `className="text-[0.75rem]"`, 'text-under-13'],
    ['text-xs', `className="text-xs font-bold"`, 'text-xs'],
    ['z-index arbitrar', `className="fixed z-[1001]"`, 'z-arbitrary'],
    ['z-index numeric din scară', `className="fixed z-50"`, 'z-numeric'],
    ['zIndex în style', `style={{ zIndex: 5 }}`, 'z-style'],
  ])('prinde %s', (_label, content, rule) => {
    expect(scan(content)).toContain(rule)
  })

  it('nu confundă mărimile permise cu cele interzise', () => {
    expect(scan(`className="text-[13px] text-[0.8125rem] text-[64px] z-30"`)).toEqual([])
  })

  it('raportează linia abaterii', () => {
    const findings = scanKitFileContent({
      filePath: 'src/components/kit/Exemplu.tsx',
      content: `const a = 1\nconst b = 'text-xs'\n`,
    })

    expect(findings).toHaveLength(1)
    expect(findings[0]).toMatchObject({ line: 2, rule: 'text-xs' })
  })
})
