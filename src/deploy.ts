/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="manual.d.ts" />
/**
  * @file Deployment related functions
  */
import * as path from 'path';
import * as fs from 'q-io/fs';
import * as fse from 'fs-extra';
import * as fsn from 'fs';
import * as q from 'q';
import * as jsonfile from 'jsonfile';
import * as utils from './utils';
import * as ppm2 from './ppm2';
import * as EventEmitter from 'events';

const mkdirp = q.nfbind(fse.mkdirp);

var readJSON = q.denodeify(jsonfile.readFile);

function execIf(pred, command): any {
    if (pred) {
        return utils.exec(command);
    } else {
        return Promise.resolve({});
    }
}

function create_process_def(commit_id, port) {
    return {
        "apps" : [{
            "name"        : "lazycloud - " + commit_id,
            "script"      : "index.js",
            "node_args"   : "--harmony",
            "env"         : {
                LAZY_CLOUD_COMMIT_ID: commit_id,
                LAZY_CLOUD_PORT: port
            }
        }]
    };
}

async function commit_is_running(commit_id) {
    await ppm2.connect();
    let list: any = await ppm2.list();
    var found = list.filter((item) => item.name.indexOf(commit_id) != -1);

    if (found.length === 0) {
        return null;
    } else if (found.length > 1){
        throw new Error("More than one process running for a commit");
    } else {
        return found[0];
    }
}

// standard deploy steps
async function standard_deploy(deploy_path, commit_id, port) {
    process.chdir(deploy_path);

    // open package.json so we can check whether the pre and post deploy
    // scripts exist.
    let json = await readJSON("package.json");
    // run predeploy
    await execIf(json['scripts'] && json['scripts']['lazy_cloud:predeploy'],
                 "npm run-script lazy_cloud:predeploy");
    // run nix
    //.then(_ => fs.stat("default.nix")
    //.then(_ => utils.exec("nix-shell ."))
    //.fail(_ => q({})))
    // run npm init
    await utils.exec("npm install");
    // run postdeploy
    await execIf(json['scripts'] && json['scripts']['lazy_cloud:postdeploy'],
                 "npm run-script lazy_cloud:postdeploy");
    // start server
    await ppm2.connect();
    await ppm2.start(create_process_def(commit_id, port));

    // wait for response
    await utils.wait_for_response('http://localhost:' + port + "/lazy_cloud_heartbeat");
}

async function reset_and_pull_repo(repo_path) {
    process.chdir(repo_path);
    await utils.exec("git reset --hard");
    // clean repo
    await utils.exec("git clean -dfX");
    // pull all changes
    await utils.exec("git pull");
}

async function needs_update(repo_path) {
    process.chdir(repo_path);
    await utils.exec("git fetch")
    let result = await utils.execPred("[ $(git rev-parse HEAD) = $(git rev-parse @{u}) ]")
    return result === 1 ? true : false;
}

async function deploy_new_commit(source_repo_path, clone_path, treeish) {
    await utils.exec("git clone " + source_repo_path + " " + clone_path)
    // set checkout commit to treeish
    process.chdir(clone_path);
    let result = await utils.execPred('git rev-parse --verify ' + treeish);
    if (result === 0) {
        await utils.exec("git checkout " + treeish);
    } else {
        await utils.exec("git checkout -b " + treeish);
    }
    let new_port = await utils.getPortAsync();
    // standard deploy
    await standard_deploy(clone_path, treeish, new_port);
}

async function deploy_process_running(myEmitter, ppm2_process, clone_path, treeish) {
    let need_update = await needs_update(clone_path);
    if (!need_update) {
        // Nothing has changed so just return
        // the port for proxying.
        myEmitter.emit('progress', 'code unchanged proxying');
        return Promise.resolve(ppm2_process.pm2_env.LAZY_CLOUD_PORT);
    } else {
        // stop current process.
        await ppm2.connect();
        await ppm2.deleteProcess(ppm2_process.name);
        // reset and pull
        await reset_and_pull_repo(clone_path);
        await standard_deploy(clone_path, treeish,
                              ppm2_process.pm2_env.LAZY_CLOUD_PORT);
    }
}

async function deploy_process_not_running(myEmitter, clone_path, treeish) {
    // clean and fast forward directory before deploying.
    process.chdir(clone_path);
    await reset_and_pull_repo(clone_path);
    // set checkout commit to treeish
    let result = await utils.execPred('git rev-parse --verify ' + treeish);
    if (result === 0) {
        await utils.exec("git checkout " + treeish);
    } else {
        await utils.exec("git checkout -b " + treeish);
    }
    // standard deploy
    let new_port = await utils.getPortAsync();
    await standard_deploy(clone_path, treeish, new_port);
}

// Returns an event emitter, since I want to decouple this from
// what controls the deploy process.
export function deploy_commit(deploy_path, treeish) {
    var myEmitter = new (EventEmitter as any)();
    var source_repo_path = path.resolve(deploy_path, 'repo');
    var clone_path = path.resolve(deploy_path, "commits", treeish);
    fsn.stat(clone_path, function(err, stat) {
        myEmitter.emit('start', source_repo_path, clone_path, treeish);
        if (err) {
            myEmitter.emit('progress', 'Cloning code.');
            deploy_new_commit(source_repo_path, clone_path, treeish)
                .then(_ => myEmitter.emit('end'))
                .catch(err => myEmitter.emit('error', err));
        } else {
            if (stat.isDirectory()) {
                myEmitter.emit('progress', 'already checked out seeing if we need to update');

                commit_is_running(treeish)
                    .then(function (ppm2_process){
                        if (ppm2_process) {
                            myEmitter.emit('progress',
                               'Commit already running');
                            return deploy_process_running(myEmitter, ppm2_process, clone_path, treeish);
                        } else {
                            myEmitter.emit('progress',
                               'Commit not already running');
                            return deploy_process_not_running(myEmitter, clone_path, treeish);
                        }})
                    .then(_ => myEmitter.emit('end'))
                    .catch(err => myEmitter.emit('error', err));
            } else {
                myEmitter.emit('error', new Error("Clone path " + clone_path + " is not a directory"));
            }
        }
    });
    return myEmitter;
}
