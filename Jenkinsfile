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
                    def now = new Date().format("yyyy-MM-dd HH:mm:ss")
                    echo "✅ New commit received at ${now}"
                }
            }
        }

        stage('Docker Login') {
            steps {
                script {
                    echo "🔑 Logging in to Docker Hub..."
                    withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
                        sh """
                            echo \$DOCKERHUB_PASS | docker login -u \$DOCKERHUB_USER --password-stdin
                        """
                    }
                }
            }
        }

        stage('Ensure Base Image') {
            steps {
                script {
                    def imageExists = sh(
                        script: "docker images -q ${BASE_IMAGE} || true",
                        returnStdout: true
                    ).trim()

                    if (!imageExists) {
                        echo "📦 Pulling base image ${BASE_IMAGE}..."
                        sh "docker pull ${BASE_IMAGE}"
                    } else {
                        echo "✅ Base image ${BASE_IMAGE} already exists."
                    }
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    echo "🚀 Building Docker image ${IMAGE_TAG}..."
                    sh "docker build -t ${IMAGE_TAG} ."
                }
            }
        }

        stage('Deploy New Instance') {
            steps {
                script {
                    // Determine active color
                    def activeContainer = sh(
                        script: "docker ps --format '{{.Names}}' | grep frontend-blue || true",
                        returnStdout: true
                    ).trim()

                    // Decide new version and port
                    def newVersion = (activeContainer == "frontend-blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    echo "🧱 Deploying new ${newVersion} container on port ${newPort}"

                    // Remove old container if exists
                    sh "docker rm -f frontend-${newVersion} || true"

                    // Run new container
                    sh """
                        docker run -d \
                        --name frontend-${newVersion} \
                        --network ${NETWORK} \
                        -p ${newPort}:3000 \
                        ${IMAGE_TAG}
                    """

                    // Save for next stages
                    env.NEW_VERSION = newVersion
                    env.NEW_PORT = newPort.toString()
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    echo "🩺 Checking health of new instance on port ${env.NEW_PORT}..."
                    
                    // Check if container is running
                    sh "docker ps | grep frontend-${env.NEW_VERSION}"
                    
                    // Check container logs
                    echo "📋 Container logs:"
                    sh "docker logs frontend-${env.NEW_VERSION} | tail -20"
                    
                    def retries = 6
                    def success = false

                    echo "⏳ Waiting for container startup..."
                    sleep 15

                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: "curl -v http://localhost:${env.NEW_PORT}/api/health 2>&1 | grep '< HTTP' | awk '{print \$3}' || echo '000'",
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
                        echo "📋 Final container logs before cleanup:"
                        sh "docker logs frontend-${env.NEW_VERSION}"
                        sh "docker rm -f frontend-${env.NEW_VERSION} || true"
                        error "❌ Deployment failed: new container did not respond correctly"
                    }
                }
            }
        }

        stage('Cleanup Old Container') {
            steps {
                script {
                    def oldVersion = (env.NEW_VERSION == "blue") ? "green" : "blue"
                    echo "🧹 Cleaning up old container: frontend-${oldVersion}"
                    sh "docker rm -f frontend-${oldVersion} || true"
                }
            }
        }
    }


    post {
        success {
            echo "✅ Deployment completed successfully."
        }
        failure {
            echo "❌ Deployment failed. Check Jenkins logs for details."
        }
    }
}
