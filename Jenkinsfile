pipeline {
    agent any
    triggers {
        githubPush()
    }

    environment {
        APP_NAME   = "frontend"
        IMAGE_TAG  = "ecosystem-frontend:latest"
        NETWORK    = "ecosystem_default"
        BLUE_PORT  = 3000
        GREEN_PORT = 3001
        BASE_IMAGE = "node:18-alpine"
    }

    stages {
        stage('Log Commit') {
            steps {
                script {
                    echo "✅ New commit received at ${new Date().format('yyyy-MM-dd HH:mm:ss')}"
                }
            }
        }

        stage('Docker Login') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
                        sh "echo \$DOCKERHUB_PASS | docker login -u \$DOCKERHUB_USER --password-stdin"
                    }
                }
            }
        }

        stage('Ensure Base Image') {
            steps {
                script {
                    def imageExists = sh(script: "docker images -q ${BASE_IMAGE} || true", returnStdout: true).trim()
                    if (!imageExists) {
                        sh "docker pull ${BASE_IMAGE}"
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    sh "docker build -t ${IMAGE_TAG} ."
                }
            }
        }

        stage('Deploy New Instance') {
            steps {
                script {
                    // Determine active color
                    def activeContainer = sh(script: "docker ps --format '{{.Names}}' | grep frontend-blue || true", returnStdout: true).trim()
                    def newVersion = (activeContainer == "frontend-blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    echo "🧱 Deploying new ${newVersion} container on port ${newPort}"

                    // Remove any stale container of the new version
                    sh "docker rm -f frontend-${newVersion} || true"

                    // Run new container mapped to host port
                    sh """
                        docker run -d \
                        --name frontend-${newVersion} \
                        --network ${NETWORK} \
                        -p ${newPort}:3000 \
                        ${IMAGE_TAG}
                    """

                    env.NEW_VERSION = newVersion
                    env.NEW_PORT = newPort.toString()
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    echo "🩺 Checking health of new container frontend-${env.NEW_VERSION}..."
                    def retries = 20
                    def success = false

                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: "curl -s -o /dev/null -w '%{http_code}' http://localhost:${env.NEW_PORT}/cf-frontend/api/health || echo '000'",
                            returnStdout: true
                        ).trim()

                        echo "Health check attempt ${i + 1}: HTTP ${status}"

                        if (status == "200" || status == "301" || status == "302" || status == "308") {
                            success = true
                            echo "✅ Health check passed for frontend-${env.NEW_VERSION}!"
                            break
                        }
                        sleep 2
                    }

                    if (!success) {
                        sh "docker logs frontend-${env.NEW_VERSION} | tail -30"
                        sh "docker rm -f frontend-${env.NEW_VERSION} || true"
                        error "❌ Deployment failed: new container not healthy"
                    }
                }
            }
        }

        stage('Switch Traffic') {
            steps {
                script {
                    // Since Nginx points to both ports with load balancing,
                    // new container is already receiving traffic after health check.
                    // If you use Nginx reload, you can reload to ensure config consistency
                    sh "sudo nginx -s reload"
                    echo "🌐 Traffic switched to new container frontend-${env.NEW_VERSION}"
                }
            }
        }

        stage('Cleanup Old Container') {
            steps {
                script {
                    def oldVersion = (env.NEW_VERSION == "blue") ? "green" : "blue"
                    echo "🧹 Removing old container: frontend-${oldVersion}"
                    sh "docker rm -f frontend-${oldVersion} || true"
                }
            }
        }
    }

    post {
        success {
            echo "✅ Deployment completed successfully with zero downtime."
        }
        failure {
            echo "❌ Deployment failed. Check logs."
        }
    }
}
