import { createChatPostHandler } from './chat-post-handler'
import { validateSameOriginMutation } from '@/lib/api/route-security'

export const runtime = 'nodejs'
// Aliniat la regiunea proiectului Supabase (eu-north-1 / Stockholm) ca și
// deployment-ul global din vercel.json (arn1). Ruta face apeluri Supabase
// (rate-limit, memorie sesiune, keyword queries), deci co-locarea reduce
// latența round-trip. Nicio dependență externă care să impună US.
export const preferredRegion = 'arn1'

const chatPostHandler = createChatPostHandler()

export async function POST(request: Request) {
  const invalidOrigin = validateSameOriginMutation(request)
  if (invalidOrigin) {
    return invalidOrigin
  }

  return chatPostHandler(request)
}
