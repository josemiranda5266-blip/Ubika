# UBIKA — Unified Commerce Architecture

## Product model

UBIKA is one application/platform. A person installs the same UBIKA app and their authenticated role determines the workspace they can access. Modules are not separate products from the user's perspective.

## Tenant model

Every employee and every commerce operation is scoped to a `companyId` (the tenant). The authenticated user's `companyId` is authoritative; client-provided tenant identifiers must never be trusted for ordinary company operations.

Core relationship:

```text
User -> companyId -> Business/Tenant
              |
              +-> Products / Menu
              +-> Orders / Tables
              +-> Kitchen
              +-> Sales / Payments / Cash
              +-> Inventory
              +-> Deliveries / Drivers
              +-> Customers
              +-> Staff
```

## Roles

- `SUPER_ADMIN`: platform administration.
- `COMPANY_ADMIN`: owner/business administrator.
- `DISPATCHER`: delivery dispatch operations.
- `KITCHEN`: kitchen preparation workflow.
- `MOZO`: salon/table service and order taking.
- `DRIVER`: assigned deliveries.
- `CLIENT`: customer-facing authenticated experience.

## Employee onboarding

1. Company owner creates an employee invitation.
2. Invitation contains the company and immutable role.
3. Raw invitation secret is sent through the configured invitation channel and only its hash is persisted.
4. Employee accepts the invitation and chooses their password.
5. Account is created with the invitation's `companyId` and role; the client cannot override either value.
6. Subsequent authorization checks use the authenticated identity and tenant scope.

## Restaurant/bar flow

```text
Customer / Mozo
      |
      v
   Order
      |
      +----> Kitchen ----> Ready
      |
      +----> Delivery ----> Delivered
      |
      v
   Payment
      |
      v
    Cash / Sales / Reports
```

For table service, tables and their active checks belong to the same company. A table order can be created by a mozo or, where enabled, by a customer using a table QR flow. Both paths feed the same order and kitchen pipeline.

## Product source of truth

The long-term target is one canonical commerce product model. POS, menu, kitchen, inventory, delivery and reporting must reference the same product identity instead of maintaining independent copies of the same product.

## Security invariants

- No cross-tenant reads or writes.
- Employee role comes from the invitation/account, never from a client-controlled route parameter.
- UI visibility is not considered authorization; backend authorization is mandatory.
- Company admins can manage only their own company's staff.
- Driver operations are limited to the authenticated driver's company and assigned delivery scope.
- Kitchen and mozo operations are limited to the authenticated company's order/table scope.
