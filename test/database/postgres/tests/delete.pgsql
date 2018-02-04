BEGIN;
  SELECT plan(5);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"B"}');

  SELECT set_config('lazycloud.version_id', 'C', false);
  SELECT lazycloud_increment_snapshot();

  -- Basic delete
  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, username, lazycloud_snapshot)
    VALUES ('C', 'billy', 0);

  DELETE FROM lazycloud_test_table WHERE test_id = lastval();

  SELECT results_eq(
    'SELECT lazycloud_version, username, lazycloud_tombstone, lazycloud_snapshot FROM lazycloud_lazycloud_test_table',
    $$VALUES ('C', 'billy', false, 0::bigint),('C', 'billy', true, 1::bigint)$$
  );

  -- SELECT results_ne(
  --   'SELECT lazycloud_version, username, lazycloud_tombstone, lazycloud_snapshot FROM lazycloud_test_table',
  --   $$VALUES ('C', 'billy', true, 1::bigint)$$
  -- );

  SELECT is_empty(
    'SELECT lazycloud_version, username, lazycloud_tombstone, lazycloud_snapshot FROM lazycloud_test_table'
  );

  DELETE FROM lazycloud_lazycloud_test_table WHERE username = 'billy';

  INSERT INTO lazycloud_lazycloud_test_table
    (lazycloud_version, username, lazycloud_snapshot)
    VALUES ('C', 'rodney', 0);

  DELETE FROM lazycloud_test_table WHERE username = 'rodney';

  SELECT results_eq(
    'SELECT lazycloud_version, username, lazycloud_tombstone FROM lazycloud_lazycloud_test_table',
    $$VALUES ('C', 'rodney', true)$$
  );

  SELECT results_ne(
    'SELECT lazycloud_version, username, lazycloud_tombstone FROM lazycloud_test_table',
    $$VALUES ('C', 'rodney', true)$$
  );

  SELECT is_empty(
    'SELECT lazycloud_version, username, lazycloud_tombstone FROM lazycloud_test_table'
  );
  SELECT * FROM finish();
ROLLBACK;
