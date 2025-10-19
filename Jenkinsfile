pipeline {
    agent any
    triggers {
        githubPush()
    }

    environment {
        APP_NAME = "frontend"
        LIVE_PORT = 3000
        NEW_PORT  = 3001
        IMAGE_TAG = "ecosystem-frontend:latest"
    }

    stages {
        stage('Log Commit') {
            steps {
                script {
                    def now = new Date().format("yyyy-MM-dd HH:mm:ss")
                    echo "✅ New commit received from GitHub at ${now}"
                    sh 'echo "✅ Commit received at ${now}" >> /var/jenkins_home/github_commit_log.txt'
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh "docker build -t ${IMAGE_TAG} ."
            }
        }

        stage('Deploy New Instance') {
            steps {
                script {
                    // Remove any previous new container if exists
                    sh "docker rm -f ${APP_NAME}-new || true"

                    // Run new container on NEW_PORT
                    sh "docker run -d --name ${APP_NAME}-new -p ${NEW_PORT}:3000 ${IMAGE_TAG}"
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    def retries = 5
                    def success = false
                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: "curl -s -o /dev/null -w \"%{http_code}\" http://localhost:${NEW_PORT}/api/health || echo '000'",
                            returnStdout: true
                        ).trim()
                        echo "Health check attempt ${i+1}: HTTP ${status}"
                        if (status == "200") {
                            success = true
                            break
                        }
                        sleep 5
                    }
                    if (!success) {
                        // Stop the new container if health check fails
                        sh "docker rm -f ${APP_NAME}-new || true"
                        error "Deployment failed: new container did not respond correctly"
                    } else {
                        echo "✅ Health check passed!"
                    }
                }
            }
        }

        stage('Switch Traffic') {
            steps {
                script {
                    // Stop old live container if exists
                    def liveContainerExists = sh(script: "docker ps -q -f name=${APP_NAME}-live", returnStdout: true).trim()
                    if (liveContainerExists) {
                        echo "Stopping old live container..."
                        sh "docker rm -f ${APP_NAME}-live"
                    } else {
                        echo "No old live container found. First deployment or previous container down."
                    }

                    // Rename new container to live
                    sh "docker rename ${APP_NAME}-new ${APP_NAME}-live"
                }
            }
        }

        stage('Cleanup') {
            steps {
                echo "✅ Deployment complete. Old container removed if any."
            }
        }
    }
}
