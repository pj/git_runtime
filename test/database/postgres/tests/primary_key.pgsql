SELECT delete_table_or_view('single_key_test');
SELECT delete_table_or_view('lazycloud_single_key_test');
SELECT delete_table_or_view('compound_key_test');
SELECT delete_table_or_view('lazycloud_compound_key_test');

CREATE TABLE single_key_test (
  id bigint PRIMARY KEY,
  name text
);

CREATE TABLE compound_key_test (
  id bigint,
  id2 bigint,
  name text,
  PRIMARY KEY (id, id2)
);

BEGIN;
  SELECT plan(17);

  -- Single key
  SELECT has_view('single_key_test');
  SELECT has_table('lazycloud_single_key_test');
  SELECT has_column('lazycloud_single_key_test', 'id');
  SELECT has_column('lazycloud_single_key_test', 'name');
  SELECT has_column('lazycloud_single_key_test', 'lazycloud_version');
  SELECT has_column('lazycloud_single_key_test', 'lazycloud_tombstone');
  SELECT has_column('lazycloud_single_key_test', 'lazycloud_snapshot');
  SELECT col_is_pk(
    'lazycloud_single_key_test',
    ARRAY[
      'id',
      'lazycloud_version',
      'lazycloud_tombstone',
      'lazycloud_snapshot'
    ]
  );

  -- Compound key
  SELECT has_view('compound_key_test');
  SELECT has_table('lazycloud_compound_key_test');
  SELECT has_column('lazycloud_compound_key_test', 'id');
  SELECT has_column('lazycloud_compound_key_test', 'id2');
  SELECT has_column('lazycloud_compound_key_test', 'name');
  SELECT has_column('lazycloud_compound_key_test', 'lazycloud_version');
  SELECT has_column('lazycloud_compound_key_test', 'lazycloud_tombstone');
  SELECT has_column('lazycloud_compound_key_test', 'lazycloud_snapshot');
  SELECT col_is_pk(
    'lazycloud_compound_key_test',
    ARRAY[
      'id',
      'id2',
      'lazycloud_version',
      'lazycloud_tombstone',
      'lazycloud_snapshot'
    ]
  );
ROLLBACK;
