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

server.listen(port, function (err) {
    if (err) {
            return console.log('something bad happened', err);
        }

    console.log("server is listening on " + port);
});`

async function check_directory(base_path, file) {
    let stat = await fs.stat(path.resolve(base_path, '.git'));
    expect(stat.isDirectory()).to.equal(true);
}

async function tmp_repo(branch, tmp_repo_callback) {
    let [tmp_repo_path, cleanupCallback] = await utils.tmp.dirAsync({unsafeCleanup: true});
    process.chdir(tmp_repo_path);
    await utils.exec("git init");
    await check_directory(tmp_repo_path, '.git');
    await utils.exec(`git checkout -b ${branch}`);
    await tmp_repo_callback(tmp_repo_path)
    cleanupCallback();
}

async function tmp_deployment(test_repo_path, post_deploy_callback) {
    let [tmp_deployment_path, cleanupCallback] = await utils.tmp.dirAsync({unsafeCleanup: true});
    process.chdir(tmp_deployment_path);
    await init.init_deployment(test_repo_path);
    await post_deploy_callback(tmp_deployment_path);
    cleanupCallback();
}

//describe("Initialise and install blank deployment.", function () {
    //it("initialise a deployment with an empty directory", async function () {
        //await test_in_tmp_deployment(async function (tmp_path) {
            //const stat = await fs.stat(path.resolve(tmp_path, 'lazycloud.json'));
            //expect(stat.isFile()).to.equal(true);
        //});
    //});
//});

async function write_commit(tmp_repo_path, commit) {
    process.chdir(tmp_repo_path);
    let [message, files] = commit;
    await Promise.all(Object.keys(files)
                        .map(path => fs.write(path, files[path])));
    // commit with message
    await utils.exec(`git add --all`);
    await utils.exec(`git commit -m "${message}"`);
    let commit_id = await utils.exec(`git rev-parse HEAD`);
    return commit_id;
}

function* commiterator(...commits){
    for (let commit of commits) {
        yield commit;
    }
}

async function execIn(tmp_deploy_path, command) {
    process.chdir(tmp_deploy_path);

    await utils.exec(command);
}

describe("Deploy, update and start commits.", function () {
    it("deploy basic checkout", function () {
        let commits = commiterator (
            ["initial commit", { 'package.json': package_json,
                                 'index.js': index_js }],
            ["another commit", { 'package.json': package_json.replace('"scripts": {}', `scripts: {\n'lazy_cloud:postdeploy': 'touch blah.blah'\n    }`)}]
        );
        return tmp_repo('master', function (tmp_repo_path) {
            return tmp_deployment(tmp_repo_path, async function (tmp_deploy_path) {
                let deploy_repo_path = path.resolve(tmp_deploy_path, 'repo');
                // write commit
                await write_commit(tmp_repo_path, commits.next().value);

                // pull changes into deployment.
                await execIn(deploy_repo_path, 'git pull');

                // deploy basic branch.
                await deploy.deploy();

                // check code exists
                await check_directory(path.resolve(tmp_deploy_path, 'commits', 'master'), 'package.json');

                // ...and process is running.

                // write second commit

                // deploy changes.

                // check changes made and process running
            });
        });
    });
});

//describe("Create and update a git repo", function () {
    //it("create and update a git repo", async function () {
        //let [tmp_path, cleanupCallback] = await utils.tmp.dirAsync({unsafeCleanup: true});
        //process.chdir(tmp_path);

        //await utils.exec("git init");
        //await check_directory(tmp_path, '.git');

        //let commits = commiterator (
            //["initial commit", { 'package.json': package_json,
                                 //'index.js': index_js }],
            //["another commit", { 'package.json': package_json.replace('"scripts": {}', `scripts: {\n'lazy_cloud:postdeploy': 'touch blah.blah'\n    }`)}]
        //)

        //await write_commit(commits.next().value);

        //await check_directory(tmp_path, 'package.json');
        //await check_directory(tmp_path, 'index.js');

        //await write_commit(commits.next().value);

        //await check_directory(tmp_path, 'blah.blah');

        //cleanupCallback();
    //});
//});
