import { DateTime } from 'luxon'
import type User from '#models/user'
import ClassroomAccess from '#services/classroom_access'
import { conflict } from '#support/errors'

interface Cancellable {
  status: string
  createdBy: number | null
  classroomId: number | null
  merge: (values: any) => any
  save: () => Promise<any>
}

export function assertNotCancelled(record: { status: string }) {
  if (record.status === 'cancelled')
    throw conflict('Este registro está cancelado e não pode ser alterado.', 'E_CANCELLED')
}

/**
 * Cancelamento lógico (DP04, premissa): o registro nunca é apagado; fica com motivo, autor e data,
 * e continua visível no histórico quando solicitado.
 */
export async function cancelRecord(user: User, record: Cancellable, reason: string) {
  await ClassroomAccess.assertCanModify(user, record)
  if (record.status === 'cancelled')
    throw conflict('Este registro já está cancelado.', 'E_CANCELLED')
  record.merge({
    status: 'cancelled',
    cancelledAt: DateTime.now(),
    cancelledBy: user.id,
    cancelReason: reason,
  })
  await record.save()
}
