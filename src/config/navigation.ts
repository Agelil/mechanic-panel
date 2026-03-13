import {
  LayoutDashboard, Wrench, Images, ClipboardList,
  Settings, Tag, Users, FolderOpen, UserCog, Star,
  ShieldCheck, ServerCog, ShoppingCart, UsersRound, BookOpen,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match pathname exactly (for index routes) */
  exact?: boolean;
  /** Permission key required to show this item */
  permission: string;
}

/**
 * Centralised admin navigation items.
 * Sidebar and route guards both consume this array.
 * To add a new section, just add an entry here — menu + protection are automatic.
 */
export const NAV_ITEMS: NavItem[] = [
  { href: "/admin",              label: "Дашборд",         icon: LayoutDashboard, exact: true, permission: "view_dashboard" },
  { href: "/admin/appointments", label: "Заявки",           icon: ClipboardList,                permission: "view_appointments" },
  { href: "/admin/supply",       label: "Снабжение",        icon: ShoppingCart,                 permission: "view_supply" },
  { href: "/admin/services",     label: "Услуги",            icon: Wrench,                       permission: "view_services" },
  { href: "/admin/categories",   label: "Категории",         icon: FolderOpen,                   permission: "view_categories" },
  { href: "/admin/portfolio",    label: "Портфолио",         icon: Images,                       permission: "view_portfolio" },
  { href: "/admin/promotions",   label: "Акции",             icon: Tag,                          permission: "view_promotions" },
  { href: "/admin/clients",      label: "Клиенты",           icon: Users,                        permission: "view_clients" },
  { href: "/admin/reviews",      label: "Отзывы",            icon: Star,                         permission: "view_reviews" },
  { href: "/admin/users",        label: "Сотрудники",        icon: UserCog,                      permission: "view_users" },
  { href: "/admin/groups",       label: "Группы и права",    icon: UsersRound,                   permission: "view_groups" },
  { href: "/admin/access",       label: "Доступ",            icon: ShieldCheck,                  permission: "view_users" },
  { href: "/admin/settings",     label: "Настройки",         icon: Settings,                     permission: "view_settings" },
  { href: "/admin/wiki",         label: "База знаний",       icon: BookOpen,                     permission: "view_dashboard" },
  { href: "/admin/system",       label: "Система",           icon: ServerCog,                    permission: "view_system" },
];

/** Role badge labels (display only) */
export const ROLE_BADGE: Record<string, string> = {
  admin:   "АДМИНИСТРАТОР",
  manager: "МЕНЕДЖЕР",
  master:  "МАСТЕР",
};
