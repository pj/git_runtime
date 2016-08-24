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

async function temp_deployment(test_deployment_callback) {
    await ppm2.connect();
    await ppm2.killDaemon();

    let [repo_path, repo_cleanup] = await utils.tmp.dirAsync({unsafeCleanup: true});
    process.chdir(repo_path);
    await utils.exec("git init");
    await check_directory(path.resolve(repo_path, '.git'));

    let [deployment_path, deployment_cleanup] = await utils.tmp.dirAsync({unsafeCleanup: true});
    process.chdir(deployment_path);
    await init.init_deployment(repo_path);

    await test_deployment_callback(repo_path, deployment_path);

    repo_cleanup();
    deployment_cleanup();
}

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

async function execIn(tmp_deploy_path, command) {
    process.chdir(tmp_deploy_path);

    let result = await utils.exec(command);

    return result;
}

function test_deploy_emitter(deployment_path, treeish, tests) {
    return new Promise(function (resolve, reject) {
        // deploy basic branch.
        let emitter = deploy.deploy(deployment_path, treeish);

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
    it("deploy master", function () {
        return temp_deployment(async function (repo_path, deployment_path) {
            let deploy_repo_path = path.resolve(deployment_path, 'repo');
            let commits = new commiterator (repo_path,
                ["initial commit", { 'package.json': package_json,
                                     'index.js': index_js }],
                ["another commit", { 'package.json': package_json.replace(
                    '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
            );

            await commits.next();
            await check_file(path.resolve(repo_path, 'package.json'));
            await check_file(path.resolve(repo_path, 'index.js'));

            // pull changes into deployment.
            await execIn(deploy_repo_path, 'git pull');

            await test_deploy_emitter(deployment_path, 'master', async function () {
                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(1);
                expect(processes[0].name).to.equal('lazycloud - master');
            });

            // write second commit
            let second_commit_id = await commits.next();
            await execIn(deploy_repo_path, 'git pull');

            // deploy changes.
            await test_deploy_emitter(deployment_path, 'master', async function () {
                // check commit id of deployed directory.
                let deployed_id = await execIn(deploy_repo_path, "git rev-parse HEAD");
                expect(second_commit_id).to.equal(deployed_id[0].trim());

                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'blah.blah'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(1);
                expect(processes[0].name).to.equal('lazycloud - master');
                expect(processes[0].pm2_env.env.LAZY_CLOUD_COMMIT_ID).to.equal('master');
            });
        });
    });

    it("deploy by commit id", function () {
        return temp_deployment(async function (repo_path, deployment_path) {
            let deploy_repo_path = path.resolve(deployment_path, 'repo');
            let commits = new commiterator (repo_path,
                ["initial commit", { 'package.json': package_json,
                                     'index.js': index_js }],
                ["another commit", { 'package.json': package_json.replace(
                    '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
            );

            let commit_id = await commits.next();
            await check_file(path.resolve(repo_path, 'package.json'));
            await check_file(path.resolve(repo_path, 'index.js'));

            // pull changes into deployment.
            await execIn(deploy_repo_path, 'git pull');

            await test_deploy_emitter(deployment_path, commit_id, async function () {
                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', commit_id, 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', commit_id, 'index.js'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(1);
                expect(processes[0].name).to.equal('lazycloud - ' + commit_id);
            });

            // write second commit
            let second_commit_id = await commits.next();
            await execIn(deploy_repo_path, 'git pull');

            // deploy changes.
            await test_deploy_emitter(deployment_path, second_commit_id, async function () {
                // check commit id of deployed directory.
                let deployed_id = await execIn(deploy_repo_path, "git rev-parse HEAD");
                expect(second_commit_id).to.equal(deployed_id[0].trim());

                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', second_commit_id, 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', second_commit_id, 'index.js'));
                await check_file(path.resolve(deployment_path, 'commits', second_commit_id, 'blah.blah'));

                await check_file(path.resolve(deployment_path, 'commits', commit_id, 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', commit_id, 'index.js'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(2);
                for (let process of processes) {
                    expect(process.name).to.be.oneOf(['lazycloud - ' + commit_id,
                                                      'lazycloud - ' + second_commit_id]);
                    expect(process.pm2_env.env.LAZY_CLOUD_COMMIT_ID).to.be.oneOf([
                        commit_id,
                        second_commit_id
                    ]);
                }
            });
        });
    });

    it("deploy, not running, but checked out", function () {
        return temp_deployment(async function (repo_path, deployment_path) {
            let deploy_repo_path = path.resolve(deployment_path, 'repo');
            let commits = new commiterator (repo_path,
                ["initial commit", { 'package.json': package_json,
                                     'index.js': index_js }],
                ["another commit", { 'package.json': package_json.replace(
                    '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
            );

            await commits.next();
            await check_file(path.resolve(repo_path, 'package.json'));
            await check_file(path.resolve(repo_path, 'index.js'));

            // pull changes into deployment.
            await execIn(deploy_repo_path, 'git pull');

            await test_deploy_emitter(deployment_path, 'master', async function () {
                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(1);
                expect(processes[0].name).to.equal('lazycloud - master');
            });

            // write second commit
            let second_commit_id = await commits.next();
            await execIn(deploy_repo_path, 'git pull');

            // stop all processes
            await ppm2.killDaemon();

            // deploy changes.
            await test_deploy_emitter(deployment_path, 'master', async function () {
                // check commit id of deployed directory.
                let deployed_id = await execIn(deploy_repo_path, "git rev-parse HEAD");
                expect(second_commit_id).to.equal(deployed_id[0].trim());

                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'blah.blah'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(1);
                expect(processes[0].name).to.equal('lazycloud - master');
                expect(processes[0].pm2_env.env.LAZY_CLOUD_COMMIT_ID).to.equal('master');
            });
        });
    });

    it("deploy branch and commit", function () {
        return temp_deployment(async function (repo_path, deployment_path) {
            let deploy_repo_path = path.resolve(deployment_path, 'repo');
            let master_commits = new commiterator (repo_path,
                ["initial commit", { 'package.json': package_json,
                                     'index.js': index_js }]
            );
            let commit_id = await master_commits.next();

            // pull changes into deployment.
            await execIn(deploy_repo_path, 'git pull --all');

            await test_deploy_emitter(deployment_path, 'master', async function () {
                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(1);
                expect(processes[0].name).to.equal('lazycloud - master');
            });

            // deploy changes.
            await test_deploy_emitter(deployment_path, commit_id, async function () {
                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));

                await check_file(path.resolve(deployment_path, 'commits', commit_id, 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', commit_id, 'index.js'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(2);
                for (let process of processes) {
                    expect(process.name).to.be.oneOf(['lazycloud - master',
                                                      'lazycloud - ' + commit_id]);
                    expect(process.pm2_env.env.LAZY_CLOUD_COMMIT_ID).to.be.oneOf([
                        'master',
                        commit_id
                    ]);
                }
            });
        });
    });

    it("deploy multiple branches", function () {
        return temp_deployment(async function (repo_path, deployment_path) {
            let deploy_repo_path = path.resolve(deployment_path, 'repo');
            let master_commits = new commiterator (repo_path,
                ["initial commit", { 'package.json': package_json,
                                     'index.js': index_js }],
                ["another commit", { 'package.json': package_json.replace(
                    '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
            );

            let branch_commits = new commiterator (repo_path,
                ["branch commit", { 'index.js': index_js.replace(
                    'Hello world!', 'Goodbye Cruel World!')}]
            );

            let master_1_commit_id = await master_commits.next();
            let master_2_commit_id = await master_commits.next();

            await execIn(repo_path, 'git checkout -b branch');
            let branch_commit_id = await branch_commits.next();

            // pull changes into deployment.
            await execIn(deploy_repo_path, 'git pull --all');

            await test_deploy_emitter(deployment_path, 'master', async function () {
                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'blah.blah'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(1);
                expect(processes[0].name).to.equal('lazycloud - master');
            });

            // deploy changes.
            await test_deploy_emitter(deployment_path, 'branch', async function () {
                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'blah.blah'));

                await check_file(path.resolve(deployment_path, 'commits', 'branch', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'branch', 'index.js'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(2);
                for (let process of processes) {
                    expect(process.name).to.be.oneOf(['lazycloud - master',
                                                      'lazycloud - branch']);
                    expect(process.pm2_env.env.LAZY_CLOUD_COMMIT_ID).to.be.oneOf([
                        'master',
                        'branch'
                    ]);
                }
            });
        });
    });
});

var server = require('../lib/processes.js');

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
    it("deploy master with web sockets", function () {
        return temp_deployment(async function (repo_path, deployment_path) {
            let deploy_repo_path = path.resolve(deployment_path, 'repo');
            let lc_server = await server.start_lazycloud_server(deployment_path,
                                                                3000, 4000, 'localhost');
            let commits = new commiterator (repo_path,
                ["initial commit", { 'package.json': package_json,
                                     'index.js': index_js }],
                ["another commit", { 'package.json': package_json.replace(
                    '"scripts": {}', `"scripts": {\n"lazy_cloud:postdeploy": "touch blah.blah"\n    }`)}]
            );

            await commits.next();
            await check_file(path.resolve(repo_path, 'package.json'));
            await check_file(path.resolve(repo_path, 'index.js'));

            // pull changes into deployment.
            await execIn(deploy_repo_path, 'git pull --all');

            await test_ws_deploy('master', async function () {
                // check code exists
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'package.json'));
                await check_file(path.resolve(deployment_path, 'commits', 'master', 'index.js'));

                // ...and process is running.
                await ppm2.connect();
                let processes = await ppm2.list();
                expect(processes).to.have.lengthOf(1);
                expect(processes[0].name).to.equal('lazycloud - master');
            });

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
});
