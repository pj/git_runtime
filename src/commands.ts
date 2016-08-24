import program = require('commander');
import proxy = require('./proxy');
import fs = require("q-io/fs");
import path = require("path");
import fsn = require('fs');
import q = require("q");
import jsonfile = require("jsonfile");
import utils = require("./utils");

var readJSON = q.denodeify(jsonfile.readFile);

// TODO: find better place for global defaults
var DEFAULT_PROXY_PORT = 5555;
var DEFAULT_PRODUCTION_PORT = 4444;
var DEFAULT_PROXY_NAME = "lazycloud - proxy";

function get_config_option(default_value, opts, config_file, cmd_option_name, config_option_name) {
    var opt = default_value;
    if (opts[cmd_option_name]){
        opt = opts[cmd_option_name];
    } else if (config_file[config_option_name]) {
        opt = config_file[config_option_name];
    }

    return opt;
}

function get_config_opts(deployment_path, opts){
    if (!deployment_path) {
        deployment_path = process.cwd();
    }
    var config_file_path = path.resolve(deployment_path, 'lazycloud.json');
    return fs.stat(config_file_path)
        .then(function (stat){
            if (stat.isFile()) {
                return readJSON(config_file_path);
            } else {
                throw new Error('lazycloud.json is not a file!');
            }
        })
        .then(function (config_file){
            var config_opts = {};
            config_opts.proxy_port = get_config_option(DEFAULT_PROXY_PORT, opts, config_file,
                'port', 'proxy_port');
            config_opts.production_port = get_config_option(DEFAULT_PRODUCTION_PORT, opts, config_file,
                'production', 'production_port');
            config_opts.proxy_name = get_config_option(DEFAULT_PROXY_NAME, opts, config_file,
                'name', 'proxy_name');
            if (opts.base) {
                config_opts.base_hostname = opts.base;
            } else if (config_file["base_hostname"]){
                config_opts.base_hostname = config_file["base_hostname"];
            } else {
                throw new Error("Base hostname must be in config file or passed on command line.");
            }
        });
}

program
    .command("start [deployment_path]")
    .option("-p, --port", "Port for proxy server")
    .option("-r, --production", "Port for production server")
    .option("-n, --name", "Name for proxy server process")
    .option("-b, --base", "Base hostname")
    .action(function(deployment_path, opts){
        get_config_opts(deployment_path, opts)
            .then(function (config_opts) {
                proxy.start_proxy_process(
                    config_opts.proxy_name,
                    config_opts.deployment_path,
                    config_opts.proxy_port,
                    config_opts.production_port,
                    config_opts.base_hostname);
            })
            .catch(function (err) {
                console.log(err);
                process.exit(1);
            });
    });

program
    .command("restart [deployment_path]")
    .option("-p, --port", "Port for proxy server", 5555)
    .option("-r, --production", "Port for production server", 4444)
    .option("-n, --name", "Name for proxy server process", "lazycloud - proxy")
    .action(function(deployment_path, opts){
        get_config_opts(deployment_path, opts)
            .then(function (config_opts) {
                proxy.restart_proxy_process(
                    config_opts.proxy_name,
                    config_opts.deployment_path,
                    config_opts.proxy_port,
                    config_opts.production_port,
                    config_opts.base_hostname);
            })
            .catch(function (err) {
                console.log(err);
                process.exit(1);
            });
    });

program
    .command("stop [deployment_path]")
    .option("-n, --proxy-name", "Name for proxy server process", "lazycloud - proxy")
    .action(function(deployment_path, opts){
        get_config_opts(deployment_path, opts)
            .then(function (config_opts) {
                proxy.stop_proxy_process(config_opts.proxy_name);
            })
            .catch(function (err) {
                console.log(err);
                process.exit(1);
            });
    });

// Create a new lazy cloud location from a git url.
program
    .command("init <url>")
    .action(function(opts){
    });

modules.exports = program;
