import app from '@adonisjs/core/services/app'
import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

const migrations = {
  naturalSort: true,
  paths: ['database/migrations'],
}

const dbConfig = defineConfig({
  connection: env.get('DB_CONNECTION', 'sqlite'),
  connections: {
    sqlite: {
      client: 'better-sqlite3',
      connection: {
        filename: env.get('DB_FILENAME') ?? app.tmpPath('db.sqlite3'),
      },
      useNullAsDefault: true,
      pool: {
        // SQLite só aplica chaves estrangeiras quando o PRAGMA é ligado por conexão.
        afterCreate(conn: any, done: (err: Error | null, conn: any) => void) {
          conn.pragma('foreign_keys = ON')
          conn.pragma('journal_mode = WAL')
          done(null, conn)
        },
      },
      migrations,
    },
    pg: {
      client: 'pg',
      connection: {
        host: env.get('DB_HOST', '127.0.0.1'),
        port: env.get('DB_PORT', 5432),
        user: env.get('DB_USER', 'postgres'),
        password: env.get('DB_PASSWORD', ''),
        database: env.get('DB_DATABASE', 'preceptoria'),
      },
      migrations,
    },
  },
})

export default dbConfig
