var git = require("nodegit");
var _ = require("underscore");
var path = require("path");
var fs = require("q-io/fs");
var fse = require("fs-extra");
var Q = require("q");
var mkdirp = Q.nfbind(fse.mkdirp);

function write_commit(tree, base_path, commit_id){
    var deferred = Q.defer();
    var walker = tree.walk();

    walker.on("entry", function(entry) {
        if(entry.isFile()) {
            var file_path = entry.path();
            var output_path = path.join(base_path, file_path);
            entry.getBlob()
                .then((blob) =>
                    mkdirp(base_path)
                    .then((_) => fs.open(output_path, 'w'))
                    .then((fd) => fs.write(fd, blob.toString()))
                 )
                 .catch((error) => deferred.reject(error));
        }
    });

    walker.on("end", function(trees){
        deferred.resolve(commit_id);
    });

    walker.start();
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
    } else if (split[0] == "..") {
        _find_repo_path("..", split.slice(1))
    } else {
        _find_repo_path("", split);
    }

    return deferred.promise;
}

function add_commit(treeish, input_path, runtime_directory) {
    var runtime_directory = runtime_directory || ".gitruntime";
    // Find git directory and split on it
    return find_repo_path(input_path).then(function(paths) {
        var repo_path = paths[0];
        var code_path = paths[1];
        return git.Repository.open(repo_path)
            .then((repo) => repo.getReferenceCommit(treeish))
            .then((commit) => {
                var commit_id = commit.id().tostrS();
                var base_path = path.join(repo_path, runtime_directory,
                                          commit_id);
                return commit.getEntry(code_path)
                    .then((entry) => entry.getTree())
                    .then((tree) => write_commit(tree, base_path, commit_id));
            });
    });
}

module.exports.add_commit = add_commit;
module.exports.find_repo_path = find_repo_path;
