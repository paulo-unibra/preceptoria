import { configApp } from '@adonisjs/eslint-config'

export default [
  ...configApp(),
  {
    rules: {
      // A API fala snake_case (payloads/respostas); variáveis desestruturadas do payload validado
      // mantêm o nome do campo.
      '@typescript-eslint/naming-convention': 'off',
      // Estilo `(await client.get(...)).assertStatus(200)` é o idiomático nos testes do Japa.
      '@unicorn/no-await-expression-member': 'off',
    },
  },
]
