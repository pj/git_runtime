/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="../src/manual.d.ts" />
import * as chai from 'chai';
var assert = chai.assert;

import * as q from "q";
var ppm2 = require("../src/ppm2");
var proxy = require('../src/proxy');

var supertest = require('supertest-as-promised');
var child_process = require('child_process');
var child_process_promise = require('child-process-promise');
var path = require('path');
var ps = require('ps-node');
var wait_for_response = require('../src/site_wait');

chai.should();
function check_ppm2_has_process_name(name){
    return ppm2.connect()
        .then((_) => ppm2.list())
        .then((list) => {
            list.should.have.length(1);
            var found = list.filter((proc) =>
                    proc.name.indexOf(name) != -1);
            found.should.have.length(1);
            return q({});
        });
}

function check_ppm2_has_no_processes(){
    return ppm2.connect()
        .then((_) => ppm2.list())
        .then((list) => {
            list.should.have.length(0);
            return q({});
        });
}

function check_admin_response() {
    return wait_for_response('http://localhost:5555/lazy_cloud_admin')
            .then(function (_) {
                return supertest('http://localhost:5555')
                    .get('/lazy_cloud_admin')
                    .expect('Hello from the lazy cloud server admin!\nPort: 5555\nHostname: localhost\n')
                    .toPromise()
            });
}

/**
  * Tests the functions that interact with pm2 to start the proxy process, sort
  * of a full integration test.
  */
it('pm2 should start, restart and stop the proxy process', function () {
    before(function (){
        return ppm2.connect()
            .then(_ => ppm2.killDaemon())
            .then(_ => ppm2.disconnect())
            .then(_ => killall('node', 'start_server'));
    });

    var test_name = "lazycloud - testing 123!";

    return ppm2.connect()
        .then(_ => proxy.start_proxy_process(test_name, 5555, 8080, 'localhost'))
        .then(_ => check_ppm2_has_process_name(test_name))
        .then(_ => check_admin_response())
        .then(_ => proxy.restart_proxy_process(test_name, 5555, 8080, 'localhost'))
        .then(_ => check_ppm2_has_process_name(test_name))
        .then(_ => check_admin_response())
        .then(_ => proxy.stop_proxy_process(test_name))
        .then(_ => check_ppm2_has_no_processes())
        .then(_ => ppm2.disconnect());
});

/**
  * Tests that the server process starts properly by starting the server
  * directly.
  */

// TODO: find a place for helper functions.
var lookup = q.denodeify(ps.lookup);
var kill = q.denodeify(ps.kill);

function killall(command, args) {
    return lookup({ command: command, arguments: args})
        .then((results: any) => q.all(results.map(process => kill(process.pid))));
}

function execPromise(command){
    var deferred = q.defer();
    var proc = child_process.exec(command);

    proc.stdout.on('data', (data) => {
        deferred.resolve(data);
    });

    proc.stderr.on('data', (data) => {
        deferred.reject(new Error("Got output on stderr: " + data));
    });

    proc.on('error', function(err) {
        deferred.reject(err);
    });

    //proc.on('close', (code) => {
        //deferred.reject(new Error("Process closed unexpectedly"));
    //});

    return deferred.promise;
}

describe('Starting lazy cloud server process', function () {
    before(function () {
        return killall('node', 'start_server');
    });

    //after(function () {
        //killall('node', 'start_server');
    //});

    it('should start the lazy cloud server process', function () {
        return execPromise(
                'node ' + path.resolve(__dirname, '..', 'lib', 'start_server.js') + ' 5555 8080 localhost'
                )
                .then(function (data) {
                    return check_admin_response();
                });
    });
});

