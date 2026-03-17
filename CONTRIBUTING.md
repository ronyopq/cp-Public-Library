# Contributing to Public Library Management System

Thank you for your interest in contributing! Here's how to get started.

## Development Setup

```bash
# Clone the repository
git clone https://github.com/ronyopq/cp-Public-Library.git
cd cp-Public-Library

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Start development
npm run dev:api    # In one terminal
npm run dev:web    # In another terminal
```

## Code Standards

- **Language**: TypeScript end-to-end
- **Style**: ESLint + Prettier
- **Type Safety**: 100% typed, no `any`
- **Documentation**: Bangla-first, English translations

## Making Changes

### 1. Create a Branch
```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix
```

### 2. Make Your Changes
- Keep commits focused and atomic
- Write descriptive commit messages
- Follow the existing code patterns

### 3. Test Your Changes
```bash
npm run lint          # Check code style
npm run type-check   # Verify TypeScript
npm test             # Run tests
```

### 4. Push and Create PR
```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub with:
- A clear title describing the change
- Description of what changed and why
- Link to any related issues

## Code Patterns

### API Endpoints
```typescript
// Routes must have:
// 1. Authentication (unless public)
// 2. Permission check
// 3. Input validation (Zod)
// 4. Error handling
// 5. Audit logging

myRoutes.post('/', authMiddleware, async (ctx: Context) => {
  const auth = requireAuth(ctx);
  
  // Permission check
  const hasPermission = await db.queryAll(
    `SELECT 1 FROM role_permissions WHERE role_id = ? AND permission_id = ?`,
    [auth.role_id, 'permission_id']
  );
  if (!hasPermission.length) {
    return ctx.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 });
  }
  
  // Validation
  const body = mySchema.parse(await ctx.req.json());
  
  // Execute
  await db.execute('INSERT INTO ...', [...]);
  
  // Audit log
  await db.execute(
    'INSERT INTO audit_logs ...',
    [generateId(), auth.user_id, 'action', ...]
  );
  
  return ctx.json({ success: true, data: {...} });
});
```

## Database Changes

### Adding a Table
1. Create migration in `migrations/`
2. Run locally: `wrangler d1 execute library-dev --local --file migrations/0XXX_name.sql`
3. Add to seed.sql if reference data needed
4. Update TypeScript types in `src/shared/types.ts`

### Adding a Field
1. Create ALTER TABLE migration
2. The same process as new table

## Documentation

- Update [docs/API.md](docs/API.md) for new endpoints
- Update [README.md](README.md) for major changes
- Add comments to complex logic
- Keep Bangla error messages in sync with English

## Commit Message Format

```
type: short description

Longer description explaining why this change was made.
Reference issues: #123, #456

Type: feat, fix, docs, style, refactor, test, chore
```

Examples:
```
feat: add loan renewal endpoint

Implements POST /api/loans/:id/renew with 2-renewal limit per loan.
Extends due date by 14 days when renewed. Adds audit logging.

Fixes #42
```

## Pull Request Checklist

- [ ] Code follows TypeScript best practices
- [ ] All tests pass (`npm test`)
- [ ] Linting passes (`npm run lint`)
- [ ] Type checking passes (`npm run type-check`)
- [ ] Documentation updated (README, API docs, code comments)
- [ ] Commit messages are clear and descriptive
- [ ] No secrets or `.env` files included
- [ ] Database migrations tested locally

## Questions?

- 📖 Read [QUICKSTART.md](../QUICKSTART.md) for setup help
- 📚 Read [docs/API.md](../docs/API.md) for API reference
- 💬 Open a GitHub Issue to discuss ideas
- 📧 Contact via GitHub Discussions

---

**Thank you for contributing to better library management in Bangladesh!** 🙏
