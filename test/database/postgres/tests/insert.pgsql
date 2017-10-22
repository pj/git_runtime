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
  SELECT * FROM finish();
ROLLBACK;
