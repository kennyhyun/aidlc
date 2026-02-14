# Terraform Guidelines

## State Management

### GitLab Terraform State Storage (Required)

- **Always use GitLab HTTP backend** for state storage to share credentials and state across team
- Each project has its own Terraform state storage in GitLab
- Example: https://gitlab.com/a-group/online/awesome-app/-/terraform

**Why?**
- Local state = only the creator can access/manage resources
- GitLab state = team collaboration, state locking, credential sharing

### Backend Configuration

```hcl
terraform {
  backend "http" {
    address        = "${var.gitlab_url}/api/v4/projects/${PROJECT_ID}/terraform/state/${STATE_NAME}"
    lock_address   = "${var.gitlab_url}/api/v4/projects/${PROJECT_ID}/terraform/state/${STATE_NAME}/lock"
    unlock_address = "${var.gitlab_url}/api/v4/projects/${PROJECT_ID}/terraform/state/${STATE_NAME}/lock"
    username       = "gitlab-ci-token"
    password       = "${CI_JOB_TOKEN}"
    lock_method    = "POST"
    unlock_method  = "DELETE"
    retry_wait_min = 5
  }
}
```

## Credentials Management

### Use Random Password Generation (Recommended)

**Never hardcode credentials in variables.tf**. Use Terraform's `random_password` resource to generate and store credentials in state.

```hcl
# Generate random passwords
resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}

# Use in resources
resource "aws_db_instance" "main" {
  password = random_password.db_password.result
  # ...
}

# Output for reference (sensitive)
output "db_password" {
  value     = random_password.db_password.result
  sensitive = true
}
```

**Benefits:**
- ✅ No hardcoded secrets in code
- ✅ Automatically generated strong passwords
- ✅ Stored securely in GitLab state
- ✅ Team can access via `terraform output db_password`
- ✅ Consistent across team members

**Retrieve credentials:**
```bash
terraform output db_password
terraform output -json  # all outputs
```

### Password Rotation

#### Manual Rotation

```bash
# Force regenerate password
terraform taint random_password.db_password
terraform apply
```

#### Automated Rotation with K8s CronJob

For production environments, automate password rotation using K8s CronJob + GitLab Pipeline:

**1. K8s CronJob (triggers GitLab pipeline monthly)**

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: terraform-password-rotation
spec:
  schedule: "0 0 1 * *"  # Monthly
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: trigger
            image: curlimages/curl:latest
            env:
            - name: PIPELINE_TRIGGER_TOKEN
              valueFrom:
                secretKeyRef:
                  name: gitlab-credentials
                  key: trigger-token
            command:
            - sh
            - -c
            - |
              curl -X POST \
                "${var.gitlab_url}/api/v4/projects/${PROJECT_ID}/trigger/pipeline" \
                -F token=${PIPELINE_TRIGGER_TOKEN} \
                -F ref=main \
                -F "variables[ROTATE_PASSWORD]=true"
          restartPolicy: OnFailure
```

**2. GitLab Pipeline (.gitlab-ci.yml)**

```yaml
rotate_passwords:
  stage: maintenance
  only:
    variables:
      - $ROTATE_PASSWORD == "true"
  script:
    - cd terraform/envs/staging
    - terraform init
    - terraform taint random_password.db_password
    - terraform apply -auto-approve
    # Update K8s deployment with new password
    - NEW_PASSWORD=$(terraform output -raw db_password)
    - kubectl set env deployment/backend DB_PASSWORD=$NEW_PASSWORD
    - kubectl rollout restart deployment/backend
```

**Benefits:**
- ✅ Fully automated rotation
- ✅ No additional cost (uses existing K8s)
- ✅ GitLab state automatically updated
- ✅ Application auto-redeployed
- ✅ Audit trail in GitLab CI/CD logs

### Alternative: GitLab CI/CD Variables

For external secrets (API keys, tokens), use GitLab CI/CD variab
