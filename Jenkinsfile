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
                    def images = ['node:18-alpine', 'nginx:1.27-alpine', 'alpine/curl:latest']
                    images.each { img ->
                        def exists = sh(script: "docker images -q ${img} || true", returnStdout: true).trim()
                        if (!exists) {
                            sh "docker pull ${img}"
                        }
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
                    // Determine active and new version
                    def activeContainer = sh(script: "docker ps --format '{{.Names}}' | grep frontend-blue || true", returnStdout: true).trim()
                    def newVersion = (activeContainer == "frontend-blue") ? "green" : "blue"
                    def newPort = (newVersion == "blue") ? BLUE_PORT : GREEN_PORT

                    echo "🧱 Deploying new ${newVersion} container on port ${newPort}"

                    // Run new container
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
                        def status = sh(
                            script: "docker run --rm --network ${NETWORK} ${CURL_IMAGE} -s -o /dev/null -w '%{http_code}' http://frontend-${env.NEW_VERSION}:3000/cf-frontend/api/health || echo '000'",
                            returnStdout: true
                        ).trim()
                        echo "Health check attempt ${i+1}: HTTP ${status}"
                        if (['200','301','302','308'].contains(status)) {
                            success = true
                            break
                        }
                        sleep 5
                    }
                    if (!success) {
                        error "❌ Health check failed for frontend-${env.NEW_VERSION}"
                    }
                }
            }
        }

        stage('Switch Nginx Upstream') {
            steps {
                script {
                echo "🔁 Switching Nginx upstream to frontend-${env.NEW_VERSION}"

                // capture current upstream to allow rollback
                def currentUpstream = sh(script: "docker exec nginx sh -c \"grep -Eo 'server[[:space:]]+[^[:space:]]+:3000' /etc/nginx/conf.d/cf-frontend.conf | head -n1 | awk '{print \$2}' || echo 'unknown'\"",
                                        returnStdout: true).trim()
                echo "Current upstream (before switch): ${currentUpstream}"

                // run toggle inside nginx container
                def toggleExit = sh(script: "docker exec nginx /usr/local/bin/toggle-cf-frontend.sh ${env.NEW_VERSION}", returnStatus: true)
                if (toggleExit != 0) {
                    error "❌ Toggle script failed (exit ${toggleExit}). Aborting deploy."
                }

                // give nginx a moment
                sleep 2
                }
            }
        }

        stage('Verify Switch & Cleanup') {
            steps {
                script {
                def verifySuccess = false

                // verify Nginx routes to new backend by curling nginx from the same docker network
                for (int i = 0; i < 8; i++) {
                    def code = sh(script: "docker run --rm --network ${NETWORK} ${CURL_IMAGE} -s -o /dev/null -w '%{http_code}' http://nginx/cf-frontend/api/health || echo '000'",
                                returnStdout: true).trim()
                    echo "Post-switch verify attempt ${i+1}: HTTP ${code}"
                    if (code == '200' || code == '301' || code == '302' || code == '308') { verifySuccess = true; break }
                    sleep 3
                }

                if (!verifySuccess) {
                    // rollback to previous upstream
                    echo "❌ Verification failed. Rolling back to previous upstream..."
                    // derive previous name from env.NEW_VERSION
                    def prev = (env.NEW_VERSION == 'blue') ? 'green' : 'blue'
                    def rbExit = sh(script: "docker exec nginx /usr/local/bin/toggle-cf-frontend.sh ${prev}", returnStatus: true)
                    if (rbExit != 0) {
                    echo "⚠️ Rollback toggle failed (exit ${rbExit}) — manual intervention required"
                    }
                    error "Deployment verification failed after switch; rollback attempted."
                }

                // verification succeeded: remove old container
                def oldVersion = (env.NEW_VERSION == 'blue') ? 'green' : 'blue'
                echo "✅ Verified. Removing old container: frontend-${oldVersion}"
                sh "docker rm -f frontend-${oldVersion} || true"
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
            echo "✅ Deployment completed successfully."
        }
        failure {
            echo "❌ Deployment failed. Check Jenkins logs for details."
        }
    }
}
