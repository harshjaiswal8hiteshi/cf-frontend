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
                    echo "🕒 Time taken for 'Log Commit': ${(System.currentTimeMillis() - start)/1000}s"
                }
            }
        }

        stage('Docker Login') {
            steps {
                script {
                    def start = System.currentTimeMillis()
                    echo "🔑 Logging in to Docker Hub..."
                    withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
                        sh "echo \$DOCKERHUB_PASS | docker login -u \$DOCKERHUB_USER --password-stdin"
                    }
                    echo "🕒 Time taken for 'Docker Login': ${(System.currentTimeMillis() - start)/1000}s"
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
                    echo "🕒 Time taken for 'Ensure Base Image': ${(System.currentTimeMillis() - start)/1000}s"
                }
            }
        }

        stage('Build Docker Image') {
            steps {
                script {
                    def start = System.currentTimeMillis()
                    echo "🚀 Building Docker image..."
                    sh "docker build -t ${IMAGE_TAG} ."
                    echo "🕒 Time taken for 'Build Docker Image': ${(System.currentTimeMillis() - start)/1000}s"
                }
            }
        }

        stage('Deploy New Instance') {
            steps {
                script {
                    def start = System.currentTimeMillis()

                    // Determine which version is active; handle first run
                    def active = sh(
                        script: "test -f /etc/nginx/sites-available/cf-frontend && grep -q '127.0.0.1:${BLUE_PORT}' /etc/nginx/sites-available/cf-frontend && echo blue || echo green || echo none",
                        returnStdout: true
                    ).trim()

                    if (active == "") active = "none"

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

                    echo "🕒 Time taken for 'Deploy New Instance': ${(System.currentTimeMillis() - start)/1000}s"
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    def start = System.currentTimeMillis()
                    echo "🩺 Checking health of new instance..."

                    def retries = 6
                    def success = false

                    def active = sh(
                        script: "test -f /etc/nginx/sites-available/cf-frontend && grep -q '127.0.0.1:3000' /etc/nginx/sites-available/cf-frontend && echo blue || echo green || echo none",
                        returnStdout: true
                    ).trim()
                    if (active == "") active = "none"

                    def newVersion = (active == "blue") ? "green" : "blue"

                    echo "⏳ Waiting for container startup..."
                    sleep 5

                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: "docker exec frontend-${newVersion} sh -c \"apk add --no-cache curl >/dev/null 2>&1 || true; curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/health || echo 000\"",
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

                    echo "🕒 Time taken for 'Health Check': ${(System.currentTimeMillis() - start)/1000}s"
                }
            }
        }


        stage('Switch Traffic via Nginx') {
            steps {
                script {
                    echo "🔄 Switching traffic via Nginx..."
                    def start = System.currentTimeMillis()

                    def active = sh(
                        script: "test -f /etc/nginx/sites-available/cf-frontend && grep -q '127.0.0.1:3000' /etc/nginx/sites-available/cf-frontend && echo blue || echo green || echo none",
                        returnStdout: true
                    ).trim()
                    if (active == "") active = "none"

                    def newVersion = (active == "blue") ? "green" : "blue"

                    echo "Current live: ${active}, switching to: ${newVersion}"

                    // ✅ No sudo — Jenkins runs as root
                    sh """
                        mkdir -p /etc/nginx/sites-available
                        echo 'server {
                            listen 80;
                            location / {
                                proxy_pass http://127.0.0.1:3000;
                                proxy_set_header Host \$host;
                                proxy_set_header X-Real-IP \$remote_addr;
                            }
                        }' > /etc/nginx/sites-available/cf-frontend

                        nginx -t
                        nginx -s reload
                    """

                    echo "🕒 Time taken for 'Switch Traffic via Nginx': ${(System.currentTimeMillis() - start)/1000}s"
                }
            }
        }


        stage('Cleanup') {
            steps {
                script {
                    def start = System.currentTimeMillis()

                    def active = sh(
                        script: "test -f /etc/nginx/sites-available/cf-frontend && grep -q '127.0.0.1:${BLUE_PORT}' /etc/nginx/sites-available/cf-frontend && echo blue || echo green || echo none",
                        returnStdout: true
                    ).trim()

                    def oldVersion = (active == "blue") ? "green" : "blue"

                    echo "🧹 Removing old container: frontend-${oldVersion}"
                    sh "docker rm -f frontend-${oldVersion} || true"

                    echo "🕒 Time taken for 'Cleanup': ${(System.currentTimeMillis() - start)/1000}s"
                }
            }
        }
    }
}
