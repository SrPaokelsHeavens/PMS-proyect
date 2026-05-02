# Production Roadmap

## Iteration 1 - Foundation

- Monorepo structure with API, web app and shared contracts.
- Database-backed rooms, guests, stays, charges, products and audit logs.
- Admin login foundation with JWT.
- Reception dashboard and room check-in/check-out workflows.

## Iteration 2 - Reception Workflow

- DNI lookup through a backend-only provider adapter.
- Multiple guests per room.
- Room move, extend stay, room blocking and maintenance states.
- Printable guest registration form.

## Iteration 3 - Cashier And Billing

- Cash/card/QR payment tracking.
- Partial payments and open balances.
- Cash drawer shifts.
- Boleta/factura integration plan for SUNAT provider.

## Iteration 4 - Inventory And Housekeeping

- Product stock movements.
- Cleaning queue by floor.
- Minibar consumption workflow.
- Low-stock alerts.

## Iteration 5 - Security And Operations

- Roles and permissions.
- Audit trail screens.
- Automated database backups.
- Production deployment scripts.
- Monitoring and error reporting.

## Privacy Rules

- DNI data and guest identity data must be requested only from the backend.
- API tokens must never be placed in frontend code.
- Guest data must have audit logging and role-based access.
