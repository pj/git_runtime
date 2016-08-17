/**
  * @file Starts and stops the lazy cloud proxy process.
  */
var structure = require('./structure');
var ppm2 = require('./ppm2.js');
var path = require('path');

function create_process_def(name, port, production_port, base_hostname) {
    return {
        "apps" : [{
            "name"        : name,
            "script"      : path.resolve(__dirname, 'start_server.js'),
            "args"        : [port, production_port, base_hostname],
            "node_args"   : "--harmony",
        }]
    };
}

function start_proxy_process(name, port, production_port, base_hostname) {
    return ppm2
        .connect()
        .then((proc) => ppm2.start(create_process_def(name, port, production_port, base_hostname)));
}

function restart_proxy_process(name, port, production_port, base_hostname) {
    return ppm2.connect()
        .then((_) => ppm2.stop(name))
        .then((proc) => ppm2.start(create_process_def(name, port, production_port, base_hostname)));
}

function stop_proxy_process(name) {
    return ppm2.connect()
        .then((_) => ppm2.stop(name))
        .then((_) => ppm2.delete(name));
}

module.exports = {
    start_proxy_process: start_proxy_process,
    restart_proxy_process: restart_proxy_process,
    stop_proxy_process: stop_proxy_process
};
