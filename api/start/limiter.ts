/*
|--------------------------------------------------------------------------
| Define HTTP limiters
|--------------------------------------------------------------------------
|
| The "limiter.define" method creates an HTTP middleware to apply rate
| limits on a route or a group of routes. Feel free to define as many
| throttle middleware as needed.
|
*/

import limiter from '@adonisjs/limiter/services/main'

export const throttle = limiter.define('global', () => {
  return limiter.allowRequests(10).every('1 minute')
})
/**
 * Proteção contra tentativa de adivinhar senhas: por IP + e-mail.
 */
export const loginThrottle = limiter.define('login', (ctx) => {
  const max = process.env.NODE_ENV === 'test' ? 1000 : 5
  return limiter
    .allowRequests(max)
    .every('1 minute')
    .blockFor('5 mins')
    .usingKey(`login_${ctx.request.ip()}_${String(ctx.request.input('email') ?? '').toLowerCase()}`)
})

export const oauthConsentThrottle = limiter.define('oauth_consent', (ctx) =>
  limiter.allowRequests(20).every('1 minute').usingKey(`oauth_consent_${ctx.request.ip()}`)
)

export const oauthTokenThrottle = limiter.define('oauth_token', (ctx) =>
  limiter.allowRequests(120).every('1 minute').usingKey(`oauth_token_${ctx.request.ip()}`)
)
