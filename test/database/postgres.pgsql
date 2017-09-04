-- SET log_min_messages TO 'NOTICE';
-- \set ECHO none
-- \set QUIET 1
\set ON_ERROR_STOP on
-- CREATE EXTENSION plpython3u;
CREATE OR REPLACE LANGUAGE plpython3u;

\ir ./helpers.pgsql

DROP FUNCTION IF EXISTS lazycloud_create_version_tree_table() CASCADE;
DROP FUNCTION IF EXISTS lazycloud_add_version(varchar, text[]) CASCADE;
DROP FUNCTION IF EXISTS lazycloud_find_parent() CASCADE;
DROP FUNCTION IF EXISTS lazycloud_get_version() CASCADE;
DROP FUNCTION IF EXISTS lazycloud_version_table() CASCADE;
DROP FUNCTION IF EXISTS lazycloud_find_parent(varchar, varchar, bigint, varchar) CASCADE;
DROP FUNCTION IF EXISTS lazycloud_find_parent_recur(hstore, varchar) CASCADE;
DROP EVENT TRIGGER IF EXISTS lazycloud_version_table_trigger CASCADE;
DROP TRIGGER IF EXISTS lazycloud_trigger_lazycloud_test_table ON lazycloud_test_table;
DROP FUNCTION IF EXISTS lazycloud_row_trigger() CASCADE;
DROP FUNCTION IF EXISTS lazycloud_row_trigger_py() CASCADE;
SELECT delete_table_or_view('lazycloud_test_table');
SELECT delete_table_or_view('lazycloud_lazycloud_test_table');
SELECT delete_table_or_view('lazycloud_version_tree');
DROP FUNCTION IF EXISTS lazycloud_find_versions() CASCADE;

\ir ../../database/sql/postgres.pgsql

CREATE TABLE lazycloud_test_table (
  id SERIAL,
  name text
);

SELECT lazycloud_create_version_tree_table();

BEGIN;
  SELECT plan(6);

  SELECT has_table('lazycloud_lazycloud_test_table');
  SELECT has_column('lazycloud_lazycloud_test_table', 'name');
  SELECT has_column('lazycloud_lazycloud_test_table', 'lazycloud_version');
  SELECT has_column('lazycloud_lazycloud_test_table', 'lazycloud_tombstone');
  SELECT has_view('lazycloud_test_table');
  SELECT has_table('lazycloud_version_tree');
ROLLBACK;

-- test version tree
BEGIN;
  SELECT plan(1);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"B"}');

  INSERT INTO lazycloud_lazycloud_test_table (name, lazycloud_version)
    VALUES ('Paul', 'A');

  SELECT is(lazycloud_find_parent('lazycloud_test_table', 'id', lastval(), 'C'), 'A');
ROLLBACK;

-- test insert and select
BEGIN;
  SELECT plan(1);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"B"}');

  SELECT set_config('lazycloud.version_id', 'C', false);

  INSERT INTO lazycloud_test_table (name) VALUES ('billy');

  SELECT results_eq(
    'SELECT lazycloud_version, name FROM lazycloud_test_table',
    $$VALUES ('C', 'billy')$$
  );
ROLLBACK;

-- test insert, select and delete
BEGIN;
  SELECT plan(1);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"B"}');

  SELECT set_config('lazycloud.version_id', 'C', false);

  INSERT INTO lazycloud_test_table (name) VALUES ('billy');

  DELETE FROM lazycloud_test_table WHERE id = lastval();

  SELECT results_eq(
    'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_test_table',
    $$VALUES ('C', 'billy', true)$$
  );
ROLLBACK;

-- Test select
BEGIN;
  SELECT plan(1);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"A"}');

  INSERT INTO lazycloud_lazycloud_test_table (id, name, lazycloud_version)
    VALUES (1, 'billy', 'A'), (2, 'robby', 'B'), (2, 'rob', 'C'),
      (3, 'buddy', 'C'), (1, 'danny', 'D');

  SELECT set_config('lazycloud.version_id', 'C', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES
      (1, 'billy', 'A', false),
      (2, 'rob', 'C', false),
      (3, 'buddy', 'C', false)
    $$
  );

  SELECT set_config('lazycloud.version_id', 'A', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES (1, 'billy', 'A', false)$$
  );

  SELECT set_config('lazycloud.version_id', 'B', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES (1, 'billy', 'A', false), (2, 'robby', 'B', false)$$
  );

  SELECT set_config('lazycloud.version_id', 'D', false);
  SELECT results_eq(
    'SELECT * FROM lazycloud_test_table',
    $$VALUES (1, 'danny', 'D', false)$$
  );
ROLLBACK;
