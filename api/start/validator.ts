import vine, { SimpleMessagesProvider } from '@vinejs/vine'

/**
 * Mensagens de validação em português (RNF01).
 */
vine.messagesProvider = new SimpleMessagesProvider(
  {
    'required': 'O campo {{ field }} é obrigatório.',
    'string': 'O campo {{ field }} deve ser um texto.',
    'number': 'O campo {{ field }} deve ser um número.',
    'boolean': 'O campo {{ field }} deve ser verdadeiro ou falso.',
    'array': 'O campo {{ field }} deve ser uma lista.',
    'object': 'O campo {{ field }} deve ser um objeto.',
    'email': 'Informe um e-mail válido.',
    'regex': 'O formato do campo {{ field }} é inválido.',
    'minLength': 'O campo {{ field }} deve ter no mínimo {{ min }} caracteres.',
    'maxLength': 'O campo {{ field }} deve ter no máximo {{ max }} caracteres.',
    'min': 'O campo {{ field }} deve ser no mínimo {{ min }}.',
    'max': 'O campo {{ field }} deve ser no máximo {{ max }}.',
    'range': 'O campo {{ field }} deve estar entre {{ min }} e {{ max }}.',
    'enum': 'O valor do campo {{ field }} é inválido. Opções: {{ choices }}.',
    'unique': 'Já existe um registro com este valor em {{ field }}.',
    'date.invalid': 'O campo {{ field }} deve ser uma data válida (AAAA-MM-DD).',
    'date.future': 'O campo {{ field }} não pode ser uma data futura.',
    'notEmpty': 'O campo {{ field }} não pode ficar vazio.',
    'distinct': 'O campo {{ field }} não pode ter valores repetidos.',
  },
  {
    full_name: 'nome completo',
    password: 'senha',
    current_password: 'senha atual',
    classroom_id: 'turma',
    student_id: 'estudante',
    school_year: 'ano letivo',
    occurred_on: 'data do acontecimento',
    notified_on: 'data da notificação',
    referred_on: 'data do encaminhamento',
    observed_on: 'data da observação',
    ra_code: 'código RA',
    description: 'descrição',
    reason: 'motivo',
    date: 'data',
    from: 'data inicial',
    to: 'data final',
  }
)
