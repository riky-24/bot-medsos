# Missing Files/Folders - Recovery Plan

## Problem
Beberapa folder dan file hilang saat project copy, termasuk **Prisma migrations**.

## Critical Missing: Prisma Migrations

Tanpa migrations, database tables tidak ter-create → app crash.

## Solution: Create Initial Migration

### Option 1: Generate Fresh Migration from Schema

```bash
cd /home/riky/Documents/bot-medsos

# 1. Create migrations dari schema
npx prisma migrate dev --name init

# 2. Atau generate SQL only (jika sudah ada DB)
npx prisma db push
```

### Option 2: Restore from Backup (if available)

Jika ada backup project sebelumnya:
```bash
# Copy migrations folder dari backup
cp -r /path/to/backup/prisma/migrations ./prisma/
```

### Option 3: Manual Migration Creation

Create `prisma/migrations/` structure:

```bash
mkdir -p prisma/migrations/20260202000000_init
```

Create migration SQL based on schema (auto-generate recommended).

## Recovery Script

Create `scripts/recover-missing-files.sh`:

```bash
#!/bin/bash
echo "Recovering missing files..."

# 1. Check if migrations exist
if [ ! -d "prisma/migrations" ]; then
    echo "❌ Missing: prisma/migrations/"
    echo "Creating migrations from schema..."
    npx prisma migrate dev --name init
fi

# 2. Check other critical files
missing_files=()

if [ ! -f ".gitignore" ]; then
    missing_files+=(".gitignore")
fi

if [ ${#missing_files[@]} -gt 0 ]; then
    echo "⚠️  Missing files detected:"
    printf '%s\n' "${missing_files[@]}"
fi

echo "Recovery complete!"
```

## Immediate Action

Run this now:
```bash
cd /home/riky/Documents/bot-medsos
npx prisma migrate dev --name init
```

This will:
1. Create `prisma/migrations/` folder
2. Generate migration SQL from schema.prisma
3. Apply migration to database
4. Create all tables (users, sessions, etc.)
