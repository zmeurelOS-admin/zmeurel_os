import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * tailwind-merge nu cunoaște clasele generate din tokenii proprii (`@theme` în globals.css).
 * Fără lista de mai jos, un `className` venit din afară (ex. `z-[60]`) nu ar mai înlocui
 * valoarea implicită a componentei (ex. `z-modal`). Ține lista la zi cu docs/redesign/tokens.md.
 */
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      z: [{ z: ["sticky", "bar", "nav", "fab", "overlay", "modal", "popover", "toast"] }],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
