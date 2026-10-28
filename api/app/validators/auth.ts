import vine from '@vinejs/vine'

export const loginValidator = vine.compile(
  vine.object({
    email: vine.string().trim().toLowerCase().email(),
    password: vine.string().minLength(1),
  })
)

export const changePasswordValidator = vine.compile(
  vine.object({
    current_password: vine.string().minLength(1),
    password: vine
      .string()
      .minLength(8)
      .maxLength(128)
      .confirmed({ confirmationField: 'password_confirmation' }),
  })
)
