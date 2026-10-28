import { spawn } from 'node:child_process'
import { mkdir, readdir, rm, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { flags, BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

/**
 * RNF05 — cópia de segurança. SQLite: cópia consistente via API de backup do SQLite (pode rodar com o
 * servidor no ar). PostgreSQL: pg_dump. Agende no cron (ex.: diário) e leve as cópias para outro local.
 *
 * Restauração: ver README ("Backup e restauração").
 */
export default class BackupRun extends BaseCommand {
  static commandName = 'backup:run'
  static description = 'Gera uma cópia de segurança do banco de dados em backups/'
  static options: CommandOptions = { startApp: true }

  @flags.string({ description: 'Diretório de destino', default: 'backups' })
  declare dir: string

  @flags.number({
    description: 'Quantas cópias manter (as mais antigas são removidas)',
    default: 14,
  })
  declare keep: number

  async run() {
    const app = this.app
    const config = app.config.get<any>('database')
    const connectionName: string = config.connection
    const conn = config.connections[connectionName]
    const target = app.makePath(this.dir)
    await mkdir(target, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')

    let output: string
    if (connectionName === 'sqlite') {
      output = join(target, `preceptoria-${stamp}.sqlite3`)
      const { default: Database } = await import('better-sqlite3')
      const db = new Database(conn.connection.filename, { readonly: true, fileMustExist: true })
      try {
        await db.backup(output)
      } finally {
        db.close()
      }
    } else {
      output = join(target, `preceptoria-${stamp}.dump`)
      const c = conn.connection
      await new Promise<void>((resolve, reject) => {
        const p = spawn(
          'pg_dump',
          ['-h', c.host, '-p', String(c.port), '-U', c.user, '-Fc', '-f', output, c.database],
          {
            env: { ...process.env, PGPASSWORD: c.password },
            stdio: 'inherit',
          }
        )
        p.on('error', (e) => reject(new Error(`Não foi possível executar o pg_dump: ${e.message}`)))
        p.on('exit', (code) =>
          code === 0 ? resolve() : reject(new Error(`pg_dump terminou com código ${code}`))
        )
      })
    }

    const { size } = await stat(output)
    this.logger.success(`Backup criado: ${output} (${(size / 1024).toFixed(1)} KB)`)

    // Retenção
    const files = (await readdir(target)).filter((f) => f.startsWith('preceptoria-')).sort()
    for (const old of files.slice(0, Math.max(0, files.length - this.keep))) {
      await rm(join(target, old))
      this.logger.info(`Backup antigo removido: ${old}`)
    }
  }
}
