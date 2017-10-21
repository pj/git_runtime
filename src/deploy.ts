/// <reference path="manual.d.ts" />
/**
  * @file Deployment related functions
  */
import * as path from 'path';
import * as fse from 'fs-extra';
import * as q from 'q';
import * as jsonfile from 'jsonfile';
import * as utils from './utils';
const pm2 = utils.pm2;
import * as EventEmitter from 'events';

function execIf(pred, command): any {
    if (pred) {
        return utils.exec(command);
    } else {
        return Promise.resolve({});
    }
}

function create_process_def(json, commit_id, port) {
    var script = json['lazycloud'] && json['lazycloud']['script'] ? json['lazycloud']['script'] : "index.js";
    return {
        "apps" : [{
            "name"        : "lazycloud - " + commit_id,
            "script"      : script,
            "node_args"   : "--harmony",
            "env"         : {
                LAZY_CLOUD_COMMIT_ID: commit_id,
                LAZY_CLOUD_PORT: port
            }
        }]
    };
}

async function commit_is_running(commit_id) {
    await pm2.connect();
    let list: any = await pm2.list();
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
async function standard_deploy(myEmitter, deploy_path, commit_id, base_hostname, port) {
    process.chdir(deploy_path);

    // open package.json so we can check whether the pre and post deploy
    // scripts exist.
    let json = await utils.readJSON("package.json");
    // run predeploy
    myEmitter.emit('progress', 'Running predeploy script.');
    await execIf(json['scripts'] && json['scripts']['lazy_cloud:predeploy'],
                 "npm run-script lazy_cloud:predeploy");
    // run nix
    //.then(_ => fs.stat("default.nix")
    //.then(_ => utils.exec("nix-shell ."))
    //.fail(_ => q({})))
    // run npm init
    myEmitter.emit('progress', 'Running npm install.');
    await utils.exec("npm install");
    // run postdeploy
    myEmitter.emit('progress', 'Running post deploy script.');
    await execIf(json['scripts'] && json['scripts']['lazy_cloud:postdeploy'],
                 "npm run-script lazy_cloud:postdeploy");
    // start server
    await pm2.connect();
    myEmitter.emit('progress', 'Starting process.');
    await pm2.start(create_process_def(json, commit_id, port));

    // wait for response
    myEmitter.emit('progress', 'Waiting for process response.');
    await utils.wait_for_response(`http://${base_hostname}:${port}/lazy_cloud_heartbeat`);
}

async function reset_and_pull_repo(myEmitter, repo_path, treeish) {
    process.chdir(repo_path);
    myEmitter.emit('progress', 'Resetting and cleaning checkout.');
    await utils.exec("git reset --hard");
    // clean repo
    await utils.exec("git clean -dfX");
    // fetch all changes
    myEmitter.emit('progress', 'Fetching new changes.');
    await utils.exec("git fetch --all");

    // check if treeish is checked out already
    let result = await utils.execPred('git rev-parse --verify ' + treeish);
    if (result === 0) {
        myEmitter.emit('progress', 'Checking out new code.');
        await utils.exec("git checkout " + treeish);

        // check if treeish is a specific commit id or is a branch id
        let treeish_test:any = await utils.exec("git rev-parse " + treeish);
        if (treeish_test[0].trim() !== treeish) {
            // if it's a branch then pull
            await utils.exec("git pull");
        }
    } else {
        myEmitter.emit('progress', 'Checking out new branch.');
        await utils.exec("git checkout -b " + treeish);
    }
}

async function needs_update(repo_path) {
    process.chdir(repo_path);
    await utils.exec("git fetch")
    let result = await utils.execPred("[ $(git rev-parse HEAD) = $(git rev-parse @{u}) ]")
    return result === 1 ? true : false;
}

async function deploy_new_commit(myEmitter, source_repo_path, clone_path, base_hostname, treeish) {
    myEmitter.emit('progress', 'Cloning into path ' + clone_path);
    await utils.exec("git clone " + source_repo_path + " " + clone_path)
    // set checkout commit to treeish
    process.chdir(clone_path);
    let result = await utils.execPred('git rev-parse --verify ' + treeish);
    if (result === 0) {
        myEmitter.emit('progress', 'Checking out commit.');
        await utils.exec("git checkout " + treeish);
    } else {
        myEmitter.emit('progress', 'Checking out new branch.');
        await utils.exec("git checkout -b " + treeish);
    }
    let new_port = await utils.getPortAsync();
    myEmitter.emit('progress', 'Using port ' + new_port + '.');
    // standard deploy
    await standard_deploy(myEmitter, clone_path, treeish, base_hostname, new_port);
}

async function deploy_process_running(myEmitter, pm2_process, clone_path, base_hostname, treeish) {
    let need_update = await needs_update(clone_path);
    if (!need_update) {
        // Nothing has changed so just return
        // the port for proxying.
        myEmitter.emit('progress', 'code unchanged proxying');
        return pm2_process.pm2_env.LAZY_CLOUD_PORT;
    } else {
        // stop current process.
        await pm2.connect();
        myEmitter.emit('progress', 'code changed stopping existing process.');
        await pm2['delete'](pm2_process.name);
        // reset and pull
        await reset_and_pull_repo(myEmitter, clone_path, treeish);
        await standard_deploy(
          myEmitter,
          clone_path,
          treeish,
          base_hostname,
          pm2_process.pm2_env.LAZY_CLOUD_PORT
        );
    }
}

async function deploy_process_errored(myEmitter, pm2_process, clone_path, base_hostname, treeish) {
    // stop current process.
    await pm2.connect();
    await pm2['delete'](pm2_process.name);
    // reset and pull
    await reset_and_pull_repo(myEmitter, clone_path, treeish);
    await standard_deploy(
      myEmitter,
      clone_path,
      treeish,
      base_hostname,
      pm2_process.pm2_env.LAZY_CLOUD_PORT
    );
}

async function deploy_process_not_running(myEmitter, clone_path, base_hostname, treeish) {
    // clean and fast forward directory before deploying.
    process.chdir(clone_path);
    await reset_and_pull_repo(myEmitter, clone_path, treeish);
    // standard deploy
    let new_port = await utils.getPortAsync();
    myEmitter.emit('progress', 'Starting process on ' + new_port);
    await standard_deploy(myEmitter, clone_path, treeish, base_hostname, new_port);
}

// Returns an event emitter, since I want to decouple this from
// what controls the deploy process.
export function deploy_commit(deploy_path, base_hostname, treeish) {
    const myEmitter = new (EventEmitter as any)();
    const source_repo_path = path.resolve(deploy_path, 'repo');
    const clone_path = path.resolve(deploy_path, "commits", treeish);
    process.nextTick(async function() {
      myEmitter.emit('start', source_repo_path, clone_path, treeish);
      try {
        const stat = await fse.stat(clone_path);
        if (stat.isDirectory()) {
          myEmitter.emit(
            'progress',
            'already checked out seeing if we need to update'
          );

          try {
            const pm2_process = await commit_is_running(treeish);
            if (pm2_process) {
              if (pm2_process.pm2_env.status ==='online') {
                myEmitter.emit('progress', 'Commit already running');
                await deploy_process_running(
                  myEmitter,
                  pm2_process,
                  clone_path,
                  base_hostname,
                  treeish
                );
              } else {
                myEmitter.emit('progress', 'Commit errored restarting');
                await deploy_process_errored(
                  myEmitter,
                  pm2_process,
                  clone_path,
                  base_hostname,
                  treeish
                );
              }
            } else {
              myEmitter.emit('progress', 'Commit not already running');
              await deploy_process_not_running(
                myEmitter,
                clone_path,
                base_hostname,
                treeish
              );
            }
          } catch (err) {
            myEmitter.emit('error', err);
          }
        } else {
          myEmitter.emit(
            'error',
            new Error("Clone path " + clone_path + " is not a directory")
          );
        }
      } catch (err) {
          myEmitter.emit('progress', 'Cloning code.');
          try {
            await deploy_new_commit(
              myEmitter,
              source_repo_path,
              clone_path,
              base_hostname,
              treeish
            );
          } catch (err) {
            myEmitter.emit('error', err);
          }
      }
      myEmitter.emit('end');
    });
    return myEmitter;
}
