import string from '@adonisjs/core/helpers/string'
import { BaseModel, SnakeCaseNamingStrategy } from '@adonisjs/lucid/orm'
import type { LucidModel } from '@adonisjs/lucid/types/model'

/**
 * Toda a API fala snake_case (payloads de entrada e respostas). Por padrão o Lucid serializa em camelCase.
 */
class ApiNamingStrategy extends SnakeCaseNamingStrategy {
  serializedName(_model: LucidModel, propertyName: string) {
    return string.snakeCase(propertyName)
  }
}

BaseModel.namingStrategy = new ApiNamingStrategy()
