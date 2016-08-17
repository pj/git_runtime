var http = require('http');
var httpProxy = require('http-proxy');
var pm2 = require('pm2');
var ppm2 = require('../lib/ppm2.js');
var extend = require('util')._extend;
var git = require("nodegit");
var path = require("path");
var wait_for_response = require("./site_wait.js");
var structure = require("./structure.js");

var PROXY_PROCESS_DEF = {
  "apps" : [{
    "name"        : "lazycloud - proxy",
    "script"      : "",
    "cwd"         : "/Users/pauljohnson/Programming/git_runtime/git_runtime",
    "args"        : [],
    "node_args"   : "--harmony",
    "merge_logs"  : true
  }]
}

function stop_proxy_process(proxy_name){
    return ppm2.connect()
        .then((_) => ppm2.stop(proxy_name))
        .then((_) => ppm2.delete(proxy_name));
}

function restart_proxy_process(proxy_name){
    return ppm2.connect()
        .then((_) => ppm2.stop(proxy_name))
        .then((proc) => ppm2.start(proxy_process_def));
}

function start_proxy_process(proxy_process_def){
    return ppm2.connect()
        .then((proc) => ppm2.start(proxy_process_def));
}
