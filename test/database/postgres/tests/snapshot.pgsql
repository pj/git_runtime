BEGIN;
  DELETE FROM lazycloud_lazycloud_test_table;
  DELETE FROM lazycloud_version_tree;
  SELECT lazycloud_add_version('A', '{}');
COMMIT;

-- Insert
BEGIN;
  SELECT set_config('lazycloud.version_id', 'A', false);
  SELECT lazycloud_increment_snapshot();

  INSERT INTO lazycloud_test_table (test_id,  username)
    VALUES (1, 'billy');
COMMIT;

-- Update
BEGIN;
  SELECT set_config('lazycloud.version_id', 'A', false);
  SELECT lazycloud_increment_snapshot();

  UPDATE lazycloud_test_table SET username = 'blobby' WHERE test_id=1;
COMMIT;

-- Delete
BEGIN;
  SELECT set_config('lazycloud.version_id', 'A', false);
  SELECT lazycloud_increment_snapshot();

  DELETE FROM lazycloud_test_table WHERE test_id = 1;
COMMIT;

BEGIN;
  SELECT plan(2);

  SELECT results_eq(
    'SELECT test_id, username, lazycloud_version, lazycloud_snapshot, lazycloud_tombstone '
    || 'FROM lazycloud_lazycloud_test_table ORDER BY lazycloud_snapshot',
    $$VALUES
        (1, 'billy', 'A', 1::bigint, false),
        (1, 'blobby', 'A', 2::bigint, false),
        (1, 'blobby', 'A', 3::bigint, true)
    $$
  );
  SELECT is_empty(
    'SELECT test_id, username, lazycloud_version, lazycloud_snapshot, lazycloud_tombstone '
    || 'FROM lazycloud_test_table'
  );
  SELECT * FROM finish();
ROLLBACK;

BEGIN;
  DELETE FROM lazycloud_lazycloud_test_table;
  DELETE FROM lazycloud_version_tree;
COMMIT;
