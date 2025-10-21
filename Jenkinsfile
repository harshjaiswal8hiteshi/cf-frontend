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

        stage('Setup Nginx Config') {
            steps {
                script {
                    echo "📝 Setting up Nginx configuration directory..."
                    sh """
                        mkdir -p ${env.WORKSPACE}/nginx_conf
                        
                        # Create the template if it doesn't exist
                        cat > ${env.WORKSPACE}/nginx_conf/active_upstream.conf.template << 'EOF'
upstream frontend {
    server __FRONTEND_CONTAINER__:3000;
}

server {
    listen 80;

    # Redirect /cf-frontend → /cf-frontend/
    location = /cf-frontend {
        return 301 /cf-frontend/;
    }

    location /cf-frontend/ {
        proxy_pass http://frontend/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF
                        
                        # Create initial config pointing to blue
                        cp ${env.WORKSPACE}/nginx_conf/active_upstream.conf.template \
                           ${env.WORKSPACE}/nginx_conf/active_upstream.conf
                        
                        sed -i 's|__FRONTEND_CONTAINER__|frontend-blue|g' \
                            ${env.WORKSPACE}/nginx_conf/active_upstream.conf
                        
                        echo "📋 Initial Nginx config created"
                        cat ${env.WORKSPACE}/nginx_conf/active_upstream.conf
                    """
                }
            }
        }

        stage('Ensure Nginx Container') {
            steps {
                script {
                    def nginxExists = sh(script: "docker ps -q -f name=nginx-proxy || true", returnStdout: true).trim()
                    if (!nginxExists) {
                        echo "🚀 Starting Nginx proxy container..."
                        sh """
                            docker run -d \
                                --name nginx-proxy \
                                --network ${NETWORK} \
                                -p 80:80 \
                                -v ${env.WORKSPACE}/nginx_conf:/etc/nginx/conf.d \
                                ${NGINX_IMAGE}
                            
                            # Wait for nginx to start
                            sleep 3
                            
                            # Verify nginx started
                            docker ps | grep nginx-proxy
                            docker exec nginx-proxy nginx -t
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
                    def blueRunning = sh(script: "docker ps -q -f name=frontend-blue || true", returnStdout: true).trim()
                    def greenRunning = sh(script: "docker ps -q -f name=frontend-green || true", returnStdout: true).trim()

                    // Decide new version (deploy to the one not running, or green if both/neither running)
                    def newVersion = blueRunning ? "green" : "blue"
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
                    
                    def retries = 12
                    def success = false

                    echo "⏳ Waiting for container startup..."
                    sleep 10

                    for (int i = 0; i < retries; i++) {
                        def status = sh(
                            script: """
                                docker run --rm --network ${NETWORK} ${CURL_IMAGE} \
                                -L -s -o /dev/null -w '%{http_code}' \
                                http://frontend-${env.NEW_VERSION}:3000/cf-frontend/api/health/ || echo '000'
                            """,
                            returnStdout: true
                        ).trim()

                        echo "Health check attempt ${i + 1}/${retries}: HTTP ${status}"

                        if (status == "200" || status == "301" || status == "302") {
                            success = true
                            echo "✅ Health check passed! HTTP ${status}"
                            break
                        }
                        sleep 5
                    }

                    if (!success) {
                        echo "📋 Container logs:"
                        sh "docker logs frontend-${env.NEW_VERSION} | tail -50"
                        echo "🔍 Container status:"
                        sh "docker ps -a | grep frontend-${env.NEW_VERSION}"
                        echo "🔍 Network info:"
                        sh "docker network inspect ${NETWORK} | grep frontend-${env.NEW_VERSION} || true"
                        sh "docker rm -f frontend-${env.NEW_VERSION} || true"
                        error "❌ Deployment failed: new container did not respond correctly"
                    }
                }
            }
        }

        stage('Switch Traffic') {
            steps {
                script {
                    def activeBackend = "frontend-${env.NEW_VERSION}"
                    echo "🔁 Switching Nginx to route traffic to ${activeBackend}..."

                    sh """
                        echo "🔍 Current nginx config:"
                        cat ${env.WORKSPACE}/nginx_conf/active_upstream.conf
                        
                        # Create new config from template
                        cp ${env.WORKSPACE}/nginx_conf/active_upstream.conf.template \
                           ${env.WORKSPACE}/nginx_conf/active_upstream.conf
                        
                        # Replace placeholder
                        sed -i "s|__FRONTEND_CONTAINER__|${activeBackend}|g" \
                            ${env.WORKSPACE}/nginx_conf/active_upstream.conf
                        
                        echo "🔍 New nginx config:"
                        cat ${env.WORKSPACE}/nginx_conf/active_upstream.conf
                        
                        # Test nginx config
                        docker exec nginx-proxy nginx -t
                        
                        # Reload nginx
                        docker exec nginx-proxy nginx -s reload
                        
                        # Wait for reload
                        sleep 2
                    """

                    echo "✅ Nginx now routes all traffic to ${activeBackend}"
                }
            }
        }

        stage('Verify Traffic Switch') {
            steps {
                script {
                    echo "🌐 Verifying Nginx routing through port 80..."

                    def retries = 5
                    def success = false

                    for (int i = 0; i < retries; i++) {
                        // Test from within nginx container
                        def httpCode = sh(
                            script: """
                                docker exec nginx-proxy \
                                curl -s -o /dev/null -w '%{http_code}' \
                                http://localhost/cf-frontend/api/health/
                            """,
                            returnStdout: true
                        ).trim()

                        echo "💡 Verification attempt ${i + 1}/${retries}: HTTP ${httpCode}"

                        if (httpCode == "200") {
                            success = true
                            echo "✅ Verified Nginx routes correctly to frontend-${env.NEW_VERSION}"
                            break
                        }
                        sleep 3
                    }

                    if (!success) {
                        echo "⚠️ Verification warning: Nginx might not be routing correctly"
                        echo "📋 Nginx error logs:"
                        sh "docker exec nginx-proxy cat /var/log/nginx/error.log | tail -20 || true"
                        echo "📋 Checking upstream health directly:"
                        sh """
                            docker exec nginx-proxy \
                            curl -I http://frontend-${env.NEW_VERSION}:3000/cf-frontend/api/health/
                        """
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
            echo "🌐 Service accessible at: http://localhost/cf-frontend/"
        }
        failure {
            echo "❌ Deployment failed. Check Jenkins logs for details."
            script {
                sh """
                    echo "📋 All running containers:"
                    docker ps -a | grep frontend || true
                    echo "📋 Nginx config:"
                    cat ${env.WORKSPACE}/nginx_conf/active_upstream.conf || true
                """
            }
        }
    }
}