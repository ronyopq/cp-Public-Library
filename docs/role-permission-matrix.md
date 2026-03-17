# Role-Permission Matrix

## Roles

- `Public`: anonymous visitors using the public catalog and public competition pages.
- `Member`: registered patron with optional portal access.
- `Librarian`: front-desk staff for cataloging, copies, members, and circulation.
- `Officer`: librarian plus fine handling, account visibility, and exports.
- `Manager`: operational control over circulation, accounts, competitions, exports, and audit visibility.
- `Admin`: manager plus user, feature flag, and settings administration.
- `Super Admin`: unrestricted tenant-level control including roles and permissions.

## Matrix

| Permission Family | Public | Member | Librarian | Officer | Manager | Admin | Super Admin |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Public catalog view | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Internal catalog view | No | No | Yes | Yes | Yes | Yes | Yes |
| Catalog metadata manage | No | No | Yes | Yes | Yes | Yes | Yes |
| Copy and inventory manage | No | No | Yes | Yes | Yes | Yes | Yes |
| Member record manage | No | No | Yes | Yes | Yes | Yes | Yes |
| Member self-service | No | Yes | No | No | No | No | Yes |
| Circulation manage | No | No | Yes | Yes | Yes | Yes | Yes |
| Own loan visibility | No | Yes | No | No | No | No | Yes |
| Fines manage | No | No | No | Yes | Yes | Yes | Yes |
| Accounts view | No | No | No | Yes | Yes | Yes | Yes |
| Accounts manage | No | No | No | No | Yes | Yes | Yes |
| Reports view | No | No | Yes | Yes | Yes | Yes | Yes |
| Competitions manage | No | No | No | No | Yes | Yes | Yes |
| Competition register | Yes | Yes | No | No | No | No | Yes |
| Settings manage | No | No | No | No | No | Yes | Yes |
| Feature flags manage | No | No | No | No | No | Yes | Yes |
| Users manage | No | No | No | No | No | Yes | Yes |
| Roles and permissions manage | No | No | No | No | No | No | Yes |
| Audit visibility | No | No | No | No | Yes | Yes | Yes |
| Print templates and jobs | No | No | Yes | Yes | Yes | Yes | Yes |
| Exports and backups | No | No | No | Yes | Yes | Yes | Yes |

## Policy notes

- Librarians and Officers should not soft-delete sensitive records or change high-trust settings.
- Managers can approve sensitive operational changes but should not alter the RBAC model.
- Admin manages tenant configuration and user administration.
- Super Admin controls global security boundaries, role assignments, and emergency overrides.
