//describe('Test CLI', function() {
    //beforeEach(deleteRuntimePath);

    //function runRuntime(command, args, env, result, status){
        //var run_result = child_process.spawnSync(command, args, env);

        //// console.log(run_result);
        //expect(run_result.status).to.equal(status);
        //expect(run_result.output[1].toString()).to.equal(result)
    //}

    //describe('Add commit', function() {
        //it('should add commit by branch', function() {
            //runRuntime("../../bin/git_runtime", ["add", "other", "lib"],
                       //{cwd: "test/repo1"}, "", 0);
            //runRuntime("node", ["main.js"], {GIT_RUNTIME: "other",
                        //cwd: "test/repo1"},
                       //"This is the first commit on the other branch!", 0);
            //runRuntime("node", ["main.js"], {GIT_RUNTIME: "occ4e9de",
                       //cwd: "test/repo1"},
                       //"This is the first commit on the other branch!", 0);
        //});

        //it('should add commit by HEAD reference', function() {
            //runRuntime("../../bin/git_runtime", ["add", "^HEAD", "lib"],
                       //{cwd: "test/repo1"}, "", 0);
            //runRuntime("node", ["main.js"], {GIT_RUNTIME: "other",
                       //cwd: "test/repo1"}, "This is the second commit!", 0);
        //});

        //it('should add commit by id', function() {
            //runRuntime("../../bin/git_runtime", ["add", "d496d8f", "lib"],
                       //{cwd: "test/repo1"}, "", 0);
            //runRuntime("node", ["main.js"], {GIT_RUNTIME: "d496d8f",
                       //cwd: "test/repo1"}, "This is the first commit!", 0);
        //});

        //it('should return error on invalid id', function() {
            //runRuntime("../../bin/git_runtime", ["add", "asdf", "lib"],
                    //{cwd: "test/repo1"}, "Invalid commit or branch.", 1);
        //});
    //});
////    describe('Delete commit', function() {
////        it('should delete a commit by id', function() {
////        });
////    });
////    describe('List commits', function() {
////        it('should list all installed commits', function() {
////        });
////    });
//});

//function delete_untracked(repo) {
    //var statusOpts = git.StatusOptions();
    //statusOpts.show = git.Status.SHOW.INDEX_AND_WORKDIR;
    //statusOpts.flags = git.Status.OPT.INCLUDE_UNTRACKED;
    //return git.StatusList.create(repo, opts))
        //.then(function (statusList) {
            //var paths = statusList.map(status => status.indexToWorkdir.newFile.path());
            //return q.all(paths.map(path => fs.unlink(path)));
        //});

//}

//function deploy(deploy_path, treeish) {
    //var source_repo_path = path.resolve(deploy_path, repo_path);
    //var clone_path = path.resolve(deploy_path, "commits", treeish);

    //return fs.stat(clone_path)
        //// if clone already exists then clean and fast forward.
        //.then(result =>{
            //if (result.isDirectory()) {
                //git.Repository.open(clone_path)
                    //.then(function (repo){
                        //// reset repo
                        //return git.Reset.reset(repo, "HEAD", git.Reset.TYPE.HARD)
                            //// clean repo
                            //.then(_ => delete_untracked(repo));
                            //// checkout head
                            //.then(_ => repo.fetchAll({}));
                            ////.then(_ => repo.mergeBranches("master", "origin/master");)
                            //.then(_ => standard_deploy());
                    //})

            //} else {
                //throw new Error("Clone path " + clone_path + " is not a directory");
            //}
        //})
        //// clone repo since it doesn't exist.
        //.fail((err) => {
            //return git.Clone(source_repo_path, clone_path)
                //.then(repository => git.Checkout(repository, treeish))
                //.then(_ => standard_deploy()));
        //});
//}



class git_commit {
    constructor(files, message, next, branches) {
        this.files = files;
        this.message = message;
        this.next = next;
        this.branches = branches;
    }

    advance(branch=null) {
        if (branch === null) {
            return this.next;
        } else {
            return this.branches[branch];
        }
    }
}

async function write_commit(commit) {
    // write files
    Object.keys(commit.files)
        .forEach(function (path) {
            let file = commit.files[path];
            // if it's a patch apply the patch
            if (file) {
                // otherwise patch and write out to file.
                await fs.writeFile(path, file);
            } else {
                // otherwise patch and write out to file.
                await fs.writeFile(path, );

            }

        });

    // commit with message
    await utils.exec(`git commit -m "${commit.message}"`);

    return commit;
}

/// <reference path="../typings/index.d.ts" />
var chai = require("chai");
chai.should();
var assert = chai.assert;
var expect = chai.expect;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var q = require("q");
var ppm2 = require("../lib/ppm2");
var proxy = require('../lib/proxy');
var deploy = require('../lib/deploy');
var init = require('../lib/init');
var utils = require('../lib/utils');
var path = require('path');

var fse = require('../lib/fs-extra');
var fs = require("q-io/fs");
var diff = require("diff");

const package_json = `{
    "name": "lazycloud_test",
    "version": "1.0.0",
    "description": "Test repo for lazycloud",
    "main": "index.js",
    "scripts": {}
}`

const index_js = `{
var http = require('http');

var server = http.createServer(function (request, response) {
    response.end("Hello world!");
});

server.listen(port, function (err) {
    if (err) {
            return console.log('something bad happened', err);
        }

    console.log("server is listening on " + port);
});`

async function write_commit(commit) {
    let [message, files] = commit;
    await Promise.all(Object.keys(files)
                        .map(path => fs.write(path, files[path])));
    // commit with message
    await utils.exec(`git add --all`);
    await utils.exec(`git commit -m "${message}"`);
    let commit_id = await utils.exec(`git rev-parse HEAD`);
    return commit_id;
}

async function check_directory(base_path, file) {
    let stat = await fs.stat(path.resolve(base_path, '.git'));
    expect(stat.isDirectory()).to.equal(true);
}

function* commiterator(...commits){
    for (let commit of commits) {
        yield commit;
    }
}

describe("Create and update a git repo", function () {
    it("create and update a git repo", async function () {
        let [tmp_path, cleanupCallback] = await utils.tmp.dirAsync({unsafeCleanup: true});
        process.chdir(tmp_path);

        await utils.exec("git init");
        await check_directory(tmp_path, '.git');

        let commits = commiterator (
            ["initial commit", { 'package.json': package_json,
                                 'index.js': index_js }],
            ["another commit", { 'package.json': package_json.replace('"scripts": {}', `scripts: {\n'lazy_cloud:postdeploy': 'touch blah.blah'\n    }`)}]
        )
        await utils.exec('git checkout -b basic');

        await write_commit(commits.next().value);

        await check_directory(tmp_path, 'package.json');
        await check_directory(tmp_path, 'index.js');

        await write_commit(commits.next().value);

        await check_directory(tmp_path, 'blah.blah');

        cleanupCallback();
    });
});

//var http = require('http');
//var httpProxy = require('http-proxy');
//var pm2 = require('pm2');
//var ppm2 = require('../lib/ppm2.js');
//var extend = require('util')._extend;
//var git = require("nodegit");
//var path = require("path");
//var wait_for_response = require("../site_wait.js");
//var structure = require("../structure.js");

//function create_process(commit_id, process_def) {
    //return ppm2.connect()
        //.then((_) => ppm2.list())
        //.then((list) => {
            //var found, i;

            //for (i in list) {
               //if (list[i].name.indexOf(commit_id) != -1) {
                    //found = i;
                    //break;
               //}
            //}

            //if (found === undefined) {
                //return commit_exists(process_def, commit_id)
                    //.then((object) => {
                        //var new_process_def = create_new_process_def(
                                //commit_id, process_def, list);
                        //return ppm2.start(new_process_def)
                            //.then((_) => new_process_def.apps[0].env.PORT);
                    //});
            //} else {
                //var existing_proc = list[found];
                //return existing_proc.pm2_env.PORT;
            //}
        //});
//}

//function create_process_server(base_hostname) {
    //return http.createServer(function(req, res) {
        //// If this is an admin request route to the admin process.
        //if (req.url.indexOf('/lazy_cloud_admin') === 0) {
            //res.
        //}

        //var hostname = req.headers.hostname.split(':')[0];
        //if (hostname !== base_hostname) {

        //}

        //var commit_id = req.headers['x-git-commit-id'];
        //if (commit_id) {
            //create_process(commit_id, process_def)
                //.then(function (port) {
                    //return wait_for_response("localhost:" + port)
                        //.then((_) => proxy.web(req, res,
                                    //{ target: "localhost:" + port}))
                //})
            //.fail((err) => {
                //console.log(err);
                //res.statusCode = 500;
                //res.end(err.toString());
                //return err;
            //});
        //} else {
            //proxy.web(req, res, { target: target + ":" + target_port});
        //}
    //});
//}

//function start_process_server(port, base_hostname) {
    //var server = create_process_server(base_hostname);
    //server.listen(port);
//}

//module.exports = {
    //start_process_server: start_process_server
//};

