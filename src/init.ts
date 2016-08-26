/**
  * @file Scripts for initializing lazy cloud deployments.
  */
import * as fs from 'q-io/fs';
import * as fse from 'fs-extra';
import * as q from 'q';
import * as utils from './utils';
import * as fsn from 'fs';

var readdir = q.denodeify(fsn.readdir);

export function init_deployment(url) {
    // Check that this directory is empty
    return readdir(".")
        .then((files: any) => {
            if (files.length === 0) {
                // Clone repo to repo
                return utils.exec("git clone " + url + " repo")
                    .then(_ => fse.writeJSON("lazycloud.json", {"repository": url}));
            } else {
                throw new Error("Directory not empty!");
            }
        })
}
