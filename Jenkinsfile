pipeline {
    agent any
    triggers { githubPush() }

    environment {
        APP_NAME = "frontend"
        HOST_PORT = 3000
        IMAGE_TAG = "ecosystem-frontend:latest"
        NETWORK   = "ecosystem_default"
        NEXT_PUBLIC_APP_BACKEND_URL = "http://localhost:8000"
        NEXT_PUBLIC_AI_BACKEND_URL  = "http://localhost:8082"
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

        stage('Prepare .env') {
            steps {
                script {
                    echo "📄 Creating .env file at project root..."
                    writeFile file: '.env', text: """
                        NEXT_PUBLIC_APP_BACKEND_URL=${env.NEXT_PUBLIC_APP_BACKEND_URL}
                        NEXT_PUBLIC_AI_BACKEND_URL=${env.NEXT_PUBLIC_AI_BACKEND_URL}
                    """
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                echo "🚀 Building Docker image..."
                sh "docker build -t ${IMAGE_TAG} ."
            }
        }

        stage('Deploy New Instance for Health Check') {
            steps {
                script {
                    echo "🧱 Running new container on random port for health check..."
                    // Remove any temp container
                    sh "docker rm -f ${APP_NAME}-temp || true"

                    // Run on random host port (Docker assigns automatically)
                    def tempPort = sh(
                        script: "docker run -d -P --name ${APP_NAME}-temp --network ${NETWORK} ${IMAGE_TAG}",
                        returnStdout: true
                    ).trim()

                    // Get dynamically assigned host port
                    def hostPort = sh(
                        script: "docker port ${APP_NAME}-temp 3000 | cut -d':' -f2",
                        returnStdout: true
                    ).trim()

                    env.NEW_HOST_PORT = hostPort
                    echo "🧪 Temp container running on host port ${hostPort}"
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
                            script: "curl -s -o /dev/null -w \"%{http_code}\" http://localhost:${env.NEW_HOST_PORT}/api/health || echo '000'",
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
                        sh "docker rm -f ${APP_NAME}-temp || true"
                        error "❌ Deployment failed: new container did not respond correctly"
                    }
                }
            }
        }

        stage('Switch Traffic to Host Port 3000') {
            steps {
                script {
                    echo "🔄 Switching traffic to new container..."
                    // Stop old live container if exists
                    sh "docker rm -f ${APP_NAME}-live || true"

                    // Stop temp container and start new container on HOST_PORT
                    sh """
                        docker stop ${APP_NAME}-temp || true
                        docker rm ${APP_NAME}-temp || true
                        docker run -d --name ${APP_NAME}-live --network ${NETWORK} -p ${HOST_PORT}:3000 ${IMAGE_TAG}
                    """
                    echo "✅ Traffic switched: host port ${HOST_PORT} points to new live container"
                }
            }
        }

        stage('Cleanup') {
            steps {
                echo "🧹 Deployment complete. Cleaning up old images..."
                sh "docker image prune -f"
            }
        }
    }

    post {
        failure {
            echo "❌ Deployment failed. Live container remains running if any."
        }
    }
}
