BEGIN;
  SELECT plan(6);

  SELECT has_table('lazycloud_lazycloud_test_table');
  SELECT has_column('lazycloud_lazycloud_test_table', 'username');
  SELECT has_column('lazycloud_lazycloud_test_table', 'lazycloud_version');
  SELECT has_column('lazycloud_lazycloud_test_table', 'lazycloud_tombstone');
  SELECT has_view('lazycloud_test_table');
  SELECT has_table('lazycloud_version_tree');
ROLLBACK;
