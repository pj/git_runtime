/**
  * @file Starts and stops the lazy cloud proxy process.
  */
import * as pm2 from 'pm2';
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
    await pm2.connect();
    await pm2.start(create_process_def(name, deployment_path, port,
                                        base_hostname, production_commit));
    await utils.wait_for_response(`http://${base_hostname}:${port}/lazy_cloud_admin/heartbeat`);
    // deploy production.
    await utils.deploy_commit(production_commit, port);
    await pm2.disconnect();
}

export async function restart_proxy_process(name, deployment_path, port,
                                            base_hostname, production_commit) {
    await pm2.connect();
    await pm2.stop(name);
    await pm2.start(create_process_def(name, deployment_path, port,
                                        base_hostname, production_commit));
    await utils.wait_for_response("http://localhost:" + port + "/lazy_cloud_admin/heartbeat");
    // deploy production.
    await utils.deploy_commit(production_commit, port);
    await pm2.disconnect();
}

export async function stop_proxy_process(name) {
    await pm2.connect();
    await pm2.stop(name);
    await pm2['delete'](name);
    await pm2.disconnect();
}
