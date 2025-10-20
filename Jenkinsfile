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
                    // Determine active color by checking which container is running
                    def activeContainer = sh(
                        script: "docker ps --format '{{.Names}}' | grep frontend-blue || true",
                        returnStdout: true
                    ).trim()

                    def newVersion = (activeContainer == "frontend-blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    echo "🧱 Deploying new ${newVersion} container on port ${newPort}"

                    // Remove existing container if exists
                    sh "docker rm -f frontend-${newVersion} || true"

                    // Run new container
                    sh """
                        docker run -d \
                        --name frontend-${newVersion} \
                        --network ${NETWORK} \
                        -p ${newPort}:3000 \
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

                    def active = sh(
                        script: "docker ps --format '{{.Names}}' | grep frontend-blue || true",
                        returnStdout: true
                    ).trim()

                    def newVersion = (active == "frontend-blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    echo "⏳ Waiting for container startup..."
                    sleep 5

                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: "curl -s -o /dev/null -w '%{http_code}' http://localhost:${newPort}/api/health || echo '000'",
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
                        sh "docker rm -f frontend-${newVersion} || true"
                        error "❌ Deployment failed: new container did not respond correctly"
                    }
                }
            }
        }

        stage('Cleanup Old Container') {
            steps {
                script {
                    def active = sh(
                        script: "docker ps --format '{{.Names}}' | grep frontend-blue || true",
                        returnStdout: true
                    ).trim()
                    def oldVersion = (active == "frontend-blue") ? "green" : "blue"
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
