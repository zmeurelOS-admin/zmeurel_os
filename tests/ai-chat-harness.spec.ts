import { expect, test } from '@playwright/test'

import { AI_CHAT_HARNESS_CORPUS } from './ai-chat-harness.cases'

test('ai chat harness corpus exists', () => {
  expect(AI_CHAT_HARNESS_CORPUS.length).toBeGreaterThan(0)
})
