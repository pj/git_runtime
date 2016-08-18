//describe('Test CLI', function() {
    //beforeEach(deleteRuntimePath);

    //function runRuntime(command, args, env, result, status){
        //var run_result = child_process.spawnSync(command, args, env);

        //// console.log(run_result);
        //expect(run_result.status).to.equal(status);
        //expect(run_result.output[1].toString()).to.equal(result)
    //}

    //describe('Add commit', function() {
        //it('should add commit by branch', function() {
            //runRuntime("../../bin/git_runtime", ["add", "other", "lib"],
                       //{cwd: "test/repo1"}, "", 0);
            //runRuntime("node", ["main.js"], {GIT_RUNTIME: "other",
                        //cwd: "test/repo1"},
                       //"This is the first commit on the other branch!", 0);
            //runRuntime("node", ["main.js"], {GIT_RUNTIME: "occ4e9de",
                       //cwd: "test/repo1"},
                       //"This is the first commit on the other branch!", 0);
        //});

        //it('should add commit by HEAD reference', function() {
            //runRuntime("../../bin/git_runtime", ["add", "^HEAD", "lib"],
                       //{cwd: "test/repo1"}, "", 0);
            //runRuntime("node", ["main.js"], {GIT_RUNTIME: "other",
                       //cwd: "test/repo1"}, "This is the second commit!", 0);
        //});

        //it('should add commit by id', function() {
            //runRuntime("../../bin/git_runtime", ["add", "d496d8f", "lib"],
                       //{cwd: "test/repo1"}, "", 0);
            //runRuntime("node", ["main.js"], {GIT_RUNTIME: "d496d8f",
                       //cwd: "test/repo1"}, "This is the first commit!", 0);
        //});

        //it('should return error on invalid id', function() {
            //runRuntime("../../bin/git_runtime", ["add", "asdf", "lib"],
                    //{cwd: "test/repo1"}, "Invalid commit or branch.", 1);
        //});
    //});
////    describe('Delete commit', function() {
////        it('should delete a commit by id', function() {
////        });
////    });
////    describe('List commits', function() {
////        it('should list all installed commits', function() {
////        });
////    });
//});

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

