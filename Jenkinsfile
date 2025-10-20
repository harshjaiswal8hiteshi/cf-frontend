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
                    echo "✅ New commit received from GitHub at ${now}"
                    sh "echo '✅ Commit received at ${now}' >> /var/jenkins_home/github_commit_log.txt"
                }
            }
        }

        stage('Ensure Base Image') {
            steps {
                script {
                    echo "📦 Checking if base image ${BASE_IMAGE} exists locally..."
                    def imageExists = sh(
                        script: "docker images -q ${BASE_IMAGE} || true",
                        returnStdout: true
                    ).trim()

                    if (!imageExists) {
                        echo "🛠 Base image missing, pulling ${BASE_IMAGE} anonymously..."
                        sh "docker pull ${BASE_IMAGE}"
                    } else {
                        echo "✅ Base image already cached locally, no need to pull."
                    }
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
                    def active = sh(
                        script: "grep -q '127.0.0.1:${BLUE_PORT}' /etc/nginx/sites-available/cf-frontend && echo blue || echo green",
                        returnStdout: true
                    ).trim()

                    def newVersion = (active == "blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    echo "🧱 Deploying new ${newVersion} container on host port ${newPort}"
                    sh "docker rm -f frontend-${newVersion} || true"

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
                        script: "grep -q '127.0.0.1:${BLUE_PORT}' /etc/nginx/sites-available/cf-frontend && echo blue || echo green",
                        returnStdout: true
                    ).trim()
                    def newVersion = (active == "blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: "curl -s -o /dev/null -w \"%{http_code}\" http://localhost:${newPort}/api/health || echo '000'",
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

        stage('Switch Traffic via Nginx') {
            steps {
                script {
                    echo "🔄 Switching traffic via Nginx..."

                    def active = sh(
                        script: "grep -q '127.0.0.1:${BLUE_PORT}' /etc/nginx/sites-available/cf-frontend && echo blue || echo green",
                        returnStdout: true
                    ).trim()

                    def newVersion = (active == "blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    echo "Current live: ${active}, switching to: ${newVersion}"

                    sh """
                        sudo sed -i "s|127.0.0.1:300[0-1]|127.0.0.1:${newPort}|" /etc/nginx/sites-available/cf-frontend
                        sudo systemctl reload nginx
                    """

                    echo "✅ Traffic switched to frontend-${newVersion} via /cf-frontend"
                }
            }
        }

        stage('Cleanup') {
            steps {
                script {
                    def oldVersion = (active == "blue") ? "blue" : "green"
                    echo "🧹 Removing old container: frontend-${oldVersion}"
                    sh "docker rm -f frontend-${oldVersion} || true"
                }
            }
        }
    }
}
