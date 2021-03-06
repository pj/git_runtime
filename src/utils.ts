/// <reference path="manual.d.ts" />
import * as q from 'q';
import * as child_process from 'child_process';
import * as fse from 'fs-extra';
import * as request from 'request';
var jsonfile = require("jsonfile");

export function exec(command: string, options=null){
    var deferred = q.defer();
    if (options) {
        var proc = child_process.exec(command, options);
    } else {
        var proc = child_process.exec(command);
    }

    var stdout_data = [];
    var stderr_data = [];

    proc.stdout.on('data', (data) => {
        //console.log("-------");
        //console.log(command);
        //console.log(data);
        stdout_data.push(data);
        deferred.notify([data, null]);
    });

    proc.stderr.on('data', (data) => {
        //console.log("-------");
        //console.log(command);
        //console.log(data);
        stderr_data.push(data);
        deferred.notify([null, data]);
    });

    proc.on('error', function(err) {
        deferred.reject(err);
    });

    proc.on('close', (code) => {
        let stdout = stdout_data.join("");
        let stderr = stderr_data.join("");
        //console.log("=======");
        //console.log(command);
        //console.log(stdout);
        //console.log("-------");
        //console.log(stderr);

        if (code !== 0) {
            deferred.reject(new Error("Process closed unexpectedly with code: " + code));
        } else {
            deferred.resolve([stdout, stderr]);
        }
    });

    return deferred.promise;
}

export function execPred(command: string){
    var deferred = q.defer();
    var proc = child_process.exec(command);

    var stdout_data = [];
    var stderr_data = [];

    proc.stdout.on('data', (data) => {
        //console.log("-------");
        //console.log(command);
        //console.log(data);
        stdout_data.push(data);
        deferred.notify([data, null]);
    });

    proc.stderr.on('data', (data) => {
        //console.log("-------");
        //console.log(command);
        //console.log(data);
        stderr_data.push(data);
        deferred.notify([null, data]);
    });


    proc.on('error', function(err) {
        deferred.reject(err);
    });

    proc.on('close', (code) => {
        //let stdout = stdout_data.join("");
        //let stderr = stderr_data.join("");
        //console.log("=======");
        //console.log(command);
        //console.log(stdout);
        //console.log("-------");
        //console.log(stderr);
        deferred.resolve(code)
    });

    return deferred.promise;
}
/**
  * apply denodeify to a module, producing a new module containing methods
  * with 'Async' appended.
  */
export function denodeifyAll(o) {
    var new_module = {}
    Object.keys(o)
        .filter(m => typeof o[m] === 'function')
        .forEach(m => new_module[m] = q.denodeify(o[m]));

    return new_module;
}

export function wait_for_response(host){
    return new Promise(function (resolve, reject) {
        var times = 0;
        var intervalId;
        intervalId = setInterval(function () {
            request(host, function (err, response, body){
                if (err) {
                    if (times < 5) {
                        times += 1;
                        return;
                    } else {
                        clearInterval(intervalId);
                        reject(new Error("Host not responding"));
                    }
                } else {
                    clearInterval(intervalId);
                    resolve();
                }
            });
        }, 200);
    });
}

var WebSocket2 = require('ws');
export function deploy_commit(commit_id, server_port) {
    return new Promise(function (resolve, reject) {
        var ws: any = new WebSocket2(`ws://localhost:${server_port}/lazy_cloud_admin/deployment/progress`);

        ws.on('open', function () {
            // start deploy
            ws.send('DEPLOY ' + commit_id);
        });

        ws.on('message', function(data, flags) {
            let [message_type, message] = data.split(" ");
            if (message_type === "PROGRESS") {
                //console.log(message);
            } else if (message_type === "STARTED"){
                //console.log("STARTED");
            } else if (message_type === "ENDED") {
                //console.log("ENDED");
            } else {
                reject(new Error("Unknown message: " + data));
            }
        });

        ws.on('close', function(code, message) {
            if (code !== 1000) {
                reject(message);
            } else {
                //console.log(data);
                resolve();
            }
        });

        ws.on('error', function(data, flags) {
            console.log(data);
            reject(data);
        });
    });
}

// Various promiseified modules
export const tmp:any = denodeifyAll(require("tmp"));
//export const fse:any = denodeifyAll(require("fs-extra"));
export const emptyDir:any = q.denodeify(fse.emptyDir);
export const glob:any = q.denodeify(require("glob"));
export var getPortAsync = q.denodeify(require("portfinder").getPort);
export var readJSON = q.denodeify(jsonfile.readFile);
export var writeJSON = q.denodeify(jsonfile.writeFile);
import * as pm2n from 'pm2';

export var pm2 = {
  connect: q.nbind(pm2n.connect, pm2n),
  start: q.nbind(pm2n.start, pm2n),
  disconnect: q.nbind(pm2n.disconnect, pm2n),
  stop: q.nbind(pm2n.stop, pm2n),
  list: q.nbind(pm2n.list, pm2n),
  killDaemon: q.nbind(pm2n.killDaemon, pm2n)
};
