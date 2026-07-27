"""
Schema service — reads table structure, columns, indexes from PostgreSQL.
The agent calls this to understand the database before writing SQL.
"""
import services.db as db


async def get_full_schema(table_name: str = None) -> dict:
    """
    Returns schema info the agent needs to write correct SQL.
    If table_name given → single table. Otherwise → all tables.

    Returns:
    {
      "tables": {
        "users": {
          "columns": [{"name": "id", "type": "integer", "nullable": false, "primary_key": true}],
          "foreign_keys": [{"column": "user_id", "references": "users.id"}]
        }
      }
    }
    """
    if db.pool is None:
        raise RuntimeError("Database pool not initialised.")

    async with db.pool.acquire() as conn:
        # Get columns
        column_query = """
            SELECT
                c.table_name,
                c.column_name,
                c.data_type,
                c.is_nullable,
                c.column_default,
                CASE WHEN pk.column_name IS NOT NULL THEN true ELSE false END AS is_primary_key
            FROM information_schema.columns c
            LEFT JOIN (
                SELECT kcu.table_name, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                    ON tc.constraint_name = kcu.constraint_name
                WHERE tc.constraint_type = 'PRIMARY KEY'
            ) pk ON c.table_name = pk.table_name AND c.column_name = pk.column_name
            WHERE c.table_schema = 'public'
            AND ($1::text IS NULL OR c.table_name = $1)
            ORDER BY c.table_name, c.ordinal_position
        """
        columns = await conn.fetch(column_query, table_name)

        # Get foreign keys
        fk_query = """
            SELECT
                kcu.table_name,
                kcu.column_name,
                ccu.table_name AS foreign_table,
                ccu.column_name AS foreign_column
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name
            JOIN information_schema.constraint_column_usage ccu
                ON tc.constraint_name = ccu.constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
            AND tc.table_schema = 'public'
            AND ($1::text IS NULL OR kcu.table_name = $1)
        """
        fk_records = await conn.fetch(fk_query, table_name)

        # Build foreign key map
        fk_map: dict = {}
        for fk in fk_records:
            t = fk["table_name"]
            if t not in fk_map:
                fk_map[t] = []
            fk_map[t].append({
                "column": fk["column_name"],
                "references": f"{fk['foreign_table']}.{fk['foreign_column']}"
            })

        # Build schema dict
        schema: dict = {"tables": {}}
        for col in columns:
            t = col["table_name"]
            if t not in schema["tables"]:
                schema["tables"][t] = {
                    "columns": [],
                    "foreign_keys": fk_map.get(t, [])
                }
            schema["tables"][t]["columns"].append({
                "name": col["column_name"],
                "type": col["data_type"],
                "nullable": col["is_nullable"] == "YES",
                "primary_key": col["is_primary_key"],
                "default": col["column_default"],
            })

        return schema


async def get_table_indexes(table_name: str) -> list:
    """
    Returns all indexes on a table.
    Agent uses this to check if a missing index already exists
    before suggesting CREATE INDEX.
    """
    if db.pool is None:
        raise RuntimeError("Database pool not initialised.")

    async with db.pool.acquire() as conn:
        query = """
            SELECT
                i.relname AS index_name,
                ix.indisunique AS is_unique,
                ix.indisprimary AS is_primary,
                array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) AS columns
            FROM pg_class t
            JOIN pg_index ix ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
            WHERE t.relname = $1
            AND t.relkind = 'r'
            GROUP BY i.relname, ix.indisunique, ix.indisprimary
            ORDER BY i.relname
        """
        records = await conn.fetch(query, table_name)

        return [
            {
                "name": r["index_name"],
                "columns": list(r["columns"]),
                "unique": r["is_unique"],
                "primary": r["is_primary"],
            }
            for r in records
        ]