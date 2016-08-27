/**
  * @file Starts and stops the lazy cloud proxy process.
  */
import * as ppm2 from './ppm2';
import * as path from 'path';

function create_process_def(name, deployment_path, port, production_port, base_hostname) {
    return {
        "apps" : [{
            "name"        : name,
            "script"      :path.resolve(__dirname, '../dist/start_server.js'),
            "args"        : [deployment_path, port, production_port, base_hostname],
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
