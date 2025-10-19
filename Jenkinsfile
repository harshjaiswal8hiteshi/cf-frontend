pipeline {
    agent any
    triggers {
        githubPush()
    }
    stages {
        stage('Log Commit') {
            steps {
                script {
                    def now = new Date().format("yyyy-MM-dd HH:mm:ss")
                    echo "✅ New commit received from GitHub at ${now}"
                    sh 'echo "✅ Commit received at ${now}" >> /var/jenkins_home/github_commit_log.txt'
                }
            }
        }
    }
}
