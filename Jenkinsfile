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
                    def start = System.currentTimeMillis()
                    def now = new Date().format("yyyy-MM-dd HH:mm:ss")
                    echo "✅ New commit received from GitHub at ${now}"
                    sh "echo '✅ Commit received at ${now}' >> /var/jenkins_home/github_commit_log.txt"
                    def duration = (System.currentTimeMillis() - start) / 1000
                    echo "🕒 Time taken for 'Log Commit': ${duration}s"
                }
            }
        }

        stage('Docker Login') {
            steps {
                script {
                    def start = System.currentTimeMillis()
                    echo "🔑 Logging in to Docker Hub..."
                    withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
                        sh """
                            echo \$DOCKERHUB_PASS | docker login -u \$DOCKERHUB_USER --password-stdin
                        """
                    }
                    def duration = (System.currentTimeMillis() - start) / 1000
                    echo "🕒 Time taken for 'Docker Login': ${duration}s"
                }
            }
        }

        stage('Ensure Base Image') {
            steps {
                script {
                    def start = System.currentTimeMillis()
                    echo "📦 Checking if base image ${BASE_IMAGE} exists locally..."
                    def imageExists = sh(script: "docker images -q ${BASE_IMAGE} || true", returnStdout: true).trim()
                    if (!imageExists) {
                        echo "🛠 Base image missing, pulling ${BASE_IMAGE}..."
                        sh "docker pull ${BASE_IMAGE}"
                    } else {
                        echo "✅ Base image already cached locally."
                    }
                    def duration = (System.currentTimeMillis() - start) / 1000
                    echo "🕒 Time taken for 'Ensure Base Image': ${duration}s"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    def start = System.currentTimeMillis()
                    echo "🚀 Building Docker image..."
                    sh "docker build -t ${IMAGE_TAG} ."
                    def duration = (System.currentTimeMillis() - start) / 1000
                    echo "🕒 Time taken for 'Build Docker Image': ${duration}s"
                }
            }
        }

        stage('Deploy New Instance') {
            steps {
                script {
                    def start = System.currentTimeMillis()

                    // Determine which version is active
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

                    def duration = (System.currentTimeMillis() - start) / 1000
                    echo "🕒 Time taken for 'Deploy New Instance': ${duration}s"
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    def start = System.currentTimeMillis()
                    echo "🩺 Checking health of new instance..."

                    def retries = 5
                    def success = false

                    def active = sh(
                        script: "grep -q '127.0.0.1:${BLUE_PORT}' /etc/nginx/sites-available/cf-frontend && echo blue || echo green",
                        returnStdout: true
                    ).trim()
                    def newVersion = (active == "blue") ? "green" : "blue"
                    def containerName = "frontend-${newVersion}"

                    // Wait briefly for app startup
                    sleep 5

                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: "docker exec ${containerName} sh -c 'curl -s -o /dev/null -w \"%{http_code}\" http://localhost:3000/api/health || echo 000'",
                            returnStdout: true
                        ).trim()

                        echo "Health check attempt ${i + 1}: HTTP ${status}"

                        if (status == "200") {
                            echo "✅ Health check passed!"
                            success = true
                            break
                        }
                        sleep 5
                    }

                    if (!success) {
                        sh "docker rm -f ${containerName} || true"
                        error "❌ Deployment failed: new container did not respond correctly"
                    }

                    def duration = (System.currentTimeMillis() - start) / 1000
                    echo "🕒 Time taken for 'Health Check': ${duration}s"
                }
            }
        }

        stage('Switch Traffic via Nginx') {
            steps {
                script {
                    def start = System.currentTimeMillis()
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

                    def duration = (System.currentTimeMillis() - start) / 1000
                    echo "🕒 Time taken for 'Switch Traffic via Nginx': ${duration}s"
                }
            }
        }

        stage('Cleanup') {
            steps {
                script {
                    def start = System.currentTimeMillis()

                    def active = sh(
                        script: "grep -q '127.0.0.1:${BLUE_PORT}' /etc/nginx/sites-available/cf-frontend && echo blue || echo green",
                        returnStdout: true
                    ).trim()
                    def oldVersion = (active == "blue") ? "green" : "blue"

                    echo "🧹 Removing old container: frontend-${oldVersion}"
                    sh "docker rm -f frontend-${oldVersion} || true"

                    def duration = (System.currentTimeMillis() - start) / 1000
                    echo "🕒 Time taken for 'Cleanup': ${duration}s"
                }
            }
        }
    }
}
