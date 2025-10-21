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
                    echo "✅ New commit received at ${new Date().format("yyyy-MM-dd HH:mm:ss")}"
                }
            }
        }

        stage('Docker Login') {
            steps {
                script {
                    withCredentials([usernamePassword(credentialsId: 'dockerhub', usernameVariable: 'DOCKERHUB_USER', passwordVariable: 'DOCKERHUB_PASS')]) {
                        sh 'echo $DOCKERHUB_PASS | docker login -u $DOCKERHUB_USER --password-stdin'
                    }
                }
            }
        }

        stage('Ensure Base Images') {
            steps {
                script {
                    ['node:18-alpine', 'nginx:1.27-alpine', 'alpine/curl:latest'].each { img ->
                        def exists = sh(script: "docker images -q ${img} || true", returnStdout: true).trim()
                        if (!exists) { sh "docker pull ${img}" }
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
                        // Ensure nginx_conf exists
                        sh """
                            mkdir -p "\${WORKSPACE}/nginx_conf"

                            # Copy template to nginx_conf if not exists
                            if [ ! -f "\${WORKSPACE}/nginx_conf/active_upstream.conf" ]; then
                                cp "\${WORKSPACE}/deployment/nginx_conf/active_upstream.conf.template" \
                                   "\${WORKSPACE}/nginx_conf/active_upstream.conf"
                            fi

                            docker run -d --name nginx-proxy \
                                --network ${NETWORK} \
                                -p 80:80 \
                                -v "\${WORKSPACE}/nginx_conf:/etc/nginx/conf.d" \
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
                script { sh "docker build -t ${IMAGE_TAG} ." }
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
                    sh "docker run -d --name frontend-${newVersion} --network ${NETWORK} -p ${newPort}:3000 ${IMAGE_TAG}"

                    env.NEW_VERSION = newVersion
                    env.NEW_PORT = newPort.toString()
                }
            }
        }

        stage('Health Check') {
            steps {
                script {
                    echo "🩺 Checking health of frontend-${env.NEW_VERSION}..."
                    sleep 15
                    def success = false
                    for (int i = 0; i < 10; i++) {
                        def status = sh(script: "docker run --rm --network ${NETWORK} ${CURL_IMAGE} -s -o /dev/null -w '%{http_code}' http://frontend-${env.NEW_VERSION}:3000/cf-frontend/api/health || echo '000'", returnStdout: true).trim()
                        echo "Health check attempt ${i+1}: HTTP ${status}"
                        if (['200','301','302','308'].contains(status)) { success = true; break }
                        sleep 5
                    }
                    if (!success) { error "❌ Health check failed for frontend-${env.NEW_VERSION}" }
                }
            }
        }

        stage('Switch Traffic') {
            steps {
                script {
                    def activeBackend = (env.NEW_VERSION == "blue") ? "frontend-blue" : "frontend-green"
                    echo "🔁 Switching Nginx to route traffic to ${activeBackend}"

                    sh """
                        cp "\${WORKSPACE}/deployment/nginx_conf/active_upstream.conf.template" \
                           "\${WORKSPACE}/nginx_conf/active_upstream.conf"

                        sed -i "s|__FRONTEND_CONTAINER__|${activeBackend}|g" "\${WORKSPACE}/nginx_conf/active_upstream.conf"

                        docker exec nginx-proxy nginx -t
                        docker exec nginx-proxy nginx -s reload
                    """
                }
            }
        }

        stage('Verify Nginx Config File') {
            steps {
                script {
                    def confFile = "${WORKSPACE}/nginx_conf/active_upstream.conf"
                    echo "🔍 Checking if Nginx config exists: ${confFile}"
                    def exists = sh(script: "[ -f \"${confFile}\" ] && echo 'yes' || echo 'no'", returnStdout: true).trim()
                    if (exists != 'yes') { error "❌ Nginx config file not found: ${confFile}" }
                    else { echo "✅ Nginx config file exists." }
                }
            }
        }

        stage('Verify Traffic Switch') {
            steps {
                script {
                    echo "🌐 Verifying Nginx routing..."
                    def httpCode = sh(script: "docker exec nginx-proxy curl -s -o /dev/null -w '%{http_code}' http://frontend-${env.NEW_VERSION}:3000/cf-frontend/api/health/", returnStdout: true).trim()
                    echo "💡 HTTP status code: ${httpCode}"
                    if (httpCode != '200') { error "❌ Nginx routing verification failed" }
                    else { echo "✅ Verified Nginx routes correctly to frontend-${env.NEW_VERSION}" }
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
        success { echo "✅ Deployment completed successfully." }
        failure { echo "❌ Deployment failed. Check Jenkins logs for details." }
    }
}
