. updatepage
mv templates/nunjucks_updated.html templates/nunjucks.html

rm repo.tar.gz
git add .
git commit -m "$*"
git push --set-upstream origin nunjucks

. archive.sh
git add repo.tar.gz
git commit -m "repo.tar.gz"
git push