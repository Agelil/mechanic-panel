/**
 * All granular action permissions, organized by section.
 * Single source of truth — used in DB seeding, permission matrix UI, HasPermission component.
 *
 * UI grouping for AdminGroupsPage accordion:
 *  🛠  orders      — Заказы и Работы
 *  💰  finance     — Финансы и Цены
 *  📦  supply      — Снабжение
 *  👥  clients_crm — Клиенты и Бонусы
 *  ⚙️  system_cfg  — Системные настройки
 */

export interface PermissionDef {
  key: string;
  label: string;
  description?: string;
  uiGroup?: string; // override to bucket into a specific accordion group
}

export interface PermissionSection {
  id: string;
  label: string;
  permissions: PermissionDef[];
}

export const PERMISSION_SECTIONS: PermissionSection[] = [
  // ─── 🛠 Заказы и Работы ────────────────────────────────────────────
  {
    id: "appointments",
    label: "🛠 Заказы и Работы",
    permissions: [
      { key: "view_dashboard",           label: "Просмотр дашборда",              description: "Доступ к главной странице панели управления" },
      { key: "view_appointments",        label: "Просмотр заявок",                description: "Видеть список записей клиентов" },
      { key: "edit_appointments",        label: "Редактирование заявок",           description: "Изменять данные заявки (имя, авто, описание)" },
      { key: "delete_appointments",      label: "Удаление заявок",                description: "Безвозвратно удалять записи" },
      { key: "edit_appointment_status",  label: "Смена статуса заявки",           description: "Изменять статус: новая → в работе → выполнена" },
      { key: "edit_appointment_services",label: "Редактирование услуг заявки",    description: "Добавлять/удалять услуги и работы в заявке" },
      { key: "view_services",            label: "Просмотр справочника услуг",     description: "Видеть список услуг сервиса" },
      { key: "edit_services",            label: "Редактирование услуг",           description: "Создавать и изменять услуги" },
      { key: "delete_services",          label: "Удаление услуг",                 description: "Удалять услуги" },
      { key: "view_categories",          label: "Просмотр категорий",             description: "Видеть категории услуг" },
      { key: "edit_categories",          label: "Редактирование категорий",       description: "Создавать и изменять категории" },
      { key: "delete_categories",        label: "Удаление категорий",             description: "Удалять категории" },
      { key: "view_portfolio",           label: "Просмотр портфолио",             description: "Видеть список работ" },
      { key: "edit_portfolio",           label: "Редактирование портфолио",       description: "Создавать и изменять кейсы" },
      { key: "delete_portfolio",         label: "Удаление фото/кейсов",           description: "Удалять работы из портфолио" },
      { key: "publish_portfolio",        label: "Публикация на сайте",            description: "Включать/выключать видимость работы" },
      { key: "view_promotions",          label: "Просмотр акций",                 description: "Видеть список акций" },
      { key: "edit_promotions",          label: "Редактирование акций",           description: "Создавать и изменять акции" },
      { key: "delete_promotions",        label: "Удаление акций",                 description: "Удалять акции" },
      { key: "view_reviews",             label: "Просмотр отзывов",               description: "Видеть все отзывы включая неопубликованные" },
      { key: "publish_reviews",          label: "Публикация отзывов",             description: "Одобрять/снимать отзывы с публикации" },
      { key: "edit_reviews",             label: "Редактирование отзывов",         description: "Изменять текст отзывов" },
      { key: "delete_reviews",           label: "Удаление отзывов",              description: "Удалять отзывы" },
    ],
  },

  // ─── 💰 Финансы и Цены ──────────────────────────────────────────────
  {
    id: "finance",
    label: "💰 Финансы и Цены",
    permissions: [
      { key: "view_appointment_price",   label: "Просмотр стоимости заявки",      description: "Видеть итоговую сумму в заявке" },
      { key: "view_order_prices",        label: "Просмотр цен в заказе",          description: "Видеть стоимость работ и запчастей внутри заявки" },
      { key: "edit_order_prices",        label: "Редактирование стоимости заказа",description: "Изменять суммы работ и запчастей" },
      { key: "view_revenue",             label: "Просмотр выручки",               description: "Видеть итоговую финансовую статистику сервиса" },
      { key: "view_total_revenue",       label: "Просмотр общей выручки",         description: "Видеть суммарную прибыль по всем заказам" },
      { key: "view_finances",            label: "Финансовая аналитика",           description: "Видеть виджеты выручки, среднего чека и дебиторки" },
      { key: "view_prices",              label: "Просмотр прайса",                description: "Видеть цены в услугах и каталоге" },
      { key: "edit_service_price",       label: "Редактирование цен услуг",       description: "Изменять стоимость позиций прайс-листа" },
      { key: "edit_parts_cost",          label: "Редактирование цен запчастей",   description: "Менять закупочную и клиентскую цену запчасти" },
    ],
  },

  // ─── 📦 Снабжение ────────────────────────────────────────────────────
  {
    id: "supply",
    label: "📦 Снабжение",
    permissions: [
      { key: "view_supply",              label: "Просмотр снабжения",             description: "Видеть список заявок на запчасти и расходники" },
      { key: "create_supply_order",      label: "Создание заявки на снабжение",   description: "Подавать новые заявки на запчасти" },
      { key: "create_supply_request",    label: "Создание запроса запчастей",     description: "Мастер создаёт запрос прямо из заявки" },
      { key: "edit_supply_order",        label: "Редактирование заявки снабж.",   description: "Изменять уже созданные заявки" },
      { key: "approve_supply_order",     label: "Одобрение заявки снабж.",        description: "Подтверждать или отклонять заявки менеджером" },
      { key: "approve_supply_request",   label: "Подтверждение заказов мастеров", description: "Согласовывать запросы запчастей от мастеров" },
      { key: "delete_supply_order",      label: "Удаление заявки снабж.",         description: "Удалять заявки на снабжение" },
    ],
  },

  // ─── 👥 Клиенты и Бонусы ─────────────────────────────────────────────
  {
    id: "clients_crm",
    label: "👥 Клиенты и Бонусы",
    permissions: [
      { key: "view_clients",             label: "Просмотр клиентов",              description: "Видеть список клиентов и их контакты" },
      { key: "edit_clients",             label: "Редактирование клиентов",        description: "Изменять данные клиентов" },
      { key: "delete_clients",           label: "Удаление клиентов",              description: "Удалять клиентов из базы" },
      { key: "view_client_history",      label: "История клиента",                description: "Видеть историю обращений в карточке клиента" },
      { key: "view_service_history",     label: "История обслуживания",           description: "Видеть детальную историю заказов и работ клиента" },
      { key: "view_client_bonuses",      label: "Просмотр баланса бонусов",       description: "Видеть бонусные баллы клиента" },
      { key: "edit_bonuses",             label: "Ручное управление бонусами",     description: "Начислять и списывать бонусы вручную (рекламации, подарки)" },
      { key: "edit_client_bonuses",      label: "Редактирование бонусного счёта", description: "Корректировать баланс клиента" },
      { key: "view_telegram_users",      label: "Telegram-подписчики",            description: "Видеть список подписчиков бота" },
      { key: "send_broadcast",           label: "Рассылка в Telegram",            description: "Отправлять массовые сообщения подписчикам" },
      { key: "edit_client_accounts",     label: "Редактирование кабинетов клиентов", description: "Менять данные клиентских аккаунтов (имя, телефон, авто)" },
      { key: "delete_client_accounts",   label: "Удаление кабинетов клиентов",    description: "Полностью удалять клиентские кабинеты" },
    ],
  },

  // ─── ⚙️ Системные настройки ─────────────────────────────────────────
  {
    id: "system_cfg",
    label: "⚙️ Системные настройки",
    permissions: [
      { key: "view_settings",            label: "Просмотр настроек",              description: "Видеть раздел настроек" },
      { key: "edit_settings",            label: "Редактирование настроек",        description: "Изменять любые настройки сайта" },
      { key: "edit_site_config",         label: "Настройки сайта (адрес, телефон)",description: "Изменять контакты, адрес, часы работы" },
      { key: "edit_contacts",            label: "Редактирование контактов",       description: "Изменять телефон, адрес, режим работы" },
      { key: "edit_telegram_settings",   label: "Telegram-настройки",             description: "Изменять токен бота и Chat ID" },
      { key: "edit_integrations",        label: "Настройка интеграций",           description: "Google Sheets, webhook и внешние сервисы" },
      { key: "manage_bonus_rate",        label: "Управление % кешбэка",           description: "Изменять процент начисления и лимит использования бонусов" },
      { key: "view_users",               label: "Просмотр пользователей",         description: "Видеть список зарегистрированных пользователей" },
      { key: "edit_users",               label: "Редактирование пользователей",   description: "Изменять данные пользователей" },
      { key: "approve_user",             label: "Одобрение регистраций",          description: "Разрешать доступ новым пользователям" },
      { key: "block_user",               label: "Блокировка пользователей",       description: "Запрещать доступ пользователям" },
      { key: "assign_role",              label: "Назначение ролей",               description: "Устанавливать роли: admin/manager/master" },
      { key: "view_groups",              label: "Просмотр групп",                 description: "Видеть группы и их права" },
      { key: "edit_groups",              label: "Редактирование групп",           description: "Создавать и изменять группы" },
      { key: "manage_user_groups",       label: "Управление матрицей прав",       description: "Полный доступ к редактированию групп и прав" },
      { key: "delete_groups",            label: "Удаление групп",                 description: "Удалять группы пользователей" },
      { key: "view_permissions",         label: "Просмотр матрицы прав",          description: "Видеть матрицу разрешений ролей" },
      { key: "edit_permissions",         label: "Редактирование прав ролей",      description: "Изменять разрешения для ролей" },
      { key: "view_system",              label: "Системная информация",           description: "Статистика БД, версии, метрики" },
      { key: "view_audit_log",           label: "Журнал аудита",                  description: "Просмотр действий всех пользователей" },
      { key: "manage_wiki",               label: "Управление базой знаний",        description: "Создание, редактирование и удаление статей Wiki" },
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
