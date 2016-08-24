#!/usr/bin/env node --harmony
/// <reference path="../typings/index.d.ts" />
/// <reference path="../typings/auto.d.ts" />
/// <reference path="manual.d.ts" />
/**
  * @file Script to start the lazy cloud proxy process that receives requests and routes
  * them to the correct commit id process.
  */
import program = require('./commands');

program.parse(process.argv);
