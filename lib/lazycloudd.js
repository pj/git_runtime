#!/usr/bin/env node --harmony

/**
  * @file Script to start the lazy cloud proxy process that receives requests and routes
  * them to the correct commit id process.
  */
var program = require('commander');
var proxy = require('./proxy.js')

program
    .command("start")
    .option("-p, --port", "Port for proxy server", 5555)
    .option("-n, --name", "Name for proxy server process", "lazycloud - proxy")
    .action(function(opts){
        proxy.start_proxy_process(opts.name, opts.port);
    });

program
    .command("restart")
    .option("-p, --port", "Port for proxy server", 5555)
    .option("-n, --name", "Name for proxy server process", "lazycloud - proxy")
    .action(function(opts){
        proxy.restart_proxy_process(opts.name, opts.port);
    });

program
    .command("stop")
    .option("-n, --proxy-name", "Name for proxy server process", "lazycloud - proxy")
    .action(function(opts){
        proxy.stop_proxy_process(opts.name);
    });

// Create a new lazy cloud location from a git url.
program
    .command("init <url>")
    .action(function(opts){
    });

program.parse(process.argv);
