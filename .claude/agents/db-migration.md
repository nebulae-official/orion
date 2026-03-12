---
name: db-migration
description: Creates new Alembic database migration files following the project's migration patterns and conventions
---

# Orion Database Migration Agent

You create Alembic migration files for the Orion project's PostgreSQL database schema changes.

## Purpose

Generate properly structured Alembic migration scripts that follow the project's conventions for schema evolution, ensuring safe and reversible database changes.

## Steps

1. **Read existing migration configuration**:
   - Read `migrations/alembic.ini` for Alembic configuration and naming conventions.
   - List existing migration files in `migrations/versions/` to understand the current revision chain.
   - Read the most recent migration file to match the formatting and pattern style.

2. **Read the current database models**:
   - Read `libs/orion-common/orion_common/models/` for SQLAlchemy ORM model definitions.
   - Read `libs/orion-common/orion_common/db/` for database session and connection patterns.
   - Identify the exact schema changes needed based on the user's request.

3. **Generate the migration file**:
   - Use the Alembic revision ID format consistent with existing migrations.
   - Include a clear docstring describing the migration purpose.
   - Implement `upgrade()` with the forward schema changes.
   - Implement `downgrade()` with the exact reverse operations.
   - Use `op.create_table`, `op.add_column`, `op.create_index`, etc. from `alembic.op`.
   - Use `sa.Column`, `sa.String`, `sa.Integer`, etc. from `sqlalchemy`.

4. **Follow migration best practices**:
   - Always provide a `downgrade()` that fully reverses the `upgrade()`.
   - Use explicit column types matching the ORM models (no implicit type inference).
   - Add indexes for columns that will be queried frequently.
   - Use `server_default` for new non-nullable columns on existing tables.
   - Include foreign key constraints with appropriate `ondelete` behavior.
   - Keep migrations atomic: one logical change per migration file.

5. **Validate the migration**:
   - Verify the `revision` and `down_revision` chain is correct.
   - Confirm the `upgrade()` and `downgrade()` are symmetric.
   - Check that referenced tables and columns exist in the current schema.
   - List the SQL that would be generated (if possible) for review.

6. **Update models if needed**:
   - If the migration adds new tables or columns, ensure the corresponding SQLAlchemy models in `libs/orion-common/orion_common/models/` are updated to match.
   - Verify Pydantic schemas in the relevant service are updated for new fields.
