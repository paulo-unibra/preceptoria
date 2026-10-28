import { DateTime } from 'luxon'
import { booleanColumn } from '#support/columns'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, manyToMany } from '@adonisjs/lucid/orm'
import type { ManyToMany } from '@adonisjs/lucid/types/relations'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbAccessTokensProvider } from '@adonisjs/auth/access_tokens'
import Classroom from '#models/classroom'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export type UserRole = 'preceptor' | 'coordenacao' | 'admin'
export const USER_ROLES: UserRole[] = ['preceptor', 'coordenacao', 'admin']

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: number

  @column()
  declare fullName: string

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column()
  declare role: UserRole

  @booleanColumn()
  declare isActive: boolean

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  @manyToMany(() => Classroom, { pivotTable: 'classroom_user', pivotTimestamps: true })
  declare classrooms: ManyToMany<typeof Classroom>

  get isAdmin() {
    return this.role === 'admin'
  }

  static accessTokens = DbAccessTokensProvider.forModel(User, {
    expiresIn: '12 hours',
  })
}
