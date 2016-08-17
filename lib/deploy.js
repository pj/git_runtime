/**
  * @file Deployment related functions
  */
var git = require("nodegit"),
    _ = require("underscore"),
    path = require("path"),
    fs = require("q-io/fs"),
    fse = require("fs-extra"),
    fsn = require("fs"),
    q = require("q"),
    jsonfile = require("jsonfile"),
    utils = require("./utils"),
    mkdirp = Q.nfbind(fse.mkdirp);

var readJSON = q.denodeify(jsonfile.readFile);

function execIf(pred, command) {
    return pred ? utils.exec(command) : q({});
}

// standard deploy steps
function standard_deploy(path) {
    process.chdir(path);

    // open package.json so we can check whether if the pre and post deploy
    // scripts exist.
    return readJson("package.json")
        .then(function (json) {
            // run predeploy
            return execIf(json['scripts'] && json['scripts']['lazy_cloud:predeploy'],
                            "npm run-script lazy_cloud:predeploy")
                    // run nix
                    //.then(_ => fs.stat("default.nix")
                            //.then(_ => utils.exec("nix-shell ."))
                            //.fail(_ => q({})))
                    // run npm init
                    .then(_ => utils.exec("npm init"))
                    // run postdeploy
                    .then(_ => execIf(json['scripts'] && json['scripts']['lazy_cloud:postdeploy'],
                                "npm run-script lazy_cloud:postdeploy");
        } );
}

//function delete_untracked(repo) {
    //var statusOpts = git.StatusOptions();
    //statusOpts.show = git.Status.SHOW.INDEX_AND_WORKDIR;
    //statusOpts.flags = git.Status.OPT.INCLUDE_UNTRACKED;
    //return git.StatusList.create(repo, opts))
        //.then(function (statusList) {
            //var paths = statusList.map(status => status.indexToWorkdir.newFile.path());
            //return q.all(paths.map(path => fs.unlink(path)));
        //});

//}

//function deploy(deploy_path, treeish) {
    //var source_repo_path = path.resolve(deploy_path, repo_path);
    //var clone_path = path.resolve(deploy_path, "commits", treeish);

    //return fs.stat(clone_path)
        //// if clone already exists then clean and fast forward.
        //.then(result =>{
            //if (result.isDirectory()) {
                //git.Repository.open(clone_path)
                    //.then(function (repo){
                        //// reset repo
                        //return git.Reset.reset(repo, "HEAD", git.Reset.TYPE.HARD)
                            //// clean repo
                            //.then(_ => delete_untracked(repo));
                            //// checkout head
                            //.then(_ => repo.fetchAll({}));
                            ////.then(_ => repo.mergeBranches("master", "origin/master");)
                            //.then(_ => standard_deploy());
                    //})

            //} else {
                //throw new Error("Clone path " + clone_path + " is not a directory");
            //}
        //})
        //// clone repo since it doesn't exist.
        //.fail((err) => {
            //return git.Clone(source_repo_path, clone_path)
                //.then(repository => git.Checkout(repository, treeish))
                //.then(_ => standard_deploy()));
        //});
//}

function deploy(deploy_path, treeish) {
    var source_repo_path = path.resolve(deploy_path, repo_path);
    var clone_path = path.resolve(deploy_path, "commits", treeish);

    return fs.stat(clone_path)
        // if clone already exists then clean and fast forward.
        .then(result =>{
            if (result.isDirectory()) {
                // reset repo
                return exec("git reset --hard")
                    // clean repo
                    .then(_ => exec("git clean -dfX"))
                    // pull all changes
                    .then(_ => exec("git pull"))
                    // set checkout commit to treeish
                    .then(_ => exec("git checkout " + treeish))
                    // standard deploy
                    .then(_ => standard_deploy());
            } else {
                throw new Error("Clone path " + clone_path + " is not a directory");
            }
        })
        // clone repo since it doesn't exist.
        .fail((err) => {
            return exec("git clone " + source_repo_path + " " + clone_path)
                    // set checkout commit to treeish
                    .then(_ => exec("git checkout " + treeish))
                    // standard deploy
                    .then(_ => standard_deploy()));
        });
}
module.exports = {
    deploy: deploy
}
