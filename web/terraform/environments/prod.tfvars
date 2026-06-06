# ============================================================================
# environments/prod.tfvars — canonical PRODUCTION variable values.
#   terraform apply -var-file=environments/prod.tfvars
# No secrets here: GITHUB_OAUTH_CLIENT_SECRET lives in Secret Manager (added
# out-of-band); NEXT_PUBLIC_* values are build args supplied by CI.
# ============================================================================

project_id         = "blackathon"
region             = "asia-northeast1"
firestore_location = "asia-northeast1"

service_name     = "zakuzaku-web"
artifact_repo_id = "web"
image_name       = "zakuzaku-web"

# First apply uses the placeholder; CI deploys real images afterwards.
container_image = "us-docker.pkg.dev/cloudrun/container/hello"

github_owner = "a-company-jp"
github_repo  = "oh-my-blackthunder"

min_instances = 0
max_instances = 3
cpu           = "1"
memory        = "512Mi"
concurrency   = 80

# Public client id of the GitHub OAuth App. Safe to commit (it is not a secret).
github_oauth_client_id = ""
