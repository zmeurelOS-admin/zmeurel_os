import { createChatPostHandler } from './chat-post-handler'

export const runtime = 'nodejs'
export const preferredRegion = 'iad1'

export const POST = createChatPostHandler()
