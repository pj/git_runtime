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

export async function start_proxy_process(name, deployment_path, port,
                                          base_hostname, production_commit) {
    await ppm2.connect();
    await ppm2.start(create_process_def(name, deployment_path, port,
                                        base_hostname, production_commit));
    await utils.wait_for_response(`http://${base_hostname}:${port}/lazy_cloud_admin/heartbeat`);
    // deploy production.
    await utils.deploy_commit(production_commit, port);
    await ppm2.disconnect();
}

export async function restart_proxy_process(name, deployment_path, port,
                                            base_hostname, production_commit) {
    await ppm2.connect();
    await ppm2.stop(name);
    await ppm2.start(create_process_def(name, deployment_path, port,
                                        base_hostname, production_commit));
    await utils.wait_for_response("http://localhost:" + port + "/lazy_cloud_admin/heartbeat");
    // deploy production.
    await utils.deploy_commit(production_commit, port);
    await ppm2.disconnect();
}

export async function stop_proxy_process(name) {
    await ppm2.connect();
    await ppm2.stop(name);
    await ppm2.deleteProcess(name);
    await ppm2.disconnect();
}
