import { createChatPostHandler } from './chat-post-handler'
import { validateSameOriginMutation } from '@/lib/api/route-security'

export const runtime = 'nodejs'
export const preferredRegion = 'iad1'

const chatPostHandler = createChatPostHandler()

export async function POST(request: Request) {
  const invalidOrigin = validateSameOriginMutation(request)
  if (invalidOrigin) {
    return invalidOrigin
  }

  return chatPostHandler(request)
}
