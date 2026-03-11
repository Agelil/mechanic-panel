/**
 * All granular action permissions, organized by section.
 * This is the single source of truth — used in DB seeding,
 * the permission matrix UI, and the HasPermission component.
 */

export interface PermissionDef {
  key: string;
  label: string;
  description?: string;
}

export interface PermissionSection {
  id: string;
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    id: "dashboard",
    label: "Дашборд",
    permissions: [
      { key: "view_dashboard",  label: "Просмотр дашборда",      description: "Доступ к главной странице панели управления" },
      { key: "view_revenue",    label: "Просмотр выручки",        description: "Видеть суммы и финансовую статистику" },
      { key: "view_prices",     label: "Просмотр цен",            description: "Видеть цены в заявках и услугах" },
    ],
  },
  {
    id: "appointments",
    label: "Заявки",
    permissions: [
      { key: "view_appointments",       label: "Просмотр заявок",              description: "Видеть список записей клиентов" },
      { key: "edit_appointments",       label: "Редактирование заявок",         description: "Изменять данные заявки (имя, авто, описание)" },
      { key: "delete_appointments",     label: "Удаление заявок",               description: "Безвозвратно удалять записи" },
      { key: "view_appointment_price",  label: "Просмотр стоимости заявки",     description: "Видеть итоговую сумму в заявке" },
      { key: "edit_appointment_status", label: "Смена статуса заявки",          description: "Изменять статус: новая → в работе → выполнена" },
      { key: "edit_appointment_services",label: "Редактирование услуг заявки",  description: "Добавлять/удалять услуги в заявке" },
    ],
  },
  {
    id: "supply",
    label: "Снабжение",
    permissions: [
      { key: "view_supply",         label: "Просмотр снабжения",            description: "Видеть список заявок на запчасти и расходники" },
      { key: "create_supply_order", label: "Создание заявки на снабжение",  description: "Подавать новые заявки на запчасти" },
      { key: "edit_supply_order",   label: "Редактирование заявки снабж.",  description: "Изменять уже созданные заявки" },
      { key: "approve_supply_order",label: "Одобрение заявки снабж.",       description: "Подтверждать или отклонять заявки" },
      { key: "delete_supply_order", label: "Удаление заявки снабж.",        description: "Удалять заявки на снабжение" },
    ],
  },
  {
    id: "services",
    label: "Услуги и Категории",
    permissions: [
      { key: "view_services",    label: "Просмотр услуг",           description: "Видеть список услуг сервиса" },
      { key: "edit_services",    label: "Редактирование услуг",      description: "Создавать и изменять услуги" },
      { key: "delete_services",  label: "Удаление услуг",            description: "Удалять услуги" },
      { key: "edit_service_price",label: "Редактирование цен услуг", description: "Изменять стоимость услуг" },
      { key: "view_categories",  label: "Просмотр категорий",        description: "Видеть категории услуг" },
      { key: "edit_categories",  label: "Редактирование категорий",  description: "Создавать и изменять категории" },
      { key: "delete_categories",label: "Удаление категорий",        description: "Удалять категории" },
    ],
  },
  {
    id: "portfolio",
    label: "Портфолио",
    permissions: [
      { key: "view_portfolio",    label: "Просмотр портфолио",       description: "Видеть список работ" },
      { key: "edit_portfolio",    label: "Редактирование портфолио", description: "Создавать и изменять кейсы" },
      { key: "delete_portfolio",  label: "Удаление фото/кейсов",     description: "Удалять работы из портфолио" },
      { key: "publish_portfolio", label: "Публикация на сайте",      description: "Включать/выключать видимость работы" },
    ],
  },
  {
    id: "promotions",
    label: "Акции",
    permissions: [
      { key: "view_promotions",   label: "Просмотр акций",     description: "Видеть список акций" },
      { key: "edit_promotions",   label: "Редактирование акций",description: "Создавать и изменять акции" },
      { key: "delete_promotions", label: "Удаление акций",     description: "Удалять акции" },
    ],
  },
  {
    id: "clients",
    label: "Клиенты",
    permissions: [
      { key: "view_clients",       label: "Просмотр клиентов",       description: "Видеть список клиентов и их контакты" },
      { key: "edit_clients",       label: "Редактирование клиентов",  description: "Изменять данные клиентов" },
      { key: "delete_clients",     label: "Удаление клиентов",        description: "Удалять клиентов из базы" },
      { key: "view_client_history",label: "История клиента",          description: "Видеть историю обращений и бонусные баллы" },
    ],
  },
  {
    id: "reviews",
    label: "Отзывы",
    permissions: [
      { key: "view_reviews",    label: "Просмотр отзывов",     description: "Видеть все отзывы включая неопубликованные" },
      { key: "publish_reviews", label: "Публикация отзывов",   description: "Одобрять/снимать отзывы с публикации" },
      { key: "edit_reviews",    label: "Редактирование отзывов",description: "Изменять текст отзывов" },
      { key: "delete_reviews",  label: "Удаление отзывов",     description: "Удалять отзывы" },
    ],
  },
  {
    id: "users",
    label: "Пользователи и Доступ",
    permissions: [
      { key: "view_users",    label: "Просмотр пользователей",     description: "Видеть список зарегистрированных пользователей" },
      { key: "edit_users",    label: "Редактирование пользователей",description: "Изменять данные пользователей" },
      { key: "approve_user",  label: "Одобрение регистраций",       description: "Разрешать доступ новым пользователям" },
      { key: "block_user",    label: "Блокировка пользователей",    description: "Запрещать доступ пользователям" },
      { key: "assign_role",   label: "Назначение ролей",            description: "Устанавливать роли: admin/manager/master" },
      { key: "view_groups",   label: "Просмотр групп",              description: "Видеть группы и их права" },
      { key: "edit_groups",   label: "Редактирование групп",        description: "Создавать и изменять группы" },
      { key: "delete_groups", label: "Удаление групп",              description: "Удалять группы пользователей" },
    ],
  },
  {
    id: "permissions",
    label: "Матрица прав",
    permissions: [
      { key: "view_permissions", label: "Просмотр матрицы прав",     description: "Видеть матрицу разрешений ролей" },
      { key: "edit_permissions", label: "Редактирование прав ролей", description: "Изменять разрешения для ролей" },
    ],
  },
  {
    id: "settings",
    label: "Настройки",
    permissions: [
      { key: "view_settings",          label: "Просмотр настроек",           description: "Видеть раздел настроек" },
      { key: "edit_settings",          label: "Редактирование настроек",      description: "Изменять любые настройки сайта" },
      { key: "edit_contacts",          label: "Редактирование контактов",     description: "Изменять телефон, адрес, часы работы" },
      { key: "edit_telegram_settings", label: "Telegram настройки",          description: "Изменять токен бота и Chat ID" },
      { key: "edit_integrations",      label: "Настройка интеграций",        description: "Google Sheets, webhook и внешние сервисы" },
    ],
  },
  {
    id: "system",
    label: "Система",
    permissions: [
      { key: "view_system",    label: "Просмотр системной информации", description: "Статистика БД, версии, метрики" },
      { key: "view_audit_log", label: "Журнал аудита",                 description: "Просмотр действий всех пользователей" },
    ],
  },
];

/** Flat list of all permission keys */
export const ALL_PERMISSIONS = PERMISSION_SECTIONS.flatMap((s) => s.permissions.map((p) => p.key));

/** Find a permission definition by key */
export function getPermissionDef(key: string): PermissionDef | undefined {
  for (const section of PERMISSION_SECTIONS) {
    const found = section.permissions.find((p) => p.key === key);
    if (found) return found;
  }
  return undefined;
}
