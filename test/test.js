var chai = require("chai");
chai.should();
var assert = chai.assert;
var chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);

var fs = require("q-io/fs");
var fss = require("fs");
var git = require("nodegit");
var q = require("q");
var pm2 = require("pm2");
var supertest = require("supertest");
var path = require("path");

var ppm2 = require("../lib/ppm2");
var jsonfile = require("jsonfile");
var structure = require("../lib/structure");
var proxy = require("../lib/proxy");
var wait_for_response = require("../lib/site_wait.js");

var TEST_REPO_PATH = "/Users/pauljohnson/Programming/test_git_runtime"

function deleteRuntimePath() {
    return fs.exists(path.join(TEST_REPO_PATH, ".gitruntime"))
        .then(function(exists){
            if (exists) {
                return fs.removeTree(
                        path.join(TEST_REPO_PATH, ".gitruntime"));
            }
        });
}

describe('Individual commits', function() {
    beforeEach(deleteRuntimePath);

    function response_success(response) {
        return response.then(
                (commit_id) => {
                    var lib_path = path.join(TEST_REPO_PATH, ".gitruntime",
                            commit_id, "lib", "lib.js");
                    return fs.exists(lib_path);
                }
                ).should.eventually.become(true);
    }

    function response_failed(response) {
        return response.should.be.rejected;
    }

    it('should add commit by branch', function() {
        var response = structure.add_commit(TEST_REPO_PATH, "other");
        return response_success(response);
    });

    it('should add commit by id', function() {
        var response = structure.add_commit(TEST_REPO_PATH,
                "880216c65b245f45215b7c4d5a97d50f");
        return response_success(response);
    });

    it('should return error on invalid id', function() {
        var response = structure.add_commit(TEST_REPO_PATH,
                "asdf");
        return response_failed(response)
    });
});

var TEST_PROCESS_DEF_PATH =
    "/Users/pauljohnson/Programming/test_git_runtime_server/processes.json";
var TEST_PROCESS_DEF = jsonfile.readFileSync(TEST_PROCESS_DEF_PATH);
var TEST_COMMIT_ID = 'd598f3db62ceed20a3d122778507c479beedf6a6';

describe('test pm2', function() {
    before(function start_regular_pm2(){
        return ppm2.connect()
            .then((_) => ppm2.killDaemon())
            .then((result) => ppm2.connect())
            .then((_) => ppm2.start(TEST_PROCESS_DEF));
    });

    after(function stop_pm2(){
        return ppm2.killDaemon()
    });

    it('create process for commit', function(done) {
        function check_list(){
            return ppm2.list()
                .then((list) =>{
                    list.should.have.length(2);
                    var found = list.filter((proc) =>
                            proc.name.indexOf(TEST_COMMIT_ID) != -1);
                    found.should.have.length(1);
                    return q({});
                });
        }

        proxy.create_process(TEST_COMMIT_ID, TEST_PROCESS_DEF)
            .then(check_list)
            .then((_) => proxy.create_process(TEST_COMMIT_ID,
                        TEST_PROCESS_DEF))
            .then(check_list)
            .then((_) => done())
            .fail((err) => done(err));
    });
});

var TEST_PROXY_DEF_FILE = "./processes.json"
var TEST_PROXY_DEF = jsonfile.readFileSync(TEST_PROXY_DEF_FILE);

describe('test proxy server', function() {
    this.timeout(5000);
    before(function start_proxy(){
        return ppm2.connect()
            .then((_) => ppm2.killDaemon())
            .then((result) => ppm2.connect())
            .then((_) => proxy.start_proxy_process(TEST_PROXY_DEF))
            .then((_) => ppm2.start(TEST_PROCESS_DEF))
            .then((_) => wait_for_response('http://localhost:3000'))
            .then((_) => wait_for_response('http://localhost:4000'));
    });

    after(function stop_proxy(){
        return ppm2.killDaemon();
    });

    var req = supertest('http://localhost:4000')
    it('return master when no commit id passed', function(done) {
        req
            .get('/')
            .expect('Called from master', done);
    });

    it('return other when commit id passed', function(done) {
        req
            .get('/')
            .set('x-git-commit-id', TEST_COMMIT_ID)
            .expect(function (res) {
                var repo_path = path.dirname(TEST_PROCESS_DEF_PATH);
                var commit_path = path.join(repo_path, ".gitruntime",
                                            TEST_COMMIT_ID);
                fss.statSync(commit_path).should.be.ok;
            })
            .expect('Called from other', done);
    });
});
