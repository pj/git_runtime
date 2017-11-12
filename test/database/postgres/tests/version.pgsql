BEGIN;
  SELECT plan(1);
  SELECT lazycloud_add_version('A', '{}');
  SELECT lazycloud_add_version('B', '{"A"}');
  SELECT lazycloud_add_version('C', '{"B"}');
  SELECT lazycloud_add_version('D', '{"B"}');

  INSERT INTO lazycloud_lazycloud_test_table
    (name, lazycloud_version, lazycloud_snapshot)
    VALUES ('Paul', 'A', 0);

  SELECT is(lazycloud_find_parent(
    'lazycloud_test_table', 'test_id', lastval(), 'C'), 'A'
  );
  SELECT * FROM finish();
ROLLBACK;
