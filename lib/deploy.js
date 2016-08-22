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
    ppm2 = require("./ppm2"),
    EventEmitter = require('events');
    mkdirp = q.nfbind(fse.mkdirp);

var readJSON = q.denodeify(jsonfile.readFile);

function execIf(pred, command) {
    return pred ? utils.exec(command) : q({});
}

function create_process_def(commit_id, port) {
    return {
        "apps" : [{
            "name"        : "lazycloud - " + commit_id,
            "script"      : "npm start",
            "node_args"   : "--harmony",
            "env"         : {
                LAZY_CLOUD_COMMIT_ID: commit_id,
                LAZY_CLOUD_PORT: port
            }
        }]
    };
}

function commit_is_running(commit_id) {
    return ppm2.list()
        .then((list) => {
            var found = list.filter(
                    (item) => item.name.indexOf(commit_id) != -1);

            if (found.length === 0) {
                return null;
            } else if (found.length > 1){
                throw new Error("More than one process running for a commit");
            } else {
                return found[0];
            }
        });
}

/**
  * If a process is started return it's port, otherwise start a new process and
  * return it's port.
  */
function get_process_port(deploy_path, commit_id) {
    return ppm2.connect()
        .then(commit_is_running(commit_id))
        .then((port) => {
            if (port !== null) {
                return port;
            } else {
                return utils.portfinder.getPort()
                    .then(port => deploy.deploy(deploy_path, commit_id, port));
            }
        });
}

// standard deploy steps
function standard_deploy(deploy_path, commit_id, port) {
    process.chdir(deploy_path);

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
                                "npm run-script lazy_cloud:postdeploy"))
                    // start server
                    .then(_ => ppm2.connect())
                    // check if commit is already running
                    .then(_ => ppm2.list())
                    .then(list => {
                        var found = list.filter((proc) =>
                            proc.name.indexOf(TEST_COMMIT_ID) != -1);
                    })


                    .then(_ => ppm2.start(create_process_def(commit_id, port))))
                    ;
        } );
}

function reset_and_pull_repo(repo_path) {
    process.chdir(repo_path);
    return utils.exec("git reset --hard")
        // clean repo
        .then(_ => utils.exec("git clean -dfX"))
        // pull all changes
        .then(_ => utils.exec("git pull"));
}

// Returns an event emitter, since I want to decouple this from the
// queue/updating sqlite.
function deploy(deploy_path, treeish) {
    var myEmitter = new EventEmitter();
    var source_repo_path = path.resolve(deploy_path, 'repo');
    var clone_path = path.resolve(deploy_path, "commits", treeish);
    myEmitter.emit('start', source_repo_path, clone_path, treeish);
    fs.stat(clone_path)
        .then(result =>{
            if (result.isDirectory()) {
                myEmitter.emit('progress', 'already checked out seeing if we need to update');
                // check if a process is running for this treeish.
                return commit_is_running(treeish)
                    .then(function (ppm2_process) {
                        if (ppm2_process) {
                            // TODO: check if we need to update the code or not.
                            return utils.exec("git fetch")
                                .then(_ => utils.execPred("$(git rev-parse HEAD) == $(git rev-parse @{u})"))
                                .then(function (result) {
                                    if (result === 0) {
                                        // Nothing has changed so just return
                                        // the port for proxying.
                                        myEmitter.emit('progress', 'code unchanged proxying');
                                        return ppm2_process.pm2.env.LAZY_CLOUD_PORT;
                                    } else {
                                        // stop current process.
                                        return ppm2.connect()
                                            .then(_ => ppm2.delete(ppm2_process))
                                            // reset and pull
                                            .then(_ => reset_and_pull_repo(clone_path))
                                            .then(_ => standard_deploy(clone_path, treeish,
                                                                        ppm2_process.pm2_env.LAZY_CLOUD_PORT)
                                            .then(_ => ppm2.disconnect());
                                    }
                                })

                        } else {
                            // clean and fast forward directory before deploying.
                            process.chdir(clone_path);
                            return reset_and_pull_repo(clone_path)
                                // set checkout commit to treeish
                                .then(_ => utils.exec("git checkout " + treeish))
                                // standard deploy
                                .then(_ => utils.portfinder.getPort())
                                .then(port => standard_deploy(clone_path, treeish, port))
                                .then(_ => ppm2.disconnect());
                        }
                    });
            } else {
                myEmitter.emit('error',"Clone path " + clone_path + " is not a directory");
            }
        })
        // clone repo, checkout treeish, and start process since it doesn't
        // exist.
        .fail((err) => {
            return utils.exec("git clone " + source_repo_path + " " + clone_path)
                    // set checkout commit to treeish
                    .then(_ => {
                        process.chdir(clone_path);
                        return utils.exec("git checkout " + treeish)
                    })
                    // standard deploy
                    .then(_ => standard_deploy(clone_path, treeish, port))
                    //.progress(data => console.log(data))
                    ;
        })
        .then(_=> myEmitter.emit('end'));
    return myEmitter;
}

module.exports = {
    deploy: deploy
}
