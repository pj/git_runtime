/**
  * @file Deployment related functions
  */
var git = require("nodegit"),
    _ = require("underscore"),
    path = require("path"),
    fs = require("q-io/fs"),
    fse = require("fs-extra"),
    fsn = require("fs"),
    q = require("q"),
    jsonfile = require("jsonfile"),
    utils = require("./utils"),
    mkdirp = q.nfbind(fse.mkdirp);

var readJSON = q.denodeify(jsonfile.readFile);

function execIf(pred, command) {
    return pred ? utils.exec(command) : q({});
}

// standard deploy steps
function standard_deploy(path) {
    process.chdir(path);

    // open package.json so we can check whether the pre and post deploy
    // scripts exist.
    return readJSON("package.json")
        .then(function (json) {
            // run predeploy
            return execIf(json['scripts'] && json['scripts']['lazy_cloud:predeploy'],
                            "npm run-script lazy_cloud:predeploy")
                    // run nix
                    //.then(_ => fs.stat("default.nix")
                            //.then(_ => utils.exec("nix-shell ."))
                            //.fail(_ => q({})))
                    // run npm init
                    .then(_ => utils.exec("npm install"))
                    // run postdeploy
                    .then(_ => execIf(json['scripts'] && json['scripts']['lazy_cloud:postdeploy'],
                                "npm run-script lazy_cloud:postdeploy"));
        } );
}

function deploy(deploy_path, treeish) {
    var source_repo_path = path.resolve(deploy_path, 'repo');
    var clone_path = path.resolve(deploy_path, "commits", treeish);
    return fs.stat(clone_path)
        // if clone already exists then clean and fast forward.
        .then(result =>{
            if (result.isDirectory()) {
                process.chdir(clone_path);
                // reset repo
                return utils.exec("git reset --hard")
                    // clean repo
                    .then(_ => utils.exec("git clean -dfX"))
                    // pull all changes
                    .then(_ => utils.exec("git pull"))
                    // set checkout commit to treeish
                    .then(_ => utils.exec("git checkout " + treeish))
                    // standard deploy
                    .then(_ => standard_deploy(clone_path));
            } else {
                throw new Error("Clone path " + clone_path + " is not a directory");
            }
        })
        // clone repo since it doesn't exist.
        .fail((err) => {
            return utils.exec("git clone " + source_repo_path + " " + clone_path)
                    // set checkout commit to treeish
                    .then(_ => {
                        process.chdir(clone_path);
                        return utils.exec("git checkout " + treeish)
                    })
                    // standard deploy
                    .then(_ => standard_deploy(clone_path))
                    //.progress(data => console.log(data))
                    ;
        });
}
module.exports = {
    deploy: deploy
}
