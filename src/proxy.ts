/**
  * @file Starts and stops the lazy cloud proxy process.
  */
import * as ppm2 from './ppm2';
import * as path from 'path';

function create_process_def(name, deployment_path, port, production_port, base_hostname) {
    return {
        "apps" : [{
            "name"        : name,
            "script"      : "/usr/local/lib/node_modules/ts-node/dist/bin.js ",// + path.resolve(__dirname, 'start_server.ts'),
            "args"        : [deployment_path, port, production_port, base_hostname],
            "cwd"         : deployment_path,
            //"interpreter" : "/usr/local/lib/node_modules/ts-node/dist/bin.js"
            //"interpreter" : "/usr/local/bin/ts\-node"
            "interpreter" : ""
        }]
    };
}

export async function start_proxy_process(name, deployment_path, port,
                                    production_port, base_hostname) {
    await ppm2.connect();
    await ppm2.start(create_process_def(name, deployment_path, port,
                                        production_port, base_hostname));
}

export async function restart_proxy_process(name, deployment_path, port,
                                      production_port, base_hostname) {
    await ppm2.connect();
    await ppm2.stop(name);
    await ppm2.start(create_process_def(name, deployment_path, port,
                                        production_port, base_hostname));
}

export async function stop_proxy_process(name) {
    await ppm2.connect();
    await ppm2.stop(name);
    await ppm2.deleteProcess(name);
}
