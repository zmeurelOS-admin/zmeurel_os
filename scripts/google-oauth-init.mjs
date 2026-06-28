import { createServer } from 'node:http'
import process from 'node:process'
import { randomBytes } from 'node:crypto'
import { createInterface } from 'node:readline/promises'

import { config } from 'dotenv'
import { OAuth2Client } from 'google-auth-library'

config({ path: '.env.local' })

const CONTACTS_READONLY_SCOPE = 'https://www.googleapis.com/auth/contacts.readonly'
const LOOPBACK_HOST = '127.0.0.1'

function extractAuthorizationCode(value) {
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    return new URL(trimmed).searchParams.get('code')
  } catch {
    return trimmed
  }
}

async function listenForOAuthCallback(expectedState) {
  let resolveCode
  let rejectCode

  const codePromise = new Promise((resolve, reject) => {
    resolveCode = resolve
    rejectCode = reject
  })
  void codePromise.catch(() => {})

  const server = createServer((request, response) => {
    const requestUrl = new URL(
      request.url ?? '/',
      `http://${LOOPBACK_HOST}`,
    )
    const error = requestUrl.searchParams.get('error')
    const state = requestUrl.searchParams.get('state')
    const code = requestUrl.searchParams.get('code')

    if (error) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Autorizarea Google a fost refuzată. Poți închide această filă.')
      rejectCode(new Error(`Google OAuth error: ${error}`))
      return
    }

    if (state !== expectedState || !code) {
      response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' })
      response.end('Callback OAuth invalid.')
      rejectCode(new Error('Callback OAuth invalid sau state nepotrivit.'))
      return
    }

    response.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Autorizare reușită. Poți reveni în terminal.')
    resolveCode(code)
  })

  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, LOOPBACK_HOST, resolve)
  })

  const address = server.address()
  if (!address || typeof address === 'string') {
    server.close()
    throw new Error('Nu am putut porni callback-ul OAuth local.')
  }

  return {
    codePromise,
    redirectUri: `http://${LOOPBACK_HOST}:${address.port}`,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve())
      }),
  }
}

async function main() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error(
      'Lipsesc GOOGLE_CLIENT_ID sau GOOGLE_CLIENT_SECRET din .env.local.',
    )
  }

  const state = randomBytes(24).toString('hex')
  const callback = await listenForOAuthCallback(state)
  const oauth2Client = new OAuth2Client(
    clientId,
    clientSecret,
    callback.redirectUri,
  )
  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: [CONTACTS_READONLY_SCOPE],
    state,
  })

  console.log('\nDeschide URL-ul de mai jos și autorizează accesul read-only la contacte:\n')
  console.log(authorizationUrl)
  console.log()

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  try {
    const manualValue = await readline.question(
      'După autorizare, apasă Enter sau lipește authorization code / URL-ul callback: ',
    )
    const authorizationCode =
      extractAuthorizationCode(manualValue) ?? (await callback.codePromise)

    if (!authorizationCode) {
      throw new Error('Authorization code lipsește.')
    }

    const { tokens } = await oauth2Client.getToken(authorizationCode)
    if (!tokens.refresh_token) {
      throw new Error(
        'Google nu a returnat refresh_token. Revocă accesul aplicației și rulează din nou scriptul.',
      )
    }

    console.log(`\nGOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`)
  } finally {
    readline.close()
    await callback.close()
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : 'Autorizarea Google a eșuat.')
  process.exitCode = 1
})
