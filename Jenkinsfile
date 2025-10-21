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
        NGINX_IMAGE = "nginx:1.27-alpine"
        CURL_IMAGE = "alpine/curl:latest"
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
                    def imageExists = sh(script: "docker images -q ${BASE_IMAGE} || true", returnStdout: true).trim()
                    if (!imageExists) {
                        echo "📦 Pulling Node base image..."
                        sh "docker pull ${BASE_IMAGE}"
                    } else {
                        echo "✅ Node base image already exists."
                    }
                }
            }
        }

        stage('Ensure Nginx Image') {
            steps {
                script {
                    def exists = sh(script: "docker images -q ${NGINX_IMAGE} || true", returnStdout: true).trim()
                    if (!exists) {
                        echo "📦 Pulling Nginx image..."
                        sh "docker pull ${NGINX_IMAGE}"
                    } else {
                        echo "✅ Nginx image already exists."
                    }
                }
            }
        }

        stage('Ensure Curl Image') {
            steps {
                script {
                    def exists = sh(script: "docker images -q ${CURL_IMAGE} || true", returnStdout: true).trim()
                    if (!exists) {
                        echo "📦 Pulling curl image..."
                        sh "docker pull ${CURL_IMAGE}"
                    } else {
                        echo "✅ Curl image already exists."
                    }
                }
            }
        }

        stage('Ensure Nginx Container') {
            steps {
                script {
                    def nginxExists = sh(script: "docker ps --format '{{.Names}}' | grep nginx-proxy || true", returnStdout: true).trim()
                    if (!nginxExists) {
                        echo "🚀 Starting Nginx proxy container..."
                        // Use Jenkins workspace folder for config instead of /etc/nginx/conf.d on host
                        sh """
                            mkdir -p ${env.WORKSPACE}/nginx_conf
                            docker run -d \
                                --name nginx-proxy \
                                --network ${NETWORK} \
                                -p 80:80 \
                                -v ${env.WORKSPACE}/nginx_conf:/etc/nginx/conf.d \
                                ${NGINX_IMAGE}
                        """
                    } else {
                        echo "✅ Nginx proxy container already running."
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
                    // Determine current active container
                    def activeContainer = sh(script: "docker ps --format '{{.Names}}' | grep frontend-blue || true", returnStdout: true).trim()

                    // Decide new version
                    def newVersion = (activeContainer == "frontend-blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    echo "🧱 Deploying new ${newVersion} container on port ${newPort}"

                    // Remove old container of same color if exists
                    sh "docker rm -f frontend-${newVersion} || true"

                    // Run new container
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
                    echo "🩺 Checking health of frontend-${env.NEW_VERSION}..."
                    
                    def retries = 10
                    def success = false

                    echo "⏳ Waiting for container startup..."
                    sleep 15

                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: """
                                docker run --rm --network ${NETWORK} ${CURL_IMAGE} \
                                -L -s -o /dev/null -w '%{http_code}' \
                                http://frontend-${env.NEW_VERSION}:3000/cf-frontend/api/health || echo '000'
                            """,
                            returnStdout: true
                        ).trim()

                        echo "Health check attempt ${i + 1}: HTTP ${status}"

                        if (status == "200" || status == "301" || status == "302" || status == "308") {
                            success = true
                            echo "✅ Health check passed! HTTP ${status}"
                            break
                        }
                        sleep 5
                    }

                    if (!success) {
                        echo "📋 Container logs:"
                        sh "docker logs frontend-${env.NEW_VERSION} | tail -30"
                        echo "🔍 Container status:"
                        sh "docker ps -a | grep frontend-${env.NEW_VERSION}"
                        sh "docker rm -f frontend-${env.NEW_VERSION} || true"
                        error "❌ Deployment failed: new container did not respond correctly"
                    }
                }
            }
        }

        stage('Switch Traffic') {
            steps {
                script {
                    def activeBackend = (env.NEW_VERSION == "blue") ? "frontend-blue:3000" : "frontend-green:3000"
                    echo "🔁 Switching Nginx to route traffic to ${activeBackend}..."

                    // Write active upstream inside Jenkins workspace (no sudo)
                    sh """
                        echo "server ${activeBackend};" > ${env.WORKSPACE}/nginx_conf/active_upstream.conf
                        docker exec nginx-proxy nginx -s reload
                    """

                    echo "✅ Nginx now routes all traffic to ${activeBackend}"
                }
            }
        }

        stage('Verify Traffic Switch') {
            steps {
                script {
                    echo "🌐 Verifying Nginx routing..."
                    def status = sh(
                        script: """
                            docker run --rm --network ${NETWORK} ${CURL_IMAGE} \
                            -s -o /dev/null -w '%{http_code}' \
                            http://nginx-proxy/cf-frontend/api/health
                        """,
                        returnStdout: true
                    ).trim()

                    if (status != "200") {
                        error "❌ Nginx verification failed (HTTP ${status})"
                    } else {
                        echo "✅ Verified Nginx routes correctly to ${env.NEW_VERSION}"
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
