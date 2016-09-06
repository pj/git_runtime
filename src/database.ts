/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="./manual.d.ts" />
import * as rethinkdb from 'rethinkdb';

let r:any = rethinkdb;

function new_run (connection, cb) {
    if (this.mt === 'insert') {
        console.log(Object.getPrototypeOf(this));
        console.log(this.toString());
        console.log(this.mt);
    }
    return this._original_run(connection, cb);
}

export default function patch_rethinkdb () {
    if (r._lazy_cloud_applied === undefined) {
        var tableObj = r.table('blah');
        r._tbProto = Object.getPrototypeOf(tableObj.constructor.__super__.constructor.__super__);
        r._tbProto._original_run = r._tbProto.run
        r._lazy_cloud_applied = true;
    }

    r._tbProto.run = new_run;

    return r;
}
