var chai = require("chai");
chai.should();
var assert = chai.assert;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var q = require("q");
var ppm2 = require("../lib/ppm2");
var proxy = require('../lib/proxy');
var init = require('../lib/init');
var path = require('path');

var fse = require('../lib/fs-extra');

describe("Initialise and install new deployment.", function () {
    it("initialise a deployment with an empty directory", function () {
        var test_path = path.resolve(__dirname,
                "lazy_cloud_deployment_test");
        var test_repo_path = "/Users/pauljohnson/Programming/git_runtime/lazy_cloud_test_repo";
        process.chdir(test_path);
        // delete existing path.
        return fse.emptyDir(test_path)
            .then(_ => init.init_deployment(test_repo_path))
            .then(_ => fs.stat(path.resolve(test_path, 'lazycloud.json')))
            .then(stat => stat.isFile().should.be(true));
    });
});

//describe("Deploy and update commits.", function () {
    //// Create test environmentrepository.mergeBranches("master", "origin/master");
    //before(function () {
        //var test_path = path.resolve(__dirname,
                //"../../lazy_cloud_deployment_test");
        //var lazy_cloud_test_config = path.resolve(__dirname,
                //"lazycloud.json");
        //// delete existing path.
        //return fse.emptyDir(test_path)
                    //.then(_ => fse.copy(lazy_cloud_test_config, test_path));
    //});

    //it("deploy basic checkout", function () {

    //});
//});

//function check_ppm2_has_process_name(name){
    //return ppm2.connect()
        //.then((_) => ppm2.list())
        //.then((list) => {
            //list.should.have.length(1);
            //var found = list.filter((proc) =>
                    //proc.name.indexOf(name) != -1);
            //found.should.have.length(1);
            //return q({});
        //});
//}

//function check_ppm2_has_no_processes(){
    //return ppm2.connect()
        //.then((_) => ppm2.list())
        //.then((list) => {
            //list.should.have.length(0);
            //return q({});
        //});
//}

//function check_admin_response() {
    //return wait_for_response('http://localhost:5555/lazy_cloud_admin')
            //.then(function (_) {
                //return supertest('http://localhost:5555')
                    //.get('/lazy_cloud_admin')
                    //.expect('Hello from the lazy cloud server admin!\nPort: 5555\nHostname: localhost\n')
                    //.toPromise()
            //});
//}

/**
  * Tests the functions that interact with pm2 to start the proxy process, sort
  * of a full integration test.
  */
//it('pm2 should start, restart and stop the proxy process', function () {
    //before(function (){
        //return ppm2.connect()
            //.then(_ => ppm2.killDaemon())
            //.then(_ => ppm2.disconnect())
            //.then(_ => killall('node', 'start_server'));
    //});

    //var test_name = "lazycloud - testing 123!";

    //return ppm2.connect()
        //.then(_ => proxy.start_proxy_process(test_name, 5555, 8080, 'localhost'))
        //.then(_ => check_ppm2_has_process_name(test_name))
        //.then(_ => check_admin_response())
        //.then(_ => proxy.restart_proxy_process(test_name, 5555, 8080, 'localhost'))
        //.then(_ => check_ppm2_has_process_name(test_name))
        //.then(_ => check_admin_response())
        //.then(_ => proxy.stop_proxy_process(test_name))
        //.then(_ => check_ppm2_has_no_processes())
        //.then(_ => ppm2.disconnect());
//});

/**
  * Tests that the server process starts properly by starting the server
  * directly.
  */

//// TODO: find a place for helper functions.
//var lookup = q.denodeify(ps.lookup);
//var kill = q.denodeify(ps.kill);

//function killall(command, args) {
    //return lookup({ command: command, arguments: args})
        //.then(results => q.all(results.map(process => kill(process.pid))));
//}

//function execPromise(command){
    //var deferred = q.defer();
    //var proc = child_process.exec(command);

    //proc.stdout.on('data', (data) => {
        //deferred.resolve(data);
    //});

    //proc.stderr.on('data', (data) => {
        //deferred.reject(new Error("Got output on stderr: " + data));
    //});

    //proc.on('error', function(err) {
        //deferred.reject(err);
    //});

    ////proc.on('close', (code) => {
        ////deferred.reject(new Error("Process closed unexpectedly"));
    ////});

    //return deferred.promise;
//}

//describe('Starting lazy cloud server process', function () {
    //before(function () {
        //return killall('node', 'start_server');
    //});

    ////after(function () {
        ////killall('node', 'start_server');
    ////});

    //it('should start the lazy cloud server process', function () {
        //return execPromise(
                //'node ' + path.resolve(__dirname, '..', 'lib', 'start_server.js') + ' 5555 8080 localhost',
                //{})
                //.then(function (data) {
                    //return check_admin_response();
                //});
    //});
//});

