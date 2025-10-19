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
        NETWORK   = "ecosystem_default" // ✅ use same network as other containers
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
                echo "🚀 Building Docker image..."
                sh "docker build -t ${IMAGE_TAG} ."
            }
        }

        stage('Deploy New Instance') {
            steps {
                script {
                    echo "🧱 Deploying new container instance..."

                    // Remove any previous new container if it exists
                    sh "docker rm -f ${APP_NAME}-new || true"

                    // Run the new container on the same Docker network
                    sh """
                        docker run -d \
                        --name ${APP_NAME}-new \
                        --network ${NETWORK} \
                        -p ${NEW_PORT}:3000 \
                        ${IMAGE_TAG}
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    echo "🩺 Checking health of new instance..."
                    def retries = 5
                    def success = false

                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: "curl -s -o /dev/null -w \"%{http_code}\" http://${APP_NAME}-new:3000/api/health || echo '000'",
                            returnStdout: true
                        ).trim()

                        echo "Health check attempt ${i + 1}: HTTP ${status}"

                        if (status == "200") {
                            success = true
                            echo "✅ Health check passed!"
                            break
                        }

                        sleep 5
                    }

                    if (!success) {
                        sh "docker rm -f ${APP_NAME}-new || true"
                        error "❌ Deployment failed: new container did not respond correctly"
                    }
                }
            }
        }

        stage('Switch Traffic') {
            steps {
                script {
                    echo "🔄 Switching traffic to new container..."

                    // Stop old live container if it exists
                    def liveContainerExists = sh(
                        script: "docker ps -q -f name=${APP_NAME}-live",
                        returnStdout: true
                    ).trim()

                    if (liveContainerExists) {
                        echo "Stopping old live container..."
                        sh "docker rm -f ${APP_NAME}-live"
                    } else {
                        echo "No old live container found — first deployment or previous container down."
                    }

                    // Rename new container to live
                    sh "docker rename ${APP_NAME}-new ${APP_NAME}-live"
                    echo "✅ Switched traffic to new live container!"
                }
            }
        }

        stage('Cleanup') {
            steps {
                echo "🧹 Deployment complete. Old container cleaned up if any."
            }
        }
    }
}
