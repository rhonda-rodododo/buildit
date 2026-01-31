//! Database commands exposed to the frontend via Tauri IPC
//!
//! These commands provide CRUD operations on the SQLCipher-encrypted SQLite database.
//! The frontend's Data Access Layer (DAL) calls these via `invoke()`.
//!
//! ## Column Name Mapping
//!
//! The frontend uses camelCase (JavaScript convention) while SQLite uses snake_case.
//! Column mapping is handled by the `to_snake_case` / `to_camel_case` helpers,
//! ensuring the frontend can pass `{ groupId: "abc" }` and it maps to `group_id`.

use std::collections::HashMap;

use rusqlite::types::ValueRef;
use serde::Deserialize;
use serde_json::Value;
use tauri::State;

use crate::db::Database;

/// Query filter for db_query command
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QueryFilter {
    /// Column-value equality conditions (AND'd together)
    pub where_clause: Option<HashMap<String, Value>>,
    /// Column to sort by
    pub order_by: Option<String>,
    /// Sort direction
    pub order_dir: Option<String>,
    /// Maximum number of results
    pub limit: Option<u32>,
    /// Number of results to skip
    pub offset: Option<u32>,
}

/// Convert camelCase to snake_case for column names
fn to_snake_case(s: &str) -> String {
    let mut result = String::with_capacity(s.len() + 4);
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                result.push('_');
            }
            result.push(c.to_lowercase().next().unwrap());
        } else {
            result.push(c);
        }
    }
    result
}

/// Convert snake_case to camelCase for JSON output
fn to_camel_case(s: &str) -> String {
    let mut result = String::with_capacity(s.len());
    let mut capitalize_next = false;
    for c in s.chars() {
        if c == '_' {
            capitalize_next = true;
        } else if capitalize_next {
            result.push(c.to_uppercase().next().unwrap());
            capitalize_next = false;
        } else {
            result.push(c);
        }
    }
    result
}

/// Convert a JSON object's keys from camelCase to snake_case
fn keys_to_snake_case(obj: &serde_json::Map<String, Value>) -> serde_json::Map<String, Value> {
    obj.iter()
        .map(|(k, v)| (to_snake_case(k), v.clone()))
        .collect()
}

/// Known tables and their primary key columns (snake_case)
fn primary_key_for(table: &str) -> &'static str {
    match table {
        "identities" => "public_key",
        "username_settings" | "user_presence" => "pubkey",
        "cache_metadata" => "key",
        _ => "id",
    }
}

/// Validate table name to prevent SQL injection
fn validate_table_name(table: &str) -> Result<(), String> {
    if table.is_empty() {
        return Err("Table name cannot be empty".to_string());
    }
    if !table.chars().next().unwrap().is_alphabetic() && table.chars().next().unwrap() != '_' {
        return Err(format!("Invalid table name: {table}"));
    }
    if !table.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(format!("Invalid table name: {table}"));
    }
    Ok(())
}

/// Validate column name to prevent SQL injection
fn validate_column_name(col: &str) -> Result<(), String> {
    if col.is_empty() || !col.chars().all(|c| c.is_alphanumeric() || c == '_') {
        return Err(format!("Invalid column name: {col}"));
    }
    Ok(())
}

/// Convert serde_json::Value to a rusqlite-compatible ToSql boxed value
fn json_to_sql(val: &Value) -> Box<dyn rusqlite::types::ToSql> {
    match val {
        Value::Null => Box::new(rusqlite::types::Null),
        Value::Bool(b) => Box::new(if *b { 1i64 } else { 0i64 }),
        Value::Number(n) => {
            if let Some(i) = n.as_i64() {
                Box::new(i)
            } else if let Some(f) = n.as_f64() {
                Box::new(f)
            } else {
                Box::new(n.to_string())
            }
        }
        Value::String(s) => Box::new(s.clone()),
        // Arrays and objects are JSON-serialized to TEXT
        Value::Array(_) | Value::Object(_) => {
            Box::new(serde_json::to_string(val).unwrap_or_default())
        }
    }
}

/// Read a SQLite ValueRef into a serde_json::Value
fn sql_to_json(val: ValueRef<'_>) -> Value {
    match val {
        ValueRef::Null => Value::Null,
        ValueRef::Integer(i) => Value::Number(serde_json::Number::from(i)),
        ValueRef::Real(f) => {
            serde_json::Number::from_f64(f)
                .map(Value::Number)
                .unwrap_or(Value::Null)
        }
        ValueRef::Text(t) => {
            let s = String::from_utf8_lossy(t).to_string();
            // Try to parse as JSON for arrays/objects stored as TEXT
            if (s.starts_with('[') && s.ends_with(']'))
                || (s.starts_with('{') && s.ends_with('}'))
            {
                serde_json::from_str(&s).unwrap_or(Value::String(s))
            } else {
                Value::String(s)
            }
        }
        ValueRef::Blob(b) => {
            // Encode binary blobs as hex strings
            Value::String(hex::encode(b))
        }
    }
}

/// Read a single row as a JSON object, converting column names to camelCase
fn row_to_json(
    row: &rusqlite::Row<'_>,
    columns: &[String],
) -> Result<Value, rusqlite::Error> {
    let mut obj = serde_json::Map::new();
    for (i, col_name) in columns.iter().enumerate() {
        let val = sql_to_json(row.get_ref(i)?);
        let camel_key = to_camel_case(col_name);
        obj.insert(camel_key, val);
    }
    Ok(Value::Object(obj))
}

/// Get column names from a prepared statement
fn get_column_names(stmt: &rusqlite::Statement<'_>) -> Vec<String> {
    (0..stmt.column_count())
        .map(|i| stmt.column_name(i).unwrap().to_string())
        .collect()
}

// ── Tauri Commands ────────────────────────────────────────────────────────────

/// Open the database with an encryption key
#[tauri::command]
pub async fn db_open(state: State<'_, Database>, key: String) -> Result<(), String> {
    state.open(&key)
}

/// Close the database
#[tauri::command]
pub async fn db_close(state: State<'_, Database>) -> Result<(), String> {
    state.close();
    Ok(())
}

/// Check if database is open
#[tauri::command]
pub async fn db_is_open(state: State<'_, Database>) -> Result<bool, String> {
    Ok(state.is_open())
}

/// Insert or replace a record (upsert)
#[tauri::command]
pub async fn db_put(
    state: State<'_, Database>,
    table: String,
    record: Value,
) -> Result<(), String> {
    validate_table_name(&table)?;

    let obj = record
        .as_object()
        .ok_or_else(|| "Record must be a JSON object".to_string())?;

    let snake_obj = keys_to_snake_case(obj);

    state.with_connection(|conn| {
        let columns: Vec<String> = snake_obj.keys().cloned().collect();

        for col in &columns {
            validate_column_name(col)?;
        }

        let col_list = columns
            .iter()
            .map(|c| format!("\"{}\"", c))
            .collect::<Vec<_>>()
            .join(", ");
        let placeholder_list = columns
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect::<Vec<_>>()
            .join(", ");

        let sql = format!(
            "INSERT OR REPLACE INTO \"{table}\" ({col_list}) VALUES ({placeholder_list})"
        );

        let params: Vec<Box<dyn rusqlite::types::ToSql>> = columns
            .iter()
            .map(|c| json_to_sql(&snake_obj[c]))
            .collect();

        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|p| p.as_ref()).collect();

        conn.execute(&sql, param_refs.as_slice())
            .map_err(|e| format!("db_put failed: {e}"))?;

        Ok(())
    })
}

/// Get a single record by primary key
#[tauri::command]
pub async fn db_get(
    state: State<'_, Database>,
    table: String,
    key: String,
) -> Result<Option<Value>, String> {
    validate_table_name(&table)?;

    let pk_col = primary_key_for(&table);

    state.with_connection(|conn| {
        let sql = format!("SELECT * FROM \"{table}\" WHERE \"{pk_col}\" = ?1");

        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare failed: {e}"))?;
        let column_names = get_column_names(&stmt);

        let mut rows = stmt
            .query(rusqlite::params![key])
            .map_err(|e| format!("Query failed: {e}"))?;

        match rows.next().map_err(|e| format!("Row fetch failed: {e}"))? {
            Some(row) => {
                let json = row_to_json(row, &column_names)
                    .map_err(|e| format!("Row conversion failed: {e}"))?;
                Ok(Some(json))
            }
            None => Ok(None),
        }
    })
}

/// Get all records from a table
#[tauri::command]
pub async fn db_get_all(
    state: State<'_, Database>,
    table: String,
) -> Result<Vec<Value>, String> {
    validate_table_name(&table)?;

    state.with_connection(|conn| {
        let sql = format!("SELECT * FROM \"{table}\"");

        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare failed: {e}"))?;
        let column_names = get_column_names(&stmt);

        let mut rows = stmt
            .query(rusqlite::params![])
            .map_err(|e| format!("Query failed: {e}"))?;

        let mut results = Vec::new();
        while let Some(row) = rows.next().map_err(|e| format!("Row fetch failed: {e}"))? {
            let json = row_to_json(row, &column_names)
                .map_err(|e| format!("Row conversion failed: {e}"))?;
            results.push(json);
        }
        Ok(results)
    })
}

/// Query records with filtering, sorting, and pagination
#[tauri::command]
pub async fn db_query(
    state: State<'_, Database>,
    table: String,
    filter: QueryFilter,
) -> Result<Vec<Value>, String> {
    validate_table_name(&table)?;

    state.with_connection(|conn| {
        let mut sql = format!("SELECT * FROM \"{table}\"");
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        // WHERE clause
        if let Some(ref where_clause) = filter.where_clause {
            let mut conditions = Vec::new();
            for (key, value) in where_clause {
                let col = to_snake_case(key);
                validate_column_name(&col)?;
                params.push(json_to_sql(value));
                conditions.push(format!("\"{}\" = ?{}", col, params.len()));
            }
            if !conditions.is_empty() {
                sql.push_str(" WHERE ");
                sql.push_str(&conditions.join(" AND "));
            }
        }

        // ORDER BY
        if let Some(ref order_by) = filter.order_by {
            let col = to_snake_case(order_by);
            validate_column_name(&col)?;
            let dir = match filter.order_dir.as_deref() {
                Some("desc") | Some("DESC") => "DESC",
                _ => "ASC",
            };
            sql.push_str(&format!(" ORDER BY \"{col}\" {dir}"));
        }

        // LIMIT / OFFSET
        if let Some(limit) = filter.limit {
            sql.push_str(&format!(" LIMIT {limit}"));
        }
        if let Some(offset) = filter.offset {
            sql.push_str(&format!(" OFFSET {offset}"));
        }

        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare failed: {e}"))?;
        let column_names = get_column_names(&stmt);

        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|p| p.as_ref()).collect();

        let mut rows = stmt
            .query(param_refs.as_slice())
            .map_err(|e| format!("Query failed: {e}"))?;

        let mut results = Vec::new();
        while let Some(row) = rows.next().map_err(|e| format!("Row fetch failed: {e}"))? {
            let json = row_to_json(row, &column_names)
                .map_err(|e| format!("Row conversion failed: {e}"))?;
            results.push(json);
        }
        Ok(results)
    })
}

/// Delete a record by primary key
#[tauri::command]
pub async fn db_delete(
    state: State<'_, Database>,
    table: String,
    key: String,
) -> Result<bool, String> {
    validate_table_name(&table)?;

    let pk_col = primary_key_for(&table);

    state.with_connection(|conn| {
        let sql = format!("DELETE FROM \"{table}\" WHERE \"{pk_col}\" = ?1");
        let affected = conn
            .execute(&sql, rusqlite::params![key])
            .map_err(|e| format!("db_delete failed: {e}"))?;
        Ok(affected > 0)
    })
}

/// Bulk insert/replace records
#[tauri::command]
pub async fn db_bulk_put(
    state: State<'_, Database>,
    table: String,
    records: Vec<Value>,
) -> Result<u32, String> {
    validate_table_name(&table)?;

    if records.is_empty() {
        return Ok(0);
    }

    state.with_connection(|conn| {
        let mut count = 0u32;

        // Use the first record to determine columns
        let first_obj = records[0]
            .as_object()
            .ok_or_else(|| "Records must be JSON objects".to_string())?;

        let snake_first = keys_to_snake_case(first_obj);
        let columns: Vec<String> = snake_first.keys().cloned().collect();

        for col in &columns {
            validate_column_name(col)?;
        }

        let col_list = columns
            .iter()
            .map(|c| format!("\"{}\"", c))
            .collect::<Vec<_>>()
            .join(", ");
        let placeholders = columns
            .iter()
            .enumerate()
            .map(|(i, _)| format!("?{}", i + 1))
            .collect::<Vec<_>>()
            .join(", ");

        let sql = format!(
            "INSERT OR REPLACE INTO \"{table}\" ({col_list}) VALUES ({placeholders})"
        );

        let tx = conn
            .unchecked_transaction()
            .map_err(|e| format!("Transaction start failed: {e}"))?;

        {
            let mut stmt = tx
                .prepare(&sql)
                .map_err(|e| format!("Prepare failed: {e}"))?;

            for record in &records {
                let obj = record
                    .as_object()
                    .ok_or_else(|| "Record must be a JSON object".to_string())?;

                let snake_obj = keys_to_snake_case(obj);
                let params: Vec<Box<dyn rusqlite::types::ToSql>> = columns
                    .iter()
                    .map(|c| json_to_sql(snake_obj.get(c).unwrap_or(&Value::Null)))
                    .collect();

                let param_refs: Vec<&dyn rusqlite::types::ToSql> =
                    params.iter().map(|p| p.as_ref()).collect();

                stmt.execute(param_refs.as_slice())
                    .map_err(|e| format!("Insert failed: {e}"))?;
                count += 1;
            }
        }

        tx.commit().map_err(|e| format!("Commit failed: {e}"))?;
        Ok(count)
    })
}

/// Count records, optionally with a filter
#[tauri::command]
pub async fn db_count(
    state: State<'_, Database>,
    table: String,
    filter: Option<HashMap<String, Value>>,
) -> Result<u32, String> {
    validate_table_name(&table)?;

    state.with_connection(|conn| {
        let mut sql = format!("SELECT COUNT(*) FROM \"{table}\"");
        let mut params: Vec<Box<dyn rusqlite::types::ToSql>> = Vec::new();

        if let Some(ref where_clause) = filter {
            let mut conditions = Vec::new();
            for (key, value) in where_clause {
                let col = to_snake_case(key);
                validate_column_name(&col)?;
                params.push(json_to_sql(value));
                conditions.push(format!("\"{}\" = ?{}", col, params.len()));
            }
            if !conditions.is_empty() {
                sql.push_str(" WHERE ");
                sql.push_str(&conditions.join(" AND "));
            }
        }

        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            params.iter().map(|p| p.as_ref()).collect();

        let count: u32 = conn
            .query_row(&sql, param_refs.as_slice(), |row| row.get(0))
            .map_err(|e| format!("Count failed: {e}"))?;

        Ok(count)
    })
}

/// Execute raw SQL (for complex queries not covered by the CRUD commands)
/// Only SELECT statements are allowed for safety
#[tauri::command]
pub async fn db_execute_query(
    state: State<'_, Database>,
    sql: String,
    params: Option<Vec<Value>>,
) -> Result<Vec<Value>, String> {
    // Safety: only allow SELECT
    let trimmed = sql.trim().to_uppercase();
    if !trimmed.starts_with("SELECT") {
        return Err("Only SELECT queries are allowed via db_execute_query".to_string());
    }

    let query_params: Vec<Box<dyn rusqlite::types::ToSql>> = params
        .unwrap_or_default()
        .iter()
        .map(json_to_sql)
        .collect();

    state.with_connection(|conn| {
        let mut stmt = conn.prepare(&sql).map_err(|e| format!("Prepare failed: {e}"))?;
        let column_names = get_column_names(&stmt);

        let param_refs: Vec<&dyn rusqlite::types::ToSql> =
            query_params.iter().map(|p| p.as_ref()).collect();

        let mut rows = stmt
            .query(param_refs.as_slice())
            .map_err(|e| format!("Query failed: {e}"))?;

        let mut results = Vec::new();
        while let Some(row) = rows.next().map_err(|e| format!("Row fetch failed: {e}"))? {
            let json = row_to_json(row, &column_names)
                .map_err(|e| format!("Row conversion failed: {e}"))?;
            results.push(json);
        }
        Ok(results)
    })
}

/// Clear all data from a specific table
#[tauri::command]
pub async fn db_clear_table(
    state: State<'_, Database>,
    table: String,
) -> Result<(), String> {
    validate_table_name(&table)?;

    state.with_connection(|conn| {
        let sql = format!("DELETE FROM \"{table}\"");
        conn.execute(&sql, rusqlite::params![])
            .map_err(|e| format!("Clear table failed: {e}"))?;
        Ok(())
    })
}
