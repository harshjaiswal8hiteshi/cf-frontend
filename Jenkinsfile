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
                timeout(time: 10, unit: 'MINUTES') {
                    echo "🚀 Building Docker image..."
                    sh """
                        docker build \
                            --network=host \
                            --progress=plain \
                            --no-cache \
                            -t ${IMAGE_TAG} .
                    """
                }
            }
        }

        stage('Deploy New Instance for Health Check') {
            steps {
                script {
                    echo "🧱 Running new container for health check..."
                    // Remove any temp container
                    sh "docker rm -f ${APP_NAME}-temp || true"

                    // Run container on the same Docker network (no port mapping needed for internal access)
                    sh "docker run -d --name ${APP_NAME}-temp --network ${NETWORK} ${IMAGE_TAG}"

                    echo "🧪 Temp container running, accessible via Docker network at ${APP_NAME}-temp:3000"
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    echo "🩺 Checking health of new instance..."
                    def retries = 10
                    def success = false

                    // Wait a bit for container to start
                    sleep 3

                    for (int i = 0; i < retries; i++) {
                        // Access container directly via Docker network DNS
                        def status = sh(
                            script: "curl -s -o /dev/null -w '%{http_code}' http://${APP_NAME}-temp:3000/api/health || echo '000'",
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
                        echo "❌ Health check failed. Checking container logs..."
                        sh "docker logs ${APP_NAME}-temp || true"
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
                    
                    // Stop and remove temp container
                    sh "docker stop ${APP_NAME}-temp || true"
                    sh "docker rm ${APP_NAME}-temp || true"
                    
                    // Stop old live container if exists
                    sh "docker stop ${APP_NAME}-live || true"
                    sh "docker rm ${APP_NAME}-live || true"

                    // Start new container on fixed HOST_PORT (3000)
                    sh "docker run -d --name ${APP_NAME}-live --network ${NETWORK} -p ${HOST_PORT}:3000 ${IMAGE_TAG}"
                    
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
            echo "❌ Deployment failed. Cleaning up..."
            sh "docker rm -f ${APP_NAME}-temp || true"
            echo "Live container remains running if any."
        }
        success {
            echo "🎉 Deployment successful!"
        }
    }
}