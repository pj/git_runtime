var git = require("nodegit");
var _ = require("underscore");
var path = require("path");
var fs = require("q-io/fs");
var fse = require("fs-extra");
var Q = require("q");
var mkdirp = Q.nfbind(fse.mkdirp);

function write_commit(tree, base_path){
    var deferred = Q.defer();
    var walker = tree.walk(true);
    var promises = [];
    walker.on("entry", function(entry) {
        var file_path = entry.path();
        var output_path = path.join(base_path, file_path);
        var dir_path = path.dirname(output_path);
        var file_p = mkdirp(dir_path)
            .then((_) => entry.getBlob())
            .then((blob) => fs.write(output_path, blob.content()));
        promises.push(file_p);
    });

    walker.on("end", function(trees){
        Q.all(promises)
         .then((results) => {
            deferred.resolve(path.basename(base_path));
         })
         .catch((error) => {
             return deferred.reject(error)});
    });

    walker.start();
    return deferred.promise;
}

//function lookup_commit(treeish, repo) {
    //return repo.getReferenceCommit(treeish)
        //.catch((error) => {
             //var oid = git.Oid.fromString(treeish);
             //return git.Commit.lookupPrefix(repo, oid, treeish.length);
         //});
//}

function add_commit(repo_path, treeish, runtime_directory) {
    var runtime_directory = runtime_directory || ".gitruntime";
    var repoP = git.Repository.open(repo_path)
    return repoP.then((repo) => {
        return git.Revparse.single(repo, treeish)
            .then((object) => git.Commit.lookup(repo, object.id()))
            .then((commit) => {
                var commit_id = commit.id().tostrS();
                var output_path = path.join(repo_path, runtime_directory, commit_id);
                return commit.getTree()
                    .then((tree) => write_commit(tree, output_path));
            });
    });
}

module.exports.add_commit = add_commit;
