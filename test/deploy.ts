/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="../src/manual.d.ts" />
import * as chai from "chai";
var assert = chai.assert;
var expect = chai.expect;

import * as q from "q";
import * as pm2 from "pm2";
import * as path from 'path';

var fs = require("q-io/fs");

import * as ppm2 from "../src/ppm2";
import * as fse from '../src/fs-extra';

import {start_proxy_process, restart_proxy_process, stop_proxy_process} from
    '../src/proxy';
import {deploy_commit} from '../src/deploy';
import * as init from '../src/init';
import * as utils from '../src/utils';

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

server.listen(process.env.LAZY_CLOUD_PORT, function (err) {
    if (err) {
            return console.log('something bad happened', err);
        }

    console.log("server is listening on " + port);
});`

async function check_directory(check_path) {
    let stat = await fs.stat(check_path);
    expect(stat.isDirectory()).to.equal(true);
}

async function check_file(check_path) {
    let stat = await fs.stat(check_path);
    expect(stat.isFile()).to.equal(true);
}

async function check_files(base_path, ...paths) {
    await Promise.all(paths.map(file_path => check_file(path.resolve(base_path, file_path))));
}

async function check_processes(...commit_ids) {
    await ppm2.connect();
    let processes: any = await ppm2.list();
    expect(processes).to.have.lengthOf(commit_ids.length);
    for (let process of processes) {
        let process_names = commit_ids.map(commit_id => 'lazycloud - ' + commit_id);
        expect(process.name).to.be.oneOf(process_names);
        expect(process.pm2_env.env.LAZY_CLOUD_COMMIT_ID).to.be.oneOf(commit_ids);

        // check that we are getting a response from the process
    }
}

//async function temp_deployment(test_deployment_callback) {
    //await ppm2.connect();
    //await ppm2.killDaemon();

    //let [repo_path, repo_cleanup] = await utils.tmp.dirAsync({unsafeCleanup: true});
    //process.chdir(repo_path);
    //await utils.exec("git init");
    //await check_directory(path.resolve(repo_path, '.git'));

    //let [deployment_path, deployment_cleanup] = await utils.tmp.dirAsync({unsafeCleanup: true});
    //process.chdir(deployment_path);
    //await init.init_deployment(repo_path);

    //await test_deployment_callback(repo_path, deployment_path);

    //repo_cleanup();
    //deployment_cleanup();
//}

async function write_commit(tmp_repo_path, commit) {
    process.chdir(tmp_repo_path);
    let [message, files] = commit;
    await Promise.all(Object.keys(files)
                        .map(path => fs.write(path, files[path])));
    // commit with message
    await utils.exec(`git add --all`);
    await utils.exec(`git commit -m "${message}"`);
    let commit_id = await utils.exec(`git rev-parse HEAD`);
    return commit_id[0].trim();
}

class commiterator {
    repo_path: string;
    current: number;
    commits: any;
    constructor(repo_path, ...commits) {
        this.repo_path = repo_path;
        this.commits = commits;
        this.current = -1;
    }

    async next() {
        this.current++;
        if (this.current >= this.commits.length) {
            throw new Error("No more commits");
        }
        let commit_id = await write_commit(this.repo_path, this.commits[this.current])
        return commit_id;
    }
}

function test_deploy_emitter(deployment_path, treeish, tests) {
    return new Promise(function (resolve, reject) {
        // deploy basic branch.
        let emitter = deploy_commit(deployment_path, treeish);

        emitter.on('end', function() {
            tests()
                .then(function () {
                    resolve();
                })
                .catch(function (err) {
                    reject(err);
                });
        });

        emitter.on('error', function(err) {
            reject(err);
        });
    });
}

async function beforeEachBasic() {
    var x = await utils.tmp.dirAsync({unsafeCleanup: true});
    this.repo_path = x[0]
    this.repo_cleanup = x[1];
    await utils.exec("git init", {cwd: this.repo_path});
    await check_directory(path.resolve(this.repo_path, '.git'));

    x = await utils.tmp.dirAsync({unsafeCleanup: true});
    this.deployment_path = x[0]
    this.deployment_cleanup = x[1];
    process.chdir(this.deployment_path);

    this.deploy_repo_path = path.resolve(this.deployment_path, 'repo');
    await init.init_deployment(this.repo_path);
    await ppm2.connect();
    await ppm2.killDaemon();
}

function afterEachBasic() {
    this.repo_cleanup();
    this.deployment_cleanup();
}

describe("Deploy, update and start commits.", function () {
    this.timeout(5000);
    //var deploy_repo_path, repo_path, deployment_path,
        //repo_cleanup, deployment_cleanup;

    beforeEach(beforeEachBasic);

    afterEach(afterEachBasic);

    it("deploy master", async function () {
        let commits = new commiterator (this.repo_path,
            ["initial commit", { 'package.json': package_json,
                                 'index.js': index_js }],
            ["another commit", { 'package.json': package_json.replace(
                '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
        );

        await commits.next();
        await check_files(this.repo_path, 'package.json', 'index.js');

        // pull changes into deployment.
        await utils.exec('git pull', {cwd: this.deploy_repo_path});

        await test_deploy_emitter(this.deployment_path, 'master', async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                              'package.json', 'index.js');

            // ...and process is running.
            await check_processes('master');
        }.bind(this));

        // write second commit
        let second_commit_id = await commits.next();
        await utils.exec('git pull', {cwd: this.deploy_repo_path});

        // deploy changes.
        await test_deploy_emitter(this.deployment_path, 'master', async function () {
            // check commit id of deployed directory.
            let deployed_id = await utils.exec('git rev-parse HEAD', {cwd: this.deploy_repo_path});
            expect(second_commit_id).to.equal(deployed_id[0].trim());

            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                             'package.json', 'index.js', 'blah.blah');

            // ...and process is running.
            await check_processes('master');
        }.bind(this));
    });

    it("deploy by commit id", async function () {
        let deploy_repo_path = path.resolve(this.deployment_path, 'repo');
        let commits = new commiterator (this.repo_path,
            ["initial commit", { 'package.json': package_json,
                                 'index.js': index_js }],
            ["another commit", { 'package.json': package_json.replace(
                '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
        );

        let commit_id = await commits.next();
        await check_files(this.repo_path, 'package.json', 'index.js');

        // pull changes into deployment.
        await utils.exec('git pull', {cwd: deploy_repo_path});

        await test_deploy_emitter(this.deployment_path, commit_id, async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', commit_id),
                          'package.json', 'index.js');

            // ...and process is running.
            await check_processes(commit_id);
        }.bind(this));

        // write second commit
        let second_commit_id = await commits.next();
        await utils.exec('git pull', {cwd: deploy_repo_path});

        // deploy changes.
        await test_deploy_emitter(this.deployment_path, second_commit_id, async function () {
            // check commit id of deployed directory.
            let deployed_id = await utils.exec("git rev-parse HEAD", {cwd: deploy_repo_path});
            expect(second_commit_id).to.equal(deployed_id[0].trim());

            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', second_commit_id),
                          'package.json', 'index.js', 'blah.blah');

            await check_files(path.resolve(this.deployment_path, 'commits', commit_id),
                          'package.json', 'index.js');

            // ...and process is running.
            await check_processes(commit_id, second_commit_id);
        }.bind(this));
    });

    it("deploy, not running, but checked out", async function () {
        let commits = new commiterator (this.repo_path,
            ["initial commit", { 'package.json': package_json,
                                 'index.js': index_js }],
            ["another commit", { 'package.json': package_json.replace(
                '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
        );

        await commits.next();
        await check_files(this.repo_path, 'package.json', 'index.js');

        // pull changes into deployment.
        await utils.exec('git pull', {cwd: this.deploy_repo_path});

        await test_deploy_emitter(this.deployment_path, 'master', async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                          'package.json', 'index.js');

            // ...and process is running.
            await check_processes('master');
        }.bind(this));

        // write second commit
        let second_commit_id = await commits.next();
        await utils.exec('git pull', {cwd: this.deploy_repo_path});

        // stop all processes
        await ppm2.killDaemon();

        // deploy changes.
        await test_deploy_emitter(this.deployment_path, 'master', async function () {
            // check commit id of deployed directory.
            let deployed_id = await utils.exec('git rev-parse HEAD', {cwd: this.deploy_repo_path});
            expect(second_commit_id).to.equal(deployed_id[0].trim());

            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                          'package.json', 'index.js', 'blah.blah');

            // ...and process is running.
            await check_processes('master');
        }.bind(this));
    });

    it("deploy branch and commit", async function () {
        let master_commits = new commiterator (this.repo_path,
            ["initial commit", { 'package.json': package_json,
                                 'index.js': index_js }]
        );
        let commit_id = await master_commits.next();

        // pull changes into deployment.
        await utils.exec('git pull --all', {cwd: this.deploy_repo_path});

        await test_deploy_emitter(this.deployment_path, 'master', async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                          'package.json', 'index.js');

            // ...and process is running.
            await check_processes('master');
        }.bind(this));

        // deploy changes.
        await test_deploy_emitter(this.deployment_path, commit_id, async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                          'package.json', 'index.js');

            await check_files(path.resolve(this.deployment_path, 'commits', commit_id),
                          'package.json', 'index.js');

            // ...and process is running.
            await check_processes('master', commit_id);
        }.bind(this));
    });

    it("deploy multiple branches", async function () {
        let master_commits = new commiterator (this.repo_path,
            ["initial commit", { 'package.json': package_json,
                                 'index.js': index_js }],
            ["another commit", { 'package.json': package_json.replace(
                '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
        );

        let branch_commits = new commiterator (this.repo_path,
            ["branch commit", { 'index.js': index_js.replace(
                'Hello world!', 'Goodbye Cruel World!')}]
        );

        let master_1_commit_id = await master_commits.next();
        let master_2_commit_id = await master_commits.next();

        await utils.exec('git checkout -b branch', {cwd: this.repo_path});
        let branch_commit_id = await branch_commits.next();

        // pull changes into deployment.
        await utils.exec('git pull --all', {cwd: this.deploy_repo_path});

        await test_deploy_emitter(this.deployment_path, 'master', async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                          'package.json', 'index.js', 'blah.blah');

            // ...and process is running.
            await check_processes('master');
        }.bind(this));

        // deploy changes.
        await test_deploy_emitter(this.deployment_path, 'branch', async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                          'package.json', 'index.js', 'blah.blah');

            await check_files(path.resolve(this.deployment_path, 'commits', 'branch'),
                          'package.json', 'index.js');

            // ...and process is running.
            await check_processes('master', 'branch');
        }.bind(this));
    });
});

var WebSocket2 = require('ws');
function test_ws_deploy(commit_id, test_callback) {
    return new Promise(function (resolve, reject) {
        var ws: any = new WebSocket2('ws://localhost:3000/lazy_cloud_admin/deployment/progress');

        ws.on('open', function () {
            // start deploy
            ws.send('DEPLOY ' + commit_id);
        });

        ws.on('message', function(data, flags) {
            let [message_type, message] = data.split(" ", 1);
            if (message_type === "PROGRESS") {
                console.log(message);
            } else if (message_type === "STARTED"){
                console.log("STARTED");
            } else if (message_type === "ENDED") {
                console.log("ENDED");
            } else {
                reject(new Error("Unknown message: " + data));
            }
        });

        ws.on('close', function(data, flags) {
            test_callback()
                .then(_ => resolve())
                .catch(err => reject(err));
            resolve();
        });

        ws.on('error', function(data, flags) {
            reject(data);
        });
    });
}

describe("Web socket deploy, update and start commits.", function () {
    this.timeout(5000);
    beforeEach(async function() {
        await beforeEachBasic.bind(this)();
        console.log(this.deployment_path);
        await start_proxy_process('lazycloud - proxy', this.deployment_path, 3000, 4000, 'localhost');
    });

    afterEach(afterEachBasic);

    it("deploy master with web sockets", async function () {
        let commits = new commiterator (this.repo_path,
            ["initial commit", { 'package.json': package_json,
                                 'index.js': index_js }],
            ["another commit", { 'package.json': package_json.replace(
                '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
        );

        await commits.next();
        await check_files(this.repo_path, 'package.json', 'index.js');

        // pull changes into deployment.
        await utils.exec('git pull --all', {cwd: this.deploy_repo_path});

        await test_ws_deploy('master', async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                              'package.json', 'index.js');

            // ...and process is running.
            await check_processes('master')
        }.bind(this));

        //// write second commit
        //let second_commit_id = await commits.next();
        //await execIn(deploy_repo_path, 'git pull');

        //// deploy changes.
        //await test_deploy_emitter(deployment_path, 'master', async function () {
            //// check commit id of deployed directory.
            //let deployed_id = await execIn(deploy_repo_path, "git rev-parse HEAD");
            //expect(second_commit_id).to.equal(deployed_id[0].trim());

            //// check code exists
            //await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
            //await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));
            //await check_file(path.resolve(deployment_path, 'commits', 'master', 'blah.blah'));

            //// ...and process is running.
            //await ppm2.connect();
            //let processes = await ppm2.list();
            //expect(processes).to.have.lengthOf(1);
            //expect(processes[0].name).to.equal('lazycloud - master');
            //expect(processes[0].pm2_env.env.LAZY_CLOUD_COMMIT_ID).to.equal('master');
        //});
    });
});
