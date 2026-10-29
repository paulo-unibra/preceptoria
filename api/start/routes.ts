/*
|--------------------------------------------------------------------------
| Rotas da API — Preceptoria / Acompanhamento Escolar
|--------------------------------------------------------------------------
*/

import router from '@adonisjs/core/services/router'
import db from '@adonisjs/lucid/services/db'
import { middleware } from '#start/kernel'
import { loginThrottle } from '#start/limiter'

const AuthController = () => import('#controllers/auth_controller')
const UsersController = () => import('#controllers/users_controller')
const ClassroomsController = () => import('#controllers/classrooms_controller')
const StudentsController = () => import('#controllers/students_controller')
const AttendancesController = () => import('#controllers/attendances_controller')
const UniformChecksController = () => import('#controllers/uniform_checks_controller')
const LessonDaysController = () => import('#controllers/lesson_days_controller')
const OccurrencesController = () => import('#controllers/occurrences_controller')
const RaCodesController = () => import('#controllers/ra_codes_controller')
const PagesController = () => import('#controllers/pages_controller')
const NotificationsController = () => import('#controllers/notifications_controller')
const ReferralsController = () => import('#controllers/referrals_controller')
const ObservationsController = () => import('#controllers/observations_controller')
const ReportsController = () => import('#controllers/reports_controller')
const RankingController = () => import('#controllers/ranking_controller')
const SettingsController = () => import('#controllers/settings_controller')
const AuditLogsController = () => import('#controllers/audit_logs_controller')

const adminOnly = middleware.role({ roles: ['admin'] })
const staff = middleware.role({ roles: ['admin', 'coordenacao'] })

router.get('/', async () => ({ name: 'Preceptoria - Acompanhamento Escolar API', version: 'v1' }))
router.get('/privacidade', [PagesController, 'privacy'])
router.get('/exclusao-de-conta', [PagesController, 'accountDeletion'])
router.get('/health', async () => {
  await db.rawQuery('select 1')
  return { status: 'ok' }
})

router
  .group(() => {
    // RF-01 — autenticação
    router.post('auth/login', [AuthController, 'login']).use(loginThrottle)

    router
      .group(() => {
        router.post('auth/logout', [AuthController, 'logout'])
        router.get('auth/me', [AuthController, 'me'])
        router.put('auth/password', [AuthController, 'changePassword'])

        // Administração
        router.get('users', [UsersController, 'index']).use(adminOnly)
        router.post('users', [UsersController, 'store']).use(adminOnly)
        router.get('users/:id', [UsersController, 'show']).use(adminOnly)
        router.patch('users/:id', [UsersController, 'update']).use(adminOnly)
        router.put('users/:id/classrooms', [UsersController, 'syncClassrooms']).use(adminOnly)
        router.get('settings', [SettingsController, 'index']).use(adminOnly)
        router.put('settings/ranking', [SettingsController, 'updateRanking']).use(adminOnly)
        router.put('settings/privacy', [SettingsController, 'updatePrivacy']).use(adminOnly)
        router.patch('ra-codes/:code', [RaCodesController, 'update']).use(adminOnly)
        router.get('audit-logs', [AuditLogsController, 'index']).use(staff)

        // RF-04 — turmas, enturmação e ficha do estudante
        router.get('classrooms', [ClassroomsController, 'index'])
        router.get('classrooms/:id', [ClassroomsController, 'show'])
        router.get('classrooms/:id/students', [ClassroomsController, 'students'])
        router.post('classrooms', [ClassroomsController, 'store']).use(adminOnly)
        router.patch('classrooms/:id', [ClassroomsController, 'update']).use(adminOnly)

        router.get('students', [StudentsController, 'index'])
        router.get('students/:id', [StudentsController, 'show'])
        router.get('students/:id/photo', [StudentsController, 'photo'])
        router.post('students', [StudentsController, 'store']).use(adminOnly)
        router.patch('students/:id', [StudentsController, 'update']).use(adminOnly)
        router.post('students/:id/photo', [StudentsController, 'uploadPhoto']).use(adminOnly)
        router.post('students/:id/guardians', [StudentsController, 'storeGuardian']).use(adminOnly)
        router
          .patch('students/:id/guardians/:guardianId', [StudentsController, 'updateGuardian'])
          .use(adminOnly)

        // RF-09 — histórico individual
        router.get('students/:id/history', [ReportsController, 'history'])

        // RF-05 — frequência
        router.get('attendances', [AttendancesController, 'index'])
        router.get('attendances/roster', [AttendancesController, 'roster'])
        router.put('attendances/bulk', [AttendancesController, 'bulk'])

        // RF-02 — checklist de fardamento e calçado
        router.get('uniform-checks', [UniformChecksController, 'index'])
        router.get('uniform-checks/roster', [UniformChecksController, 'roster'])
        router.put('uniform-checks/bulk', [UniformChecksController, 'bulk'])

        // RF-06 / RF-07 — registro diário das aulas
        router.get('lesson-days', [LessonDaysController, 'index'])
        router.get('lesson-days/:id', [LessonDaysController, 'show'])
        router.put('lesson-days', [LessonDaysController, 'upsert'])

        // RF-08 — ocorrências e RAs
        router.get('ra-codes', [RaCodesController, 'index'])
        router.get('occurrences', [OccurrencesController, 'index'])
        router.post('occurrences', [OccurrencesController, 'store'])
        router.get('occurrences/:id', [OccurrencesController, 'show'])
        router.patch('occurrences/:id', [OccurrencesController, 'update'])
        router.post('occurrences/:id/cancel', [OccurrencesController, 'cancel'])
        router
          .post('occurrences/:id/resolve-divergence', [OccurrencesController, 'resolveDivergence'])
          .use(adminOnly)
        router
          .post('occurrences/:id/review-duplicate', [OccurrencesController, 'reviewDuplicate'])
          .use(staff)

        router.get('notifications', [NotificationsController, 'index'])
        router.post('notifications', [NotificationsController, 'store'])
        router.get('notifications/:id', [NotificationsController, 'show'])
        router.patch('notifications/:id', [NotificationsController, 'update'])
        router.post('notifications/:id/cancel', [NotificationsController, 'cancel'])

        router.get('observations', [ObservationsController, 'index'])
        router.post('observations', [ObservationsController, 'store'])
        router.patch('observations/:id', [ObservationsController, 'update'])
        router.post('observations/:id/cancel', [ObservationsController, 'cancel'])

        // RF-11 — encaminhamentos
        router.get('referrals', [ReferralsController, 'index'])
        router.post('referrals', [ReferralsController, 'store'])
        router.get('referrals/:id', [ReferralsController, 'show'])
        router.patch('referrals/:id', [ReferralsController, 'update'])
        router.post('referrals/:id/cancel', [ReferralsController, 'cancel'])

        // RF-10 — relatórios (JSON ou ?format=pdf)
        router.get('reports/students/:id', [ReportsController, 'student'])
        router.get('reports/classrooms/:id', [ReportsController, 'classroom'])
        router.get('reports/classrooms/:id/day', [ReportsController, 'day'])

        // RF-03 — ranking
        router.get('ranking', [RankingController, 'index'])
        router.get('ranking/criteria', [RankingController, 'criteria'])
      })
      .use(middleware.auth())
  })
  .prefix('/api/v1')
