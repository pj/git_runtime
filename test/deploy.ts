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
import {commiterator, createTempRepo, createTempDeployment} from './test_helpers';
import * as init from '../src/init';
import * as utils from '../src/utils';
import * as request from 'request';

const package_json = `{
    "name": "lazycloud_test",
    "version": "1.0.0",
    "description": "Test repo for lazycloud",
    "main": "index.js",
    "scripts": {}
}`

const index_js = `
var http = require('http');

var server = http.createServer(function (request, response) {
    console.log("hello world");
    response.end("Hello world!");
});

server.listen(process.env.LAZY_CLOUD_PORT, function (err) {
    if (err) {
        console.error('something bad happened', err);
        return;
    }

    console.error("server is listening on " + process.env.LAZY_CLOUD_PORT);
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
    console.log(processes.map(proc => proc.name));
    processes = processes.filter(process => process.name.indexOf('proxy') === -1);
    expect(processes).to.have.lengthOf(commit_ids.length);
    for (let process of processes) {
        let process_names = commit_ids.map(commit_id => 'lazycloud - ' + commit_id);
        expect(process.name).to.be.oneOf(process_names);
        expect(process.pm2_env.env.LAZY_CLOUD_COMMIT_ID).to.be.oneOf(commit_ids);

        // check that we are getting a response from the process
    }
}

function test_deploy_emitter(deployment_path, treeish, base_hostname, tests) {
    return new Promise(function (resolve, reject) {
        // deploy basic branch.
        let emitter = deploy_commit(deployment_path, base_hostname, treeish);

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


describe("Deploy, update and start commits.", function () {
    this.timeout(5000);

    beforeEach(async function () {
        await createTempRepo.bind(this)();
        await createTempDeployment.bind(this)();
    });

    afterEach(
        function() {
            this.repo_cleanup();
            this.deployment_cleanup();
        }
    );

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

        await test_deploy_emitter(this.deployment_path, 'master', 'lazycloud.test', async function () {
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
        await test_deploy_emitter(this.deployment_path, 'master', 'lazycloud.test', async function () {
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

        await test_deploy_emitter(this.deployment_path, commit_id, 'lazycloud.test', async function () {
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
        await test_deploy_emitter(this.deployment_path, second_commit_id, 'lazycloud.test', async function () {
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

        await test_deploy_emitter(this.deployment_path, 'master', 'lazycloud.test', async function () {
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
        await test_deploy_emitter(this.deployment_path, 'master', 'lazycloud.test', async function () {
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

        await test_deploy_emitter(this.deployment_path, 'master', 'lazycloud.test', async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                          'package.json', 'index.js');

            // ...and process is running.
            await check_processes('master');
        }.bind(this));

        // deploy changes.
        await test_deploy_emitter(this.deployment_path, commit_id, 'lazycloud.test', async function () {
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

        await test_deploy_emitter(this.deployment_path, 'master', 'lazycloud.test', async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                          'package.json', 'index.js', 'blah.blah');

            // ...and process is running.
            await check_processes('master');
        }.bind(this));

        // deploy changes.
        await test_deploy_emitter(this.deployment_path, 'branch', 'lazycloud.test', async function () {
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
            let [message_type, message] = data.split(" ");
            if (message_type === "PROGRESS") {
                //console.log(message);
            } else if (message_type === "STARTED"){
                //console.log("STARTED");
            } else if (message_type === "ENDED") {
                //console.log("ENDED");
            } else {
                reject(new Error("Unknown message: " + data));
            }
        });

        ws.on('close', function(code, message) {
            if (code !== 1000) {
                reject(message);
            } else {
                //console.log(data);
                test_callback()
                    .then(_ => resolve())
                    .catch(err => reject(err));
            }
        });

        ws.on('error', function(data, flags) {
            console.log(data);
            reject(data);
        });
    });
}

describe("Web socket deploy, update and start commits.", function () {
    this.timeout(5000);
    beforeEach(async function() {
        await createTempRepo.bind(this)();
        await createTempDeployment.bind(this)();
        await utils.exec('tsc', {cwd: path.resolve(__dirname, '..')});
    });

    afterEach(function() {
        this.repo_cleanup();
        this.deployment_cleanup();
    });

    it("deploy master with web sockets", async function () {
        let commits = new commiterator (this.repo_path,
            ["initial commit", { 'package.json': package_json,
                                 'index.js': index_js }],
            ["another commit", { 'package.json': package_json.replace(
                '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
        );
        let first_commit_id = await commits.next();
        await check_files(this.repo_path, 'package.json', 'index.js');

        // pull changes into deployment.
        await utils.exec('git pull --all', {cwd: this.deploy_repo_path});

        // have to start this here since we don't have the "production commit",
        // till we've setup the repository.
        await start_proxy_process('lazycloud - proxy', this.deployment_path,
                                  3000, 'lazycloud.test', first_commit_id);
        await test_ws_deploy('master', async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                              'package.json', 'index.js');

            // ...and process is running.
            await check_processes(first_commit_id, 'master');
        }.bind(this));

        // write second commit
        let second_commit_id = await commits.next();
        await utils.exec('git pull', {cwd: this.deploy_repo_path});

        // deploy changes.
        await test_ws_deploy('master', async function () {
            // check commit id of deployed directory.
            //let deployed_id = await utils.exec('git rev-parse HEAD', {cwd: this.deploy_repo_path});
            //expect(second_commit_id).to.equal(deployed_id[0].trim());

            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', 'master'),
                             'package.json', 'index.js', 'blah.blah');

            // ...and process is running.
            await check_processes('master', first_commit_id);
        }.bind(this));
    });
});


//describe("Multiproxy", function () {
    //this.timeout(5000);
    //beforeEach(async function() {
        //await createTempRepo.bind(this)();
        //await createTempDeployment.bind(this)();
        //await utils.exec('tsc', {cwd: path.resolve(__dirname, '..')});
        //// configure multiproxy in lazycloud.json
        //const jsonpath = path.join(this.deployment_path, 'lazycloud.json');
        //let lazycloud_json = await utils.readJSON(jsonpath);
        //lazycloud_json["plugins"] = {
            //multiproxy: null
        //};
        //await utils.writeJSON(jsonpath, lazycloud_json);
    //});

    //afterEach(function() {
        //this.repo_cleanup();
        //this.deployment_cleanup();
    //});

    //it("records requests", async function () {
        //let commits = new commiterator (this.repo_path,
            //["initial commit", { 'package.json': package_json,
                                 //'index.js': index_js }],
            //["another commit", { 'package.json': package_json.replace(
                //'"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
        //);
        //let first_commit_id = await commits.next();

        //// pull changes into deployment.
        //await utils.exec('git pull --all', {cwd: this.deploy_repo_path});

        //// have to start this here since we don't have the "production commit",
        //// till we've setup the repository.
        //await start_proxy_process('lazycloud - proxy', this.deployment_path,
                                  //3000, 'lazycloud.test', first_commit_id);

        //// send request to production.
            //request('http://lazycloud.test:3000', function (err, response, body){
                //if (err) {
                    //if (times < 5) {
                        //times += 1;
                        //return;
                    //} else {
                        //clearInterval(intervalId);
                        //reject(new Error("Host not responding"));
                    //}
                //} else {
                    //clearInterval(intervalId);
                    //resolve();
                //}
            //});

        //// check request was saved with snapshot id.
    //});
//});

const time_waster_js = `
var http = require('http');

var server = http.createServer(function (request, response) {
    setTimeout(function () {
        response.end("Hello world!");
   }, 500);
});

server.listen(process.env.LAZY_CLOUD_PORT, function (err) {
    if (err) {
        console.error('something bad happened', err);
        return;
    }

    console.error("server is listening on " + process.env.LAZY_CLOUD_PORT);
});`

describe("Multiple simultaneous requests to proxied process", function () {
    this.timeout(5000);
    beforeEach(async function() {
        await createTempRepo.bind(this)();
        await createTempDeployment.bind(this)();
        await utils.exec('tsc', {cwd: path.resolve(__dirname, '..')});
    });

    afterEach(function() {
        this.repo_cleanup();
        this.deployment_cleanup();
    });

    it("heartbeat", async function () {
        let commits = new commiterator (this.repo_path,
            ["initial commit", { 'package.json': package_json,
                                 'index.js': time_waster_js }]
        );
        let first_commit_id = await commits.next();
        await check_files(this.repo_path, 'package.json', 'index.js');

        // pull changes into deployment.
        await utils.exec('git pull --all', {cwd: this.deploy_repo_path});

        // have to start this here since we don't have the "production commit",
        // till we've setup the repository.
        await start_proxy_process('lazycloud - proxy', this.deployment_path,
                                  3000, 'lazycloud.test', first_commit_id);
        await test_ws_deploy(first_commit_id, async function () {
            // check code exists
            await check_files(path.resolve(this.deployment_path, 'commits', first_commit_id),
                              'package.json', 'index.js');

            // ...and process is running.
            await check_processes(first_commit_id);

            // send multiple requests to  the server
            for (let x = 0; x < 5; x++) {
                console.log("sending: " + x);
                request("http://lazycloud.test:3000", function (error, response, body) {
                    console.log(`response ${x} - ${body}`);
                });
            }


        }.bind(this));
    });
});

