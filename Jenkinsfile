pipeline {
    agent any

    environment {
        DOCKER_IMAGE = "frontend-app"
        BLUE_CONTAINER = "frontend_blue"
        GREEN_CONTAINER = "frontend_green"
        GITHUB_PAT = credentials('github-pat')
    }

    triggers {
        githubPush() // trigger on push
    }

    stages {
        stage('Check Merge Commit') {
            steps {
                script {
                    def commitMsg = sh(script: "git log -1 --pretty=%B", returnStdout: true).trim()
                    if (!commitMsg.toLowerCase().contains("merge")) {
                        echo "No merge commit found. Skipping deployment."
                        currentBuild.result = 'SUCCESS'
                        return
                    }
                    echo "Merge commit detected. Proceeding with deployment."
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                dir('../Ecosystem') {
                    sh "docker build -t ${DOCKER_IMAGE}:latest ./frontend"
                }
            }
        }

        stage('Blue-Green Deployment') {
            steps {
                script {
                    def activeContainer = sh(script: "docker ps --filter 'name=${BLUE_CONTAINER}' --format '{{.Names}}'", returnStdout: true).trim()
                    def newContainer = activeContainer == BLUE_CONTAINER ? GREEN_CONTAINER : BLUE_CONTAINER

                    echo "Active container: ${activeContainer}"
                    echo "Deploying new container: ${newContainer}"

                    sh """
                        docker run -d --name ${newContainer} \
                          -p 3000:3000 \
                          -v $(pwd)/../Ecosystem/frontend:/usr/src/app \
                          ${DOCKER_IMAGE}:latest
                    """

                    sleep 10
                    def status = sh(script: "curl -s -o /dev/null -w '%{http_code}' http://localhost:3000", returnStdout: true).trim()
                    if (status != "200") {
                        error("Health check failed for ${newContainer}")
                    }

                    if (activeContainer) {
                        sh "docker stop ${activeContainer} && docker rm ${activeContainer}"
                    }

                    echo "✅ Deployment successful! ${newContainer} is now live."
                }
            }
        }
    }
}
