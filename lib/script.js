#!/usr/bin/env node --harmony
var parser = require("nomnom");
var files = require("files");

parser.command('add')
    .option('commit_id', {
        position: 1,
        help: "Commit id",
        metavar: "COMMIT_ID"
    })
    .option('path', {
        position: 2,
        help: "path to checkout",
        metavar: "PATH"
    })
    .option('repo_path', {
        abbr: 'r',
        default: ".",
        help: "path to repository",
        metavar: "REPO"
    })
    .option('branch_name', {
        abbr: 'b',
        default: "master",
        help: "branch to checkout",
        metavar: "BRANCH"
    })
    .option('run_dir', {
        abbr: 'd',
        default: ".gitruntime",
        help: 'Directory to store runtime files in.',
        metavar: "RUNTIME_DIR"
    })
    .callback(function(opts) {
        files.addCommit(opts.commit_id, opts.path, opts.branch_name, opts.repo_path,
                  opts.run_dir);
    })
    .help("Add a commit id to runtime.");

parser.nocommand()
    .callback(function(opts) {
        console.log(parser.getUsage())
    });

parser.parse();

