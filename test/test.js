/*
 * test.js
 * Copyright (C) 2015 pauljohnson <pauljohnson@Paul-Johnsons-MacBook-Pro.local>
 *
 * Distributed under terms of the MIT license.
 */

var expect = require('chai').expect;
var child_process = require('child_process');

console.log(process.cwd());

describe('Versioned file structure', function() {
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


