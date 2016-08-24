#!/usr/bin/env node --harmony
/// <reference path="../typings/index.d.ts" />
/**
  * @file Script to start the lazy cloud proxy process that receives requests and routes
  * them to the correct commit id process.
  */
var program = require('./commands');

program.parse(process.argv);
