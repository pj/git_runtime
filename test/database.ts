/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="../src/manual.d.ts" />
import * as chai from "chai";
var assert = chai.assert;

import * as q from "q";
import * as pm2 from "pm2";
import * as path from 'path';

var fs = require("q-io/fs");

import * as ppm2 from "../src/ppm2";
import * as fse from '../src/fs-extra';
import {commiterator, createTempRepo} from './test_helpers';
import * as original_rethinkdb from 'rethinkdb';
import patch_rethinkdb from "../src/database";

var git_tree = [];
var r = patch_rethinkdb(git_tree);

//let _original_run = r.run;

//r.run = function (connection, options, cb) {
    //_original_run.bind(r)(connection, options, cb);
//}

describe("Version database", function () {
    beforeEach(async function () {
        this.connection = await r.connect({host: 'localhost'});
        await r.tableCreate('test').run(this.connection);
    });

    afterEach(async function () {
        await r.tableDrop('test').run(this.connection);
        await this.connection.close();
    });

    it("create and retrieve records with version information", async function () {
        // Set environment version.
        process.env["LAZY_CLOUD_COMMIT_ID"] = "1234";

        // create record.
        var insert_result = await r.table('test')
                                   .insert({hello: "world!"})
                                   .run(this.connection);

        // test version creation.
        var get_result = await r.table('test')
                                   .get(insert_result.generated_keys[0])
                                   .run(this.connection);

        assert.property(get_result, 'lazy_cloud_commit_id');
        assert.equal(get_result.lazy_cloud_commit_id, '1234');
        assert.equal(insert_result.generated_keys[0], get_result.id);
    });

    it("update and retrieve correct version of records", async function () {
        // Set environment version.
        process.env["LAZY_CLOUD_COMMIT_ID"] = "1234";

        // create record.
        var insert_result = await r.table('test')
                                   .insert({hello: "world!"})
                                   .run(this.connection);

        var new_id = insert_result.generated_keys[0];

        // test version creation.
        var get_result = await r.table('test')
                                   .get(new_id)
                                   .run(this.connection);

        assert.isNotNull(get_result);
        assert.property(get_result, 'lazy_cloud_commit_id');
        assert.equal(get_result.lazy_cloud_commit_id, '1234');
        assert.equal(new_id, get_result.id);

        // Set new environment version.
        process.env["LAZY_CLOUD_COMMIT_ID"] = "4321";

        // update record
        var update_result = await r.table('test')
                                   .get(new_id)
                                   .update({goodbye: "world!"})
                                   .run(this.connection);

        var update_get_result = await r.table('test')
                                   .get(new_id)
                                   .run(this.connection);

        assert.isNotNull(update_get_result);
        assert.property(update_get_result, 'lazy_cloud_commit_id');
        assert.equal(update_get_result.lazy_cloud_commit_id, '4321');
        // check that two records now exist.

    });

    it.skip("update records by copy on write by using specific branch point",  function () {

    });

    it.skip("delete records without affecting previous versions",  function () {
        // fixtures.

        // test previous version still exists
    });

    it.skip("reset/delete entire version of the database",  function () {

    });

    it.skip("change branch point of commit",  function () {
    });

    it.skip("reject attempt to branch from version not accessible to passed commit id",  function () {
    });

    it.skip("reject when multiple records exist due to merge commit.",  function () {
    });

    it.skip("reject attempts to modify master.",  function () {
    });
});

//describe("Snapshot database", function () {
    //beforeEach( function ( ) {
    //});

    //afterEach( function ( ) {
    //});

    //it("deploy master",  function () {
    //});
//});

//describe("Schema evolution", function () {
    //beforeEach( function ( ) {
    //});

    //afterEach( function ( ) {
    //});

    //it("deploy master",  function () {
    //});
//});
