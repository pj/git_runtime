/**
  * @file Starts and stops the lazy cloud proxy process.
  */
import * as ppm2 from './ppm2';
import * as path from 'path';
import * as utils from './utils';

function create_process_def(name, deployment_path, port, base_hostname, production_commit) {
    return {
        "apps" : [{
            "name"        : name,
            "script"      : path.resolve(__dirname, '../dist/start_server.js'),
            "args"        : [deployment_path, port, base_hostname, production_commit],
        }]
    };
}

var WebSocket2 = require('ws');
function deploy_production(commit_id, production_port) {
    return new Promise(function (resolve, reject) {
        var ws: any = new WebSocket2(`ws://localhost:${production_port}/lazy_cloud_admin/deployment/progress`);

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

export async function start_proxy_process(name, deployment_path, port, base_hostname, production_commit) {
    await ppm2.connect();
    await ppm2.start(create_process_def(name, deployment_path, port, base_hostname, production_commit));
    await utils.wait_for_response("http://localhost:" + port + "/lazy_cloud_admin/heartbeat");
    // deploy production.
    await deploy_production(production_commit, port);
    await ppm2.disconnect();
}

export async function restart_proxy_process(name, deployment_path, port, base_hostname, production_commit) {
    await ppm2.connect();
    await ppm2.stop(name);
    await ppm2.start(create_process_def(name, deployment_path, port, base_hostname, production_commit));
    await utils.wait_for_response("http://localhost:" + port + "/lazy_cloud_admin/heartbeat");
    // deploy production.
    await deploy_production(production_commit, port);
    await ppm2.disconnect();
}

export async function stop_proxy_process(name) {
    await ppm2.connect();
    await ppm2.stop(name);
    await ppm2.deleteProcess(name);
    await ppm2.disconnect();
}
