const fs=require("fs")
require('child_process').exec("wc -l puzzle_games.txt", (error, stdout, stderr)=>{
    const games = stdout.split(" ")[0]
    const template = fs.readFileSync("templates/nunjucks.html").toString()
    const m = template.match(/Last updated [^\.]+\. Contains [0-9]+ [^\.]+\./)[0]
    const r = `Last updated ${new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}. Contains ${games} puzzle games.`
    const newTemplate = template.replace(m, r)
    fs.writeFileSync("templates/nunjucks_updated.html", newTemplate)
})