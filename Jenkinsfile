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

                        // Ensure nginx_conf folder exists
                        sh """
                            mkdir -p "${env.WORKSPACE}/nginx_conf"

                            # Copy template from repo if exists
                            if [ -f "${env.WORKSPACE}/deployment/nginx_conf/active_upstream.conf.template" ]; then
                                cp "${env.WORKSPACE}/deployment/nginx_conf/active_upstream.conf.template" \
                                   "${env.WORKSPACE}/nginx_conf/active_upstream.conf"
                            fi

                            # Start Nginx container with proper mount
                            docker run -d \
                                --name nginx-proxy \
                                --network ${NETWORK} \
                                -p 80:80 \
                                -v "${env.WORKSPACE}/nginx_conf:/etc/nginx/conf.d" \
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
                    def activeContainer = sh(script: "docker ps --format '{{.Names}}' | grep frontend-blue || true", returnStdout: true).trim()
                    def newVersion = (activeContainer == "frontend-blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    echo "🧱 Deploying new ${newVersion} container on port ${newPort}"

                    sh "docker rm -f frontend-${newVersion} || true"

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

                        if (status in ["200","301","302","308"]) {
                            success = true
                            echo "✅ Health check passed! HTTP ${status}"
                            break
                        }
                        sleep 5
                    }

                    if (!success) {
                        sh "docker logs frontend-${env.NEW_VERSION} | tail -30"
                        sh "docker rm -f frontend-${env.NEW_VERSION} || true"
                        error "❌ Deployment failed: new container did not respond correctly"
                    }
                }
            }
        }

        stage('Switch Traffic') {
            steps {
                script {
                    def activeBackend = (env.NEW_VERSION == "blue") ? "frontend-blue" : "frontend-green"
                    echo "🔁 Switching Nginx to route traffic to ${activeBackend}..."

                    sh """
                        # Copy template to nginx_conf folder (mounted into container)
                        cp "${env.WORKSPACE}/deployment/nginx_conf/active_upstream.conf.template" \
                           "${env.WORKSPACE}/nginx_conf/active_upstream.conf"

                        # Replace placeholder with actual backend
                        sed -i "s|__FRONTEND_CONTAINER__|${activeBackend}|g" \
                            "${env.WORKSPACE}/nginx_conf/active_upstream.conf"

                        # Test Nginx config inside container
                        docker exec nginx-proxy nginx -t

                        # Reload Nginx
                        docker exec nginx-proxy nginx -s reload
                    """

                    echo "✅ Nginx now routes all traffic to ${activeBackend}"
                }
            }
        }

        stage('Verify Nginx Config File') {
            steps {
                script {
                    def confFile = "${env.WORKSPACE}/nginx_conf/active_upstream.conf"
                    echo "🔍 Checking if Nginx config exists: ${confFile}"

                    def exists = sh(
                        script: "[ -f \"${confFile}\" ] && echo 'yes' || echo 'no'",
                        returnStdout: true
                    ).trim()

                    if (exists != 'yes') {
                        error "❌ Nginx config file not found: ${confFile}. Deployment cannot proceed."
                    } else {
                        echo "✅ Nginx config file exists."
                    }
                }
            }
        }

        stage('Debug Nginx Network') {
            steps {
                script {
                    sh """
                        docker network inspect ${NETWORK}
                        docker exec nginx-proxy ping -c 4 frontend-blue || true
                        docker exec nginx-proxy curl -I http://frontend-blue:3000/cf-frontend/api/health || true
                    """
                }
            }
        }

        stage('Verify Traffic Switch') {
            steps {
                script {
                    def httpCode = sh(
                        script: """
                            docker exec nginx-proxy curl -s -o /dev/null -w '%{http_code}' \
                            http://frontend-${env.NEW_VERSION}:3000/cf-frontend/api/health/
                        """,
                        returnStdout: true
                    ).trim()

                    echo "💡 HTTP status code: ${httpCode}"

                    if (httpCode != "200") {
                        error "❌ Nginx verification failed (HTTP ${httpCode})"
                    } else {
                        echo "✅ Verified Nginx routes correctly to frontend-${env.NEW_VERSION}"
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
