import { test } from '@japa/runner'
import { polarityForCode } from '#support/ra'

test.group('Polaridade dos códigos RA (RN01/RN02)', () => {
  test('códigos 01 a 09 são positivos', ({ assert }) => {
    for (let code = 1; code <= 9; code++)
      assert.equal(polarityForCode(code), 'positive', `código ${code}`)
  })

  test('códigos 10 a 21 são negativos', ({ assert }) => {
    for (let code = 10; code <= 21; code++)
      assert.equal(polarityForCode(code), 'negative', `código ${code}`)
  })

  test('RN02: o código 09 nunca é negativo', ({ assert }) => {
    assert.notEqual(polarityForCode(9), 'negative')
  })

  test('códigos fora da faixa conhecida não têm polaridade', ({ assert }) => {
    for (const code of [0, 22, -1, 1.5, Number.NaN])
      assert.isNull(polarityForCode(code), `código ${code}`)
  })
})
