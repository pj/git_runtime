/// <reference path="../../typings/index.d.ts" />
/// <reference path="../../typings/auto.d.ts" />
/// <reference path="../manual.d.ts" />
import {Map} from 'immutable';
var uuid = require('uuid');

class Version {
    parent: Version
    items: Map<string, any>
    version_id: string
    constructor(parent, version_id, items) {
        this.parent = parent;
        this.version_id = version_id;
        this.items = items;
    }

    set_item(key, item) {
        let new_items = this.items.set(key, item);

        return new Version(this.parent, this.version_id, new_items);
    }

    delete_item(key) {
        let new_items = this.items.delete(key);

        return new Version(this.parent, this.version_id, new_items);
    }
}

export function get_item(snapshots, item_id, version_id, transaction_id) {
    let snapshot = snapshots.get(transaction_id);
    let version = snapshot.get(version_id);
    if (version && version.items.has(item_id)) {
        return version.items.get(item_id);
    } else {
        return null;
    }
}

export function update_item(snapshots, item_id, version_id, transaction_id, data) {
    data.id = item_id;
    data.version = version_id;
    let snapshot = snapshots.get(transaction_id);
    let git_version = snapshot.get(version_id);
    let new_git_version = git_version.set_item(item_id, data);
    let new_snapshot = snapshot.set(version_id, new_git_version);
    return snapshots.set(transaction_id, new_snapshot);
}

export function delete_item(snapshots, item_id, version_id, transaction_id) {
    let snapshot = snapshots.get(transaction_id);
    let version = snapshot.get(version_id);
    if (version) {
        let new_version = version.delete_item(item_id);
        let new_snapshot = snapshot.set(version_id, new_version);
        return snapshots.set(transaction_id, new_snapshot);
    } else {
        throw new Error("Item does not exist");
    }
}

export function create_item(snapshots, version_id, transaction_id, data) {
    let item_id = uuid.v4();
    data.id = item_id;
    data.version = version_id;
    let snapshot = snapshots.get(transaction_id);
    let git_version = snapshot.get(version_id);
    let new_git_version = git_version.set_item(item_id, data);
    let new_snapshot = snapshot.set(version_id, new_git_version);
    return [snapshots.set(transaction_id, new_snapshot), item_id];
}

export function find_items(snapshots, project, select, reduce, version_id, transaction_id) {
    let snapshot = snapshots.get(transaction_id);
    let git_version = snapshot.get(version_id);
    let results = git_version.items.filter(select).reduce(reduce).map(project);

    return [snapshots, results];
}

export function create_version(snapshots, commit_id, parent_commit_id): Map<string, Map<string, any>> {
    let current_snapshot = snapshots.get("current", Map());
    // handle initial commit.
    if (parent_commit_id === null) {
        // FIXME: git can apparently have multiple independent intial commits,
        // not sure if this should be allowed?
        var new_version = new Version(null, commit_id, Map());
    } else {
        let parent_version = current_snapshot.get(parent_commit_id);
        var new_version = new Version(parent_version, commit_id, parent_version.items);
    }
    let new_snapshot = current_snapshot.set(commit_id, new_version);
    return snapshots.set("current", new_snapshot);
}

export function begin_transaction(snapshots, snapshot_id) {
    let transaction_id = uuid.v4();
    let snapshot = snapshots.get(snapshot_id);
    let new_snapshots = snapshots.set(transaction_id, snapshot);
    new_snapshots = new_snapshots.set("original-" + transaction_id, snapshot);
    return [new_snapshots, transaction_id];
}

export function commit_transaction(snapshots, transaction_id) {
    let completed_transaction = snapshots.get(transaction_id);
    let current_snapshot = snapshots.get("current");
    let original_snapshot = snapshots.get("original-" + transaction_id);
    let new_snapshot = snapshots.get(transaction_id);
    // reject concurrent updates to database - for now.
    if (current_snapshot === original_snapshot) {
        let new_current = snapshots.set("current", new_snapshot);
        new_current = new_current.delete("original-" + transaction_id);
        return new_current.delete(transaction_id);
    } else {
        // TODO: rollback here? or should transaction state be saved for examination?
        throw new Error("Concurrent updates not allowed!");
    }
}

export function rollback_transaction(snapshots, transaction_id) {
    let new_snapshots = snapshots.delete("original-" + transaction_id);
    return new_snapshots.delete(transaction_id);
}

export function create_snapshot(snapshots) {
    let snapshot_id = uuid.v4();

    let current_snapshot = snapshots.get("current");
    let new_snapshots = snapshots.set(snapshot_id, current_snapshot);

    return [new_snapshots, snapshot_id];
}

export function delete_snapshot(snapshots, snapshot_id: string) {
    return snapshots.delete(snapshot_id);
}
