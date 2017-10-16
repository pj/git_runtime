/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="manual.d.ts" />
import * as rethinkdb from 'rethinkdb';
let uuid = require('uuid');

let r:any = rethinkdb;

async function new_run (connection, cb) {
    if (this.mt === 'insert') {
        let insert_result = await this._original_run(connection, cb);

        //for (let arg of this.args) {
            //console.log(arg);
        //}
        //console.log(Object.getPrototypeOf(this));
        //console.log(this.toString());
        //console.log(this.mt);

        let doc = this.args[1].optargs;
        //console.log(doc);
        let [_, id] = doc.id.data.split('_');
        insert_result.generated_keys = [id];

        //console.log(id);

        return Promise.resolve(insert_result);


        //doc.lazy_cloud_commit_id = version;
        //doc.id = `${version}-${new_id}`;

        //for (let arg of this.args) {
            //console.log(arg);
        //}

    } else if (this.mt === 'get') {
        let get_result = await this._original_run(connection, cb);

        if (get_result) {
            let [_, result_id] = get_result.id.split('_');

            get_result.id = result_id;
        }

        return Promise.resolve(get_result);
    } else {
        return this._original_run(connection, cb);
    }
}

function new_insert (doc, opts) {
    let new_id = uuid.v4();
    let version = process.env["LAZY_CLOUD_COMMIT_ID"]

    doc.lazy_cloud_commit_id = version;
    doc.id = `${version}_${new_id}`;
    //console.log(doc);

    if (opts) {
        return this._original_insert(doc, opts);
    } else {
        return this._original_insert(doc);
    }
}

function new_get (id) {
    let new_id = `${process.env["LAZY_CLOUD_COMMIT_ID"]}_${id}`;
    return this._original_get(new_id);
}

export default function patch_rethinkdb (git_tree) {
    if (r._lazy_cloud_applied === undefined) {
        var tableObj = r.table('blah');
        r._tbProto = Object.getPrototypeOf(tableObj.constructor.__super__.constructor.__super__);
        r._tbProto._original_run = r._tbProto.run
        r._lazy_cloud_applied = true;

        var insertObj = r.table('blah').insert({'asdf': 'asdf'});
        r._rdbvalProto = Object.getPrototypeOf(insertObj.constructor.__super__);
        r._rdbvalProto._original_insert = r._rdbvalProto.insert

        r._rdbvalProto._original_get = r._rdbvalProto.get
    }

    r._tbProto.run = new_run;
    r._rdbvalProto.insert = new_insert;
    r._rdbvalProto.get = new_get;

    return r;
}
