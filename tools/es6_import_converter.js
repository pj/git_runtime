var fs = require('fs');
var glob = require('glob-fs')({ gitignore: true });
var files = glob.readdirSync('src/*.ts');

for (var i in files) {
    var file = files[i];

    console.log(file);
    var contents = fs.readFileSync(file, {encoding: 'ascii'});

    fs.writeFileSync(file, contents.replace(/(var )?\s*(.+?)\s*=\s*require\(("|')(.+?)("|')\)(,|;)/g, "import $2 from '$4';\n"));
}
