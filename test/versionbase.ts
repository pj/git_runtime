/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="../src/manual.d.ts" />
import * as chai from "chai";
var assert = chai.assert;

import * as database from "../src/versionbase/database";
import {Map} from "immutable";

describe("the versionbase core logic", function () {
    it("should create a version tree", function () {
        let transshots = Map<string, Map<string, any>>();
        transshots = database.create_version(transshots, "A", null);
        assert.equal(transshots.size, 1);
        transshots = database.create_version(transshots, "B", "A");
        transshots = database.create_version(transshots, "C", "A");
        transshots = database.create_version(transshots, "D", "C");
        assert.equal(transshots.get("current").size, 4);

        let version = transshots.get("current").get("D");
        assert.equal(version.parent.version_id, "C");
        assert.equal(version.parent.parent.version_id, "A");

        version = transshots.get("current").get("B");
        assert.equal(version.parent.version_id, "A");
        version = transshots.get("current").get("A");
        assert.isNull(version.parent);
    });

    it("should CRUD items", function () {
        let new_id, data;
        let transshots = Map<string, Map<string, any>>();
        transshots = database.create_version(transshots, "A", null);
        transshots = database.create_version(transshots, "B", "A");
        assert.equal(transshots.get("current").size, 2);

        [transshots, new_id] = database.create_item(transshots, "B", "current", {message: "hello"});

        assert.isNotNull(new_id);
        let current = transshots.get("current");
        assert.equal(current.get("A").items.size, 0);
        assert.equal(current.get("B").items.size, 1);

        data = database.get_item(transshots, new_id, "B", "current");
        assert.equal(data.message, "hello");
        assert.equal(data.id, new_id);
        assert.equal(data.version, "B");
        data = database.get_item(transshots, "asdf", "B", "current");
        assert.isNull(data);
        data = database.get_item(transshots, new_id, "A", "current");
        assert.isNull(data);

        [transshots, new_id] = database.create_item(transshots, "A", "current", {message: "foo"});
        transshots = database.update_item(transshots, new_id, "B", "current", {message: "bar"});
        data = database.get_item(transshots, new_id, "A", "current");
        assert.equal(data.message, "foo");
        assert.equal(data.id, new_id);
        assert.equal(data.version, "A");
        data = database.get_item(transshots, new_id, "B", "current");
        assert.equal(data.message, "bar");
        assert.equal(data.id, new_id);
        assert.equal(data.version, "B");

        transshots = database.delete_item(transshots, new_id, "B", "current");
        data = database.get_item(transshots, new_id, "A", "current");
        assert.equal(data.message, "foo");
        assert.equal(data.id, new_id);
        assert.equal(data.version, "A");
        data = database.get_item(transshots, new_id, "B", "current");
        assert.isNull(data);
    });

    it("should find some items", function () {
    });

    it("should reduce some items", function () {
    });
});

describe("versionbase transaction", function () {
    function common_transaction() {
        let first_id, second_id, data, transaction_id;
        let transshots = Map<string, Map<string, any>>();
        transshots = database.create_version(transshots, "A", null);
        transshots = database.create_version(transshots, "B", "A");
        assert.equal(transshots.get("current").size, 2);

        [transshots, transaction_id] = database.begin_transaction(transshots, "current");
        [transshots, first_id] = database.create_item(transshots, "B",
                                                      transaction_id, {message: "foo"});
        [transshots, second_id] = database.create_item(transshots, "B",
                                                       transaction_id, {message: "bar"});

        transshots = database.delete_item(transshots, first_id, "B", transaction_id);
        transshots = database.update_item(transshots, second_id, "B",
                                          transaction_id, {message: "baz"});

        data = database.get_item(transshots, first_id, "B", transaction_id);
        assert.isNull(data);
        data = database.get_item(transshots, second_id, "B", transaction_id);
        assert.equal(data.message, "baz");
        assert.equal(data.id, second_id);
        assert.equal(data.version, "B");

        // check that current isn't modified.
        assert.equal(transshots.get("current").size, 2);
        assert.equal(transshots.get("current").get("B").items.size, 0);

        return [transshots, first_id, second_id, transaction_id];
    };

    it("should apply transaction", function () {
        let [transshots, first_id, second_id, transaction_id] = common_transaction();
        transshots = database.commit_transaction(transshots, transaction_id);
        // now checkout
        let data = database.get_item(transshots, first_id, "B", "current");
        assert.isNull(data);
        data = database.get_item(transshots, second_id, "B", "current");
        assert.equal(data.message, "baz");
        assert.equal(data.id, second_id);
        assert.equal(data.version, "B");
    });

    it("should rollback transaction", function () {
        let [transshots, first_id, second_id, transaction_id] = common_transaction();
        transshots = database.rollback_transaction(transshots, transaction_id);
        // now checkout
        let data = database.get_item(transshots, first_id, "B", "current");
        assert.isNull(data);
        data = database.get_item(transshots, second_id, "B", "current");
        assert.isNull(data);
        assert.equal(transshots.get("current").size, 2);
        assert.equal(transshots.get("current").get("B").items.size, 0);
    });

    it("should reject transaction when current modified", function () {
        let third_id;
        let [transshots, first_id, second_id, transaction_id] = common_transaction();

        [transshots, third_id] = database.create_item(transshots, "B",
                                                      "current", {message: "foo"});

        assert.throws(function () {
            database.commit_transaction(transshots, transaction_id);
        }, "Concurrent updates not allowed!");
    });
});

describe.skip("versionbase snapshots", function () {
    function common_transaction() {
        let first_id, second_id, data, transaction_id;
        let transshots = Map<string, Map<string, any>>();
        transshots = database.create_version(transshots, "A", null);
        transshots = database.create_version(transshots, "B", "A");
        assert.equal(transshots.get("current").size, 2);

        [transshots, transaction_id] = database.begin_transaction(transshots, "current");
        [transshots, first_id] = database.create_item(transshots, "B",
                                                      transaction_id, {message: "foo"});
        [transshots, second_id] = database.create_item(transshots, "B",
                                                       transaction_id, {message: "bar"});

        transshots = database.delete_item(transshots, first_id, "B", transaction_id);
        transshots = database.update_item(transshots, second_id, "B",
                                          transaction_id, {message: "baz"});

        data = database.get_item(transshots, first_id, "B", transaction_id);
        assert.isNull(data);
        data = database.get_item(transshots, second_id, "B", transaction_id);
        assert.equal(data.message, "baz");
        assert.equal(data.id, second_id);
        assert.equal(data.version, "B");

        // check that current isn't modified.
        assert.equal(transshots.get("current").size, 2);
        assert.equal(transshots.get("current").get("B").items.size, 0);

        return [transshots, first_id, second_id, transaction_id];
    };

    it("should apply transaction", function () {
        let [transshots, first_id, second_id, transaction_id] = common_transaction();
        transshots = database.commit_transaction(transshots, transaction_id);
        // now checkout
        let data = database.get_item(transshots, first_id, "B", "current");
        assert.isNull(data);
        data = database.get_item(transshots, second_id, "B", "current");
        assert.equal(data.message, "baz");
        assert.equal(data.id, second_id);
        assert.equal(data.version, "B");
    });

    it("should rollback transaction", function () {
        let [transshots, first_id, second_id, transaction_id] = common_transaction();
        transshots = database.rollback_transaction(transshots, transaction_id);
        // now checkout
        let data = database.get_item(transshots, first_id, "B", "current");
        assert.isNull(data);
        data = database.get_item(transshots, second_id, "B", "current");
        assert.isNull(data);
        assert.equal(transshots.get("current").size, 2);
        assert.equal(transshots.get("current").get("B").items.size, 0);
    });

    it("should reject transaction when current modified", function () {
        let third_id;
        let [transshots, first_id, second_id, transaction_id] = common_transaction();

        [transshots, third_id] = database.create_item(transshots, "B",
                                                      "current", {message: "foo"});

        assert.throws(function () {
            database.commit_transaction(transshots, transaction_id);
        }, "Concurrent updates not allowed!");
    });
});

describe.skip("versionbase server", function () {
});

describe("versionbase client", function () {
});
