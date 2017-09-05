BEGIN;
  SELECT plan(6);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"B"}');

  SELECT set_config('lazycloud.version_id', 'C', false);

  INSERT INTO lazycloud_test_table (name) VALUES ('billy');

  DELETE FROM lazycloud_test_table WHERE id = lastval();

  SELECT results_eq(
    'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_lazycloud_test_table',
    $$VALUES ('C', 'billy', true)$$
  );

  SELECT results_ne(
    'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_test_table',
    $$VALUES ('C', 'billy', true)$$
  );

  SELECT is_empty(
    'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_test_table'
  );

  INSERT INTO lazycloud_test_table (name) VALUES ('rodney');

  DELETE FROM lazycloud_test_table WHERE name = 'rodney';

  SELECT results_eq(
    'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_lazycloud_test_table',
    $$VALUES ('C', 'rodney', true)$$
  );

  SELECT results_ne(
    'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_test_table',
    $$VALUES ('C', 'rodney', true)$$
  );

  SELECT is_empty(
    'SELECT lazycloud_version, name, lazycloud_tombstone FROM lazycloud_test_table'
  );
  SELECT * FROM finish();
ROLLBACK;
