/**
  * @file Scripts for initializing lazy cloud deployments.
  */

var fs = require("q-io/fs"),
    fse = require("fs-extra"),
    q = require("q"),
    utils = require("./utils"),
    fsn = require("fs");

var readdir = q.denodeify(fsn.readdir);

function init_deployment(url) {
    console.log(url);
    // Check that this directory is empty
    return readdir(".")
        .then(files => {
            if (files.length === 0) {
                // Clone repo to repo
                return utils.exec("git clone " + url + " repo")
                    .then(_ => fse.writeJSON("lazycloud.json", {"repository": url}));
            } else {
                throw new Error("Directory not empty!");
            }
        })
}

module.exports = {
    init_deployment: init_deployment
}
