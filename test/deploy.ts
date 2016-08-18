/// <reference path="../typings/index.d.ts" />
console.log(process.version);
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

async function test_in_tmp_deployment(post_deploy_callback) {
    var test_repo_path = "/Users/pauljohnson/Programming/git_runtime/lazy_cloud_test_repo";
    let [tmp_path, cleanupCallback] = await utils.tmp.dirAsync({unsafeCleanup: true});
    process.chdir(tmp_path);
    await init.init_deployment(test_repo_path);
    await post_deploy_callback(tmp_path);
    cleanupCallback();
}

describe("Initialise and install blank deployment.", function () {
    it("initialise a deployment with an empty directory", async function () {
        await test_in_tmp_deployment(async function (tmp_path) {
            const stat = await fs.stat(path.resolve(tmp_path, 'lazycloud.json'));
            expect(stat.isFile()).to.equal(true);
        });
    });
});

describe("Deploy, update and start commits.", function () {
    it("deploy basic checkout", async function () {
        await test_in_tmp_deployment(async function (tmp_path) {
            await deploy.deploy(tmp_path, 'basic')
            const stat = await fs.stat(path.resolve(tmp_path, 'commits', 'basic', 'package.json'));
            expect(stat.isFile()).to.equal(true);
        });
    });
});
