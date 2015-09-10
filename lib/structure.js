var git = require("nodegit");
var _ = require("underscore");
var path = require("path");
var fs = require("q-io/fs");
var fse = require("fs-extra");
var Q = require("q");

function write_commit(tree, base_path){
    var deferred = Q.defer();
    var walker = tree.walk();
    walker.on("entry", function(entry) {
        if(entry.isFile()) {
            var file_path = entry.path();
            var dir_path = path.dirname(file_path);
            var output_path = path.join(base_path, file_path);
            Q.nfcall(fse.mkdirp, dir_path)
                .then((result) => entry.getBlob())
                .then((blob) => {
                    fs.openAsync(output_path, 'w')
                        .then((fd) => fs.writeAsync(fd, blob.toString()))
                 })
                 .catch((error) => deferred.reject(error));
        }
    });

    walker.on("end", function(trees){
        deferred.resolve();
    });

    return deferred.promise;
}

// Returns promise returning a split between the
function find_repo_path(input_path) {
    var deferred = Q.defer();
    var split = input_path.split(path.sep);

    function _find_repo_path(start_path, rest_path) {
        var git_path = path.join(start_path, ".git");
        fs.exists(git_path)
            .then((exists) => {
                if (exists) {
                    var code_path = path.join.apply(null, rest_path);
                    deferred.resolve([start_path, code_path]);
                } else if (rest_path.length > 0) {
                    var next_start_segment = rest_path[0];
                    var next_start_path = path.join(start_path,
                            next_start_segment);
                    _find_repo_path(next_start_path, rest_path.slice(1));
                } else {
                    deferred.reject("Git directory not found");
                }
            });
    }

    if (split[0] === "") {
        _find_repo_path("/", split);
    } else {
        _find_repo_path("", split);
    }

    return deferred.promise;
}

function add_commit(treeish, input_path, runtime_directory) {
    var runtime_directory = runtime_directory || ".gitruntime";
    // Find git directory and split on it
    return _find_repo_path(input_path).then(function(paths) {
        var repo_path, code_path = paths;

        git.Repository.open(repo_path)
            .then((repo) => repo.getReferenceCommit(treeish))
            .then((commit) => {
                var base_path = path.join(repo_path, runtime_directory,
                                      commit.id().tostrS());
                commit.getEntry(code_path)
                    .then((entry) => entry.getTree())
                    .then((tree) => write_commit(tree, base_path));
            });
    });
}

module.exports.add_commit = add_commit;
module.exports.find_repo_path = find_repo_path;
