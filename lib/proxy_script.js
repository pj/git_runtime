var jsonfile = require("jsonfile");
var proxy = require("./proxy.js");

var target = process.env.TARGET;
var target_port = process.env.TARGET_PORT;
var proxy_port = process.env.PROXY_PORT;
var process_def_file = process.env.PROCESS_DEF;
var process_def = jsonfile.readFileSync(process_def_file);

proxy.start_proxy(target, target_port, proxy_port, process_def);
