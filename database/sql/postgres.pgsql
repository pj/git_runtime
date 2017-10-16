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

CREATE OR REPLACE FUNCTION lazycloud_create_version_tree_table()
  RETURNS void
  LANGUAGE plpgsql
  AS $$
    BEGIN
      CREATE TABLE lazycloud_version_tree (
        id varchar PRIMARY KEY,
        parents hstore
      );
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
      EXECUTE 'SELECT array_agg(lazycloud_version)  ' ||
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

      col_names = list(col_names)
      insert_nums = list(insert_nums)
      assigns = map(
        lambda x: "{} = {}".format(
          x[0],
          x[1]
        ),
        zip(col_names, insert_nums)
      )
      insert_len = len(list(insert_nums))

      assigns_joined = ', '.join(assigns)

      # FIXME: handle primary key correctly.
      query = 'UPDATE lazycloud_{} SET {} WHERE id = {} AND lazycloud_version = {}'.format(
        TD['table_name'],
        assigns_joined,
        '${}'.format(insert_len + 1),
        '${}'.format(insert_len + 2),
      )

      col_values = list(col_values)
      # FIXME: handle primary key correctly.
      col_types.append(col_mapping['id'])
      col_values.append(row['id'])
      col_types.append(col_mapping['lazycloud_version'])
      col_values.append(row['lazycloud_version'])
      query_plan = plpy.prepare(query, col_types)
      plpy.execute(query_plan, col_values)

    lazycloud_version_row = plpy.execute('select lazycloud_get_version()')
    lazycloud_version = lazycloud_version_row[0]['lazycloud_get_version']
    if TD['event'] == 'INSERT':
      new_row = TD['new']
      new_row.pop('id', None)
      new_row['lazycloud_version'] = lazycloud_version
      new_row['lazycloud_tombstone'] = False
      insert_row(new_row)
      return None;

    elif TD['event'] == 'DELETE':
      old_row = TD['old']
      if old_row['lazycloud_version'] == lazycloud_version:
        # FIXME: handle primary key correctly.
        plpy.execute('UPDATE lazycloud_{} SET lazycloud_tombstone = true'.format(
          TD['table_name'])
        )
      else:
        old_row['lazycloud_version'] = lazycloud_version
        old_row['lazycloud_tombstone'] = true
        insert_row(old_row)
      return None

    elif TD['event'] == 'UPDATE':
      new_row = TD['new']
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
    BEGIN
      FOR createdTable IN SELECT * FROM pg_event_trigger_ddl_commands() LOOP
        IF NOT createdTable.object_type = 'table' THEN
          CONTINUE;
        END IF;
        schemaName = split_part(createdTable.object_identity, '.', 1);
        tableName = split_part(createdTable.object_identity, '.', 2);
        if tableName = 'lazycloud_version_tree' THEN
          CONTINUE;
        END IF;

        isTempTable = is_temp_table(tableName);

        IF isTempTable THEN
          CONTINUE;
        END IF;

        -- FIXME: handle primary keys.
        -- SELECT column_name, udt_name
        --   FROM information_schema.columns
        --   WHERE createdTable.object_identity;
        --
        -- EXECUTE 'SELECT ' ||
        --   'c.column_name, c.data_type ' ||
        --   'FROM information_schema.table_constraints tc ' ||
        --   'JOIN information_schema.constraint_column_usage AS ccu ' ||
        --     'USING (constraint_schema, constraint_name) '  ||
        --   'JOIN information_schema.columns AS c ' ||
        --     'ON c.table_schema = tc.constraint_schema ' ||
        --       'AND tc.table_name = c.table_name ' ||
        --       'AND ccu.column_name = c.column_name ' ||
        --   'WHERE constraint_type = "PRIMARY KEY" ' ||
        --     'AND tc.table_schema = ' || schemaName ||
        --     'AND tc.table_name = ' || tableName;

        EXECUTE 'ALTER TABLE ' || createdTable.object_identity
          || ' ADD COLUMN lazycloud_version text';

        EXECUTE 'ALTER TABLE ' || createdTable.object_identity
          || ' ADD COLUMN lazycloud_tombstone boolean NOT NULL DEFAULT false';

        -- EXECUTE 'ALTER TABLE ' || tableName || ' ADD PRIMARY KEY (id)';

        EXECUTE 'ALTER TABLE ' || tableName ||
          ' RENAME TO lazycloud_' || tableName;

        internalIdentity = schemaName || '.lazycloud_' ||   tableName;

        EXECUTE 'CREATE VIEW ' || createdTable.object_identity || ' AS '
          || 'SELECT DISTINCT ON (' || internalIdentity || '.id) '
          ||   internalIdentity || '.* '
          || 'FROM ' || internalIdentity || ', lazycloud_find_versions() '
          || 'AS lazycloud_version_table '
          || 'WHERE ' || internalIdentity
          ||   '.lazycloud_version = lazycloud_version_table.id '
          || 'AND ' || internalIdentity || '.lazycloud_tombstone = false '
          || 'ORDER BY ' || internalIdentity || '.id, '
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
