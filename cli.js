#!/usr/bin/env node --harmony
var program = require('commander');
var fs = require('fs');
var jsonfile = require('jsonfile');
var structure = require('./lib/structure');
var proxy = require('./lib/proxy');

program
    .command('add <reference> <repo_path>')
    .option("-d, --directory <runtime_dir>",
            "Directory to store runtime files in.", ".gitruntime")
    .action(function(reference, repo_path, opts){
        structure.add_commit(repo_path, reference, opts.directory)
    });

program
    .command('proxy <target_server> <port> <process_file>')
    //.option("-t, --thing", "Another option", 1234)
    .action(function(target, port, process_file, opts){
        var process_def = jsonfile.readFileSync(process_file);
        proxy.star_proxy(target, port, process_def);
    });

program.parse(process.argv);
