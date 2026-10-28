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
