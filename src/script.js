// Requiring this file at the top of a script will cause a different version to
// be run if GIT_RUNTIME is set.
var kexec = require("kexec");
var structure = require("./structure.js");

if (process.env["GIT_RUNTIME"] && !process.env["IN_GIT_RUNTIME"]) {
    var repo_path = structure.find_repo_path();
    var commit_path = structure.add_commit(repo_path, process.env.GIT_RUNTIME);
    var executable_path = path.join(commit_path, process.argv[0]);
    var executable_args = process.argv.slice(1);

    process.env["IN_GIT_RUNTIME"] = "";
    kexec(executable_path, executable_args);
}
