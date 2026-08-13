build-no-cache:
	DC build --no-cache app

deploy:
	bash deploy/deploy.sh

backup: 
	./deploy/backup.sh

only-env:
	DC up -d --no-deps --force-recreate app