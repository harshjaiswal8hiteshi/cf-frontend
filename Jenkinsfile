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
                }
            }
        }

        stage('Prepare .env') {
            steps {
                script {
                    echo "📄 Creating .env file..."
                    writeFile file: '.env', text: """
                        NEXT_PUBLIC_APP_BACKEND_URL=${env.NEXT_PUBLIC_APP_BACKEND_URL}
                        NEXT_PUBLIC_AI_BACKEND_URL=${env.NEXT_PUBLIC_AI_BACKEND_URL}
                    """
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                sh "docker build -t ${IMAGE_TAG} ."
            }
        }

        stage('Deploy New Container') {
            steps {
                script {
                    echo "🧱 Deploying new container..."
                    // Remove any old "new" container
                    sh "docker rm -f ${APP_NAME}-new || true"

                    // Run new container without exposing host port yet (internal port 3000)
                    sh """
                        docker run -d \
                        --name ${APP_NAME}-new \
                        --network ${NETWORK} \
                        ${IMAGE_TAG}
                    """
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    echo "🩺 Performing health check on new container..."
                    def retries = 5
                    def success = false

                    for (int i = 0; i < retries; i++) {
                        // Use docker exec to curl internal port
                        def status = sh(
                            script: "docker exec ${APP_NAME}-new curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health || echo '000'",
                            returnStdout: true
                        ).trim()

                        echo "Health check attempt ${i + 1}: HTTP ${status}"

                        if (status == "200") {
                            success = true
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
                    echo "🔄 Switching host port 3000 to new container..."

                    // Remove old live container (host port 3000)
                    sh "docker rm -f ${APP_NAME}-live || true"

                    // Start new container on host port 3000
                    sh """
                        docker stop ${APP_NAME}-new
                        docker rm ${APP_NAME}-new
                        docker run -d \
                        --name ${APP_NAME}-live \
                        --network ${NETWORK} \
                        -p ${HOST_PORT}:3000 \
                        ${IMAGE_TAG}
                    """
                    echo "✅ Traffic switched: host port 3000 points to new live container"
                }
            }
        }

        stage('Cleanup') {
            steps {
                sh "docker image prune -f"
            }
        }
    }

    post {
        failure {
            echo "❌ Deployment failed. Old live container remains on host port 3000"
        }
    }
}
