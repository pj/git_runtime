var chai = require("chai");
chai.should();
var assert = chai.assert;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var path = require("path");
var fs = require("q-io/fs");
var fss = require("fs");
var git = require("nodegit");
var pm2 = require("pm2");
var jsonfile = require("jsonfile");
var structure = require("../lib/structure");
var proxy = require("../lib/proxy");

var test_repo_path = "/Users/pauljohnson/Programming/test_git_runtime"

function deleteRuntimePath() {
    return fs.exists(path.join(test_repo_path, ".gitruntime"))
             .then(function(exists){
                if (exists) {
                    return fs.removeTree(
                        path.join(test_repo_path, ".gitruntime"));
                }
             });
}

describe('Individual commits', function() {
    beforeEach(deleteRuntimePath);

    function response_success(response) {
        return response.then(
            (commit_id) => {
                var lib_path = path.join(test_repo_path, ".gitruntime",
                                commit_id, "lib", "lib.js");
                return fs.exists(lib_path);
            }
        ).should.eventually.become(true);
    }

    function response_failed(response) {
        return response.should.be.rejected;
    }

    it('should add commit by branch', function() {
        var response = structure.add_commit(test_repo_path, "other");
        return response_success(response);
    });

    it('should add commit by id', function() {
        var response = structure.add_commit(test_repo_path,
                         "880216c65b245f45215b7c4d5a97d50f");
        return response_success(response);
    });

    it('should return error on invalid id', function() {
        var response = structure.add_commit(test_repo_path,
                         "asdf");
        return response_failed(response)
    });
//    describe('Delete commit', function() {
//        it('should delete a commit by id', function() {
//        });
//    });
//    describe('List commits', function() {
//        it('should list all installed commits', function() {
//        });
//    });
});

var test_process_def_path = "/Users/pauljohnson/Programming/test_git_runtime_server/processes.json";
var test_process_def = jsonfile.readFileSync(test_process_def_path);

var TEST_COMMIT_ID = "7b74924e249a9bd43433310a35a6c548bb80572a";

describe('test pm2', function() {
    before(function start_regular_pm2(done){
        pm2.connect(function(err) {
            if (err) done(err);
            pm2.killDaemon(function(err, ret){
                pm2.connect(function(err) {
                    if (err) done(err);

                    pm2.start(
                        test_process_def,
                        function(err, apps) {
                            if (err) {
                                pm2.disconnect();
                                done(err);
                            }

                            done();
                        }
                    );
                });
            });
        });
    });

    after(function stop_pm2(done){
        pm2.disconnect(function(err, proc){
            if (err) done(err);

            done();
        });
    });

    it('list running processes', function(done) {
        pm2.connect(function(err) {
            if (err) done(err);

            pm2.list(function (err, list) {
                if (err) done(err);

                //console.log(list);
                done();
            });
        });
    });

    it('create process for commit', function(done) {
        function test_process_exists(err, apps) {
            pm2.list(function (err, list) {
                if (err) done(err);
                list.should.have.length(2);

                var found = list.filter((proc) =>
                        proc.name.indexOf(TEST_COMMIT_ID) != -1);

                found.should.have.length(1);
                done();
            });
        }

        proxy.find_create_commit_process(TEST_COMMIT_ID,
                test_process_def, test_process_exists);
    });

});

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
