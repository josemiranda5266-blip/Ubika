export const UBIKA_ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  DISPATCHER: 'DISPATCHER',
  KITCHEN: 'KITCHEN',
  MOZO: 'MOZO',
  DRIVER: 'DRIVER',
  CLIENT: 'CLIENT',
} as const;

export type UbikaRole = (typeof UBIKA_ROLES)[keyof typeof UBIKA_ROLES];

/** Roles that a COMPANY_ADMIN can assign to employees through invitations. */
export const EMPLOYEE_INVITATION_ROLES: readonly UbikaRole[] = [
  UBIKA_ROLES.MOZO,
  UBIKA_ROLES.KITCHEN,
  UBIKA_ROLES.DRIVER,
  UBIKA_ROLES.DISPATCHER,
] as const;

export type CommerceModule =
  | 'dashboard'
  | 'pos'
  | 'cash'
  | 'products'
  | 'menu'
  | 'stock'
  | 'sales'
  | 'orders'
  | 'kitchen'
  | 'tables'
  | 'delivery'
  | 'customers'
  | 'staff'
  | 'reports'
  | 'settings';

const ROLE_MODULES: Record<UbikaRole, readonly CommerceModule[]> = {
  SUPER_ADMIN: [
    'dashboard', 'pos', 'cash', 'products', 'menu', 'stock', 'sales', 'orders',
    'kitchen', 'tables', 'delivery', 'customers', 'staff', 'reports', 'settings',
  ],
  COMPANY_ADMIN: [
    'dashboard', 'pos', 'cash', 'products', 'menu', 'stock', 'sales', 'orders',
    'kitchen', 'tables', 'delivery', 'customers', 'staff', 'reports', 'settings',
  ],
  DISPATCHER: ['dashboard', 'orders', 'delivery'],
  KITCHEN: ['orders', 'kitchen'],
  MOZO: ['orders', 'tables', 'menu', 'customers'],
  DRIVER: ['delivery'],
  CLIENT: ['menu', 'orders', 'customers'],
};

export function roleCanAccessModule(role: UbikaRole | string, module: CommerceModule): boolean {
  const modules = ROLE_MODULES[role as UbikaRole];
  return !!modules?.includes(module);
}

export function isEmployeeInvitationRole(role: string): role is UbikaRole {
  return EMPLOYEE_INVITATION_ROLES.includes(role as UbikaRole);
}

export function isCommerceStaffRole(role: UbikaRole | string): boolean {
  return (['SUPER_ADMIN', 'COMPANY_ADMIN', 'DISPATCHER', 'KITCHEN', 'MOZO', 'DRIVER'] as readonly UbikaRole[])
    .includes(role as UbikaRole);
}
