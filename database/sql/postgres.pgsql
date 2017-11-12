CREATE OR REPLACE FUNCTION is_temp_table(tableName varchar)
  RETURNS pg_catalog.bool
  LANGUAGE plpgsql AS $$
    BEGIN
       /* check the table exist in database and is visible*/
      PERFORM n.nspname, c.relname
        FROM pg_catalog.pg_class c
          LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname LIKE 'pg_temp_%'
          AND pg_catalog.pg_table_is_visible(c.oid)
          AND Upper(relname) = Upper(tableName);

      IF FOUND THEN
        RETURN TRUE;
      ELSE
        RETURN FALSE;
      END IF;
    END;
  $$;

CREATE OR REPLACE FUNCTION lazycloud_get_version()
  RETURNS varchar
  LANGUAGE plpgsql
  AS $$
    BEGIN
      RETURN current_setting('lazycloud.version_id');
    EXCEPTION
      WHEN undefined_object THEN
        RAISE EXCEPTION 'Set lazycloud version after establishing connection';
    END;
  $$;

CREATE OR REPLACE FUNCTION lazycloud_get_snapshot()
  RETURNS bigint
  LANGUAGE plpgsql
  AS $$
    DECLARE
      current_snapshot_number bigint;
    BEGIN
      SELECT snapshot_number
        INTO current_snapshot_number
        FROM lazycloud_snapshot
        WHERE id = 1;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'Snapshot number must exist';
      END IF;
      RETURN current_snapshot_number;
    END;
  $$;

CREATE OR REPLACE FUNCTION lazycloud_increment_snapshot()
  RETURNS void
  LANGUAGE plpgsql
  AS $$
    BEGIN
      UPDATE lazycloud_snapshot
        SET snapshot_number = snapshot_number + 1
        WHERE id = 1;
    END;
  $$;

CREATE OR REPLACE FUNCTION lazycloud_create_version_tree_table()
  RETURNS void
  LANGUAGE plpgsql
  AS $$
    BEGIN
      CREATE TABLE lazycloud_version_tree (
        id varchar PRIMARY KEY,
        parents hstore
      );

      CREATE TABLE lazycloud_snapshot (
        id int PRIMARY KEY,
        snapshot_number bigint
      );

      INSERT INTO lazycloud_snapshot VALUES (1, 0);
    END;
  $$;

CREATE OR REPLACE FUNCTION lazycloud_add_version(id varchar, parents text[])
  RETURNS void
  LANGUAGE plpgsql
  AS $$
    BEGIN
      INSERT INTO lazycloud_version_tree VALUES (id, hstore(parents, parents));
    END;
  $$;

CREATE OR REPLACE FUNCTION lazycloud_find_parent_recur(
    versions hstore,
    version varchar
  )
  RETURNS varchar
  LANGUAGE plpgsql
  AS $$
    DECLARE
      lazycloud_version record;
      parent varchar;
      recur_result varchar;
    BEGIN
      IF exist(versions, version) THEN
        RETURN version;
      END IF;

      SELECT *
        INTO lazycloud_version
        FROM lazycloud_version_tree
        WHERE lazycloud_version_tree.id = version;

      FOREACH parent IN ARRAY akeys(lazycloud_version.parents) LOOP
        recur_result = lazycloud_find_parent_recur(versions, parent);
        IF recur_result IS NOT NULL THEN
          RETURN recur_result;
        END IF;
      END LOOP;

      RETURN NULL;
  END;
  $$;

-- FIXME: Replace with recursive CTE.
CREATE OR REPLACE FUNCTION lazycloud_find_parent(
    tableName varchar,
    idColumn varchar,
    id bigint,
    version varchar
  )
  RETURNS varchar
  LANGUAGE plpgsql
  AS $$
    DECLARE
      lazycloud_version record;
      keys text[];
      versions hstore;
    BEGIN
      EXECUTE 'SELECT array_agg(lazycloud_version) ' ||
        'FROM lazycloud_' || tableName ||
        ' WHERE ' || idColumn || ' = ' || id INTO keys;
      versions = hstore(keys, keys);

      RETURN lazycloud_find_parent_recur(versions, version);
    END;
  $$;

CREATE OR REPLACE FUNCTION lazycloud_find_versions()
  RETURNS table(id varchar, parents hstore, version_order int)
  LANGUAGE plpgsql
  AS $$
    BEGIN
      RETURN QUERY WITH RECURSIVE versions(id, parents, version_order) AS (
          SELECT lazycloud_version_tree.id, lazycloud_version_tree.parents, 0
            FROM lazycloud_version_tree
            WHERE lazycloud_version_tree.id = lazycloud_get_version()
        UNION
          SELECT lazycloud_version_tree.id, lazycloud_version_tree.parents,
              versions.version_order + 1
            FROM lazycloud_version_tree, versions
            WHERE versions.parents ? lazycloud_version_tree.id
        )
        SELECT * from versions;
    END;
  $$;

-- FIXME: Replace python version with plpgsql version.
-- CREATE OR REPLACE FUNCTION lazycloud_row_trigger()
--   RETURNS trigger
--   LANGUAGE plpgsql
--   AS $$
--     DECLARE
--       version_id varchar;
--       existing_version varchar;
--       existing_row record;
--     BEGIN
--       version_id := lazycloud_get_version();
--       IF (TG_OP = 'DELETE') THEN
--         -- If row with this version doesn't exist, insert tombstone'd row
--         -- else delete.
--         RETURN OLD;
--       ELSIF (TG_OP = 'UPDATE') THEN
--         -- insert row if one already exists.
--         -- existing_version = lazycloud_find_parent();
--         --
--         -- IF existing_version IS NULL THEN
--         --   RETURN NULL;
--         -- ELSE
--         --   NEW.lazycloud_version := version_id;
--         --   RETURN NEW;
--         -- END IF;
--         RETURN NEW;
--       ELSIF (TG_OP = 'INSERT') THEN
--         -- check that there is no parent id for this
--         -- set version id
--         -- column_names := 'lazycloud_version';
--         -- FOR k,v IN select key,value from each(hstore(NEW)) LOOP
--         --
--         -- END LOOP;
--         NEW.lazycloud_version := version_id;
--         RAISE NOTICE '%', NEW;
--         RAISE NOTICE '%', hstore(NEW);
--         RAISE NOTICE '%', TG_TABLE_NAME;
--         RAISE NOTICE '%', TG_ARGV;
--         EXECUTE 'INSERT INTO ' || TG_TABLE_NAME || NEW.*;
--         RETURN NEW;
--       END IF;
--     END;
--   $$;

CREATE OR REPLACE FUNCTION lazycloud_row_trigger_py()
  RETURNS trigger
  LANGUAGE plpython3u
  AS $$
    import itertools
    def prepare_row(row):
      col_names, col_values = zip(*row.items())
      col_types_rows = plpy.execute("""
        SELECT column_name, udt_name
        FROM information_schema.columns
        WHERE table_name = 'lazycloud_{}'
      """.format(TD['table_name']));
      col_mapping = dict(
        map(lambda r: (r['column_name'], r['udt_name']), col_types_rows)
      )

      col_types = []
      for n in col_names:
        col_types.append(col_mapping[n]);

      insert_nums = map(lambda n: "$" + str(n+1), range(0, len(col_names)))
      return col_values, insert_nums, col_names, col_types, col_mapping

    def insert_row(row):
      col_values, insert_nums, col_names, col_types, _ = prepare_row(row)
      insert_nums_joined = ', '.join(insert_nums)
      col_names_joined = ', '.join(col_names)
      query = 'INSERT INTO lazycloud_{} ({}) VALUES ({})'.format(
        TD['table_name'],
        col_names_joined,
        insert_nums_joined
      )
      query_plan = plpy.prepare(query, col_types)
      plpy.execute(query_plan, col_values)

    def update_row(row):
      col_values, insert_nums, col_names, col_types, col_mapping = prepare_row(row)
      col_values = list(col_values)

      col_names = list(col_names)
      insert_nums = list(insert_nums)
      assigns = map(
        lambda x: "{} = {}".format(x[0], x[1]),
        zip(col_names, insert_nums)
      )
      insert_len = len(list(insert_nums))

      assigns_joined = ', '.join(assigns)

      primary_key_names = get_primary_key_names()
      primary_equals = []
      for i, name in enumerate(itertools.chain(primary_key_names, ['lazycloud_version'])):
        col_types.append(col_mapping[name])
        col_values.append(row[name])
        primary_equals.append(
          "{} = {}".format(name, '${}'.format(insert_len + i + 1))
        )
      primary_joined = ' AND '.join(primary_equals)

      query = 'UPDATE lazycloud_{} SET {} WHERE {}'.format(
        TD['table_name'],
        assigns_joined,
        primary_joined
      )

      col_values = list(col_values)
      query_plan = plpy.prepare(query, col_types)
      plpy.execute(query_plan, col_values)

    def get_primary_key_names():
      primary_cols = plpy.execute("""
        SELECT c.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.constraint_column_usage AS ccu
          USING (constraint_schema, constraint_name)
        JOIN information_schema.columns AS c
          ON c.table_schema = tc.constraint_schema
            AND tc.table_name = c.table_name
            AND ccu.column_name = c.column_name
        WHERE constraint_type = 'PRIMARY KEY'
          AND tc.table_schema = '{}'
          AND tc.table_name = 'lazycloud_{}'
      """.format(TD['table_schema'], TD['table_name']))

      return filter(
        lambda x: x not in
          ['lazycloud_version', 'lazycloud_tombstone', 'lazycloud_snapshot'],
        map(lambda r: r['column_name'], primary_cols)
      )

    lazycloud_version_row = plpy.execute('select lazycloud_get_version()')
    lazycloud_version = lazycloud_version_row[0]['lazycloud_get_version']
    lazycloud_snapshot_row = plpy.execute('select lazycloud_get_snapshot()')
    lazycloud_snapshot = lazycloud_snapshot_row[0]['lazycloud_get_snapshot']
    if TD['event'] == 'INSERT':
      new_row = TD['new']
      primary_key_names = get_primary_key_names()
      for name in primary_key_names:
        new_row.pop(name, None)
      new_row['lazycloud_version'] = lazycloud_version
      new_row['lazycloud_snapshot'] = lazycloud_snapshot
      new_row['lazycloud_tombstone'] = False
      insert_row(new_row)
      return None;

    elif TD['event'] == 'DELETE':
      old_row = TD['old']
      old_row['lazycloud_snapshot'] = lazycloud_snapshot
      if old_row['lazycloud_version'] == lazycloud_version:
        # FIXME: handle primary key correctly.
        plpy.execute(
          'UPDATE lazycloud_{} SET lazycloud_tombstone = true'.format(
            TD['table_name']
          )
        )
      else:
        old_row['lazycloud_version'] = lazycloud_version
        old_row['lazycloud_tombstone'] = true
        insert_row(old_row)
      return None

    elif TD['event'] == 'UPDATE':
      new_row = TD['new']
      new_row['lazycloud_snapshot'] = lazycloud_snapshot
      if new_row['lazycloud_version'] == lazycloud_version:
        update_row(new_row)
      else:
        new_row['lazycloud_version'] = lazycloud_version
        insert_row(new_row)
      return None
  $$;

CREATE OR REPLACE FUNCTION lazycloud_version_table()
  RETURNS event_trigger
  LANGUAGE plpgsql
  AS $$
    DECLARE
      createdTable record;
      tableName varchar;
      schemaName varchar;
      isTempTable boolean;
      internalIdentity text;
      primaryColumn record;
      primaryColumns text[];
      newPrimaryColumns text[];
      tableConstraintName text;
      joinedPrimaryKeyColumns text;
      viewKeyColumn text;
      viewKeyColumns text[];
      joinedViewKeyColumns text;
    BEGIN
      FOR createdTable IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
        IF NOT createdTable.object_type = 'table' THEN
          CONTINUE;
        END IF;
        schemaName = split_part(createdTable.object_identity, '.', 1);
        tableName = split_part(createdTable.object_identity, '.', 2);
        if tableName = 'lazycloud_version_tree'
          OR tableName = 'lazycloud_snapshot' THEN
          CONTINUE;
        END IF;

        isTempTable = is_temp_table(tableName);

        IF isTempTable THEN
          CONTINUE;
        END IF;

        FOR primaryColumn IN
          EXECUTE
            'SELECT c.column_name, c.data_type ' ||
            'FROM information_schema.table_constraints tc ' ||
            'JOIN information_schema.constraint_column_usage AS ccu ' ||
              'USING (constraint_schema, constraint_name) '  ||
            'JOIN information_schema.columns AS c ' ||
              'ON c.table_schema = tc.constraint_schema ' ||
                'AND tc.table_name = c.table_name ' ||
                'AND ccu.column_name = c.column_name ' ||
            'WHERE constraint_type = ''PRIMARY KEY'' ' ||
              'AND tc.table_schema = ''' || schemaName || ''' ' ||
              'AND tc.table_name = ''' || tableName || ''''
          LOOP
          primaryColumns := array_append(
            primaryColumns,
            primaryColumn.column_name::text
          );
        END LOOP;

        newPrimaryColumns := array_cat(
          primaryColumns,
          ARRAY[
            'lazycloud_version',
            'lazycloud_tombstone',
            'lazycloud_snapshot'
          ]
        );

        joinedPrimaryKeyColumns := array_to_string(
          newPrimaryColumns,
          ','
        );

        FOR tableConstraintName IN
          EXECUTE 'SELECT constraint_name ' ||
            'FROM information_schema.table_constraints ' ||
            'WHERE constraint_type = ''PRIMARY KEY'' ' ||
              'AND table_schema = ''' || schemaName || ''' '
              'AND table_name = ''' || tableName || '''' LOOP
          EXECUTE 'ALTER TABLE ' || createdTable.object_identity
            || ' DROP CONSTRAINT ' || tableConstraintName;
        END LOOP;

        EXECUTE 'ALTER TABLE ' || createdTable.object_identity
          || ' ADD COLUMN lazycloud_version text';

        EXECUTE 'ALTER TABLE ' || createdTable.object_identity
          || ' ADD COLUMN lazycloud_tombstone boolean NOT NULL DEFAULT false';

        EXECUTE 'ALTER TABLE ' || createdTable.object_identity
          || ' ADD COLUMN lazycloud_snapshot bigint NOT NULL';

        EXECUTE 'ALTER TABLE ' || tableName || ' ADD PRIMARY KEY (' || joinedPrimaryKeyColumns || ')';

        EXECUTE 'ALTER TABLE ' || tableName ||
          ' RENAME TO lazycloud_' || tableName;

        internalIdentity = schemaName || '.lazycloud_' ||   tableName;
        FOREACH viewKeyColumn IN ARRAY primaryColumns LOOP
          viewKeyColumns := array_append(
            viewKeyColumns,
            internalIdentity || '.' || viewKeyColumn
          );
        END LOOP;

        joinedViewKeyColumns := array_to_string(
          viewKeyColumns,
          ','
        );

        EXECUTE 'CREATE VIEW ' || createdTable.object_identity || ' AS '
          || 'SELECT DISTINCT ON (' || joinedViewKeyColumns || ') '
          ||   internalIdentity || '.* '
          || 'FROM ' || internalIdentity || ', lazycloud_find_versions() '
          || 'AS lazycloud_version_table '
          || 'WHERE ' || internalIdentity
          ||   '.lazycloud_version = lazycloud_version_table.id '
          || 'AND ' || internalIdentity || '.lazycloud_tombstone = false '
          || 'ORDER BY ' || joinedViewKeyColumns || ', '
          ||   'lazycloud_version_table.version_order';

        EXECUTE 'CREATE TRIGGER lazycloud_trigger_' || tableName
          || ' INSTEAD OF INSERT OR DELETE OR UPDATE ON ' || tableName
          || ' FOR EACH ROW '
          || ' EXECUTE PROCEDURE lazycloud_row_trigger_py()';
      END LOOP;
    END;
  $$;

DROP EVENT TRIGGER IF EXISTS lazycloud_version_table_trigger CASCADE;
CREATE EVENT TRIGGER lazycloud_version_table_trigger
  ON ddl_command_end
  WHEN TAG IN ('CREATE TABLE')
  EXECUTE PROCEDURE lazycloud_version_table();
