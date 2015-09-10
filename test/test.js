var chai = require("chai");
chai.should();
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var path = require("path");
var fs = require("q-io/fs");
var structure = require("../lib/structure");

var test_repo_path = "/Users/pauljohnson/Programming/test_repos/repo1"

describe('Test splitting', function() {
    it('should split the given path into repo and code path', function() {
        var response = structure.find_repo_path(
                path.join(test_repo_path, "lib"));

        return response.should.eventually.deep.equal([test_repo_path, "lib"]);
    });
});

describe('Test adding commit to structure', function() {
    beforeEach(function() {
        return fs.exists(path.join(test_repo_path, ".gitruntime"), function(){
            if (exists) {
                return fs.unlink(path.join(test_repo_path, ".gitruntime"));
            }
        });
    });

    describe('Add commit', function() {
        //it('should add commit by branch', function() {
            //var response = structure.add_commit("other",
                               //path.join(test_repo_path, "lib"));

            //response.should.be.fullfilled();

        //});

        //it('should add commit by HEAD reference', function() {
            //assert.fail();
        //});

        //it('should add commit by id', function() {
            //assert.fail();
        //});

        //it('should return error on invalid id', function() {
            //assert.fail();
        //});
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

describe('Test CLI', function() {
    before(function() {
    });

    beforeEach(function() {
    });

    afterEach(function() {
    });

    after(function() {
    });

    function runRuntime(command, args, env, result, status){
        var run_result = child_process.spawnSync(command, args, env);

        // console.log(run_result);
        expect(run_result.status).to.equal(status);
        expect(run_result.output[1].toString()).to.equal(result)
    }

    describe('Add commit', function() {
        it('should add commit by branch', function() {
            runRuntime("../../bin/git_runtime", ["add", "other", "lib"],
                       {cwd: "test/repo1"}, "", 0);
            runRuntime("node", ["main.js"], {GIT_RUNTIME: "other",
                        cwd: "test/repo1"},
                       "This is the first commit on the other branch!", 0);
            runRuntime("node", ["main.js"], {GIT_RUNTIME: "occ4e9de",
                       cwd: "test/repo1"},
                       "This is the first commit on the other branch!", 0);
        });

        it('should add commit by HEAD reference', function() {
            runRuntime("../../bin/git_runtime", ["add", "^HEAD", "lib"],
                       {cwd: "test/repo1"}, "", 0);
            runRuntime("node", ["main.js"], {GIT_RUNTIME: "other",
                       cwd: "test/repo1"}, "This is the second commit!", 0);
        });

        it('should add commit by id', function() {
            runRuntime("../../bin/git_runtime", ["add", "d496d8f", "lib"],
                       {cwd: "test/repo1"}, "", 0);
            runRuntime("node", ["main.js"], {GIT_RUNTIME: "d496d8f",
                       cwd: "test/repo1"}, "This is the first commit!", 0);
        });

        it('should return error on invalid id', function() {
            runRuntime("../../bin/git_runtime", ["add", "asdf", "lib"],
                    {cwd: "test/repo1"}, "Invalid commit or branch.", 1);
        });
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
