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
