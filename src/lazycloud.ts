#!/usr/bin/env node --harmony
/// <reference path="manual.d.ts" />
/**
  * @file Script to start the lazy cloud proxy process that receives requests and routes
  * them to the correct commit id process.
  */
import program from './commands';

program.parse(process.argv);
